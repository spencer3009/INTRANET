import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Lock, Eye, Copy, Plus, Star, MoreVertical, Archive, Trash2,
  CheckCircle2, FileEdit, Loader2, X, ClipboardList
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function RegistroAuxiliarPlantillasTab({ user, token, schoolId }) {
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
      await axios.post(`${API}/api/schools/${schoolId}/registro-auxiliar/plantillas/${plantillaId}/clonar`,
        { nombre: `Copia de ${nombre}` }, { headers });
      toast.success("Plantilla clonada correctamente");
      loadPlantillas();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al clonar");
    }
  };

  const handleCreate = async () => {
    try {
      await axios.post(`${API}/api/schools/${schoolId}/registro-auxiliar/plantillas`, {
        nombre: "Nueva Plantilla",
        estado: "borrador",
        criterios: [{ nombre: "CRITERIO 1", porcentaje: 50, color: "#3498DB",
          subcolumnas: [{ label: "C1", tipo: "input" }, { label: "PROMEDIO", tipo: "promedio_auto" }] }],
        columnas_finales: [{ label: "EXAMEN", label_corto: "EX", porcentaje: 50 }],
      }, { headers });
      toast.success("Plantilla creada");
      loadPlantillas();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear");
    }
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

  const sistema = plantillas.find(p => p.es_sistema);
  const propias = plantillas.filter(p => !p.es_sistema);

  const estadoBadge = (estado) => {
    const map = {
      activa: "bg-emerald-100 text-emerald-700",
      borrador: "bg-amber-100 text-amber-700",
      archivada: "bg-gray-100 text-gray-500",
    };
    const labels = { activa: "Activa", borrador: "Borrador", archivada: "Archivada" };
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${map[estado] || map.borrador}`}>{labels[estado] || estado}</span>;
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6" data-testid="ra-plantillas-tab">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Plantillas de Registro Auxiliar</h2>
          <p className="text-sm text-slate-500">Personaliza la estructura de evaluación de tu colegio</p>
        </div>
      </div>

      {/* System Template Card */}
      {sistema && (
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border-2 border-slate-200 p-5" data-testid="ra-system-template">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-400" />
              <h3 className="font-bold text-slate-700">{sistema.nombre}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 font-semibold">Solo lectura</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreviewPlantilla(sistema)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50" data-testid="ra-view-system">
                <Eye className="w-3.5 h-3.5" /> Ver
              </button>
              <button onClick={() => handleClone(sistema.id, sistema.nombre)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100" data-testid="ra-clone-system">
                <Copy className="w-3.5 h-3.5" /> Clonar
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-3">{sistema.descripcion}</p>
          <div className="flex flex-wrap gap-2">
            {(sistema.criterios || []).map(c => (
              <span key={c.id} className="text-[10px] px-2 py-1 rounded-full font-semibold text-white" style={{ backgroundColor: c.color || "#94a3b8" }}>
                {c.nombre} {c.porcentaje}%
              </span>
            ))}
            {(sistema.columnas_finales || []).map(c => (
              <span key={c.id} className="text-[10px] px-2 py-1 rounded-full font-semibold bg-amber-100 text-amber-800">
                {c.label_corto || c.label} {c.porcentaje}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* My Templates Grid */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">Mis Plantillas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {propias.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow relative" data-testid={`ra-template-${p.id}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {estadoBadge(p.estado)}
                  {p.es_predeterminada && <span className="text-amber-500"><Star className="w-3.5 h-3.5 fill-amber-400" /></span>}
                </div>
                <div className="relative">
                  <button onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)} className="p-1 rounded hover:bg-slate-100" data-testid={`ra-menu-${p.id}`}>
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </button>
                  {menuOpen === p.id && (
                    <div className="absolute right-0 top-7 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20 w-48" onMouseLeave={() => setMenuOpen(null)}>
                      <button onClick={() => { handleClone(p.id, p.nombre); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"><Copy className="w-3.5 h-3.5" /> Clonar</button>
                      {p.estado === "activa" && !p.es_predeterminada && (
                        <button onClick={() => { handleSetDefault(p.id); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"><Star className="w-3.5 h-3.5" /> Predeterminada</button>
                      )}
                      {p.estado === "borrador" && (
                        <button onClick={() => { handleChangeEstado(p.id, "activa"); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" /> Activar</button>
                      )}
                      {p.estado === "activa" && (
                        <button onClick={() => { handleChangeEstado(p.id, "borrador"); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"><FileEdit className="w-3.5 h-3.5" /> Pasar a borrador</button>
                      )}
                      {p.estado !== "archivada" && (
                        <button onClick={() => { handleChangeEstado(p.id, "archivada"); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 text-slate-400"><Archive className="w-3.5 h-3.5" /> Archivar</button>
                      )}
                      <button onClick={() => { handleDelete(p.id); setMenuOpen(null); }} className="w-full text-left px-3 py-2 text-xs hover:bg-rose-50 text-rose-600 flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
                    </div>
                  )}
                </div>
              </div>
              <h4 className="font-bold text-slate-800 text-sm mb-1 cursor-pointer hover:text-indigo-600" onClick={() => setPreviewPlantilla(p)}>{p.nombre}</h4>
              <p className="text-[11px] text-slate-400 mb-3">{(p.criterios || []).length} criterios · {(p.columnas_finales || []).length + (p.criterios || []).reduce((s, c) => s + (c.subcolumnas || []).length, 0)} columnas</p>
              <div className="flex flex-wrap gap-1">
                {(p.criterios || []).slice(0, 4).map(c => (
                  <span key={c.id} className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white" style={{ backgroundColor: c.color || "#94a3b8" }}>
                    {c.nombre} {c.porcentaje}%
                  </span>
                ))}
                {(p.criterios || []).length > 4 && <span className="text-[9px] text-slate-400">+{(p.criterios || []).length - 4}</span>}
              </div>
            </div>
          ))}

          {/* + New Template Card */}
          <button onClick={handleCreate} className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-4 flex flex-col items-center justify-center gap-2 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors min-h-[140px]" data-testid="ra-create-new">
            <Plus className="w-6 h-6 text-slate-400" />
            <span className="text-sm font-semibold text-slate-500">Nueva plantilla</span>
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {previewPlantilla && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setPreviewPlantilla(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden" data-testid="ra-preview-modal">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold">{previewPlantilla.nombre}</h2>
                <p className="text-indigo-200 text-xs">{previewPlantilla.descripcion || "Vista previa de la tabla"}</p>
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

function PreviewTable({ config }) {
  const criterios = config.criterios || [];
  const columnas = config.columnas_finales || [];
  const students = ["Alumno Ejemplo 1", "Alumno Ejemplo 2", "Alumno Ejemplo 3"];
  const totalSubcols = criterios.reduce((s, c) => s + (c.subcolumnas || []).length, 0) + columnas.length;

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
