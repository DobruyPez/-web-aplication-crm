import { Navigate } from "react-router-dom";
import { useAuth } from "../authContext";

const RequireAdmin = ({ children }) => {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RequireAdmin;
