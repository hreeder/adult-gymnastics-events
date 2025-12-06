import logging

import boto3
import streamlit as st
from botocore.exceptions import ClientError, NoCredentialsError, PartialCredentialsError

from manager.config import DDB_TABLE

logger = logging.getLogger(__name__)


def get_table():
    try:
        ddb = boto3.resource("dynamodb")
        return ddb.Table(DDB_TABLE)
    except (NoCredentialsError, PartialCredentialsError) as e:
        logger.error(f"AWS credentials error: {e}")
        st.error(
            "AWS credentials are not configured correctly. Please contact support."
        )
        st.stop()
    except Exception as e:
        logger.error(f"Failed to initialize DynamoDB: {e}")
        st.error("Failed to connect to database. Please try again later.")
        st.stop()


def get_items():
    tbl = get_table()
    if not tbl:
        return

    # Load events with error handling
    try:
        items = tbl.scan()["Items"]
        return items
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        logger.error(f"DynamoDB scan failed: {error_code} - {e}")
        if error_code == "ResourceNotFoundException":
            st.error(f"Table '{DDB_TABLE}' not found. Please contact support.")
        elif error_code == "ProvisionedThroughputExceededException":
            st.error("Service is currently busy. Please try again in a few moments.")
        else:
            st.error("Failed to load events. Please try again later.")
        st.stop()
    except Exception as e:
        logger.error(f"Unexpected error loading events: {e}")
        st.error("An unexpected error occurred. Please try again later.")
        st.stop()
