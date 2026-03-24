import client from "./client";

export const listUsersApi = (skip = 0, limit = 20) =>
  client.get("/users/", { params: { skip, limit } });

export const createUserApi = (data) => client.post("/users/", data);

export const updateUserApi = (id, data) => client.put(`/users/${id}`, data);

export const deleteUserApi = (id) => client.delete(`/users/${id}`);
