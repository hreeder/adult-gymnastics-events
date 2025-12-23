#!/usr/bin/env bash
set -e
# export UV_CACHE_DIR=/tmp/.uv_cache

# mkdir -p /tmp/app/.streamlit
# cp -r /app/* /tmp/app/
# cd /tmp/app

# STREAMLIT_CONFIG_DIR=/tmp/app/.streamlit python util/entrypoint_build_config.py

exec streamlit run main.py --server.port=${PORT} --server.address=0.0.0.0 --browser.gatherUsageStats=false
