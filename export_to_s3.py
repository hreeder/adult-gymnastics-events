import json
import os

import boto3

TABLE = os.environ.get("DDB_TABLE", "adult-gymnastics-events")
BUCKET = os.environ.get("S3_BUCKET", "adult-gymnastics-competitions-data")
EVENTS_KEY = os.environ.get("EVENTS_KEY", "events.json")

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
        if createdAt := item.get("createdAt"):
            item["createdAt"] = int(createdAt)  # type: ignore
        if updatedAt := item.get("updatedAt"):
            item["updatedAt"] = int(updatedAt)  # type: ignore

    data = {"events": items}
    data = json.dumps(data, separators=(",", ":"))

    obj = s3_bucket.Object(EVENTS_KEY)
    obj.put(Body=data, ContentType="application/json")

    return


if __name__ == "__main__":
    handler({}, None)
