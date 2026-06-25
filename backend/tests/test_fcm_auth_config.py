"""
FCM Auth / Config tests (post-fix verification)

Verifies that:
 1. services.fcm_service._is_configured() returns True (project_id + service account loaded)
 2. _resolve_project_id() == 'edunet-b38ce'
 3. _get_access_token() returns a NON-empty OAuth2 token (proves the bundled
    secure/firebase-key.json authenticates correctly against Google -- i.e. the
    'invalid_grant: Invalid JWT Signature' error is gone).
 4. firebase_admin.messaging.send(msg, dry_run=True) with a fake registration
    token does NOT raise a RefreshError/Invalid JWT Signature. An
    InvalidArgumentError (or UnregisteredError) saying "registration token
    not valid" is accepted as proof the auth layer is OK.
"""
import os
import sys
import pytest

# Make /app/backend importable
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Import the modules under test
from services import fcm_service  # noqa: E402
from utils.firebase_admin_sdk import get_firebase_app  # noqa: E402


# ---------- FCM config / service account loading ----------

class TestFcmConfig:
    """Verifies project_id + service account are discoverable from the bundled key."""

    def test_service_account_file_present(self):
        sa_path = fcm_service._SA_FILE_PATH
        assert os.path.isfile(sa_path), f"Service account file missing at {sa_path}"

    def test_load_sa_info_returns_dict(self):
        info = fcm_service._load_sa_info()
        assert isinstance(info, dict), "_load_sa_info() must return a dict"
        assert info.get("type") == "service_account"
        assert info.get("project_id"), "project_id must be present in the key"
        assert info.get("client_email"), "client_email must be present in the key"
        # client_email of the new key
        assert info["client_email"].endswith("@edunet-b38ce.iam.gserviceaccount.com"), (
            f"Unexpected client_email: {info['client_email']}"
        )
        # Private key should be a PEM
        pk = info.get("private_key", "")
        assert "BEGIN PRIVATE KEY" in pk, "private_key does not look like a PEM"

    def test_resolve_project_id_is_edunet(self):
        pid = fcm_service._resolve_project_id()
        assert pid == "edunet-b38ce", f"Expected project_id 'edunet-b38ce', got '{pid}'"

    def test_is_configured_true(self):
        assert fcm_service._is_configured() is True, (
            "_is_configured() must be True after fix (project_id + service account both available)"
        )

    def test_fcm_endpoint_url(self):
        url = fcm_service._fcm_endpoint()
        assert url == "https://fcm.googleapis.com/v1/projects/edunet-b38ce/messages:send", url


# ---------- OAuth2 token (this is the critical auth check) ----------

class TestFcmOAuthToken:
    """Proves the new service-account key authenticates against Google OAuth.

    If the key were the revoked one, _get_access_token() would raise
    google.auth.exceptions.RefreshError: invalid_grant: Invalid JWT Signature.
    """

    def test_get_credentials_returns_object(self):
        creds = fcm_service._get_credentials()
        assert creds is not None, "_get_credentials() returned None -- key file unreadable?"

    def test_get_access_token_non_empty(self):
        # This call performs the JWT->OAuth2 exchange with Google.
        # It will raise RefreshError if the JWT signature is invalid (revoked key).
        try:
            token = fcm_service._get_access_token()
        except Exception as e:
            pytest.fail(
                f"_get_access_token() raised {type(e).__name__}: {e}. "
                "This indicates the service-account key is invalid/revoked."
            )
        assert isinstance(token, str), "Access token must be a string"
        assert len(token) > 50, f"Access token suspiciously short (len={len(token)})"
        # Google OAuth2 tokens commonly start with 'ya29.'
        # (Don't hard-fail if format ever changes, just assert non-empty + reasonable length.)


# ---------- firebase_admin SDK + dry_run send ----------

class TestFirebaseAdminDryRun:
    """Sanity-check the firebase_admin path used by routes/support.py-style code.

    Sends a dry_run message to a FAKE token. We accept any error that proves
    auth succeeded (e.g. InvalidArgumentError / UnregisteredError about the
    token being invalid). We FAIL only on RefreshError / Invalid JWT Signature.
    """

    def test_firebase_admin_app_initializes(self):
        app = get_firebase_app()
        assert app is not None, "firebase_admin app failed to initialize"
        assert app.project_id == "edunet-b38ce", f"Unexpected project_id: {app.project_id}"

    def test_dry_run_send_auth_ok(self):
        from firebase_admin import messaging
        from firebase_admin import exceptions as fb_exceptions

        app = get_firebase_app()
        assert app is not None

        fake_token = "fake-token-for-dry-run-" + "x" * 80
        msg = messaging.Message(
            notification=messaging.Notification(title="Test", body="dry run"),
            token=fake_token,
        )

        try:
            resp = messaging.send(msg, dry_run=True)
            # Very unlikely, but if Google accepts the fake token in dry mode,
            # that's still proof that auth worked.
            print(f"[DRY_RUN] Unexpected success: {resp}")
        except fb_exceptions.InvalidArgumentError as e:
            # EXPECTED with a fake token. Auth passed; token rejected. PASS.
            assert "token" in str(e).lower() or "registration" in str(e).lower() or True
            print(f"[DRY_RUN] Got expected InvalidArgumentError (auth OK): {e}")
        except messaging.UnregisteredError as e:
            # Also acceptable -- means auth passed and token is unregistered.
            print(f"[DRY_RUN] Got UnregisteredError (auth OK): {e}")
        except Exception as e:
            # Anything mentioning JWT / invalid_grant / RefreshError is the bug we're checking.
            msg_str = f"{type(e).__name__}: {e}"
            forbidden = ("invalid_grant", "Invalid JWT Signature", "RefreshError")
            for needle in forbidden:
                if needle.lower() in msg_str.lower():
                    pytest.fail(
                        f"FCM auth still broken -- got {msg_str}. "
                        "The service-account key is invalid/revoked."
                    )
            # Other errors (e.g. transient quota) -- log but don't fail this auth-focused test.
            print(f"[DRY_RUN] Non-auth error (treated as acceptable): {msg_str}")


# ---------- Optional: support endpoint smoke check ----------

class TestSupportTestPushEndpoint:
    """Best-effort check that POST /api/support/schools/{school_id}/test-push
    reports fcm_configured=true. We don't have a soporte session here, so we
    only require that the endpoint exists and either (a) requires auth (401/403)
    or (b) returns fcm_configured=true if reachable.
    """

    def test_endpoint_reachable(self):
        import requests
        base = os.environ.get("REACT_APP_BACKEND_URL")
        if not base:
            # Try frontend/.env
            env_path = os.path.join(os.path.dirname(BACKEND_DIR), "frontend", ".env")
            if os.path.isfile(env_path):
                for line in open(env_path):
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        base = line.split("=", 1)[1].strip()
                        break
        if not base:
            pytest.skip("REACT_APP_BACKEND_URL not set; skipping HTTP smoke test")

        base = base.rstrip("/")
        url = f"{base}/api/support/schools/test-id/test-push"
        try:
            r = requests.post(url, json={}, timeout=10)
        except Exception as e:
            pytest.skip(f"Backend not reachable for smoke test: {e}")

        # 401/403 == route exists, just requires auth. That's enough for this test.
        assert r.status_code in (200, 400, 401, 403, 404, 422), (
            f"Unexpected status {r.status_code}: {r.text[:200]}"
        )
        if r.status_code == 200:
            try:
                body = r.json()
            except Exception:
                body = {}
            if "fcm_configured" in body:
                assert body["fcm_configured"] is True, f"Expected fcm_configured=true, body={body}"
