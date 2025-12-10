import logging
import os
import time
from collections import defaultdict
from pathlib import Path

import boto3

start = time.time()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

logger.info("Building Streamlit config from SSM Parameter Store")
prefix = os.environ.get("SSM_PREFIX", "/adult-gymnastics-events/manager/")

ssm = boto3.client("ssm")
values = ssm.get_parameters_by_path(Path=prefix, WithDecryption=True, Recursive=True)
params = {p["Name"].removeprefix(prefix): p["Value"] for p in values["Parameters"]}
logger.info("Fetched %d parameters from SSM", len(params))

files = defaultdict(lambda: defaultdict(dict))
for name, value in params.items():
    try:
        file, section, key = name.split("/")
        files[file][section][key] = value
    except ValueError:
        logger.warning("Skipping parameter with unexpected format: %s", name)
        continue

base_dir = Path(os.environ.get("STREAMLIT_CONFIG_DIR", "/app/.streamlit"))
base_dir.mkdir(parents=True, exist_ok=True)
logger.info("Created Streamlit config directory at %s", base_dir)

for file, sections in files.items():
    target = base_dir / f"{file}.toml"
    lines = []
    for section, keys in sections.items():
        lines.append(f"[{section}]\n")
        for key, value in keys.items():
            lines.append(f'{key} = "{value}"\n')
        lines.append("\n")

    with open(target, "w") as f:
        f.write("".join(lines))

    logger.info("Wrote config file - %s", target)

end = time.time()
logger.info("Completed building Streamlit config files in %.2f seconds", end - start)
