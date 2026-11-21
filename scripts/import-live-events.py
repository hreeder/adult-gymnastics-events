"""One-time migration: seed KV from the live site's public events.json
(no AWS access needed).

The public export is missing `sk` (stripped by the old S3 export), so we
regenerate it with the same scheme as `eventSk()` in manager/worker.js and
the legacy Streamlit manager: epochSeconds(date) + 8 hex chars of sha256(name).
Authorship emails aren't in the public export; a placeholder is used (the
public worker strips these fields anyway).

Usage:
    python scripts/import-live-events.py > events.json
    npx wrangler kv key put events --path events.json --namespace-id <id>
"""

import calendar
import hashlib
import json
import sys
import urllib.request
from datetime import date

SOURCE = "https://adultgymnastics.events/data/events.json"
PLACEHOLDER_AUTHOR = "migrated"


def event_sk(name: str, event_date: str) -> str:
    epoch_seconds = calendar.timegm(date.fromisoformat(event_date).timetuple())
    digest = hashlib.sha256(name.encode()).hexdigest()
    return f"{epoch_seconds}#{digest[:8]}"


def main() -> None:
    request = urllib.request.Request(SOURCE, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request) as response:
        data = json.load(response)

    for event in data["events"]:
        event["sk"] = event_sk(event["name"], event["date"])
        event.setdefault("createdBy", PLACEHOLDER_AUTHOR)
        event.setdefault("updatedBy", PLACEHOLDER_AUTHOR)

    json.dump(data, sys.stdout, separators=(",", ":"))


if __name__ == "__main__":
    main()
