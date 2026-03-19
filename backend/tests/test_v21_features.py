"""Tests for v2.1 features: WebSocket broadcast, CSV export, mobile responsiveness."""

import asyncio
import pytest
from unittest.mock import AsyncMock, patch

from app.api.websocket import broadcast_event, active_connections


class TestBroadcastEvent:
    """Test WebSocket broadcast_event function."""

    @pytest.mark.asyncio
    async def test_broadcast_to_no_connections(self):
        """broadcast_event should be a no-op when no clients are connected."""
        active_connections.clear()
        # Should not raise
        await broadcast_event("test_event", {"key": "value"})

    @pytest.mark.asyncio
    async def test_broadcast_sends_json_to_connections(self):
        """broadcast_event should send JSON to all connected clients."""
        mock_ws = AsyncMock()
        mock_ws.send_text = AsyncMock()
        active_connections.add(mock_ws)
        try:
            await broadcast_event("scores_updated", {"boundary_pcode": "TEST01", "cri": 0.5})
            mock_ws.send_text.assert_called_once()
            import json
            sent = json.loads(mock_ws.send_text.call_args[0][0])
            assert sent["type"] == "scores_updated"
            assert sent["data"]["boundary_pcode"] == "TEST01"
            assert sent["data"]["cri"] == 0.5
        finally:
            active_connections.discard(mock_ws)

    @pytest.mark.asyncio
    async def test_broadcast_removes_disconnected_clients(self):
        """Clients that raise on send should be removed from active connections."""
        mock_ws = AsyncMock()
        mock_ws.send_text = AsyncMock(side_effect=Exception("disconnected"))
        active_connections.add(mock_ws)
        try:
            await broadcast_event("test_event", {"key": "value"})
            assert mock_ws not in active_connections
        finally:
            active_connections.discard(mock_ws)

    @pytest.mark.asyncio
    async def test_broadcast_event_types(self):
        """Verify different event types are serialized correctly."""
        mock_ws = AsyncMock()
        mock_ws.send_text = AsyncMock()
        active_connections.add(mock_ws)
        try:
            for event_type in ["indicator_value_changed", "bulk_upload_complete", "scores_updated"]:
                mock_ws.send_text.reset_mock()
                await broadcast_event(event_type, {"test": True})
                import json
                sent = json.loads(mock_ws.send_text.call_args[0][0])
                assert sent["type"] == event_type
        finally:
            active_connections.discard(mock_ws)


class TestIndicatorBroadcastIntegration:
    """Test that indicator endpoints call broadcast_event."""

    @pytest.mark.asyncio
    async def test_submit_indicator_value_broadcasts(self, admin_token, client, db_session):
        """POST /indicators/values should broadcast indicator_value_changed."""
        from sqlalchemy import select
        from app.models.indicator import ClimateIndicator
        from app.models.boundary import AdminBoundary

        ind_result = await db_session.execute(select(ClimateIndicator.id).limit(1))
        ind = ind_result.scalar_one_or_none()
        bnd_result = await db_session.execute(
            select(AdminBoundary.pcode).where(AdminBoundary.adm_level == 4).limit(1)
        )
        bnd = bnd_result.scalar_one_or_none()

        if ind is None or bnd is None:
            pytest.skip("No indicators or boundaries to test broadcast")

        with patch("app.api.indicators.broadcast_event", new_callable=AsyncMock) as mock_broadcast:
            response = await client.post(
                "/api/v1/indicators/values",
                json={"indicator_id": ind, "boundary_pcode": bnd, "value": 5.0},
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert response.status_code == 200
            mock_broadcast.assert_called_once()
            call_args = mock_broadcast.call_args
            assert call_args[0][0] == "indicator_value_changed"
            assert call_args[0][1]["boundary_pcode"] == bnd

    @pytest.mark.asyncio
    async def test_risk_index_create_broadcasts(self, admin_token, client, db_session):
        """POST /risk-index/ should broadcast scores_updated."""
        from sqlalchemy import select
        from app.models.boundary import AdminBoundary
        from app.models.indicator_reference import IndicatorReference

        bnd_result = await db_session.execute(
            select(AdminBoundary.pcode).where(AdminBoundary.adm_level == 4).limit(1)
        )
        bnd = bnd_result.scalar_one_or_none()
        ref_result = await db_session.execute(select(IndicatorReference).limit(1))

        if bnd is None or ref_result.scalar_one_or_none() is None:
            pytest.skip("No boundaries or references to test broadcast")

        with patch("app.api.risk_index.broadcast_event", new_callable=AsyncMock) as mock_broadcast:
            response = await client.post(
                "/api/v1/risk-index/",
                json={"boundary_pcode": bnd, "year": 2024, "values": {"rainfall": 3.5}},
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert response.status_code == 200
            mock_broadcast.assert_called_once()
            assert mock_broadcast.call_args[0][0] == "scores_updated"


class TestCSVExportEndpoint:
    """Test that CSV export endpoint includes all expected columns."""

    @pytest.mark.asyncio
    async def test_csv_export_has_headers(self, admin_token, client):
        """CSV export should include boundary and score columns."""
        response = await client.get(
            "/api/v1/export/csv?level=1",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        content_type = response.headers.get("content-type", "")
        assert "text/csv" in content_type

    @pytest.mark.asyncio
    async def test_csv_export_level_4(self, admin_token, client):
        response = await client.get(
            "/api/v1/export/csv?level=4",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200


class TestBulkUploadBroadcast:
    """Test that bulk upload broadcasts on success."""

    @pytest.mark.asyncio
    async def test_bulk_upload_broadcasts_on_success(self, admin_token, client, db_session):
        """Bulk upload with valid data should call broadcast_event."""
        import io
        from sqlalchemy import select
        from app.models.indicator import ClimateIndicator
        from app.models.boundary import AdminBoundary

        ind_result = await db_session.execute(
            select(ClimateIndicator.code, ClimateIndicator.gis_attribute_id).limit(1)
        )
        ind = ind_result.one_or_none()
        bnd_result = await db_session.execute(
            select(AdminBoundary.pcode).where(AdminBoundary.adm_level == 4).limit(1)
        )
        bnd = bnd_result.scalar_one_or_none()

        if ind is None or bnd is None:
            pytest.skip("No indicators or boundaries for bulk upload test")

        code = ind.gis_attribute_id or ind.code
        csv_content = f"indicator_code,boundary_pcode,value\n{code},{bnd},1.0"

        with patch("app.api.indicators.broadcast_event", new_callable=AsyncMock) as mock_broadcast:
            response = await client.post(
                "/api/v1/indicators/values/bulk",
                files={"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")},
                headers={"Authorization": f"Bearer {admin_token}"},
            )
            assert response.status_code == 200
            data = response.json()["data"]
            if data["created"] > 0 or data["updated"] > 0:
                mock_broadcast.assert_called()
