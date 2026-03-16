import pytest
from httpx import AsyncClient

from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_boundaries_returns_geojson(client: AsyncClient, user_token):
    res = await client.get("/api/v1/geo/boundaries?zoom=7",
        headers=auth_header(user_token),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "FeatureCollection"
    assert "features" in data


@pytest.mark.asyncio
async def test_boundaries_zoom_level_mapping(client: AsyncClient, user_token):
    # zoom 5 should request adm_level 1
    res = await client.get("/api/v1/geo/boundaries?zoom=5",
        headers=auth_header(user_token),
    )
    assert res.status_code == 200
    features = res.json()["features"]
    for f in features:
        assert f["properties"]["adm_level"] == 1

    # zoom 8 should request adm_level 2
    res = await client.get("/api/v1/geo/boundaries?zoom=8",
        headers=auth_header(user_token),
    )
    assert res.status_code == 200
    features = res.json()["features"]
    for f in features:
        assert f["properties"]["adm_level"] == 2


@pytest.mark.asyncio
async def test_divisions_endpoint(client: AsyncClient, user_token):
    res = await client.get("/api/v1/geo/divisions",
        headers=auth_header(user_token),
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_union_detail_not_found(client: AsyncClient, user_token):
    res = await client.get("/api/v1/geo/unions/INVALID_PCODE",
        headers=auth_header(user_token),
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_geo_stats(client: AsyncClient, user_token):
    res = await client.get("/api/v1/geo/stats",
        headers=auth_header(user_token),
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_unauthenticated_cannot_access_geo(client: AsyncClient):
    res = await client.get("/api/v1/geo/boundaries?zoom=7")
    assert res.status_code == 403 or res.status_code == 401
