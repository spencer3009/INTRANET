import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Loader2, ChevronDown, User } from "lucide-react";
import SchedulePage from "./SchedulePage";

const API = process.env.REACT_APP_BACKEND_URL;

function ChildSelectorDropdown({ children, selected, onChange }) {
  const [open, setOpen] = useState(false);
  if (!children || children.length <= 1) return null;
  return (
    <div className="relative inline-block" data-testid="child-selector">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all text-sm font-medium text-slate-700"
      >
        <User className="w-4 h-4 text-slate-400" />
        {selected?.name || "Seleccionar hijo"}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[200px] py-1">
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => { onChange(child); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2 ${selected?.id === child.id ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`}
                data-testid={`child-option-${child.id}`}
              >
                <User className="w-4 h-4" />
                {child.name} {child.last_name || ""}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ParentSchedulePage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [loadingChildren, setLoadingChildren] = useState(true);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const init = async () => {
      setLoadingChildren(true);
      try {
        const res = await axios.get(`${API}/api/parent/me`, { headers });
        const childrenList = res.data.children || [];
        setChildren(childrenList);
        if (childrenList.length > 0) {
          const savedId = localStorage.getItem("selected_child_id");
          const child = childrenList.find(c => c.id === savedId) || childrenList[0];
          setSelectedChild(child);
          localStorage.setItem("selected_child_id", child.id);
        }
      } catch (err) {
        console.error("Error loading children:", err);
      } finally {
        setLoadingChildren(false);
      }
    };
    init();
  }, [token]);

  const handleChildChange = (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    setSelectedChild(newChild);
    localStorage.setItem("selected_child_id", newChild.id);
  };

  if (loadingChildren) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!selectedChild) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <p className="text-slate-500">No se encontraron hijos vinculados.</p>
      </div>
    );
  }

  return (
    <SchedulePage
      key={selectedChild.id}
      user={user}
      token={token}
      onLogout={onLogout}
      readOnly={true}
      showFilters={false}
      lockedSeccionId={selectedChild.seccion_id}
      apiEndpoint={`/api/parent/schedule?student_id=${selectedChild.id}`}
      headerTitle={`Horario de ${selectedChild.name}`}
      childSelector={
        <ChildSelectorDropdown
          children={children}
          selected={selectedChild}
          onChange={handleChildChange}
        />
      }
    />
  );
}
