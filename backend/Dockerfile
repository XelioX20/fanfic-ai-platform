FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir hatchling
COPY pyproject.toml .
RUN pip install --no-cache-dir fastapi "uvicorn[standard]" "sqlalchemy[asyncio]" asyncpg pydantic pydantic-settings PyJWT "passlib[bcrypt]" httpx aiokafka "redis[asyncio]" alembic
COPY . .
RUN pip install --no-cache-dir -e /app/../ficbook-parser || true
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
