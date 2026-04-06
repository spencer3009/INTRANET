import { useNavigate } from "react-router-dom";
import ParentSidebar from "../components/ParentSidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import ParentPsychologyMessages from "../components/ParentPsychologyMessages";

export default function ParentPsychMessagesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const subdomain = user?.subdomain;

  const navigateTo = (path) => {
    if (subdomain) navigate(`/${subdomain}${path}`);
    else navigate(path);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <ParentSidebar
        user={user}
        activePage="psicologia-mensajes"
        navigateTo={navigateTo}
        onLogout={onLogout}
      />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <ParentPsychologyMessages
          token={token}
          user={user}
          subdomain={subdomain}
          onBack={() => navigateTo("/parent")}
        />
      </div>
      <MobileBottomNav activePage="psicologia-mensajes" navigateTo={navigateTo} role="parent" />
    </div>
  );
}
