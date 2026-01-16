
# chạy worker: 
 - uv run celery -A app.tasks.worker worker --loglevel=info -P solo
 - uv run celery -A app.tasks.worker worker --loglevel=info -P solo --concurrency=2
# clean data:
- $env:PYTHONPATH="."; uv run python scripts/clean_data.py
