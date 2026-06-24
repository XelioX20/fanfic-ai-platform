"""Tests for auth module."""
import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch
from ficbook_parser.auth.session import FicbookAuth, AuthResult


@pytest.mark.asyncio
async def test_check_authorized_false_on_redirect():
    """If settings page redirects to login — not authorized."""
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_resp = MagicMock()
    mock_resp.status_code = 302
    mock_resp.headers = {"location": "/login"}
    mock_client.get.return_value = mock_resp

    auth = FicbookAuth(mock_client)
    result = await auth.check_authorized()
    assert result is False


@pytest.mark.asyncio
async def test_check_authorized_true_on_200():
    mock_client = AsyncMock(spec=httpx.AsyncClient)
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {}
    mock_client.get.return_value = mock_resp

    auth = FicbookAuth(mock_client)
    result = await auth.check_authorized()
    assert result is True
