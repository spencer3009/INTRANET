import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  Lock, Eye, Copy, Plus, Star, MoreVertical, Archive, Trash2,
  CheckCircle2, FileEdit, Loader2, X, Layers, Sparkles, ChevronRight, Shield
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function RegistroAuxiliarPlantillasTab({ user, token, schoolId, subdomain }) {
  const navigate = useNavigate();
  const [plantillas, setPlantillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewPlantilla, setPreviewPlantilla] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  const loadPlantillas = async () => {
    try {
      const { data } = await axios.get(`${API}/api/schools/${schoolId}/registro-auxiliar/plantillas?estado=todas`, { headers });
      setPlantillas(data.plantillas || []);
    } catch (err) {
      toast.error("Error al cargar plantillas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlantillas(); }, []);

  const handleClone = async (plantillaId, nombre) => {
    try {
      const { data } = await axios.post(`${API}/api/schools/${schoolId}/registro-auxiliar/plantillas/${plantillaId}/clonar`,
        { nombre: `Copia de ${nombre}` }, { headers });
      toast.success("Plantilla clonada — abriendo editor");
      navigate(`/${subdomain}/settings/registro-auxiliar/editor/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al clonar");
    }
  };

  const handleCreate = () => {
    navigate(`/${subdomain}/settings/registro-auxiliar/nueva`);
  };

  const handleEdit = (id) => {
    navigate(`/${subdomain}/settings/registro-auxiliar/editor/${id}`);
  };

  const handleSetDefault = async (id) => {
    try {
      await axios.patch(`${API}/api/schools/${schoolId}/registro-auxiliar/plantillas/${id}/predeterminada`, {}, { headers });
      toast.success("Plantilla marcada como predeterminada");
      loadPlantillas();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error");
    }
  };

  const handleChangeEstado = async (id, estado) => {
    try {
      await axios.patch(`${API}/api/schools/${schoolId}/registro-auxiliar/plantillas/${id}/estado`, { estado }, { headers });
      toast.success(`Estado cambiado a '${estado}'`);
      loadPlantillas();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al cambiar estado");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta plantilla permanentemente?")) return;
    try {
      await axios.delete(`${API}/api/schools/${schoolId}/registro-auxiliar/plantillas/${id}`, { headers });
      toast.success("Plantilla eliminada");
      loadPlantillas();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar");
    }
  };

  const handleUseSystem = async () => {
    if (!window.confirm("¿Seguro que quieres desactivar tu plantilla y volver a usar la plantilla del sistema? Los docentes verán las columnas del sistema al registrar notas.")) return;
    try {
      const { data } = await axios.post(`${API}/api/schools/${schoolId}/registro-auxiliar/plantillas/usar-sistema`, {}, { headers });
      toast.success(data.message || "Ahora se usa la plantilla del sistema");
      loadPlantillas();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al cambiar a la plantilla del sistema");
    }
  };

  const sistema = plantillas.find(p => p.es_sistema);
  const propias = plantillas.filter(p => !p.es_sistema);
  const activas = propias.filter(p => p.estado === "activa").length;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-8" data-testid="ra-plantillas-tab">
      {/* Hero header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Plantillas de Registro Auxiliar</h2>
            <p className="text-sm text-slate-500 mt-0.5">Define la estructura de evaluación que usaran tus docentes al registrar notas.</p>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs font-semibold text-slate-400">{propias.length} plantilla{propias.length !== 1 ? "s" : ""} creada{propias.length !== 1 ? "s" : ""}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-xs font-semibold text-emerald-600">{activas} activa{activas !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
        <button onClick={handleCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 shrink-0"
          data-testid="ra-create-new-btn">
          <Plus className="w-4 h-4" /> Nueva plantilla
        </button>
      </div>

      {/* System Template — Premium card */}
      {sistema && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white" data-testid="ra-system-template">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/[0.03] rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative px-6 py-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-base">{sistema.nombre}</h3>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold tracking-wide border border-slate-200">SOLO LECTURA</span>
                    {activas === 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold tracking-wide border border-emerald-200" data-testid="ra-system-in-use-badge">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> EN USO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-lg">{sistema.descripcion || "Estructura de evaluación estandar de EduNet. Clonala para crear tu propia versión personalizada."}</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setPreviewPlantilla(sistema)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
                  data-testid="ra-view-system">
                  <Eye className="w-3.5 h-3.5" /> Vista previa
                </button>
                {activas > 0 && (
                  <button onClick={handleUseSystem}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors shadow-sm"
                    data-testid="ra-use-system-btn"
                    title="Desactiva tu plantilla y vuelve a usar la plantilla del sistema">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Usar esta plantilla
                  </button>
                )}
                <button onClick={() => handleClone(sistema.id, sistema.nombre)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20"
                  data-testid="ra-clone-system">
                  <Copy className="w-3.5 h-3.5" /> Clonar y personalizar
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4 pl-[52px]">
              {(sistema.criterios || []).map(c => (
                <span key={c.id} className="text-[10px] px-3 py-1 rounded-lg font-bold text-white shadow-sm" style={{ backgroundColor: c.color || "#94a3b8" }}>
                  {c.nombre} {c.porcentaje}%
                </span>
              ))}
              {(sistema.columnas_finales || []).map(c => (
                <span key={c.id} className="text-[10px] px-3 py-1 rounded-lg font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  {c.label_corto || c.label} {c.porcentaje}%
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* My Templates */}
      {propias.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">Mis Plantillas</h3>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {propias.map(p => (
              <TemplateCard
                key={p.id}
                plantilla={p}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                onEdit={handleEdit}
                onClone={handleClone}
                onSetDefault={handleSetDefault}
                onChangeEstado={handleChangeEstado}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {propias.length === 0 && (
        <div className="text-center py-16 px-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">Crea tu primera plantilla</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">Clona la plantilla del sistema o crea una desde cero para definir los criterios de evaluación de tu colegio.</p>
          <div className="flex items-center justify-center gap-3">
            {sistema && (
              <button onClick={() => handleClone(sistema.id, sistema.nombre)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors">
                <Copy className="w-4 h-4" /> Clonar plantilla del sistema
              </button>
            )}
            <button onClick={handleCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Crear desde cero
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewPlantilla && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setPreviewPlantilla(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden" data-testid="ra-preview-modal">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold">{previewPlantilla.nombre}</h2>
                <p className="text-indigo-200 text-xs">{previewPlantilla.descripcion || "Vista previa de la estructura"}</p>
              </div>
              <button onClick={() => setPreviewPlantilla(null)} className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/20"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(85vh-80px)]">
              <PreviewTable config={previewPlantilla} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Template Card ── */
function TemplateCard({ plantilla: p, menuOpen, setMenuOpen, onEdit, onClone, onSetDefault, onChangeEstado, onDelete }) {
  const estadoStyles = {
    activa: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", label: "Activa" },
    borrador: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400", label: "Borrador" },
    archivada: { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200", dot: "bg-slate-400", label: "Archivada" },
  };
  const est = estadoStyles[p.estado] || estadoStyles.borrador;
  const totalCols = (p.columnas_finales || []).length + (p.criterios || []).reduce((s, c) => s + (c.subcolumnas || []).length, 0);
  const pctSum = (p.criterios || []).reduce((s, c) => s + (c.porcentaje || 0), 0) + (p.columnas_finales || []).reduce((s, c) => s + (c.porcentaje || 0), 0);

  return (
    <div className={`group relative bg-white rounded-2xl border hover:shadow-lg transition-all duration-200 overflow-hidden ${p.estado === "activa" ? "border-emerald-200 ring-1 ring-emerald-100" : "border-slate-200 hover:border-slate-300"}`}
      data-testid={`ra-template-${p.id}`}>
      {/* Top accent bar */}
      <div className="h-1" style={{ background: p.estado === "activa" ? "linear-gradient(90deg, #10b981, #059669)" : p.estado === "borrador" ? "linear-gradient(90deg, #f59e0b, #d97706)" : "#e2e8f0" }} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold ${est.bg} ${est.text} border ${est.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${est.dot}`} />
              {est.label}
            </span>
            {p.es_predeterminada && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold bg-amber-50 text-amber-600 border border-amber-200">
                <Star className="w-3 h-3 fill-amber-400 text-amber-500" /> Default
              </span>
            )}
          </div>
          <div className="relative">
            <button onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
              data-testid={`ra-menu-${p.id}`}>
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen === p.id && (
              <div className="absolute right-0 top-8 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-20 w-52" onMouseLeave={() => setMenuOpen(null)}>
                <button onClick={() => { onClone(p.id, p.nombre); setMenuOpen(null); }} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 flex items-center gap-2.5 text-slate-700"><Copy className="w-3.5 h-3.5 text-slate-400" /> Duplicar plantilla</button>
                {p.estado === "activa" && !p.es_predeterminada && (
                  <button onClick={() => { onSetDefault(p.id); setMenuOpen(null); }} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 flex items-center gap-2.5 text-slate-700"><Star className="w-3.5 h-3.5 text-amber-400" /> Marcar como predeterminada</button>
                )}
                {p.estado === "borrador" && (
                  <button onClick={() => { onChangeEstado(p.id, "activa"); setMenuOpen(null); }} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 flex items-center gap-2.5 text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Activar</button>
                )}
                {p.estado === "activa" && (
                  <button onClick={() => { onChangeEstado(p.id, "borrador"); setMenuOpen(null); }} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 flex items-center gap-2.5 text-slate-700"><FileEdit className="w-3.5 h-3.5 text-slate-400" /> Pasar a borrador</button>
                )}
                <div className="my-1 h-px bg-slate-100" />
                {p.estado !== "archivada" && (
                  <button onClick={() => { onChangeEstado(p.id, "archivada"); setMenuOpen(null); }} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 flex items-center gap-2.5 text-slate-400"><Archive className="w-3.5 h-3.5" /> Archivar</button>
                )}
                <button onClick={() => { onDelete(p.id); setMenuOpen(null); }} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-rose-50 text-rose-500 flex items-center gap-2.5"><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
              </div>
            )}
          </div>
        </div>

        {/* Title + meta */}
        <h4 className="font-extrabold text-slate-900 text-sm mb-0.5 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => onEdit(p.id)}>
          {p.nombre}
        </h4>
        <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-4">
          <span>{(p.criterios || []).length} criterios</span>
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
          <span>{totalCols} columnas</span>
          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
          <span className={pctSum === 100 ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>{Math.round(pctSum)}%</span>
        </div>

        {/* Criteria pills */}
        <div className="flex flex-wrap gap-1.5">
          {(p.criterios || []).map(c => (
            <span key={c.id} className="text-[9px] px-2 py-0.5 rounded-md font-bold text-white shadow-sm" style={{ backgroundColor: c.color || "#94a3b8" }}>
              {c.nombre} {c.porcentaje}%
            </span>
          ))}
          {(p.columnas_finales || []).map(c => (
            <span key={c.id} className="text-[9px] px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-700 border border-amber-200">
              {c.label_corto || c.label} {c.porcentaje}%
            </span>
          ))}
        </div>

        {/* Footer action */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            {p.updated_at ? `Editado ${new Date(p.updated_at).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}` : ""}
          </span>
          <button onClick={() => onEdit(p.id)}
            className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            data-testid={`ra-edit-${p.id}`}>
            Editar <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Preview Table ── */
function PreviewTable({ config }) {
  const criterios = config.criterios || [];
  const columnas = config.columnas_finales || [];
  const students = ["Garcia Lopez, Ana Maria", "Mendoza Torres, Carlos", "Quispe Huamani, Lucia"];

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th rowSpan={2} className="bg-slate-100 text-slate-600 font-bold px-3 py-2 border border-slate-200 min-w-[150px] text-left sticky left-0 z-10">ALUMNO</th>
            {criterios.map(c => (
              <th key={c.id} colSpan={(c.subcolumnas || []).length} className="text-white font-bold px-2 py-2 border border-white/20 text-center" style={{ backgroundColor: c.color || "#94a3b8" }}>
                {c.nombre} {c.porcentaje}%
              </th>
            ))}
            {columnas.map(col => (
              <th key={col.id} rowSpan={2} className="bg-amber-400 text-white font-bold px-2 py-2 border border-amber-300 text-center min-w-[50px]">
                {col.label_corto || col.label} {col.porcentaje}%
              </th>
            ))}
            <th rowSpan={2} className="bg-emerald-600 text-white font-bold px-3 py-2 border border-emerald-500 text-center min-w-[80px]">
              {config.label_promedio_final || "PROM."}
            </th>
          </tr>
          <tr>
            {criterios.flatMap(c => (c.subcolumnas || []).map(s => (
              <th key={s.id} className="bg-slate-50 text-slate-600 font-semibold px-1 py-1.5 border border-slate-200 text-center min-w-[35px]">
                {s.label}
              </th>
            )))}
          </tr>
        </thead>
        <tbody>
          {students.map((name, i) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="px-3 py-2 border border-slate-200 font-medium text-slate-700 sticky left-0 bg-white z-10">{name}</td>
              {criterios.flatMap(c => (c.subcolumnas || []).map(s => (
                <td key={s.id} className={`px-1 py-2 border border-slate-200 text-center ${s.tipo === "promedio_auto" ? "bg-emerald-50 text-emerald-700 font-bold" : "text-slate-400"}`}>
                  {s.tipo === "promedio_auto" ? "—" : ""}
                </td>
              )))}
              {columnas.map(col => (
                <td key={col.id} className="px-1 py-2 border border-slate-200 text-center text-slate-400"></td>
              ))}
              <td className="px-2 py-2 border border-slate-200 text-center bg-emerald-50 text-emerald-700 font-bold">—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
