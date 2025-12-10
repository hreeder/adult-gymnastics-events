import json
import os
from decimal import Decimal

import boto3

TABLE = os.environ["DDB_TABLE"]
BUCKET = os.environ["S3_BUCKET"]
EVENTS_KEY = os.environ.get("EVENTS_KEY", "events.json")

LOG_ITEMS = os.environ.get("LOG_ITEMS", "false").lower() == "true"

DDB = boto3.resource("dynamodb")
S3 = boto3.resource("s3")

table = DDB.Table(TABLE)
s3_bucket = S3.Bucket(BUCKET)


def handler(event, context):
    items = []
    response = table.scan()
    items.extend(response.get("Items", []))

    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))

    for item in items:
        for key, val in item.items():
            if isinstance(val, Decimal):
                item[key] = int(val)

    data = {"events": items}

    if LOG_ITEMS:
        print(data)

    data = json.dumps(data, separators=(",", ":"))

    obj = s3_bucket.Object(EVENTS_KEY)
    obj.put(Body=data, ContentType="application/json")

    return


if __name__ == "__main__":
    handler({}, None)
