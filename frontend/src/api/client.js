import axios from "axios";

const client = axios.create({
  baseURL: "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

let accessToken = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
          refreshPromise = client
            .post("/auth/refresh", { refresh_token: refreshToken })
            .then((res) => {
              const newAccess = res.data.data.access_token;
              const newRefresh = res.data.data.refresh_token;
              setAccessToken(newAccess);
              localStorage.setItem("refresh_token", newRefresh);
              return newAccess;
            })
            .catch((err) => {
              setAccessToken(null);
              localStorage.removeItem("refresh_token");
              window.location.href = "/login";
              return Promise.reject(err);
            })
            .finally(() => {
              refreshPromise = null;
            });
        } else {
          window.location.href = "/login";
          return Promise.reject(error);
        }
      }

      const newToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return client(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default client;
