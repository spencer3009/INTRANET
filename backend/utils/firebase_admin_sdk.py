"""
Firebase Admin SDK initialization - Singleton pattern
"""
import firebase_admin
from firebase_admin import credentials, messaging
import os
import logging

logger = logging.getLogger(__name__)

_firebase_app = None

def get_firebase_app():
    global _firebase_app
    if _firebase_app is None and not firebase_admin._apps:
        try:
            key_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "secure", "firebase-key.json")
            cred = credentials.Certificate(key_path)
            _firebase_app = firebase_admin.initialize_app(cred)
            logger.info(f"Firebase Admin initialized: {_firebase_app.project_id}")
        except Exception as e:
            logger.error(f"Firebase Admin init failed: {e}")
            return None
    return firebase_admin._apps.get("[DEFAULT]") if firebase_admin._apps else None


def send_push_notification(token: str, title: str, body: str, data: dict = None):
    """Send a single push notification via FCM"""
    app = get_firebase_app()
    if not app:
        logger.error("Firebase not initialized, cannot send push")
        return False
    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            android=messaging.AndroidConfig(
                notification=messaging.AndroidNotification(
                    sound="default",
                    channel_id="attendance_channel",
                ),
            ),
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    title=title,
                    body=body,
                    icon="/logo192.png",
                    badge="/logo192.png",
                ),
            ),
            data={k: str(v) for k, v in (data or {}).items()},
            token=token,
        )
        response = messaging.send(message)
        logger.info(f"Push sent successfully: {response}")
        return True
    except messaging.UnregisteredError:
        logger.warning(f"Token unregistered, should be removed: {token[:20]}...")
        return False
    except Exception as e:
        logger.error(f"Push send error: {e}")
        return False


def send_push_to_multiple(tokens: list, title: str, body: str, data: dict = None):
    """Send push to multiple tokens"""
    app = get_firebase_app()
    if not app or not tokens:
        return []
    try:
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            android=messaging.AndroidConfig(
                notification=messaging.AndroidNotification(sound="default", channel_id="attendance_channel"),
            ),
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(title=title, body=body, icon="/logo192.png", badge="/logo192.png"),
            ),
            data={k: str(v) for k, v in (data or {}).items()},
            tokens=tokens,
        )
        response = messaging.send_each_for_multicast(message)
        logger.info(f"Multicast: {response.success_count} sent, {response.failure_count} failed")
        return response.responses
    except Exception as e:
        logger.error(f"Multicast push error: {e}")
        return []
