# FROM ghcr.io/astral-sh/uv:debian
FROM python:3.13
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock .python-version /app/

ENV UV_SYSTEM_PYTHON=1
RUN uv sync --locked --no-dev --no-install-project

COPY . /app/

RUN uv sync --locked --no-dev

EXPOSE 8080
CMD ["streamlit", "run", "main.py", "--server.port=8080", "--server.address=0.0.0.0", "--browser.gatherUsageStats=false"]
