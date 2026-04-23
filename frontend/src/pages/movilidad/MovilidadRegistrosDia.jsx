import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Bus, Loader2, ChevronLeft,
  Clock, Users, Search, Filter, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MovilidadRegistrosDia({ user, token, subdomain, embedded = false }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [turnoFilter, setTurnoFilter] = useState("");
  const [turnos, setTurnos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Academic cascading filters
  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [nivelId, setNivelId] = useState("");
  const [gradoId, setGradoId] = useState("");
  const [seccionId, setSeccionId] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  // Load academic data + turnos on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [lR, gR, sR, tR] = await Promise.all([
          fetch(`${API}/academic/levels`, { headers }),
          fetch(`${API}/academic/grades`, { headers }),
          fetch(`${API}/academic/sections`, { headers }),
          axios.get(`${API}/movilidad/turnos`, { headers }),
        ]);
        if (lR.ok) setLevels(await lR.json());
        if (gR.ok) { const d = await gR.json(); setGrades(Array.isArray(d) ? d : d.grades || []); }
        if (sR.ok) { const d = await sR.json(); setSections(Array.isArray(d) ? d : d.sections || []); }
        setTurnos(tR.data || []);
      } catch (err) {
        console.error("Error loading filters:", err);
      }
    };
    loadFilters();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ fecha });
      if (turnoFilter) params.append("turno_id", turnoFilter);
      if (nivelId) params.append("nivel_id", nivelId);
      if (gradoId) params.append("grado_id", gradoId);
      if (seccionId) params.append("seccion_id", seccionId);
      const res = await axios.get(`${API}/movilidad/registros-dia?${params}`, { headers });
      setData(res.data);
    } catch (err) {
      console.error("Error loading registros:", err);
      toast.error("Error al cargar registros");
    } finally {
      setLoading(false);
    }
  };

  // Cascading: grades filtered by nivel, sections filtered by grade
  const filteredGrades = nivelId ? grades.filter(g => g.nivel_id === nivelId) : grades;
  const filteredSections = gradoId ? sections.filter(s => s.grado_id === gradoId) : sections;

  const formatTime = (isoStr) => {
    if (!isoStr) return "";
    try {
      return new Date(isoStr).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch { return ""; }
  };

  const goBack = () => {
    const path = subdomain ? `/${subdomain}/movilidad` : "/movilidad";
    navigate(path);
  };

  const filteredRegistros = (data?.registros || []).filter(r => {
    if (!searchTerm) return true;
    const name = (r.metadata?.nombre_estudiante || "").toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6" data-testid="movilidad-registros-dia">
      {/* Back button - only when not embedded */}
      {!embedded && (
        <button
          onClick={goBack}
          className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-all font-medium text-sm shadow-sm"
          data-testid="movilidad-registros-back"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver a Movilidad
        </button>
      )}

      {/* Filters Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm" data-testid="movilidad-filters-card">
        <div className="flex items-center gap-2 mb-5">
          <Filter className="w-5 h-5 text-indigo-500" />
          <h2 className="text-base font-bold text-slate-800">Filtros de Asistencia</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Nivel</label>
            <select
              value={nivelId}
              onChange={e => { setNivelId(e.target.value); setGradoId(""); setSeccionId(""); }}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none appearance-none"
              data-testid="movilidad-filter-nivel"
            >
              <option value="">Seleccionar nivel</option>
              {levels.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Grado</label>
            <select
              value={gradoId}
              onChange={e => { setGradoId(e.target.value); setSeccionId(""); }}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none appearance-none"
              data-testid="movilidad-filter-grado"
            >
              <option value="">Seleccionar grado</option>
              {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Sección</label>
            <select
              value={seccionId}
              onChange={e => setSeccionId(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none appearance-none"
              data-testid="movilidad-filter-seccion"
            >
              <option value="">Seleccionar sección</option>
              {filteredSections.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Turno</label>
            <select
              value={turnoFilter}
              onChange={e => setTurnoFilter(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none appearance-none"
              data-testid="movilidad-filter-turno"
            >
              <option value="">Todos los turnos</option>
              {turnos.map(t => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
              data-testid="movilidad-filter-fecha"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={loadData}
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="movilidad-btn-cargar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Cargar
            </button>
          </div>
        </div>
      </div>

      {/* Results - only shown after Cargar */}
      {data && (
        <>
          {/* Summary cards - GREEN */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-violet-600 to-violet-500 rounded-xl p-4 text-white">
              <Users className="w-5 h-5 mb-1 opacity-80" />
              <p className="text-2xl font-bold">{data.total}</p>
              <p className="text-xs text-violet-100">Total Registros</p>
            </div>
            {(data.resumen_por_turno || []).map(s => (
              <div key={s.turno_id} className="bg-white rounded-xl p-4 border border-slate-200">
                <Bus className="w-5 h-5 text-violet-600 mb-1" />
                <p className="text-2xl font-bold text-slate-800">{s.total}</p>
                <p className="text-xs text-slate-500">{s.turno_nombre}</p>
              </div>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar estudiante..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
              data-testid="movilidad-filter-search"
            />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {filteredRegistros.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Bus className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">No hay registros para esta fecha</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="movilidad-registros-table">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-5 py-3 font-semibold text-slate-600">#</th>
                      <th className="text-left px-5 py-3 font-semibold text-slate-600">Estudiante</th>
                      <th className="text-left px-5 py-3 font-semibold text-slate-600">Grado</th>
                      <th className="text-left px-5 py-3 font-semibold text-slate-600">Sección</th>
                      <th className="text-left px-5 py-3 font-semibold text-slate-600">Turno</th>
                      <th className="text-left px-5 py-3 font-semibold text-slate-600">Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRegistros.map((r, i) => (
                      <tr key={r.id || i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                        <td className="px-5 py-3 font-medium text-slate-800">{r.metadata?.nombre_estudiante}</td>
                        <td className="px-5 py-3 text-slate-600">{r.metadata?.grado || "-"}</td>
                        <td className="px-5 py-3 text-slate-600">{r.metadata?.seccion || "-"}</td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-violet-100 text-violet-700 text-xs font-medium">
                            {r.turno_nombre || "-"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-500 font-mono text-xs">{formatTime(r.hora_registro)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      )}

      {/* Initial state - no data loaded yet */}
      {!data && !loading && (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-200">
          <Filter className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium">Selecciona los filtros y presiona "Cargar"</p>
        </div>
      )}
    </div>
  );
}
