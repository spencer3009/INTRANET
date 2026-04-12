import SchedulePage from "./SchedulePage";

export default function StudentSchedulePage({ user, token, onLogout }) {
  return (
    <SchedulePage
      user={user}
      token={token}
      onLogout={onLogout}
      readOnly={true}
      showFilters={false}
      lockedSeccionId={user?.seccion_id}
      apiEndpoint="/api/student/schedule"
      headerTitle="Mi Horario de Clases"
    />
  );
}
