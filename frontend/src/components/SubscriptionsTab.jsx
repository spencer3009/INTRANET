import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2, Search, User, Tag, RefreshCw, ShieldCheck, Unlock, Play } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SubscriptionsTab({ token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [concepts, setConcepts] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [runningCron, setRunningCron] = useState(false);

  // Load all students once
  useEffect(() => {
    const loadStudents = async () => {
      try {
        const res = await axios.get(`${API}/users`, { headers });
        const list = Array.isArray(res.data) ? res.data : (res.data.users || []);
        setStudents(list.filter(u => u.role === "student"));
      } catch (e) {
        console.error("students load error", e);
      }
    };
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStudentData = useCallback(async (studentId) => {
    setLoading(true);
    try {
      const [conceptsRes, subsRes] = await Promise.all([
        axios.get(`${API}/accounting/payment-concepts?include_inactive=true`, { headers }),
        axios.get(`${API}/accounting/students/${studentId}/concept-subscriptions`, { headers }),
      ]);
      const allConcepts = conceptsRes.data.concepts || [];
      const recurrent = allConcepts.filter(c => c.concept_type === "recurrente" && c.status === "active");
      setConcepts(recurrent);
      setSubscriptions(subsRes.data.subscriptions || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (selectedStudent?.id) {
      loadStudentData(selectedStudent.id);
    }
  }, [selectedStudent, loadStudentData]);

  const filteredStudents = search
    ? students.filter(s => `${s.name || ""} ${s.last_name || ""} ${s.dni || ""}`.toLowerCase().includes(search.toLowerCase())).slice(0, 20)
    : [];

  const getSubForConcept = (conceptId) =>
    subscriptions.find(s => s.concept_id === conceptId);

  const handleToggle = async (concept) => {
    if (!selectedStudent) return;
    const sub = getSubForConcept(concept.id);
    setSavingId(concept.id);
    try {
      if (sub) {
        await axios.patch(
          `${API}/accounting/concept-subscriptions/${sub.id}`,
          { is_active: !sub.is_active },
          { headers },
        );
        toast.success(!sub.is_active ? "Suscripción activada" : "Suscripción desactivada");
      } else {
        await axios.post(
          `${API}/accounting/students/${selectedStudent.id}/concept-subscriptions`,
          { concept_id: concept.id },
          { headers },
        );
        toast.success("Suscripción creada");
      }
      await loadStudentData(selectedStudent.id);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error");
    } finally {
      setSavingId(null);
    }
  };

  const handleRunCron = async () => {
    setRunningCron(true);
    try {
      const res = await axios.post(
        `${API}/accounting/concept-subscriptions/run-cron`,
        {},
        { headers },
      );
      const r = res.data?.result || {};
      toast.success(`Cron ejecutado: ${r.generated} generados · ${r.already_existed} ya existían · ${r.errors} errores`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al ejecutar el cron");
    } finally {
      setRunningCron(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="subscriptions-tab">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Tag className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Suscripciones por alumno</h3>
              <p className="text-xs text-slate-500">Activa o desactiva conceptos recurrentes para cada alumno.</p>
            </div>
          </div>
          <button
            onClick={handleRunCron}
            disabled={runningCron}
            className="px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm font-semibold hover:bg-amber-200 transition-colors flex items-center gap-2 disabled:opacity-50"
            data-testid="run-cron-btn"
          >
            {runningCron ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generar cobros del mes
          </button>
        </div>

        {/* Student search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar alumno por nombre o DNI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            data-testid="subscriptions-student-search"
          />
          {filteredStudents.length > 0 && search && !selectedStudent && (
            <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
              {filteredStudents.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedStudent(s); setSearch(""); }}
                  className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors flex items-center gap-3"
                  data-testid={`subscriptions-pick-${s.id}`}
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{s.name} {s.last_name}</p>
                    <p className="text-xs text-slate-500">DNI: {s.dni || "—"}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedStudent && (
          <div className="mt-4 px-4 py-3 bg-indigo-50 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="text-sm font-bold text-indigo-900">{selectedStudent.name} {selectedStudent.last_name}</p>
                <p className="text-xs text-indigo-700">DNI: {selectedStudent.dni || "—"}</p>
              </div>
            </div>
            <button
              onClick={() => { setSelectedStudent(null); setConcepts([]); setSubscriptions([]); }}
              className="text-xs font-semibold text-indigo-600 hover:underline"
              data-testid="subscriptions-clear-student"
            >
              Cambiar alumno
            </button>
          </div>
        )}
      </div>

      {/* Subscriptions table */}
      {selectedStudent && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : concepts.length === 0 ? (
            <div className="p-8 text-center">
              <Tag className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No hay conceptos recurrentes configurados</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Concepto</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Monto</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Modalidad</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Activado por</th>
                  <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {concepts.map((c) => {
                  const sub = getSubForConcept(c.id);
                  const isActive = !!(sub && sub.is_active);
                  const isOpen = c.enrollment_mode === "open";
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`sub-row-${c.id}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-sm font-semibold text-slate-800">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-sm font-bold text-emerald-700">S/ {Number(sub?.amount ?? c.amount).toFixed(2)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isOpen ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {isOpen ? <Unlock className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                          {isOpen ? "Abierto" : "Obligatorio"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center text-xs text-slate-500">
                        {sub?.activated_by ? (sub.activated_by === "admin" ? "Admin" : "Padre") : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => handleToggle(c)}
                          disabled={savingId === c.id}
                          className={`relative w-12 h-7 rounded-full transition-colors duration-300 disabled:opacity-50 ${isActive ? "bg-emerald-500" : "bg-slate-300"}`}
                          data-testid={`sub-toggle-${c.id}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${isActive ? "translate-x-5" : "translate-x-0"}`} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!selectedStudent && (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-12 text-center">
          <User className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Selecciona un alumno para gestionar sus suscripciones</p>
        </div>
      )}
    </div>
  );
}
