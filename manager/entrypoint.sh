#!/usr/bin/env bash
cd /app
mkdir -p /app/.streamlit

echo "which"
which jq
echo ".."

exec uv run streamlit run main.py --server.port=${PORT} --server.address=0.0.0.0 --browser.gatherUsageStats=false
