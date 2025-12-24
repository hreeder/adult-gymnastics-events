import logging

import streamlit as st

from manager.config import ALLOWED_USERS

logger = logging.getLogger(__name__)


def do_auth():
    if not st.user.is_logged_in:
        st.button("Log in with Google", on_click=st.login, type="primary")
        st.stop()

    if not st.user.email_verified:
        st.error(
            "Your Google account email address is not verified. Unable to proceed."
        )
        st.stop()

    logger.info("User logged in: %s", st.user.email)
    logger.info("Allowed Users: %s", ALLOWED_USERS)
    logger.info("User allowed: %s", st.user.email in ALLOWED_USERS)

    if st.user.email not in ALLOWED_USERS:
        st.error(
            "You do not have permission to access this application.\n\n"
            f"You are logged in as {st.user.email}."
        )
        st.stop()
