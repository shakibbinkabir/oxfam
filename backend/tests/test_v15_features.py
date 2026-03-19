"""Tests for v1.5 features: wizard, exports, soft-delete, audit trail."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.boundary import AdminBoundary
from app.models.indicator import ClimateIndicator
from app.models.indicator_reference import IndicatorReference
from app.models.indicator_value import IndicatorValue
from app.services.audit import create_audit_log
from app.services.cvi_engine import normalise, compute_component_score, compute_vulnerability, compute_cri


# ── Unit tests (no DB needed) ──


class TestSoftDeleteModel:
    """Test that IndicatorValue model supports soft-delete fields."""

    def test_is_deleted_default_false(self):
        iv = IndicatorValue(
            indicator_id=1,
            boundary_pcode="TEST01",
            value=1.0,
        )
        assert not iv.is_deleted
        assert iv.deleted_at is None


class TestCVIEngineEdgeCases:
    """Additional CVI engine tests for wizard preview."""

    def test_normalise_with_known_values(self):
        # Salinity: value=7.1, min=0, max=20, direction=+
        result = normalise(7.1, 0.0, 20.0, "+")
        assert result == pytest.approx(0.355, abs=0.001)

    def test_normalise_inverted_indicator(self):
        # Literacy: value=52, min=20, max=100, direction=-
        result = normalise(52.0, 20.0, 100.0, "-")
        expected = 1.0 - (52.0 - 20.0) / (100.0 - 20.0)
        assert result == pytest.approx(expected, abs=0.001)

    def test_component_score_with_all_nine_hazard(self):
        values = [0.3, 0.5, 0.2, 0.7, 0.4, 0.1, 0.8, 0.6, 0.9]
        result = compute_component_score(values)
        assert result == pytest.approx(sum(values) / 9, abs=0.001)

    def test_vulnerability_full_formula(self):
        # PRD formula: V = (E + S + (1 - AC)) / 3
        result = compute_vulnerability(0.45, 0.35, 0.4)
        expected = (0.45 + 0.35 + (1.0 - 0.4)) / 3
        assert result == pytest.approx(expected, abs=0.001)

    def test_cri_bounded(self):
        result = compute_cri(1.0, 1.0)
        assert 0.0 <= result <= 1.0


# ── Integration tests (require DB) ──


@pytest.mark.asyncio
class TestAuditLogCreation:
    """Test audit log creation service."""

    async def test_create_audit_log(self, db_session: AsyncSession, admin_user):
        log = await create_audit_log(
            db_session,
            user_id=admin_user.id,
            action="create",
            entity_type="indicator_value",
            entity_id="123",
            new_values={"value": 42.0},
        )
        assert log.id is not None
        assert log.action == "create"
        assert log.entity_type == "indicator_value"
        assert log.new_values == {"value": 42.0}

    async def test_audit_log_with_old_and_new_values(self, db_session: AsyncSession, admin_user):
        log = await create_audit_log(
            db_session,
            user_id=admin_user.id,
            action="update",
            entity_type="risk_index",
            entity_id="BD30140602",
            old_values={"rainfall": 3.5},
            new_values={"rainfall": 5.0},
        )
        assert log.old_values == {"rainfall": 3.5}
        assert log.new_values == {"rainfall": 5.0}


@pytest.mark.asyncio
class TestSoftDelete:
    """Test soft-delete and restore for indicator values."""

    async def test_soft_delete_sets_is_deleted(self, db_session: AsyncSession, admin_token, client):
        # First, we need an indicator value to delete
        # Check if any exist
        result = await db_session.execute(
            select(IndicatorValue).where(IndicatorValue.is_deleted == False).limit(1)
        )
        iv = result.scalar_one_or_none()
        if iv is None:
            pytest.skip("No indicator values to test soft-delete")

        response = await client.delete(
            f"/api/v1/indicators/values/{iv.id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200

        await db_session.refresh(iv)
        assert iv.is_deleted
        assert iv.deleted_at is not None

    async def test_restore_clears_is_deleted(self, db_session: AsyncSession, admin_token, client):
        # Find a soft-deleted value
        result = await db_session.execute(
            select(IndicatorValue).where(IndicatorValue.is_deleted == True).limit(1)
        )
        iv = result.scalar_one_or_none()
        if iv is None:
            pytest.skip("No soft-deleted indicator values to test restore")

        response = await client.post(
            f"/api/v1/indicators/values/{iv.id}/restore",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200

        await db_session.refresh(iv)
        assert not iv.is_deleted
        assert iv.deleted_at is None


@pytest.mark.asyncio
class TestAuditLogAPI:
    """Test audit log API endpoints."""

    async def test_list_audit_logs_admin(self, admin_token, client):
        response = await client.get(
            "/api/v1/audit-logs/",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "logs" in data["data"]
        assert "total" in data["data"]

    async def test_list_audit_logs_regular_user_forbidden(self, user_token, client):
        response = await client.get(
            "/api/v1/audit-logs/",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestRiskIndexAPI:
    """Test risk index create/update endpoints."""

    async def test_create_risk_index_basic(self, admin_token, client, db_session):
        # Check if there's a union boundary we can use
        result = await db_session.execute(
            select(AdminBoundary.pcode).where(AdminBoundary.adm_level == 4).limit(1)
        )
        boundary = result.scalar_one_or_none()
        if boundary is None:
            pytest.skip("No union boundaries to test risk index creation")

        # Check if there are indicator references
        ref_result = await db_session.execute(select(IndicatorReference).limit(1))
        if ref_result.scalar_one_or_none() is None:
            pytest.skip("No indicator references to test risk index creation")

        response = await client.post(
            "/api/v1/risk-index/",
            json={
                "boundary_pcode": boundary,
                "year": 2024,
                "values": {"rainfall": 3.5, "heat": 38.0},
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["data"]["boundary_pcode"] == boundary

    async def test_create_risk_index_unknown_boundary(self, admin_token, client):
        response = await client.post(
            "/api/v1/risk-index/",
            json={
                "boundary_pcode": "NONEXISTENT",
                "year": 2024,
                "values": {"rainfall": 3.5},
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestExportCSV:
    """Test CSV export endpoint."""

    async def test_export_csv(self, admin_token, client):
        response = await client.get(
            "/api/v1/export/csv?level=1",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")

    async def test_export_csv_with_filters(self, admin_token, client):
        response = await client.get(
            "/api/v1/export/csv?level=4",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200


@pytest.mark.asyncio
class TestExportPDF:
    """Test PDF export endpoint."""

    async def test_export_pdf_missing_boundary(self, admin_token, client):
        response = await client.get(
            "/api/v1/export/pdf?boundary_pcode=NONEXISTENT",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 404

    async def test_export_pdf_with_valid_boundary(self, admin_token, client, db_session):
        result = await db_session.execute(
            select(AdminBoundary.pcode).where(AdminBoundary.adm_level == 4).limit(1)
        )
        boundary = result.scalar_one_or_none()
        if boundary is None:
            pytest.skip("No union boundaries to test PDF export")

        response = await client.get(
            f"/api/v1/export/pdf?boundary_pcode={boundary}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        # Will be 200 if reportlab is installed, 501 if not
        assert response.status_code in (200, 501)


@pytest.mark.asyncio
class TestBulkUploadEnhancements:
    """Test enhanced bulk upload with xlsx support and range validation."""

    async def test_bulk_upload_rejects_invalid_extension(self, admin_token, client):
        import io
        content = b"indicator_code,boundary_pcode,value\nrainfall,TEST01,1.0"
        files = {"file": ("test.txt", io.BytesIO(content), "text/plain")}
        response = await client.post(
            "/api/v1/indicators/values/bulk",
            files=files,
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 400

    async def test_include_deleted_filter(self, admin_token, client):
        # Without include_deleted
        response = await client.get(
            "/api/v1/indicators/values?include_deleted=false",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200

        # With include_deleted
        response = await client.get(
            "/api/v1/indicators/values?include_deleted=true",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
