import client from "./client";

export const loginApi = (email, password) =>
  client.post("/auth/login", { email, password });

export const registerApi = (email, password, full_name) =>
  client.post("/auth/register", { email, password, full_name });

export const refreshApi = (refresh_token) =>
  client.post("/auth/refresh", { refresh_token });

export const getMeApi = () => client.get("/auth/me");

export const changePasswordApi = (current_password, new_password) =>
  client.put("/auth/me/password", { current_password, new_password });
