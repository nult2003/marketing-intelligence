import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Filter, TrendingUp, AlertTriangle, Search, Clock, ArrowUpDown, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Badge, Input, Button, cn } from './ui/base-ui'
import { format, isToday, isYesterday, isAfter, subDays, subMonths, subYears, startOfDay, parseISO } from 'date-fns'

import { apiRequest } from '../lib/api'

export type NewsItem = {
    id: number;
    title: string;
    url: string;
    summary: string;
    sentiment_score: number;
    impact_score: number;
    urgency: string;
    risk_type: string;
    action_recommendation: string;
    industry_tag: string;
    created_at: string;
    source_domain?: string;
}

export type TimeRange = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';

export const NewsFeed = () => {
    const [industryFilter, setIndustryFilter] = useState('All')
    const [minScore, setMinScore] = useState(0)
    const [timeRange, setTimeRange] = useState<TimeRange>('Monthly')
    const [sortBy, setSortBy] = useState<'Latest' | 'Highest Impact'>('Latest')

    const { data: news, isLoading } = useQuery<NewsItem[]>({
        queryKey: ['news', industryFilter],
        queryFn: () => apiRequest<NewsItem[]>(`/news?industry=${industryFilter}`)
    })

    const filteredAndSortedNews = useMemo(() => {
        if (!news) return []

        const now = new Date()
        let startDate: Date

        switch (timeRange) {
            case 'Daily': startDate = startOfDay(now); break;
            case 'Weekly': startDate = subDays(now, 7); break;
            case 'Monthly': startDate = subMonths(now, 1); break;
            case 'Quarterly': startDate = subMonths(now, 3); break;
            case 'Yearly': startDate = subYears(now, 1); break;
            default: startDate = subMonths(now, 1)
        }

        let filtered = news.filter(item => {
            const itemDate = parseISO(item.created_at)
            const matchesTime = isAfter(itemDate, startDate)
            const matchesIndustry = industryFilter === 'All' || item.industry_tag === industryFilter
            const matchesScore = item.impact_score >= minScore
            return matchesTime && matchesIndustry && matchesScore
        })

        if (sortBy === 'Latest') {
            filtered.sort((a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime())
        } else {
            filtered.sort((a, b) => b.impact_score - a.impact_score)
        }

        return filtered
    }, [news, industryFilter, minScore, timeRange, sortBy])

    // Grouping logic
    const groupedNews = useMemo(() => {
        const groups: { [key: string]: typeof filteredAndSortedNews } = {}
        filteredAndSortedNews.forEach(item => {
            const date = parseISO(item.created_at)
            let groupLabel = 'Earlier'
            if (isToday(date)) groupLabel = 'Today'
            else if (isYesterday(date)) groupLabel = 'Yesterday'
            else if (isAfter(date, subDays(new Date(), 7))) groupLabel = 'This Week'
            else groupLabel = format(date, 'MMMM yyyy')

            if (!groups[groupLabel]) groups[groupLabel] = []
            groups[groupLabel].push(item)
        })
        return groups
    }, [filteredAndSortedNews])

    const { data: config } = useQuery({
        queryKey: ['admin-config'],
        queryFn: () => apiRequest<{ search_keywords: string[] }>('/admin/config')
    })
    const keywords = config?.search_keywords || []

    if (isLoading) return <div className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading market insights...</div>

    return (
        <div className="space-y-6">
            {/* Global Controls Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <Clock size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest leading-none">Global Timeframe</h2>
                        <p className="text-[10px] text-slate-500 font-bold mt-1">Synchronized across data feeds</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as TimeRange[]).map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={cn(
                                "px-4 py-1.5 text-xs font-black rounded-lg transition-all",
                                timeRange === range
                                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            )}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Filter Sidebar */}
                <aside className="w-full md:w-72 space-y-6">
                    <div className="p-5 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600" />
                        <div className="flex items-center gap-2 mb-6 font-black text-xs uppercase tracking-widest text-slate-400">
                            <Filter size={14} className="text-indigo-600" />
                            Refine Insights
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Industry focus</label>
                                <select
                                    className="w-full p-2.5 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-xs font-black bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all cursor-pointer"
                                    value={industryFilter}
                                    onChange={(e) => setIndustryFilter(e.target.value)}
                                >
                                    <option value="All">All Categories</option>
                                    {keywords.map(kw => (
                                        <option key={kw} value={kw}>{kw}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Min Impact Score</label>
                                    <span className="text-xl font-black text-indigo-600 leading-none">{minScore}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    step="1"
                                    className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    value={minScore}
                                    onChange={(e) => setMinScore(parseInt(e.target.value))}
                                />
                                <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase">
                                    <span>Lax</span>
                                    <span>Critical</span>
                                </div>
                            </div>

                            <div className="pt-2">
                                <Button className="w-full font-black text-[10px] uppercase tracking-widest bg-slate-900 dark:bg-white dark:text-slate-900" onClick={() => { setIndustryFilter('All'); setMinScore(0); }}>
                                    Reset Filters
                                </Button>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* News List */}
                <div className="flex-1 space-y-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">Reports</h2>
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none font-black px-3 py-1">
                                {filteredAndSortedNews.length} Signals
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-xl w-full sm:w-auto shadow-sm">
                            <ArrowUpDown size={14} className="ml-2 text-indigo-600" />
                            <select
                                className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 outline-none pr-4 cursor-pointer focus:ring-0"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                            >
                                <option value="Latest" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Latest Signals</option>
                                <option value="Highest Impact" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Peak Impact</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-10">
                        {Object.entries(groupedNews).map(([group, items]) => (
                            <div key={group} className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] whitespace-nowrap bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full">{group}</span>
                                    <div className="h-px w-full bg-slate-100 dark:bg-slate-800" />
                                </div>
                                <div className="space-y-4">
                                    {items.map((item) => (
                                        <Card key={item.id} className="group bg-white dark:bg-slate-900 hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 border-slate-200 dark:border-slate-800 hover:-translate-y-1 shadow-md">
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-4">
                                                <div className="space-y-3 pr-4 flex-1">
                                                    <a
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-2xl font-black leading-tight text-black dark:text-white group-hover:text-indigo-700 transition-colors flex items-center gap-2"
                                                    >
                                                        {item.title || "Untitled Intelligence Signal"}
                                                        <ExternalLink size={20} className="opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 text-indigo-600" />
                                                    </a>
                                                    <div className="flex items-center flex-wrap gap-2 pt-1">
                                                        <Badge
                                                            className={cn(
                                                                "text-[10px] uppercase tracking-widest font-black px-3 py-1 border-none shadow-sm",
                                                                item.sentiment_score > 7 ? "bg-emerald-600 text-white" :
                                                                    item.sentiment_score < 4 ? "bg-rose-600 text-white" :
                                                                        "bg-amber-500 text-white"
                                                            )}
                                                        >
                                                            {item.sentiment_score > 7 ? <TrendingUp size={10} className="mr-1" /> : <AlertTriangle size={10} className="mr-1" />}
                                                            {item.sentiment_score > 7 ? "Bullish" : item.sentiment_score < 4 ? "Bearish" : "Neutral"}
                                                        </Badge>
                                                        <Badge variant="outline" className={cn(
                                                            "text-[10px] font-black uppercase tracking-widest border-2",
                                                            item.urgency === 'High' ? "text-rose-700 border-rose-200 bg-rose-50" : "text-slate-500 border-slate-100"
                                                        )}>
                                                            {item.urgency} Urgency
                                                        </Badge>
                                                        {item.risk_type !== 'None' && (
                                                            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest text-orange-700 border-2 border-orange-200 bg-orange-50">
                                                                {item.risk_type} Risk
                                                            </Badge>
                                                        )}
                                                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest text-slate-600 border-2 border-slate-100 bg-slate-50">
                                                            {item.industry_tag}
                                                        </Badge>
                                                        <span className="text-[11px] text-slate-500 font-black ml-auto bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{format(parseISO(item.created_at), 'hh:mm a')}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col items-end min-w-[110px] justify-center bg-slate-900 text-white p-5 rounded-2xl border-2 border-slate-800 shadow-xl">
                                                    <span className={cn(
                                                        "text-5xl font-black tabular-nums leading-none tracking-tighter transition-colors",
                                                        item.impact_score > 7 ? "text-emerald-400" :
                                                            item.impact_score > 4 ? "text-amber-400" :
                                                                "text-slate-300"
                                                    )}>
                                                        {item.impact_score.toFixed(1)}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-2">Impact Score</span>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="px-6 pb-6 space-y-5">
                                                <div className="p-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                                    <p className="text-base text-black dark:text-slate-50 leading-relaxed font-bold bg-white dark:bg-slate-900 p-4 rounded-md border border-slate-100 dark:border-slate-800 shadow-sm">
                                                        {item.summary || "No automated summary available for this intelligence node."}
                                                    </p>
                                                </div>
                                                {item.action_recommendation && (
                                                    <div className="bg-indigo-50 dark:bg-indigo-950/40 p-5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/50 shadow-md">
                                                        <h4 className="text-[11px] font-black text-indigo-800 dark:text-indigo-300 uppercase tracking-[0.25em] mb-3 flex items-center gap-2">
                                                            <ShieldCheck size={16} className="fill-indigo-200 dark:fill-indigo-900/50" />
                                                            Operational Directive
                                                        </h4>
                                                        <p className="text-sm text-slate-900 dark:text-indigo-50 font-black leading-normal">
                                                            {item.action_recommendation}
                                                        </p>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredAndSortedNews.length === 0 && (
                        <div className="py-32 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                            <Search className="mx-auto mb-4 text-slate-300" size={48} />
                            <p className="text-slate-500 font-black uppercase tracking-widest text-sm">No signals detected for this timeframe.</p>
                        </div>
                    )}
                </div>
            </div>
        </div >
    )
}
