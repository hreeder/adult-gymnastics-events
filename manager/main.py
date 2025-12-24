import calendar
import hashlib
import logging
import sys
import time

import boto3
import manager.db as db
import pandas as pd
import streamlit as st
from botocore.exceptions import ClientError
from manager.auth import do_auth
from manager.config import DATE_FORMAT, IMAGE_BUCKET

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def date_to_str(dt):
    if dt:
        return dt.strftime("%Y-%m-%d")
    return None


do_auth()

st.set_page_config(layout="wide")
st.title("Gymnastics Events")

items = db.get_items()
# Empty array is fine, so don't use "if not items", but None indicates an error (but we should
# have already stopped in that case. sys.exit() is just to satisfy type checkers.)
if items is None:
    st.stop()
    sys.exit(1)

if len(items) == 0:
    st.info("No events found. Please create a new event below.")
    st.subheader("Create New Event")
    form_mode = "create"

else:
    # Convert items to DataFrame for table display
    df = pd.DataFrame(items)
    df = df[["name", "country", "date", "entriesOpen", "entriesClose"]]
    df.columns = ["Event Name", "Country", "Date", "Entries Open", "Entries Close"]
    df = df.fillna("N/A")

    # Display table with selection
    event_selection = st.dataframe(
        df,
        width="stretch",
        on_select="rerun",
        selection_mode="single-row",
    )

    st.write(
        "Select an event from the table above to edit it, or create a new event below."
    )
    # Event form section
    st.divider()

    selected_rows = event_selection.selection.rows
    if selected_rows:
        selected_idx = list(selected_rows)[0]
        event = items[selected_idx]
        st.subheader(f"Edit Event: {event['name']}")
        form_mode = "edit"
    else:
        st.subheader("Create New Event")
        form_mode = "create"


with st.form("event_form"):
    if form_mode == "edit":
        selected_idx = list(selected_rows)[0]
        event = items[selected_idx]
    else:
        event = {}

    upperCol1, upperCol2 = st.columns(2)
    with upperCol1:
        name = st.text_input("Event Name*", value=event.get("name", ""))

        countries = ["United Kingdom", "United States", "Ireland"]
        existing_country = event.get("country", "")
        existing_country_index = (
            countries.index(existing_country) if existing_country in countries else None
        )
        country = st.selectbox(
            "Country*",
            countries,
            index=existing_country_index,
            accept_new_options=True,
        )

        date = st.date_input("Date*", value=event.get("date", None), format=DATE_FORMAT)

        min_age = st.number_input(
            "Minimum Age",
            min_value=0,
            max_value=100,
            value=event.get("minAge", None),
        )

    with upperCol2:
        event_types = ["competition", "workshop", "other"]
        current_type = event.get("eventType", "")
        current_type_index = (
            event_types.index(current_type) if current_type in event_types else None
        )
        event_type = st.selectbox("Event Type", event_types, index=current_type_index)

        entries_open = st.date_input(
            "Entries Open", value=event.get("entriesOpen", None), format=DATE_FORMAT
        )

        entries_close = st.date_input(
            "Entries Close", value=event.get("entriesClose", None), format=DATE_FORMAT
        )

        disciplines = st.pills(
            "Discipline(s)",
            options=["wag", "mag", "tum", "fv", "tra", "acro"],
            selection_mode="multi",
            default=event.get("disciplines", []),
        )

    details = st.text_area(
        "Event Details (Markdown supported)",
        value=event.get("details", ""),
        height=200,
    )

    imageCol1, imageCol2 = st.columns(2)

    existing_image = event.get("imageUrl")
    uploadText = "Replace Event Image" if existing_image else "Set Event Image"

    with imageCol1:
        image_file = st.file_uploader(uploadText, type=["png", "jpg", "jpeg"])

    with imageCol2:
        if existing_image:
            st.image(existing_image, width=400)

    button_label = "Update Event" if form_mode == "edit" else "Create Event"

    st.write("Please note, updates take a minute to reflect on the main page.")
    if st.form_submit_button(button_label):
        if not all([name, country, date]):
            st.error("Please fill in all required fields: Event Name, Country, Date.")
            st.stop()

        if form_mode == "create":
            event["pk"] = "event"
            # Generate sk from date + hash of event name
            name_hash = hashlib.sha256(name.encode()).hexdigest()[:8]
            sk = calendar.timegm(date.timetuple())
            event["sk"] = f"{sk}#{name_hash}"
            event["createdBy"] = st.user.email
            event["createdAt"] = int(time.time())

        if image_file:
            try:
                s3 = boto3.client("s3")
                ext = "png" if image_file.type == "image/png" else "jpg"
                image_key = f"event-images/{event['sk'].replace('#', '_')}/{image_file.file_id}.{ext}"

                s3.upload_fileobj(
                    image_file,
                    IMAGE_BUCKET,
                    image_key,
                    ExtraArgs={"ACL": "public-read", "ContentType": image_file.type},
                )

                event["imageUrl"] = f"/{image_key}"
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "Unknown")
                logger.error(f"S3 upload failed: {error_code} - {e}")
                if error_code == "NoSuchBucket":
                    st.error(
                        f"Storage bucket '{IMAGE_BUCKET}' not found. Please contact support."
                    )
                elif error_code == "AccessDenied":
                    st.error(
                        "Permission denied for image upload. Please contact support."
                    )
                else:
                    st.error("Failed to upload image. Please try again.")
                st.stop()
            except Exception as e:
                logger.error(f"Unexpected error uploading image: {e}")
                st.error("Failed to upload image. Please try again.")
                st.stop()

        try:
            tbl = db.get_table()
            if not tbl:
                # again, if we haven't been able to get the table, we'd have exited already, but
                # this keeps the linters happy
                sys.exit(1)

            tbl.put_item(
                Item={
                    **event,
                    "name": name,
                    "country": country,
                    "eventType": event_type,
                    "date": date_to_str(date),
                    "entriesOpen": date_to_str(entries_open),
                    "entriesClose": date_to_str(entries_close),
                    "disciplines": disciplines,
                    "details": details,
                    "minimumAge": min_age,
                    "updatedBy": st.user.email,
                    "updatedAt": int(time.time()),
                }
            )

            success_msg = (
                "Event updated successfully!"
                if form_mode == "edit"
                else "Event created successfully!"
            )
            st.success(success_msg)
            logger.info(
                f"Event {'updated' if form_mode == 'edit' else 'created'}: {name} by {st.user.email}"
            )
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            logger.error(f"DynamoDB put_item failed: {error_code} - {e}")
            if error_code == "ConditionalCheckFailedException":
                st.error(
                    "Event was modified by another user. Please refresh and try again."
                )
            elif error_code == "ProvisionedThroughputExceededException":
                st.error(
                    "Service is currently busy. Please try again in a few moments."
                )
            elif error_code == "ValidationException":
                st.error("Invalid data provided. Please check your inputs.")
            else:
                st.error("Failed to save event. Please try again.")
            st.stop()
        except Exception as e:
            logger.error(f"Unexpected error saving event: {e}")
            st.error("An unexpected error occurred while saving. Please try again.")
            st.stop()

st.html(f"<small>Logged in as: {st.user.email}</small>")
st.button("Log out", on_click=st.logout, type="tertiary")
