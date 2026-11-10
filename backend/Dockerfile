FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir "starlette>=0.37.0,<1.0.0"

# Copy backend app source code
COPY . .

# Ensure data directory exists for SQLite persistent volume if mounted
RUN mkdir -p /app/data

ENV APP_ENV=production
ENV DATABASE_URL=sqlite:////app/data/vaaniops.db
ENV FRONTEND_ORIGIN=*
ENV GNANI_TIMEOUT_SECONDS=60

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

