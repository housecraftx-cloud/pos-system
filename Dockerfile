FROM python:3.11-slim
WORKDIR /app
RUN pip install fastapi uvicorn python-dotenv aiomysql cryptography PyMySQL pydantic PyJWT httpx
COPY backend/ .
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}
