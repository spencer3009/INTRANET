"""
FCM Service — HTTP v1 API
Sends push notifications via https://fcm.googleapis.com/v1/projects/{PROJECT_ID}/messages:send
Uses google-auth for OAuth2 access tokens (cached until expiry).
Gracefully degrades if Firebase is not configured.
"""
import os
import json
import base64
import logging
import httpx
from datetime import datetime, timezone

from google.oauth2 import service_account
from google.auth.transport.requests import Request as GoogleAuthRequest

logger = logging.getLogger(__name__)

FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "")
FIREBASE_SERVICE_ACCOUNT_JSON = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")

FCM_ENDPOINT = f"https://fcm.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/messages:send"
SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"]

_credentials = None


def _is_configured() -> bool:
    return bool(FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT_JSON)


def _get_credentials():
    """Load and cache Google OAuth2 credentials from service account."""
    global _credentials
    if _credentials and _credentials.valid:
        return _credentials

    if not _is_configured():
        return None

    try:
        # Try base64 first, then raw JSON, then file path
        sa_json = FIREBASE_SERVICE_ACCOUNT_JSON.strip()
        info = None

        # Attempt base64 decode
        try:
            decoded = base64.b64decode(sa_json)
            info = json.loads(decoded)
        except Exception:
            pass

        # Attempt raw JSON string
        if not info:
            try:
                info = json.loads(sa_json)
            except Exception:
                pass

        # Attempt file path
        if not info and os.path.isfile(sa_json):
            with open(sa_json, "r") as f:
                info = json.load(f)

        if not info:
            logger.error("[FCM] Could not parse FIREBASE_SERVICE_ACCOUNT_JSON")
            return None

        _credentials = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
        return _credentials

    except Exception as e:
        logger.error(f"[FCM] Error loading service account: {e}")
        return None


def _get_access_token() -> str:
    """Get a valid OAuth2 access token, refreshing if needed."""
    creds = _get_credentials()
    if not creds:
        return ""

    if not creds.valid:
        creds.refresh(GoogleAuthRequest())

    return creds.token or ""


async def send_fcm_to_devices(db, devices: list, title: str, body: str, data: dict = None) -> tuple:
    """
    Send push notification to a list of devices via FCM HTTP v1.
    Returns (sent_count, failed_count).
    Marks invalid tokens as active=False in device_tokens.
    """
    if not _is_configured():
        logger.warning("[FCM] Firebase not configured (FIREBASE_PROJECT_ID empty), skipping push send.")
        return (0, 0)

    access_token = _get_access_token()
    if not access_token:
        logger.error("[FCM] Could not obtain access token.")
        return (0, 0)

    sent = 0
    failed = 0
    data_str = {k: str(v) for k, v in (data or {}).items()}

    async with httpx.AsyncClient(timeout=10) as client:
        for device in devices:
            fcm_token = device.get("fcm_token")
            if not fcm_token:
                failed += 1
                continue

            payload = {
                "message": {
                    "token": fcm_token,
                    "notification": {"title": title, "body": body},
                    "data": data_str,
                    "android": {
                        "notification": {"sound": "default", "channel_id": "edunet_default"}
                    },
                    "apns": {
                        "payload": {"aps": {"sound": "default"}}
                    },
                    "webpush": {
                        "notification": {"icon": "/logo192.png"}
                    }
                }
            }

            try:
                resp = await client.post(
                    FCM_ENDPOINT,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                    }
                )

                if resp.status_code == 200:
                    sent += 1
                else:
                    failed += 1
                    error_body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                    error_code = error_body.get("error", {}).get("details", [{}])[0].get("errorCode", "")
                    error_status = error_body.get("error", {}).get("status", "")

                    # Deactivate invalid tokens
                    if error_status in ("NOT_FOUND", "INVALID_ARGUMENT") or error_code in ("UNREGISTERED", "INVALID_ARGUMENT"):
                        logger.info(f"[FCM] Deactivating invalid token for device user_id={device.get('user_id')}")
                        await db.device_tokens.update_one(
                            {"fcm_token": fcm_token},
                            {"$set": {"active": False}}
                        )
                    else:
                        logger.warning(f"[FCM] Push failed for token ...{fcm_token[-8:]}: {resp.status_code} {error_status}")

            except Exception as e:
                failed += 1
                logger.error(f"[FCM] Exception sending to ...{fcm_token[-8:]}: {e}")

    logger.info(f"[FCM] Push result: {sent} sent, {failed} failed out of {len(devices)} devices")
    return (sent, failed)
