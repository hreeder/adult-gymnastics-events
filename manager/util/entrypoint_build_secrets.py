import os
from collections import defaultdict
from pathlib import Path

import boto3

prefix = os.environ.get("SSM_PREFIX", "/adult-gymnastics-events/manager/")

ssm = boto3.client("ssm")
values = ssm.get_parameters_by_path(Path=prefix, WithDecryption=True, Recursive=True)
params = {p["Name"].removeprefix(prefix): p["Value"] for p in values["Parameters"]}

files = defaultdict(lambda: defaultdict(dict))
for name, value in params.items():
    file, section, key = name.split("/")
    files[file][section][key] = value

base_dir = Path(os.environ.get("STREAMLIT_CONFIG_DIR", "/app/.streamlit"))
base_dir.mkdir(parents=True, exist_ok=True)

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

    print(f"Wrote config file - {target}")
