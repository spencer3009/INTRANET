import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Search, Loader2, UserCheck, GraduationCap, Users } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const RetiredStudentsTab = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reactivating, setReactivating] = useState(false);
  const debounceRef = useRef(null);

  const runSearch = async (term) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/students/disabled/search`, { headers, params: { q: term } });
      setResults(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al buscar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const reactivate = async () => {
    if (!selected) return;
    setReactivating(true);
    try {
      await axios.patch(`${API}/students/${selected.id}/toggle-disable`, {}, { headers });
      toast.success("Alumno reactivado. Ya aparece nuevamente en el sistema.");
      setSelected(null);
      setResults(prev => prev.filter(s => s.id !== selected.id));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al reactivar");
    } finally {
      setReactivating(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden" data-testid="retired-students-tab">
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5" /> Alumnos retirados
        </h2>
        <p className="text-sm text-slate-300 mt-1">Busca alumnos desactivados para consultarlos o reactivarlos.</p>
      </div>

      <div className="p-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, apellido o DNI..."
            className="w-full border border-slate-300 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-slate-400 outline-none"
            data-testid="retired-search-input"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
        </div>

        {!loading && results.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6" data-testid="retired-empty">No hay alumnos desactivados que coincidan.</p>
        )}

        <div className="space-y-2">
          {results.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${selected?.id === s.id ? 'border-slate-700 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}
              data-testid={`retired-result-${s.id}`}
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
                {s.photo_url ? <img src={s.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-slate-500 font-bold">{s.name?.charAt(0)}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800 text-sm truncate">{s.name} {s.last_name}</p>
                <p className="text-xs text-slate-400 truncate">DNI: {s.dni || "—"} · {s.grade_name} {s.section_name}</p>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded-full">RETIRADO</span>
            </button>
          ))}
        </div>

        {selected && (
          <div className="mt-4 border-2 border-slate-700 rounded-2xl p-5 bg-slate-50" data-testid="retired-selected-card">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                {selected.photo_url ? <img src={selected.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl text-slate-500 font-bold">{selected.name?.charAt(0)}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800">{selected.name} {selected.last_name}</p>
                <p className="text-sm text-slate-500 flex items-center gap-1"><GraduationCap className="w-4 h-4" /> {selected.grade_name} {selected.section_name}</p>
                <p className="text-xs text-slate-400">DNI: {selected.dni || "—"}{selected.disabled_at ? ` · Desactivado: ${new Date(selected.disabled_at).toLocaleDateString("es-PE")}` : ""}</p>
              </div>
            </div>
            <button
              onClick={reactivate}
              disabled={reactivating}
              className="mt-4 w-full px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              data-testid="retired-reactivate-btn"
            >
              {reactivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />} Reactivar alumno
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default RetiredStudentsTab;
