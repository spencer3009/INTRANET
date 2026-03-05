import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import MobileBottomNav from "../components/MobileBottomNav";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import {
  Wallet,
  Calendar,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CircleDollarSign,
  TrendingUp,
  Receipt,
  CheckCircle,
  ArrowLeft,
  CreditCard
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParentPaymentsPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [activeSection, setActiveSection] = useState("pagos");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const [parentProfile, setParentProfile] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [settings, setSettings] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [profileRes, settingsRes] = await Promise.all([
          axios.get(`${API}/api/parent/me`, { headers }),
          axios.get(`${API}/api/settings/public/${subdomain}`, { headers }).catch(() => ({ data: null }))
        ]);
        setParentProfile(profileRes.data);
        if (settingsRes.data) setSettings(settingsRes.data);
        const childrenList = profileRes.data.children || [];
        setChildren(childrenList);
        if (childrenList.length > 0) {
          const savedChildId = localStorage.getItem('selected_child_id');
          const childToSelect = childrenList.find(c => c.id === savedChildId) || childrenList[0];
          setSelectedChild(childToSelect);
          await loadPayments(childToSelect.id);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [token]);

  const loadPayments = async (childId) => {
    try {
      const res = await axios.get(`${API}/api/parent/payments?student_id=${childId}`, { headers });
      setPaymentData(res.data);
    } catch (err) {
      console.error("Error loading payments:", err);
    }
  };

  const handleChildChange = async (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    setSelectedChild(newChild);
    setLoading(true);
    localStorage.setItem('selected_child_id', newChild.id);
    await loadPayments(newChild.id);
    setLoading(false);
  };

  const schoolName = settings?.system_name || user?.school_name || "Portal Padres";
  const logoUrl = settings?.logo_url;
  const navigateTo = (path) => {
    if (subdomain) navigate(`/${subdomain}${path}`);
    else navigate(path);
  };

  const summary = paymentData?.summary || {};

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <ParentSidebar
        active={activeSection} onNavigate={setActiveSection}
        expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout} schoolName={schoolName} subdomain={subdomain || user?.subdomain}
        user={parentProfile || user} children={children} selectedChild={selectedChild} onSelectChild={handleChildChange}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader
          user={user} onMenuClick={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout}
          logoUrl={logoUrl} schoolName={schoolName} subdomain={subdomain || user?.subdomain} token={token}
          roleLabel="Padre/Apoderado" profilePath="/parent/profile"
        />

        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => navigateTo("/parent")}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>Estado de Pagos</h1>
                <p className="text-sm text-slate-500">
                  {selectedChild?.name} {selectedChild?.last_name}
                </p>
              </div>
            </div>
            {/* Child selector */}
            {children.length > 1 && (
              <div className="flex items-center gap-2">
                {children.map((child) => (
                  <button key={child.id} onClick={() => handleChildChange(child)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedChild?.id === child.id
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                    }`} data-testid={`payments-child-${child.id}`}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            </div>
          ) : !paymentData ? (
            <div className="text-center py-20">
              <CreditCard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No hay datos de pagos disponibles</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 text-center">
                  <CircleDollarSign className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-2xl font-black text-emerald-700" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    S/ {((summary.paid_amount || 0) + (paymentData.matricula?.paid ? (paymentData.matricula?.amount || 0) : 0)).toLocaleString('es-PE')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Total Pagado</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 text-center">
                  <AlertTriangle className={`w-8 h-8 mx-auto mb-2 ${summary.debt_amount > 0 ? 'text-red-500' : 'text-slate-300'}`} />
                  <p className={`text-2xl font-black ${summary.debt_amount > 0 ? 'text-red-700' : 'text-slate-400'}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                    S/ {(summary.debt_amount || 0).toLocaleString('es-PE')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Deuda Pendiente</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 text-center">
                  <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-black text-blue-700" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    S/ {(summary.total_annual || summary.total_amount || 0).toLocaleString('es-PE')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Total Anual</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-200 text-center">
                  <Receipt className={`w-8 h-8 mx-auto mb-2 ${paymentData.matricula?.paid ? 'text-emerald-500' : 'text-amber-500'}`} />
                  <p className={`text-2xl font-black ${paymentData.matricula?.paid ? 'text-emerald-700' : 'text-amber-700'}`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {paymentData.matricula?.paid ? `S/ ${(paymentData.matricula?.amount || 0).toLocaleString('es-PE')}` : 'Pendiente'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Matrícula {paymentData.matricula?.paid ? '- Pagada' : ''}</p>
                </div>
              </div>

              {/* Progress Bar Summary */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6" data-testid="payments-progress">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Wallet className={`w-6 h-6 ${
                      summary.overall_status === 'moroso' ? 'text-red-500' :
                      summary.overall_status === 'pendiente' ? 'text-amber-500' : 'text-emerald-500'
                    }`} />
                    <span className="font-bold text-slate-800 text-lg">Progreso de Pagos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {summary.overall_status === 'moroso' && (
                      <span className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-3 py-1.5 text-xs font-bold text-red-700 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" /> MOROSO
                      </span>
                    )}
                    {summary.overall_status === 'pendiente' && (
                      <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 text-xs font-bold text-amber-700">
                        PENDIENTE
                      </span>
                    )}
                    {summary.overall_status === 'al_dia' && (
                      <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5 text-xs font-bold text-emerald-700">
                        <CheckCircle className="w-3.5 h-3.5" /> AL DÍA
                      </span>
                    )}
                    <span className="text-2xl font-black text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {summary.paid_percentage}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden flex">
                  {summary.paid_count > 0 && (
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-700"
                      style={{ width: `${(summary.paid_count / summary.total_months) * 100}%` }} />
                  )}
                  {summary.pending_count > 0 && (
                    <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
                      style={{ width: `${(summary.pending_count / summary.total_months) * 100}%` }} />
                  )}
                  {summary.overdue_count > 0 && (
                    <div className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-700"
                      style={{ width: `${(summary.overdue_count / summary.total_months) * 100}%` }} />
                  )}
                </div>
                <div className="flex items-center gap-5 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-sm text-slate-600">{summary.paid_count} pagados</span>
                  </div>
                  {summary.pending_count > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-sm text-slate-600">{summary.pending_count} pendientes</span>
                    </div>
                  )}
                  {summary.overdue_count > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm text-red-600 font-semibold">{summary.overdue_count} morosos</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Monthly Detail Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" data-testid="payments-detail-table">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-slate-500" />
                    Detalle Mensual
                  </h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {paymentData.monthly_detail.map((month, idx) => (
                    <div key={month.id || idx} className="px-6 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors" data-testid={`payment-row-${idx}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          month.payment_status === 'paid' ? 'bg-emerald-500' :
                          month.payment_status === 'overdue' ? 'bg-red-500' : 'bg-amber-500'
                        }`} />
                        <span className="text-base text-slate-700 font-medium">{month.month_name}</span>
                      </div>
                      <div className="flex items-center gap-5">
                        <span className="text-base font-bold text-slate-800">S/ {month.total_amount.toFixed(2)}</span>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
                          month.payment_status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : month.payment_status === 'overdue'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {month.payment_status === 'paid' ? 'PAGADO' : month.payment_status === 'overdue' ? 'MOROSO' : 'PENDIENTE'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
      <MobileBottomNav role="parent" />
    </div>
  );
}
