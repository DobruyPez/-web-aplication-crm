import RequireAdmin from "../components/RequireAdmin";
import ResourceFrame from "../components/ResourceFrame";

const UsersPage = () => (
  <RequireAdmin>
    <p className="hint" style={{ marginBottom: 14 }}>
      Здесь создаются только <strong>менеджеры</strong>. Роль администратора назначается только в базе данных; такие учётные записи нельзя изменить или удалить из интерфейса.
    </p>
    <ResourceFrame routeKey="users" />
  </RequireAdmin>
);

export default UsersPage;
