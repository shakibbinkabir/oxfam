import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_superadmin_can_list_users(client: AsyncClient, superadmin_token):
    res = await client.get("/api/v1/users/", headers=auth_header(superadmin_token))
    assert res.status_code == 200
    data = res.json()["data"]
    assert "users" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_admin_cannot_list_users(client: AsyncClient, admin_token):
    res = await client.get("/api/v1/users/", headers=auth_header(admin_token))
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_superadmin_can_create_user(client: AsyncClient, superadmin_token):
    res = await client.post("/api/v1/users/",
        headers=auth_header(superadmin_token),
        json={
            "email": f"created_{uuid.uuid4().hex[:6]}@test.com",
            "password": "password123",
            "full_name": "Created User",
            "role": "admin",
        },
    )
    assert res.status_code == 200
    assert res.json()["data"]["role"] == "admin"


@pytest.mark.asyncio
async def test_superadmin_can_update_user(client: AsyncClient, superadmin_token, regular_user):
    res = await client.put(f"/api/v1/users/{regular_user.id}",
        headers=auth_header(superadmin_token),
        json={"full_name": "Updated Name"},
    )
    assert res.status_code == 200
    assert res.json()["data"]["full_name"] == "Updated Name"


@pytest.mark.asyncio
async def test_superadmin_can_delete_user(client: AsyncClient, superadmin_token, regular_user):
    res = await client.delete(f"/api/v1/users/{regular_user.id}",
        headers=auth_header(superadmin_token),
    )
    assert res.status_code == 200
    assert res.json()["message"] == "User deleted successfully"
