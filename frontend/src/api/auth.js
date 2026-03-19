import client from "./client";

export const loginApi = (email, password) =>
  client.post("/auth/login", { email, password });

export const registerApi = (email, password, full_name) =>
  client.post("/auth/register", { email, password, full_name });

export const refreshApi = () => client.post("/auth/refresh", {});

export const logoutApi = () => client.post("/auth/logout");

export const getMeApi = () => client.get("/auth/me");

export const changePasswordApi = (current_password, new_password) =>
  client.put("/auth/me/password", { current_password, new_password });
