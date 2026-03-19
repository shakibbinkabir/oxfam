"""API tests for score endpoints."""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_header


@pytest_asyncio.fixture
async def seed_test_data(db_session: AsyncSession):
    """Seed minimal test data: a boundary, indicators, indicator values, and references."""
    # Create a test union boundary
    await db_session.execute(
        text("""
            INSERT INTO admin_boundaries (adm_level, name_en, pcode, parent_pcode, division_name, district_name, upazila_name, created_at)
            VALUES (4, 'Test Union', '99990001', '9999000', 'Test Division', 'Test District', 'Test Upazila', NOW())
            ON CONFLICT (pcode) DO NOTHING
        """)
    )
    # Create a parent upazila boundary
    await db_session.execute(
        text("""
            INSERT INTO admin_boundaries (adm_level, name_en, pcode, parent_pcode, division_name, created_at)
            VALUES (3, 'Test Upazila', '9999000', '9999', 'Test Division', NOW())
            ON CONFLICT (pcode) DO NOTHING
        """)
    )

    # Create test indicators (one per dimension)
    indicators = [
        ("Hazard", "Hazard", "Test Rainfall", "test_rainfall", "rainfall"),
        ("Socioeconomic", "Exposure", "Test Population", "test_population", "population"),
        ("Socioeconomic", "Sensitivity", "Test Pop Density", "test_pop_density", "pop_density"),
        ("Socioeconomic", "Adaptive Capacity", "Test Literacy", "test_literacy", "literacy"),
        ("Environmental", "Exposure", "Test Forest", "test_forest", "forest"),
        ("Environmental", "Sensitivity", "Test NDVI", "test_ndvi", "ndvi"),
    ]

    indicator_ids = {}
    for component, subcategory, name, code, gis_attr in indicators:
        result = await db_session.execute(
            text("""
                INSERT INTO climate_indicators (component, subcategory, indicator_name, code, gis_attribute_id)
                VALUES (:comp, :sub, :name, :code, :gis)
                ON CONFLICT (code) DO UPDATE SET gis_attribute_id = EXCLUDED.gis_attribute_id
                RETURNING id
            """),
            {"comp": component, "sub": subcategory, "name": name, "code": code, "gis": gis_attr},
        )
        row = result.one()
        indicator_ids[gis_attr] = row.id

    # Create indicator values for the test union
    values = {
        "rainfall": 0.7,
        "population": 50000.0,
        "pop_density": 800.0,
        "literacy": 65.0,
        "forest": 15.0,
        "ndvi": 0.45,
    }
    for gis_attr, value in values.items():
        await db_session.execute(
            text("""
                INSERT INTO indicator_values (indicator_id, boundary_pcode, value)
                VALUES (:ind_id, '99990001', :val)
                ON CONFLICT ON CONSTRAINT uq_indicator_boundary DO UPDATE SET value = EXCLUDED.value
            """),
            {"ind_id": indicator_ids[gis_attr], "val": value},
        )

    # Create indicator references
    references = {
        "rainfall": (0.0, 1.0, "+"),
        "population": (1000.0, 200000.0, "+"),
        "pop_density": (50.0, 3000.0, "+"),
        "literacy": (20.0, 95.0, "-"),
        "forest": (0.0, 80.0, "+"),
        "ndvi": (0.1, 0.8, "+"),
    }
    for gis_attr, (gmin, gmax, direction) in references.items():
        await db_session.execute(
            text("""
                INSERT INTO indicator_reference (indicator_id, global_min, global_max, direction, weight)
                VALUES (:ind_id, :gmin, :gmax, :dir, 1.0)
                ON CONFLICT ON CONSTRAINT uq_indicator_reference_indicator DO UPDATE SET
                    global_min = EXCLUDED.global_min,
                    global_max = EXCLUDED.global_max,
                    direction = EXCLUDED.direction
            """),
            {"ind_id": indicator_ids[gis_attr], "gmin": gmin, "gmax": gmax, "dir": direction},
        )

    await db_session.flush()
    return indicator_ids


@pytest.mark.asyncio
async def test_get_scores_for_boundary(
    client: AsyncClient,
    admin_token: str,
    seed_test_data,
):
    """GET /api/v1/scores/{pcode} returns CVI breakdown."""
    response = await client.get(
        "/api/v1/scores/99990001",
        headers=auth_header(admin_token),
    )
    assert response.status_code == 200
    data = response.json()["data"]

    assert data["boundary_pcode"] == "99990001"
    assert data["name_en"] == "Test Union"
    assert data["cri"] is not None
    assert data["hazard"] is not None
    assert data["vulnerability"] is not None
    assert data["cri_category"] in ["Very Low", "Low", "Medium", "High", "Very High"]
    # CRI should be in [0, 1]
    assert 0.0 <= data["cri"] <= 1.0


@pytest.mark.asyncio
async def test_get_scores_not_found(
    client: AsyncClient,
    admin_token: str,
):
    """GET /api/v1/scores/{pcode} returns 404 for nonexistent boundary."""
    response = await client.get(
        "/api/v1/scores/XXXXXXXXX",
        headers=auth_header(admin_token),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_calculation_trace(
    client: AsyncClient,
    admin_token: str,
    seed_test_data,
):
    """GET /api/v1/scores/{pcode}/trace returns step-by-step trace."""
    response = await client.get(
        "/api/v1/scores/99990001/trace",
        headers=auth_header(admin_token),
    )
    assert response.status_code == 200
    data = response.json()["data"]

    assert "step_1_normalisation" in data
    assert "step_2_component_aggregation" in data
    assert "step_3_vulnerability_and_cri" in data

    # Check normalisation step has our indicators
    step1 = data["step_1_normalisation"]
    assert "rainfall" in step1
    assert "normalised_value" in step1["rainfall"]
    assert "formula" in step1["rainfall"]


@pytest.mark.asyncio
async def test_list_indicator_references(
    client: AsyncClient,
    admin_token: str,
    seed_test_data,
):
    """GET /api/v1/scores/reference returns all reference entries."""
    response = await client.get(
        "/api/v1/scores/reference",
        headers=auth_header(admin_token),
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert isinstance(data, list)
    assert len(data) >= 6

    # Check structure
    entry = data[0]
    assert "global_min" in entry
    assert "global_max" in entry
    assert "direction" in entry
    assert "indicator_name" in entry


@pytest.mark.asyncio
async def test_recompute_requires_admin(
    client: AsyncClient,
    user_token: str,
):
    """POST /api/v1/scores/recompute requires admin role."""
    response = await client.post(
        "/api/v1/scores/recompute",
        headers=auth_header(user_token),
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_recompute_all_scores(
    client: AsyncClient,
    admin_token: str,
    seed_test_data,
):
    """POST /api/v1/scores/recompute computes and caches scores."""
    response = await client.post(
        "/api/v1/scores/recompute",
        headers=auth_header(admin_token),
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["computed"] >= 1


@pytest.mark.asyncio
async def test_unauthenticated_access(client: AsyncClient):
    """Score endpoints require authentication."""
    response = await client.get("/api/v1/scores/99990001")
    assert response.status_code in (401, 403)
