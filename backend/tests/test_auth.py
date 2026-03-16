import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_register_valid(client: AsyncClient):
    email = f"newuser_{uuid.uuid4().hex[:6]}@test.com"
    res = await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "password123",
        "full_name": "New User",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["data"]["email"] == email
    assert data["data"]["role"] == "user"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, regular_user):
    res = await client.post("/api/v1/auth/register", json={
        "email": regular_user.email,
        "password": "password123",
        "full_name": "Duplicate User",
    })
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_login_valid(client: AsyncClient):
    email = f"login_{uuid.uuid4().hex[:6]}@test.com"
    await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "password123",
        "full_name": "Login User",
    })
    res = await client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "password123",
    })
    assert res.status_code == 200
    data = res.json()["data"]
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == email


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    email = f"wrongpw_{uuid.uuid4().hex[:6]}@test.com"
    await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "password123",
        "full_name": "Wrong PW User",
    })
    res = await client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "wrongpassword",
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_me_with_token(client: AsyncClient, superadmin_token, superadmin_user):
    res = await client.get("/api/v1/auth/me", headers=auth_header(superadmin_token))
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["email"] == superadmin_user.email
    assert data["role"] == "superadmin"


@pytest.mark.asyncio
async def test_me_without_token(client: AsyncClient):
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 403 or res.status_code == 401


@pytest.mark.asyncio
async def test_token_refresh(client: AsyncClient):
    email = f"refresh_{uuid.uuid4().hex[:6]}@test.com"
    await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "password123",
        "full_name": "Refresh User",
    })
    login_res = await client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "password123",
    })
    refresh_token = login_res.json()["data"]["refresh_token"]

    res = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert res.status_code == 200
    data = res.json()["data"]
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_password_change(client: AsyncClient):
    email = f"changepw_{uuid.uuid4().hex[:6]}@test.com"
    await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "password123",
        "full_name": "Change PW User",
    })
    login_res = await client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "password123",
    })
    token = login_res.json()["data"]["access_token"]

    res = await client.put("/api/v1/auth/me/password",
        headers=auth_header(token),
        json={
            "current_password": "password123",
            "new_password": "newpassword123",
        },
    )
    assert res.status_code == 200
