import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../authContext";

const ProtectedRoute = () => {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
