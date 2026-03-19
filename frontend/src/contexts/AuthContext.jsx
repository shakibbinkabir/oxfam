import { createContext, useContext, useState, useEffect } from "react";
import { loginApi, registerApi, getMeApi, logoutApi } from "../api/auth";
import { setAccessToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On page load, attempt silent refresh via httpOnly cookie
    silentRefresh();
  }, []);

  async function silentRefresh() {
    try {
      // The httpOnly cookie is sent automatically — try to get a new access token
      const refreshRes = await fetch(
        (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1") +
          "/auth/refresh",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        }
      );

      if (!refreshRes.ok) {
        throw new Error("Refresh failed");
      }

      const refreshData = await refreshRes.json();
      const newToken = refreshData.data.access_token;
      setAccessToken(newToken);

      // Now fetch user profile
      const res = await getMeApi();
      setUser(res.data.data);
    } catch {
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const res = await loginApi(email, password);
    const { access_token, user: userData } = res.data.data;
    // Access token stored in memory only — refresh token set as httpOnly cookie by backend
    setAccessToken(access_token);
    setUser(userData);
    return userData;
  }

  async function register(email, password, full_name) {
    const res = await registerApi(email, password, full_name);
    return res.data.data;
  }

  async function logout() {
    try {
      await logoutApi();
    } catch {
      // Ignore errors during logout
    }
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
