FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN useradd --create-home thumbsup && mkdir -p /app/storage && chown -R thumbsup /app/storage
USER thumbsup

EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health')"
# Migrations run automatically at startup. The delivery worker runs inside each process.
# The real visitor IP is read from X-Forwarded-For by ThumbsUp itself (TRUSTED_PROXY_HOPS), so uvicorn
# must not trust that header from everyone.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
