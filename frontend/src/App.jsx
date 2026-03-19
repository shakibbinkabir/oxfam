import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/layout/ErrorBoundary";
import LoginPage from "./components/auth/LoginPage";

// Lazy-loaded page components
const RegisterPage = lazy(() => import("./components/auth/RegisterPage"));
const DashboardLayout = lazy(() => import("./components/layout/DashboardLayout"));
const ProtectedRoute = lazy(() => import("./components/layout/ProtectedRoute"));
const NotFoundPage = lazy(() => import("./components/layout/NotFoundPage"));
const MapPage = lazy(() => import("./components/map/MapPage"));
const IndicatorsPage = lazy(() => import("./components/indicators/IndicatorsPage"));
const SubmitIndicatorPage = lazy(() => import("./components/indicators/SubmitIndicatorPage"));
const IndicatorValuesPage = lazy(() => import("./components/indicators/IndicatorValuesPage"));
const ValueUploaderPage = lazy(() => import("./components/indicators/ValueUploaderPage"));
const RiskIndexWizard = lazy(() => import("./components/indicators/RiskIndexWizard"));
const UnitsPage = lazy(() => import("./components/units/UnitsPage"));
const SourcesPage = lazy(() => import("./components/sources/SourcesPage"));
const UsersPage = lazy(() => import("./components/users/UsersPage"));
const ScenariosPage = lazy(() => import("./components/scenarios/ScenariosPage"));
const AuditLogPage = lazy(() => import("./components/audit/AuditLogPage"));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-[#1B4F72] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
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
            <Route path="indicator-values" element={<IndicatorValuesPage />} />
            <Route
              path="value-uploader"
              element={
                <ProtectedRoute requiredRole="admin">
                  <ValueUploaderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="submit-risk-index"
              element={
                <ProtectedRoute requiredRole="admin">
                  <RiskIndexWizard />
                </ProtectedRoute>
              }
            />
            <Route path="scenarios" element={<ScenariosPage />} />
            <Route
              path="audit-log"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AuditLogPage />
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
      </Suspense>
    </ErrorBoundary>
  );
}
