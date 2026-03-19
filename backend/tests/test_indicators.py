import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_authenticated_can_list(client: AsyncClient, user_token):
    res = await client.get("/api/v1/indicators/", headers=auth_header(user_token))
    assert res.status_code == 200
    data = res.json()["data"]
    assert "indicators" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_unauthenticated_cannot_list(client: AsyncClient):
    res = await client.get("/api/v1/indicators/")
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_admin_can_create(client: AsyncClient, admin_token):
    code = f"test_{uuid.uuid4().hex[:8]}"
    res = await client.post("/api/v1/indicators",
        headers=auth_header(admin_token),
        json={
            "component": "Hazard",
            "subcategory": "Hazard",
            "indicator_name": "Test Indicator",
            "code": code,
            "unit": "%",
            "source": "Test",
        },
    )
    assert res.status_code == 200
    assert res.json()["data"]["code"] == code


@pytest.mark.asyncio
async def test_user_cannot_create(client: AsyncClient, user_token):
    res = await client.post("/api/v1/indicators",
        headers=auth_header(user_token),
        json={
            "component": "Hazard",
            "indicator_name": "Blocked Indicator",
            "code": f"blocked_{uuid.uuid4().hex[:8]}",
        },
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_update(client: AsyncClient, admin_token):
    code = f"upd_{uuid.uuid4().hex[:8]}"
    create_res = await client.post("/api/v1/indicators",
        headers=auth_header(admin_token),
        json={
            "component": "Hazard",
            "indicator_name": "Update Me",
            "code": code,
        },
    )
    ind_id = create_res.json()["data"]["id"]

    res = await client.put(f"/api/v1/indicators/{ind_id}",
        headers=auth_header(admin_token),
        json={"indicator_name": "Updated Name"},
    )
    assert res.status_code == 200
    assert res.json()["data"]["indicator_name"] == "Updated Name"


@pytest.mark.asyncio
async def test_admin_can_delete(client: AsyncClient, admin_token):
    code = f"del_{uuid.uuid4().hex[:8]}"
    create_res = await client.post("/api/v1/indicators",
        headers=auth_header(admin_token),
        json={
            "component": "Environmental",
            "indicator_name": "Delete Me",
            "code": code,
        },
    )
    ind_id = create_res.json()["data"]["id"]

    res = await client.delete(f"/api/v1/indicators/{ind_id}",
        headers=auth_header(admin_token),
    )
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_duplicate_code(client: AsyncClient, admin_token):
    code = f"dup_{uuid.uuid4().hex[:8]}"
    await client.post("/api/v1/indicators",
        headers=auth_header(admin_token),
        json={
            "component": "Hazard",
            "indicator_name": "First",
            "code": code,
        },
    )
    res = await client.post("/api/v1/indicators",
        headers=auth_header(admin_token),
        json={
            "component": "Hazard",
            "indicator_name": "Second",
            "code": code,
        },
    )
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_export_csv(client: AsyncClient, user_token):
    res = await client.get("/api/v1/indicators/export?format=csv",
        headers=auth_header(user_token),
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
