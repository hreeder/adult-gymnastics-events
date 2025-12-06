import os

DDB_TABLE = os.environ.get("DDB_TABLE", "adult-gymnastics-events")
IMAGE_BUCKET = os.environ.get("IMAGE_BUCKET", "adult-gymnastics-event-images")
ALLOWED_USERS = os.environ.get("ALLOWED_USERS", "").split(";")
DATE_FORMAT = "YYYY-MM-DD"
