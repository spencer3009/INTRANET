import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import MobileBottomNav from "../components/MobileBottomNav";
import AccessDenied from "../components/AccessDenied";
import { canAccessSection } from "../lib/permissions";
import {
  UserX, BadgeDollarSign, TrendingDown, User, Eye, X, Loader2,
  History, ArrowLeft, Search, ChevronDown, ChevronUp, ShieldBan,
  ChevronLeft, ChevronRight
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatNumber = (n) => {
  if (n == null) return "0.00";
  return Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ── Student History Modal ──
function StudentHistoryModal({ isOpen, onClose, studentId, token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && studentId) {
      setLoading(true);
      axios.get(`${API}/accounting/student-history/${studentId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setData(res.data))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }
  }, [isOpen, studentId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" data-testid="student-history-modal">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Historial de Pagos</h2>
              <p className="text-xs text-indigo-100">{data?.student?.name || "..."}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[calc(85vh-160px)]">
          {loading ? (
            <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" /></div>
          ) : !data ? (
            <p className="text-center text-gray-400 py-8">No se pudo cargar el historial</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-200">
                  <p className="text-lg font-bold text-emerald-700">S/ {formatNumber(data.totals.total_paid)}</p>
                  <p className="text-xs text-emerald-600">Pagado</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-200">
                  <p className="text-lg font-bold text-amber-700">S/ {formatNumber(data.totals.total_pending)}</p>
                  <p className="text-xs text-amber-600">Pendiente</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                  <p className="text-lg font-bold text-slate-700">S/ {formatNumber(data.totals.total)}</p>
                  <p className="text-xs text-slate-600">Total</p>
                </div>
              </div>
              {data.matriculas.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Matrícula</h3>
                  {data.matriculas.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${m.status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="text-sm font-medium text-gray-700">{m.concept_label}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-800">S/ {formatNumber(m.amount)}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${m.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {m.status === 'paid' ? 'Pagado' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {data.mensualidades.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mensualidades</h3>
                  <div className="space-y-1.5">
                    {data.mensualidades.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${m.status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span className="text-sm font-medium text-gray-700">{m.pension_month_label || m.pension_month || 'Sin mes'}</span>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-800">S/ {formatNumber(m.amount)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {m.status === 'paid' ? 'Pagado' : 'Pendiente'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Expandable Months Cell ──
function MonthsCell({ months }) {
  const [expanded, setExpanded] = useState(false);
  if (!months || months.length === 0) return <span className="text-xs text-emerald-600 font-medium">Ninguno</span>;
  const visible = expanded ? months : months.slice(0, 3);
  const remaining = months.length - 3;
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visible.map((m, i) => (
        <span key={i} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-md font-medium">{m}</span>
      ))}
      {!expanded && remaining > 0 && (
        <button onClick={() => setExpanded(true)} className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-0.5">
          +{remaining} más <ChevronDown className="w-3 h-3" />
        </button>
      )}
      {expanded && months.length > 3 && (
        <button onClick={() => setExpanded(false)} className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-0.5">
          Menos <ChevronUp className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── Main Page ──
export default function MorososPage({ user, token, subdomain, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [debtors, setDebtors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("moroso");
  const [search, setSearch] = useState("");
  const [historyModal, setHistoryModal] = useState({ open: false, studentId: null });
  const [schoolSettings, setSchoolSettings] = useState(null);
  const [blockAccessIfDebt, setBlockAccessIfDebt] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const hasAccess = canAccessSection(user, 'accounting');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [debtorsRes, settingsRes] = await Promise.all([
          axios.get(`${API}/accounting/debtors`, { headers }),
          axios.get(`${API}/settings`, { headers }).catch(() => null)
        ]);
        setDebtors(debtorsRes.data.debtors || []);
        setSummary(debtorsRes.data.summary || null);
        if (settingsRes) {
          setSchoolSettings(settingsRes.data);
          setBlockAccessIfDebt(settingsRes.data.restrict_grades_if_debt || false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleToggleBlockAccess = async () => {
    setSavingToggle(true);
    try {
      const newValue = !blockAccessIfDebt;
      await axios.put(`${API}/settings/roles`, { restrict_grades_if_debt: newValue }, { headers });
      setBlockAccessIfDebt(newValue);
    } catch (err) {
      console.error("Error al actualizar configuración:", err);
    } finally {
      setSavingToggle(false);
    }
  };

  // Reset page when filter/search changes
  useEffect(() => { setCurrentPage(1); }, [filter, search]);

  if (!hasAccess) return <AccessDenied />;

  const filtered = debtors
    .filter(d => filter === "all" ? true : d.status === filter)
    .filter(d => !search || d.student_name.toLowerCase().includes(search.toLowerCase()));

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const avgDebt = summary?.morosos_count > 0 ? summary.total_debt / summary.morosos_count : 0;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={onLogout} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} subdomain={subdomain} schoolName={schoolSettings?.system_name} />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader user={user} onMenuClick={() => setSidebarOpen(!sidebarOpen)} logoUrl={schoolSettings?.logo_url} schoolName={schoolSettings?.system_name} />
        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-20 lg:pb-8 space-y-6 max-w-[1400px] mx-auto w-full">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(`/${subdomain}/contabilidad`)} className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors" data-testid="back-to-accounting">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900" data-testid="morosos-page-title">Control de Morosidad</h1>
                <p className="text-sm text-gray-500 mt-0.5">Seguimiento de pagos pendientes por alumno</p>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100" data-testid="kpi-morosos-total">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
                  <UserX className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Morosos Totales</p>
                  <p className="text-3xl font-bold text-red-600">{summary?.morosos_count || 0}</p>
                  <p className="text-xs text-gray-400">alumnos con deuda</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100" data-testid="kpi-deuda-total">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <BadgeDollarSign className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Deuda Total</p>
                  <p className="text-3xl font-bold text-amber-600">S/ {formatNumber(summary?.total_debt)}</p>
                  <p className="text-xs text-gray-400">pendiente de cobro</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100" data-testid="kpi-promedio-deuda">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <TrendingDown className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Promedio de Deuda</p>
                  <p className="text-3xl font-bold text-purple-600">S/ {formatNumber(avgDebt)}</p>
                  <p className="text-xs text-gray-400">por alumno moroso</p>
                </div>
              </div>
            </div>
          </div>

          {/* Global Debt Block Toggle */}
          <div className="flex items-center justify-between bg-white rounded-2xl px-6 py-4 shadow-sm border border-gray-100" data-testid="debt-block-toggle-section">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl flex items-center justify-center shadow-sm">
                <ShieldBan className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">Bloquear acceso si el alumno tiene deuda</h3>
                <p className="text-xs text-gray-500">Los alumnos y padres con pagos pendientes no podrán acceder al sistema</p>
              </div>
            </div>
            <button
              onClick={handleToggleBlockAccess}
              disabled={savingToggle}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                blockAccessIfDebt ? 'bg-red-600' : 'bg-gray-300'
              } ${savingToggle ? 'opacity-50 cursor-not-allowed' : ''}`}
              data-testid="toggle-block-access-debt"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                  blockAccessIfDebt ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
              {savingToggle && (
                <Loader2 className="absolute inset-0 m-auto w-4 h-4 text-white animate-spin" />
              )}
            </button>
          </div>

          {/* Filters bar */}
          <div className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 flex-1 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar alumno..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent outline-none text-sm flex-1 text-gray-700 placeholder:text-gray-400"
                data-testid="search-morosos"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {[{ key: "moroso", label: "Morosos" }, { key: "al_dia", label: "Al Día" }, { key: "all", label: "Todos" }].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    filter === f.key ? "bg-slate-800 text-white shadow-md" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                  data-testid={`filter-${f.key}`}
                >{f.label}</button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><UserX className="w-8 h-8 text-gray-300" /></div>
                <p className="text-gray-500 font-semibold">Sin registros en este periodo</p>
                <p className="text-xs text-gray-400 mt-1">No hay alumnos con los filtros seleccionados</p>
              </div>
            ) : (
              <table className="w-full" data-testid="morosos-table">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Alumno</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Deuda</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Meses Pendientes</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Último Pago</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((d, idx) => (
                    <tr key={d.student_id} className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`} data-testid={`debtor-row-${d.student_id}`}>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-slate-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{d.student_name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{d.grade_name} - {d.section_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className={`text-base font-bold ${d.total_pending > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          S/ {formatNumber(d.total_pending)}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <MonthsCell months={d.pending_months} />
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-gray-500">{d.last_payment_date || '-'}</span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                          d.status === 'moroso' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'moroso' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                          {d.status === 'moroso' ? 'Moroso' : 'Al Día'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button
                          onClick={() => setHistoryModal({ open: true, studentId: d.student_id })}
                          className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                          title="Ver detalle"
                          data-testid={`view-history-${d.student_id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {/* Pagination */}
            {!loading && filtered.length > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    data-testid="pagination-prev"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                        p === currentPage ? 'bg-slate-800 text-white' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                      data-testid={`pagination-page-${p}`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    data-testid="pagination-next"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <StudentHistoryModal
        isOpen={historyModal.open}
        onClose={() => setHistoryModal({ open: false, studentId: null })}
        studentId={historyModal.studentId}
        token={token}
      />
      <MobileBottomNav role={user?.role === "admin" ? "admin" : "owner"} />
    </div>
  );
}
