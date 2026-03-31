import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2, Copy, UserPlus, ExternalLink, CheckCircle, AlertTriangle, Clock, Send } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function SupportDemosPage({ token }) {
  const [status, setStatus] = useState(null);
  const [accesses, setAccesses] = useState([]);
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copied, setCopied] = useState(null);
  const [newAccess, setNewAccess] = useState(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, accessRes, schoolsRes] = await Promise.all([
        fetch(`${API}/api/support/demo/status`, { headers }),
        fetch(`${API}/api/support/demo/accesses`, { headers }),
        fetch(`${API}/api/support/schools`, { headers }),
      ]);
      const statusData = await statusRes.json();
      const accessData = await accessRes.json();
      const schoolsData = await schoolsRes.json();
      setStatus(statusData);
      setAccesses(accessData.accesses || []);
      setSchools((schoolsData.schools || schoolsData || []).filter(s => !s.is_demo));
    } catch (e) {
      console.error("Error fetching demo data:", e);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleClone = async () => {
    if (!selectedSchoolId) return;
    setCloning(true);
    try {
      const res = await fetch(`${API}/api/support/demo/clone`, {
        method: "POST", headers,
        body: JSON.stringify({ source_school_id: selectedSchoolId }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchData();
      } else {
        alert(data.detail || "Error al clonar");
      }
    } catch (e) { alert("Error de conexión"); }
    setCloning(false);
  };

  const handleReclone = async () => {
    if (!window.confirm("¿Eliminar el demo actual y crear uno nuevo desde el mismo colegio fuente?")) return;
    const sourceId = status?.demo_school?.source_school_id;
    if (!sourceId) return;
    setCloning(true);
    try {
      const res = await fetch(`${API}/api/support/demo/reclone`, {
        method: "POST", headers,
        body: JSON.stringify({ source_school_id: sourceId }),
      });
      if (res.ok) await fetchData();
      else { const d = await res.json(); alert(d.detail || "Error"); }
    } catch (e) { alert("Error de conexión"); }
    setCloning(false);
  };

  const handleDeleteClone = async () => {
    if (!window.confirm("¿Eliminar el colegio demo y TODA su data? Esta acción es irreversible.")) return;
    try {
      const res = await fetch(`${API}/api/support/demo/clone`, { method: "DELETE", headers });
      if (res.ok) { await fetchData(); setNewAccess(null); }
      else { const d = await res.json(); alert(d.detail || "Error"); }
    } catch (e) { alert("Error de conexión"); }
  };

  const handleRevokeAccess = async (userId) => {
    if (!window.confirm("¿Revocar este acceso demo?")) return;
    try {
      const res = await fetch(`${API}/api/support/demo/access/${userId}`, { method: "DELETE", headers });
      if (res.ok) await fetchData();
    } catch (e) { alert("Error"); }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="demo-loading">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="demo-management-page">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Gestión de Demos</h1>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
        </Button>
      </div>

      {/* Demo School Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-5" data-testid="demo-school-section">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Colegio Demo</h2>

        {status?.has_demo ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-800 text-lg">{status.demo_school.school_name}</p>
                <p className="text-sm text-slate-500">
                  Clonado de: <span className="font-medium text-slate-700">{status.demo_school.source_school_name}</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Creado: {new Date(status.demo_school.created_at).toLocaleDateString("es-PE")}
                </p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">ACTIVO</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Colecciones" value={status.demo_school.collections_cloned} />
              <Stat label="Documentos" value={status.demo_school.documents_cloned} />
              <Stat label="Alumnos anon." value={status.demo_school.students_anonymized} />
              <Stat label="Padres anon." value={status.demo_school.parents_anonymized} />
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={handleReclone} disabled={cloning} data-testid="reclone-btn">
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${cloning ? "animate-spin" : ""}`} />
                Re-clonar
              </Button>
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleDeleteClone} data-testid="delete-clone-btn">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Eliminar Clon
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3" data-testid="clone-form">
            <p className="text-sm text-slate-600">No hay colegio demo activo. Selecciona un colegio fuente para clonar.</p>
            <div className="flex items-center gap-3">
              <select
                className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                data-testid="source-school-select"
              >
                <option value="">Seleccionar colegio fuente...</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.school_name || s.name} ({s.subdomain})</option>
                ))}
              </select>
              <Button onClick={handleClone} disabled={!selectedSchoolId || cloning} data-testid="clone-btn">
                {cloning ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Copy className="w-4 h-4 mr-1.5" />}
                {cloning ? "Clonando..." : "Clonar Demo"}
              </Button>
            </div>
            {cloning && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Esto puede tardar hasta 30 segundos...
              </p>
            )}
          </div>
        )}
      </div>

      {/* Demo Accesses Section */}
      {status?.has_demo && (
        <div className="bg-white rounded-lg border border-slate-200 p-5" data-testid="demo-accesses-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Accesos Demo</h2>
            <Button size="sm" onClick={() => { setShowCreateModal(true); setNewAccess(null); }} data-testid="create-access-btn">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Crear Acceso
            </Button>
          </div>

          {/* Newly created access (highlight) */}
          {newAccess && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg" data-testid="new-access-card">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-blue-800 text-sm">Acceso creado exitosamente</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-500">Email: </span>
                  <span className="font-mono font-medium">{newAccess.email}</span>
                  <button onClick={() => copyToClipboard(newAccess.email, "new-email")}
                    className="ml-1 text-blue-600 hover:text-blue-800">
                    {copied === "new-email" ? <CheckCircle className="w-3.5 h-3.5 inline" /> : <Copy className="w-3.5 h-3.5 inline" />}
                  </button>
                </div>
                <div>
                  <span className="text-slate-500">Contraseña: </span>
                  <span className="font-mono font-medium">{newAccess.password}</span>
                  <button onClick={() => copyToClipboard(newAccess.password, "new-pwd")}
                    className="ml-1 text-blue-600 hover:text-blue-800">
                    {copied === "new-pwd" ? <CheckCircle className="w-3.5 h-3.5 inline" /> : <Copy className="w-3.5 h-3.5 inline" />}
                  </button>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <a href={newAccess.whatsapp_link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors">
                  <Send className="w-3.5 h-3.5" /> Enviar por WhatsApp
                </a>
                <a href={newAccess.login_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-md hover:bg-slate-200 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir Login
                </a>
              </div>
            </div>
          )}

          {/* Access list */}
          {accesses.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No hay accesos demo activos</p>
          ) : (
            <div className="space-y-2">
              {accesses.map((a) => (
                <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg border ${a.is_expired ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}
                  data-testid={`access-row-${a.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{a.prospect_name}</p>
                    <p className="text-xs text-slate-500 font-mono">{a.email}</p>
                    {a.prospect_phone && <p className="text-xs text-slate-400">Tel: {a.prospect_phone}</p>}
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    {a.is_expired ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                        <AlertTriangle className="w-3.5 h-3.5" /> Expirado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <Clock className="w-3.5 h-3.5" /> {a.days_remaining}d
                      </span>
                    )}
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                      onClick={() => handleRevokeAccess(a.id)} data-testid={`revoke-btn-${a.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Access Modal */}
      {showCreateModal && <CreateAccessModal token={token} headers={headers}
        onClose={() => setShowCreateModal(false)}
        onCreated={(data) => { setNewAccess(data); setShowCreateModal(false); fetchData(); }}
      />}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <p className="text-lg font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function CreateAccessModal({ headers, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("51");
  const [days, setDays] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/support/demo/access`, {
        method: "POST", headers,
        body: JSON.stringify({ prospect_name: name.trim(), prospect_phone: phone.trim(), expiration_days: days }),
      });
      const data = await res.json();
      if (res.ok) onCreated(data);
      else alert(data.detail || "Error");
    } catch (e) { alert("Error de conexión"); }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()} data-testid="create-access-modal">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Crear Acceso Demo</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del prospecto</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Juan Pérez" required data-testid="prospect-name-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono (con código país)</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="51987654321" data-testid="prospect-phone-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Días de acceso</label>
            <input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={1} max={30} data-testid="expiration-days-input" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={submitting || !name.trim()} data-testid="submit-access-btn">
              {submitting ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1.5" />}
              {submitting ? "Creando..." : "Crear Acceso"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
