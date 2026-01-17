
# chạy worker: 
 - uv run celery -A app.tasks.worker worker --loglevel=info -P solo
 - uv run celery -A app.tasks.worker worker --loglevel=info -P solo --concurrency=2

 - run auto for window: 
   + Terminal 1: uv run celery -A app.tasks.worker worker --loglevel=info -P solo --concurrency=2
   + Terminal 2: uv run celery -A app.tasks.worker beat --loglevel=info
- run auto for linux:
   + uv run celery -A app.tasks.worker worker --beat --loglevel=info -P solo
   
# clean data:
- $env:PYTHONPATH="."; uv run python scripts/clean_data.py



