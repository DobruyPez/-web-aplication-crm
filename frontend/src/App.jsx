import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import ResourceFrame from "./components/ResourceFrame";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import UsersPage from "./pages/UsersPage";
import DocumentUploadPage from "./pages/DocumentUploadPage";
import Profile from "./pages/Profile";
import CallCreatePage from "./pages/CallCreatePage";
import CallRecordingAssignPage from "./pages/CallRecordingAssignPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<ResourceFrame routeKey="clients" />} />
          <Route path="deals" element={<ResourceFrame routeKey="deals" />} />
          <Route path="tasks" element={<ResourceFrame routeKey="tasks" />} />
          <Route path="calls/create" element={<CallCreatePage />} />
          <Route path="calls" element={<ResourceFrame routeKey="calls" />} />
          <Route path="calls/assign-recording" element={<CallRecordingAssignPage />} />
          <Route path="documents/upload" element={<DocumentUploadPage />} />
          <Route path="documents" element={<ResourceFrame routeKey="documents" />} />
          <Route path="profile" element={<Profile />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
