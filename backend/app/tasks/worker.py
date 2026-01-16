import asyncio
import time
import httpx
import json
import trafilatura
from datetime import datetime, timedelta
from dateutil import parser as date_parser
from celery import Celery
from sqlalchemy import select, and_
from simhash import Simhash
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
from pydantic import BaseModel, Field

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from ..core.config import settings
from ..core.async_database import AsyncSessionLocal
from ..models.models import News, User, SearchCache, AdminConfig, MarketTrend

# Initialize Celery
worker = Celery("tasks", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

# --- LangChain & Gemini Setup ---

class MetricDetail(BaseModel):
    name: str = Field(description="Name of the metric (e.g., 'Lithium Price', 'Market Share %')")
    value: float = Field(description="The numeric value extracted. Must be non-zero and realistic.")
    unit: str = Field(description="Unit of measurement (e.g., '$', '%', 'units')")
    company: str = Field(description="The brand or company name this metric belongs to (e.g., 'Tesla', 'Ford', 'Nvidia'). Use 'Market' if general.")
    data_type: str = Field(description="Must be either 'absolute' (for counts/prices) or 'ratio' (for percentages/shares)")

class NewsAnalysis(BaseModel):
    summary: str = Field(description="A concise 2-sentence summary in Vietnamese.")
    sentiment_score: float = Field(description="A float from 0 to 10 (0=Very Negative, 5=Neutral, 10=Very Positive).")
    impact_score: float = Field(description="A float from 0 to 10 based on business importance for the specific industry.")
    urgency: str = Field(description="Action urgency: 'High', 'Medium', or 'Low'.")
    risk_type: str = Field(description="Primary risk category: 'Policy', 'Competition', 'Supply Chain', 'Financial', or 'None'.")
    action_recommendation: str = Field(description="A short, actionable advice for a business manager.")
    published_date: Optional[str] = Field(description="The actual publication date if mentioned in the text (ISO format YYYY-MM-DD or similar).", default=None)
    extracted_metrics: List[MetricDetail] = Field(description="List of any specific prices, market percentages, or numeric business figures mentioned.", default_factory=list)

parser = PydanticOutputParser(pydantic_object=NewsAnalysis)

# Using model from settings to allow user control via .env
llm = ChatGoogleGenerativeAI(
    model=settings.GEMINI_MODEL,
    google_api_key=settings.GOOGLE_API_KEY,
    temperature=0.1
)

class NewsBatchAnalysis(BaseModel):
    analyses: List[NewsAnalysis] = Field(description="List of analysis results for each article, in the SAME ORDER as provided.")

batch_parser = PydanticOutputParser(pydantic_object=NewsBatchAnalysis)

batch_prompt_template = PromptTemplate(
    template="""Analyze the following {count} market news articles for the industry: {industry}.
    For each article, provide a professional analysis in Vietnamese.
    
    Articles:
    {contents}
    
    {format_instructions}
    """,
    input_variables=["contents", "industry", "count"],
    partial_variables={"format_instructions": batch_parser.get_format_instructions()}
)

batch_analysis_chain = batch_prompt_template | llm | batch_parser

# --- Worker Utilities ---

def run_async_task(coro):
    """Robust wrapper to run async code in sync Celery task, especially for Windows"""
    import sys
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    try:
        return asyncio.run(coro)
    except Exception as e:
        import traceback
        print(f"CELERY ASYNC ERROR: {e}")
        traceback.print_exc()
        return str(e)

@worker.task(name="crawl_intelligence_task")
def crawl_intelligence_task(force: bool = False):
    """Main entry point for periodic crawling"""
    print(f"CELERY: Received crawl_intelligence_task (force={force})")
    return run_async_task(process_all_keywords(force=force))

@worker.task(name="analyze_keyword_task", bind=True, max_retries=3)
def analyze_keyword_task(self, keyword: str, force: bool = False):
    """Celery task for a single keyword to allow retries"""
    try:
        return run_async_task(process_keyword_news_batch(keyword, force=force))
    except Exception as exc:
        # Retry logic for 429/503
        if "429" in str(exc) or "503" in str(exc) or "ResourceExhausted" in str(exc):
            # Exponential backoff: 10, 30, 60
            countdown = [10, 30, 60][min(self.request.retries, 2)]
            print(f"RETRY: Quota exceeded for {keyword}. Retrying in {countdown}s...")
            raise self.retry(exc=exc, countdown=countdown)
        raise exc

async def process_all_keywords(force: bool = False):
    """Main crawler loop"""
    async with AsyncSessionLocal() as db:
        stmt = select(AdminConfig).order_by(AdminConfig.id.desc()).limit(1)
        config = await db.scalar(stmt)
        
        keywords = config.search_keywords if config and config.search_keywords else ["EV market expansion"]
        
        for kw in keywords:
            print(f"CELERY: Dispatching analysis task for: {kw}")
            analyze_keyword_task.delay(kw, force=force)

async def fetch_market_news(keyword: str, time_range: str = "w") -> List[str]:
    """Fetch news URLs via Serper.dev (Google News)"""
    if not settings.SERPER_API_KEY:
        print("SERPER_API_KEY not configured")
        return []

    url = "https://google.serper.dev/news"
    # Include country (Vietnam) and language (Vietnamese) to prioritize local news
    payload = json.dumps({
        "q": keyword,
        "tbs": f"qdr:{time_range}",
        "gl": "vn",
        "hl": "vi"
    })
    headers = {
        'X-API-KEY': settings.SERPER_API_KEY,
        'Content-Type': 'application/json'
    }

    async with httpx.AsyncClient() as client:
        try:
            print(f"SERPER: Searching news for '{keyword}' (Vietnam priority)")
            response = await client.post(url, headers=headers, data=payload)
            response.raise_for_status()
            results = response.json()
            # Original links list
            all_links = [item['link'] for item in results.get('news', [])]
            # Prioritize .vn domains
            vn_links = [link for link in all_links if '.vn' in link]
            # Return up to 8 links, preferring Vietnamese sources
            links = (vn_links if vn_links else all_links)[:8]
            print(f"SERPER: Found {len(links)} links (Vietnam priority applied)")
            return links
        except Exception as e:
            print(f"SERPER: Error fetching from Serper: {e}")
            return []

async def get_cached_urls(db, keyword: str) -> Optional[List[str]]:
    """Check if we have recent search results for this keyword"""
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    stmt = select(SearchCache).where(
        and_(
            SearchCache.keyword == keyword,
            SearchCache.created_at >= one_hour_ago
        )
    ).order_by(SearchCache.created_at.desc())
    cache_entry = await db.scalar(stmt)
    return cache_entry.urls if cache_entry else None


async def process_keyword_news_batch(keyword: str, force: bool = False):
    """Process news for a keyword using batch analysis (5 articles/step)"""
    async with AsyncSessionLocal() as db:
        urls = None
        if not force:
            urls = await get_cached_urls(db, keyword)
        
        if urls is None:
            urls = await fetch_market_news(keyword)
            # Update cache logic...
            stmt = select(SearchCache).where(SearchCache.keyword == keyword).order_by(SearchCache.created_at.desc())
            cache_entry = await db.scalar(stmt)
            if cache_entry:
                cache_entry.urls = urls
                cache_entry.created_at = datetime.utcnow()
            else:
                db.add(SearchCache(keyword=keyword, urls=urls))
            await db.commit()

        # Step 1: Scrape and collect valid articles
        to_process = []
        for url in urls:
            stmt = select(News).where(News.url == url)
            existing = await db.scalar(stmt)
            if existing:
                continue

            downloaded = trafilatura.fetch_url(url)
            if downloaded:
                content = trafilatura.extract(downloaded, include_comments=False, include_tables=True)
                metadata = trafilatura.extract_metadata(downloaded)
                if content and len(content) > 300:
                    to_process.append({
                        "url": url, 
                        "content": content[:4000], 
                        "title": metadata.title,
                        "metadata_date": metadata.date
                    })
        
        if not to_process:
            return

        # Step 2: Batch Analysis (5 per group)
        BATCH_SIZE = 5
        for i in range(0, len(to_process), BATCH_SIZE):
            chunk = to_process[i:i+BATCH_SIZE]
            contents_text = "\n---\n".join([f"Article {idx+1}: {c['title']}\n{c['content']}" for idx, c in enumerate(chunk)])
            
            try:
                print(f"LLM: Batch analyzing {len(chunk)} articles for {keyword}")
                batch_res = await asyncio.wait_for(
                    batch_analysis_chain.ainvoke({
                        "contents": contents_text, 
                        "industry": keyword, 
                        "count": len(chunk)
                    }),
                    timeout=90.0
                )
                
                # Step 3: Iterate results and save
                for idx, analysis in enumerate(batch_res.analyses):
                    if idx >= len(chunk): break
                    art = chunk[idx]
                    
                    # Date extraction: prioritize article metadata, then analysis date, ensure UTC
                    pub_date = None
                    if art.get('metadata_date'):
                        try:
                            pub_date = date_parser.parse(art['metadata_date'])
                        except Exception:
                            pub_date = None
                    if not pub_date and getattr(analysis, 'published_date', None):
                        try:
                            pub_date = date_parser.parse(analysis.published_date)
                        except Exception:
                            pub_date = None
                    # Fallback to current UTC if parsing failed
                    if not pub_date:
                        pub_date = datetime.utcnow()
                    # Ensure timezone-aware UTC datetime
                    if pub_date.tzinfo is None:
                        pub_date = pub_date.replace(tzinfo=datetime.timezone.utc)
                    else:
                        pub_date = pub_date.astimezone(datetime.timezone.utc)

                    # Extract primary price for News table
                    p_val = None
                    p_unit = None
                    if analysis.extracted_metrics:
                        p_val = analysis.extracted_metrics[0].value
                        p_unit = analysis.extracted_metrics[0].unit

                    new_news = News(
                        title=art['title'] or "Untitled Market Report",
                        url=art['url'],
                        source_domain=urlparse(art['url']).netloc,
                        summary=analysis.summary,
                        content_hash=str(Simhash(art['content']).value),
                        sentiment_score=analysis.sentiment_score,
                        impact_score=analysis.impact_score,
                        urgency=analysis.urgency,
                        risk_type=analysis.risk_type,
                        action_recommendation=analysis.action_recommendation,
                        price_value=p_val,
                        unit=p_unit,
                        industry_tag=keyword,
                        published_at=pub_date
                    )
                    db.add(new_news)
                    await db.flush()

                    for m in analysis.extracted_metrics:
                        # Data Cleaning: Filter out 0 or unreasonable values
                        if m.value == 0: continue
                        
                        db.add(MarketTrend(
                            news_id=new_news.id,
                            metric_name=m.name,
                            company_name=m.company,
                            metric_value=m.value,
                            metric_unit=m.unit,
                            metric_type=m.data_type,
                            industry_tag=keyword,
                            published_at=pub_date
                        ))
                    
                    if analysis.impact_score > 8:
                        await trigger_notifications(new_news.title, keyword)

                await db.commit()
                print(f"BATCH: Successfully processed chunk of {len(chunk)}")
                # Quota optimization delay
                await asyncio.sleep(2)

            except Exception as e:
                print(f"LLM BATCH ERROR: {e}")
                # Re-raise to trigger Celery retry if it's a quota issue
                if "429" in str(e) or "503" in str(e) or "ResourceExhausted" in str(e):
                    raise e
                continue

async def trigger_notifications(title: str, industry: str):
    """Queue email alerts for high-impact items"""
    async with AsyncSessionLocal() as db:
        stmt = select(User.email).where(
            User.industry_preference == industry,
            User.receive_email_alerts == True
        )
        result = await db.execute(stmt)
        emails = result.scalars().all()
        for email in emails:
            send_email_task.delay(email, title, industry)

@worker.task(name="send_email_task")
def send_email_task(email: str, title: str, industry: str):
    print(f"EMAIL AUTO-ALERT: High Impact ({industry}) - {title} sent to {email}")
    return True
