import { Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/layout/ErrorBoundary";
import LoginPage from "./components/auth/LoginPage";
import RegisterPage from "./components/auth/RegisterPage";
import DashboardLayout from "./components/layout/DashboardLayout";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import NotFoundPage from "./components/layout/NotFoundPage";
import MapPage from "./components/map/MapPage";
import IndicatorsPage from "./components/indicators/IndicatorsPage";
import SubmitIndicatorPage from "./components/indicators/SubmitIndicatorPage";
import UnitsPage from "./components/units/UnitsPage";
import SourcesPage from "./components/sources/SourcesPage";
import UsersPage from "./components/users/UsersPage";

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<MapPage />} />
          <Route path="indicators" element={<IndicatorsPage />} />
          <Route
            path="submit-indicator"
            element={
              <ProtectedRoute requiredRole="admin">
                <SubmitIndicatorPage />
              </ProtectedRoute>
            }
          />
          <Route path="units" element={<UnitsPage />} />
          <Route path="sources" element={<SourcesPage />} />
          <Route
            path="users"
            element={
              <ProtectedRoute requiredRole="superadmin">
                <UsersPage />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
