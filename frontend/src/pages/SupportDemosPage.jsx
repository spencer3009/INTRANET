import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, Trash2, Copy, UserPlus, ExternalLink, CheckCircle,
  AlertTriangle, Clock, Send, ChevronDown, School, Database,
  Users, ShieldCheck, Layers, FileText, X, Search, Camera, Building2, Key
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function SupportDemosPage({ token }) {
  const [status, setStatus] = useState(null);
  const [accesses, setAccesses] = useState([]);
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
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
      setStatus(await statusRes.json());
      setAccesses((await accessRes.json()).accesses || []);
      const raw = await schoolsRes.json();
      setSchools((raw.schools || raw || []).filter(s => !s.is_demo));
    } catch (e) {
      console.error("Error fetching demo data:", e);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleClone = async () => {
    if (!selectedSchool) return;
    setCloning(true);
    try {
      const res = await fetch(`${API}/api/support/demo/clone`, {
        method: "POST", headers,
        body: JSON.stringify({ source_school_id: selectedSchool.id }),
      });
      const data = await res.json();
      if (res.ok) { await fetchData(); setSelectedSchool(null); }
      else alert(data.detail || "Error al clonar");
    } catch (e) { alert("Error de conexión"); }
    setCloning(false);
  };

  const handleReclone = async () => {
    if (!window.confirm("Esto eliminará el demo actual y creará uno nuevo. ¿Continuar?")) return;
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

  const copyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="demo-loading">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm text-slate-500">Cargando datos de demos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10" data-testid="demo-management-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gestión de Demos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Crea demos funcionales para prospectos con data real anonimizada</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="text-slate-600">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Actualizar
        </Button>
      </div>

      {/* Demo School Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm" data-testid="demo-school-section">
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Database className="w-4 h-4 text-indigo-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-700">Colegio Demo</h2>
          </div>
        </div>

        <div className="p-6">
          {status?.has_demo ? (
            <DemoActiveView
              status={status}
              cloning={cloning}
              onReclone={handleReclone}
              onDelete={handleDeleteClone}
            />
          ) : (
            <CloneForm
              schools={schools}
              selectedSchool={selectedSchool}
              onSelect={setSelectedSchool}
              onClone={handleClone}
              cloning={cloning}
            />
          )}
        </div>
      </div>

      {/* Demo Accesses Card */}
      {status?.has_demo && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" data-testid="demo-accesses-section">
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <h2 className="text-sm font-semibold text-slate-700">Accesos Demo</h2>
              <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">{accesses.length}</span>
            </div>
            <Button size="sm" onClick={() => { setShowCreateModal(true); setNewAccess(null); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="create-access-btn">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Crear Acceso
            </Button>
          </div>

          <div className="p-6 space-y-4">
            {/* New access highlight */}
            {newAccess && <NewAccessCard access={newAccess} copyText={copyText} copied={copied} />}

            {/* Access list */}
            {accesses.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No hay accesos demo activos</p>
                <p className="text-xs text-slate-300 mt-1">Crea uno para enviar credenciales a un prospecto</p>
              </div>
            ) : (
              <div className="space-y-2">
                {accesses.map((a) => (
                  <AccessRow key={a.id} access={a} onRevoke={() => handleRevokeAccess(a.id)} token={token} onUpdate={fetchData} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Access Modal */}
      {showCreateModal && (
        <CreateAccessModal
          headers={headers}
          onClose={() => setShowCreateModal(false)}
          onCreated={(data) => { setNewAccess(data); setShowCreateModal(false); fetchData(); }}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════ */
/*  SUBCOMPONENTS                                                             */
/* ════════════════════════════════════════════════════════════════════════════ */

function DemoActiveView({ status, cloning, onReclone, onDelete }) {
  const s = status.demo_school;
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <School className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">{s.school_name}</h3>
            <p className="text-sm text-slate-500">Clonado de <span className="font-medium text-slate-600">{s.source_school_name}</span></p>
            <p className="text-xs text-slate-400 mt-0.5">
              Slug: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{s.subdomain}</code>
              <span className="mx-2">·</span>
              {new Date(s.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 tracking-wide">
          ACTIVO
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Layers} color="indigo" label="Colecciones" value={s.collections_cloned} />
        <StatCard icon={FileText} color="blue" label="Documentos" value={s.documents_cloned?.toLocaleString()} />
        <StatCard icon={Users} color="amber" label="Alumnos anon." value={s.students_anonymized} />
        <StatCard icon={Users} color="rose" label="Padres anon." value={s.parents_anonymized} />
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
        <Button variant="outline" size="sm" onClick={onReclone} disabled={cloning} data-testid="reclone-btn"
          className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${cloning ? "animate-spin" : ""}`} />
          {cloning ? "Re-clonando..." : "Re-clonar"}
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete}
          className="text-red-600 border-red-200 hover:bg-red-50" data-testid="delete-clone-btn">
          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Eliminar Clon
        </Button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <Icon className="w-4 h-4 mb-2 opacity-60" />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

function CloneForm({ schools, selectedSchool, onSelect, onClone, cloning }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = schools.filter(s =>
    (s.school_name || s.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (s.subdomain || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5" data-testid="clone-form">
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Database className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-700">No hay colegio demo activo</h3>
        <p className="text-sm text-slate-400 mt-1">Selecciona un colegio fuente para crear una copia demo con data anonimizada</p>
      </div>

      {/* Custom school selector with logos */}
      <div className="relative max-w-2xl mx-auto" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm hover:border-indigo-300 hover:ring-2 hover:ring-indigo-100 transition-all"
          data-testid="source-school-select"
        >
          {selectedSchool ? (
            <div className="flex items-center gap-3">
              <SchoolAvatar school={selectedSchool} size="sm" />
              <div className="text-left">
                <p className="font-medium text-slate-800">{selectedSchool.school_name || selectedSchool.name}</p>
                <p className="text-xs text-slate-400">{selectedSchool.subdomain}</p>
              </div>
            </div>
          ) : (
            <span className="text-slate-400">Seleccionar colegio fuente...</span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute z-50 mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar colegio..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">No se encontraron colegios</div>
              ) : (
                filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { onSelect(s); setOpen(false); setSearch(""); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0 ${selectedSchool?.id === s.id ? "bg-indigo-50" : ""}`}
                  >
                    <SchoolAvatar school={s} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-800 truncate">{s.school_name || s.name}</p>
                      <p className="text-xs text-slate-400 truncate">{s.subdomain}</p>
                    </div>
                    {selectedSchool?.id === s.id && <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Clone button */}
      <div className="flex justify-center">
        <Button
          onClick={onClone}
          disabled={!selectedSchool || cloning}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-200 disabled:shadow-none transition-all"
          data-testid="clone-btn"
        >
          {cloning ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Clonando colegio...
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" /> Clonar como Demo
            </>
          )}
        </Button>
      </div>

      {cloning && (
        <div className="flex items-center justify-center gap-2 text-amber-600 text-sm">
          <Clock className="w-4 h-4" />
          <span>Copiando colecciones y anonimizando datos... esto puede tardar hasta 30 segundos</span>
        </div>
      )}
    </div>
  );
}

function SchoolAvatar({ school, size = "md" }) {
  const dim = size === "sm" ? "w-9 h-9" : "w-11 h-11";
  const textSize = size === "sm" ? "text-sm" : "text-base";
  const logo = school.logo_url;
  const name = school.school_name || school.name || "?";
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  if (logo) {
    return (
      <img src={logo} alt={name} className={`${dim} rounded-xl object-cover border border-slate-200 shrink-0`} />
    );
  }
  return (
    <div className={`${dim} rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0`}>
      <span className={`${textSize} font-bold text-white`}>{initials}</span>
    </div>
  );
}

function NewAccessCard({ access, copyText, copied }) {
  return (
    <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl" data-testid="new-access-card">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="w-5 h-5 text-emerald-600" />
        <span className="font-semibold text-emerald-800">Acceso creado exitosamente</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CredentialField label="Email" value={access.email} id="new-email" copyText={copyText} copied={copied} />
        <CredentialField label="Contraseña" value={access.password} id="new-pwd" copyText={copyText} copied={copied} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={access.whatsapp_link} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
          <Send className="w-4 h-4" /> Enviar por WhatsApp
        </a>
        <a href={access.login_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors border border-slate-200">
          <ExternalLink className="w-4 h-4" /> Abrir Login
        </a>
      </div>
    </div>
  );
}

function CredentialField({ label, value, id, copyText, copied }) {
  return (
    <div className="bg-white/70 rounded-lg px-3 py-2.5 border border-emerald-100">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <code className="text-sm font-semibold text-slate-800 truncate">{value}</code>
        <button onClick={() => copyText(value, id)}
          className="shrink-0 p-1 rounded hover:bg-emerald-100 transition-colors">
          {copied === id
            ? <CheckCircle className="w-4 h-4 text-emerald-600" />
            : <Copy className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          }
        </button>
      </div>
    </div>
  );
}

function AccessRow({ access: a, onRevoke, token, onUpdate }) {
  const profileInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [profileUrl, setProfileUrl] = useState(a.profile_photo_url || null);
  const [logoUrl, setLogoUrl] = useState(a.logo_url || null);
  const [creds, setCreds] = useState(null);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [copied, setCopied] = useState(null);

  const copyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleResetPassword = async () => {
    setLoadingCreds(true);
    try {
      const res = await fetch(`${API}/api/support/demo/access/${a.id}/reset-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) setCreds(data);
      else alert(data.detail || "Error");
    } catch { alert("Error de conexión"); }
    setLoadingCreds(false);
  };

  const handleUpload = async (file, type) => {
    const isProfile = type === "profile";
    const setUploading = isProfile ? setUploadingProfile : setUploadingLogo;
    const endpoint = isProfile
      ? `${API}/api/support/demo/access/${a.id}/profile-photo`
      : `${API}/api/support/demo/access/${a.id}/logo`;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        if (isProfile) setProfileUrl(data.profile_photo_url);
        else setLogoUrl(data.logo_url);
      } else {
        alert(data.detail || "Error al subir imagen");
      }
    } catch {
      alert("Error de conexión al subir imagen");
    }
    setUploading(false);
  };

  return (
    <div className={`rounded-xl border transition-colors ${a.is_expired ? "bg-red-50/50 border-red-200" : "bg-slate-50/50 border-slate-200 hover:border-slate-300"}`}
      data-testid={`access-row-${a.id}`}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Profile Photo Avatar */}
          <div
            className="relative w-10 h-10 rounded-full shrink-0 cursor-pointer group"
            title="Cambiar foto de perfil"
            onClick={() => profileInputRef.current?.click()}
            data-testid={`profile-photo-trigger-${a.id}`}
          >
            {uploadingProfile ? (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${a.is_expired ? "bg-red-100" : "bg-indigo-100"}`}>
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
              </div>
            ) : profileUrl ? (
              <img src={profileUrl} alt={a.prospect_name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${a.is_expired ? "bg-red-100" : "bg-indigo-100"}`}>
                <span className={`text-sm font-bold ${a.is_expired ? "text-red-600" : "text-indigo-600"}`}>
                  {(a.prospect_name || "?")[0].toUpperCase()}
                </span>
              </div>
            )}
            {!uploadingProfile && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-4 h-4 text-white" />
              </div>
            )}
            <input
              ref={profileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0], "profile"); e.target.value = ""; }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-800 text-sm">{a.prospect_name}</p>
            <p className="text-xs text-slate-500 font-mono truncate">{a.email}</p>
            {a.prospect_phone && <p className="text-xs text-slate-400">Tel: {a.prospect_phone}</p>}
          </div>

          {/* Logo */}
          <div
            className="relative w-9 h-9 rounded-lg shrink-0 cursor-pointer group border border-dashed border-slate-300 hover:border-indigo-400 transition-colors"
            title="Cambiar logo"
            onClick={() => logoInputRef.current?.click()}
            data-testid={`logo-trigger-${a.id}`}
          >
            {uploadingLogo ? (
              <div className="w-full h-full flex items-center justify-center">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              </div>
            ) : logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full rounded-lg object-contain p-0.5" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Building2 className="w-4 h-4 text-slate-300" />
              </div>
            )}
            {!uploadingLogo && (
              <div className="absolute inset-0 rounded-lg bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0], "logo"); e.target.value = ""; }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 ml-3">
          <Button variant="outline" size="sm" onClick={handleResetPassword} disabled={loadingCreds}
            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 h-8 text-xs px-2.5"
            title="Ver credenciales (regenera contraseña)"
            data-testid={`creds-btn-${a.id}`}>
            {loadingCreds ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
          </Button>
          {a.is_expired ? (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
              <AlertTriangle className="w-3 h-3" /> Expirado
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
              <Clock className="w-3 h-3" /> {a.days_remaining}d restantes
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={onRevoke}
            className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0 rounded-lg"
            data-testid={`revoke-btn-${a.id}`}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Credentials panel */}
      {creds && (
        <div className="px-4 pb-4">
          <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-semibold text-indigo-800">Credenciales actualizadas</span>
              </div>
              <button onClick={() => setCreds(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="bg-white/70 rounded-lg px-3 py-2 border border-indigo-100">
                <p className="text-xs text-slate-500 mb-0.5">Email</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-semibold text-slate-800 truncate">{creds.email}</code>
                  <button onClick={() => copyText(creds.email, `e-${a.id}`)} className="shrink-0 p-1 rounded hover:bg-indigo-100">
                    {copied === `e-${a.id}` ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                </div>
              </div>
              <div className="bg-white/70 rounded-lg px-3 py-2 border border-indigo-100">
                <p className="text-xs text-slate-500 mb-0.5">Contraseña</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm font-semibold text-slate-800">{creds.password}</code>
                  <button onClick={() => copyText(creds.password, `p-${a.id}`)} className="shrink-0 p-1 rounded hover:bg-indigo-100">
                    {copied === `p-${a.id}` ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {creds.whatsapp_link && (
                <a href={creds.whatsapp_link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors">
                  <Send className="w-3.5 h-3.5" /> Enviar por WhatsApp
                </a>
              )}
              <a href={creds.login_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 border border-slate-200">
                <ExternalLink className="w-3.5 h-3.5" /> Abrir Login
              </a>
            </div>
          </div>
        </div>
      )}
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()} data-testid="create-access-modal">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center justify-between">
          <h3 className="text-white font-semibold">Crear Acceso Demo</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre del prospecto</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition-all"
              placeholder="Ej: Juan Pérez" required data-testid="prospect-name-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Teléfono (con código país)</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition-all"
              placeholder="51987654321" data-testid="prospect-phone-input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Días de acceso</label>
            <input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition-all"
              min={1} max={30} data-testid="expiration-days-input" />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl">Cancelar</Button>
            <Button type="submit" disabled={submitting || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5" data-testid="submit-access-btn">
              {submitting ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1.5" />}
              {submitting ? "Creando..." : "Crear Acceso"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
