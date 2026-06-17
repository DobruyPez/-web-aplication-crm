import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import ResourcePanel from "./ResourcePanel";
import { useAuth } from "../authContext";
import { getResourceForUi } from "../resourceUi";
import { parseListViewSearchParams } from "../lib/listViewQuery";

const ResourceFrame = ({ routeKey }) => {
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const role = isAdmin ? "admin" : "manager";
  const toDatetimeLocalNow = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const listParams = useMemo(
    () => parseListViewSearchParams(location.search, routeKey),
    [location.search, routeKey],
  );

  const defaults = useMemo(() => {
    const base = {
      ...(routeKey === "calls" ? { direction: "out", status: "completed", startedAt: toDatetimeLocalNow() } : {}),
    };
    if (!user?.id) {
      return base;
    }
    const clientIdFromHistory =
      routeKey === "calls" && listParams.filterField === "clientId" && listParams.filterValue
        ? listParams.filterValue
        : null;
    return {
      ...base,
      ...(routeKey === "deals" ? { managerId: user.id, documentIds: [] } : {}),
      ...(routeKey === "tasks" ? { authorId: user.id } : {}),
      ...(routeKey === "calls" ? { callerId: user.id } : {}),
      ...(routeKey === "documents" ? { uploaderId: user.id } : {}),
      ...(clientIdFromHistory ? { clientId: clientIdFromHistory } : {}),
    };
  }, [routeKey, user?.id, listParams.filterField, listParams.filterValue]);

  const resource = useMemo(() => getResourceForUi(routeKey, role), [routeKey, role]);

  if (!resource) {
    return <p>Неизвестный раздел.</p>;
  }

  return <ResourcePanel resource={resource} defaults={defaults} />;
};

export default ResourceFrame;
