import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
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
        // Refresh token is sent automatically as httpOnly cookie
        refreshPromise = client
          .post("/auth/refresh", {})
          .then((res) => {
            const newAccess = res.data.data.access_token;
            setAccessToken(newAccess);
            return newAccess;
          })
          .catch((err) => {
            setAccessToken(null);
            window.location.href = "/login";
            return Promise.reject(err);
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return client(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default client;
