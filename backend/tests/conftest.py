import pytest


# Run all async tests on a single session-scoped event loop so the shared Motor
# client (bound to the loop on first use) is never used from a closed loop.
@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"
