# FROM ghcr.io/astral-sh/uv:debian
FROM python:3.14
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /app

COPY pyproject.toml uv.lock .python-version /app/

# ENV UV_COMPILE_BYTECODE=1
# ENV UV_LINK_MODE=copy
# ENV UV_TOOL_BIN_DIR=/usr/local/bin

# RUN --mount=type=cache,target=/root/.cache/uv \
#     --mount=type=bind,source=uv.lock,target=uv.lock \
#     --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
#     uv sync --locked --no-install-project --no-dev

RUN pip install .

COPY . /app/

# RUN --mount=type=cache,target=/root/.cache/uv \
#     uv sync --locked --no-dev

ENV PORT=8080
CMD ["./entrypoint.sh"]
