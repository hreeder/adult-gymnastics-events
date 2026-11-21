"""One-time migration: export events from the legacy DynamoDB table into the
KV document format the Cloudflare workers expect.

Usage:
    # With AWS credentials for the legacy account/table:
    python scripts/migrate-ddb-to-kv.py > events.json

    # Then seed KV (namespace id is in the wrangler.jsonc files):
    npx wrangler kv key put events --path events.json --namespace-id <KV_NAMESPACE_ID>
"""

import json
import os
import sys
from decimal import Decimal

import boto3

TABLE = os.environ.get("DDB_TABLE", "adult-gymnastics-events")


def main():
    table = boto3.resource("dynamodb").Table(TABLE)
    items = []
    response = table.scan()
    items.extend(response.get("Items", []))
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))

    events = []
    for item in items:
        event = {}
        for key, value in item.items():
            if key == "pk":  # fixed partition key, meaningless outside DDB
                continue
            if isinstance(value, Decimal):
                value = int(value)
            event[key] = value
        events.append(event)

    json.dump({"events": events}, sys.stdout, separators=(",", ":"))


if __name__ == "__main__":
    main()
