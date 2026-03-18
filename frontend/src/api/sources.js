import client from "./client";

export const listSources = (params = {}) =>
  client.get("/sources", { params });

export const createSource = (data) => client.post("/sources", data);

export const updateSource = (id, data) => client.put(`/sources/${id}`, data);

export const deleteSource = (id) => client.delete(`/sources/${id}`);
