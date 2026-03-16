import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const ROLE_LEVEL = { superadmin: 3, admin: 2, user: 1 };

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B4F72]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && ROLE_LEVEL[user.role] < ROLE_LEVEL[requiredRole]) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
