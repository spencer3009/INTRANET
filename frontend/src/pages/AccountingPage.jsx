import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts";
import Sidebar from "../components/Sidebar";
import MobileBottomNav from "../components/MobileBottomNav";
import FloatingHelpAvatar from "../components/FloatingHelpAvatar";
import DashboardHeader from "../components/DashboardHeader";
import AccessDenied from "../components/AccessDenied";
import { canAccessSection } from "../lib/permissions";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import FinancialSettingsTab from "../components/FinancialSettingsTab";
import ConfiguracionBoletaTab from "../components/ConfiguracionBoletaTab";
import YapeConfigPanel from "../components/YapeConfigPanel";
import YapePaymentVerification from "../components/YapePaymentVerification";
import GenerateBillingModal from "../components/GenerateBillingModal";
import BoletaPreviewModal from "../components/BoletaPreviewModal";
import AccountingDateFilter, { getDefaultDates } from "../components/AccountingDateFilter";
import AccountingSummaryCards from "../components/AccountingSummaryCards";
import { 
  Plus, X, Loader2, AlertCircle, Check, Edit2, Trash2, 
  TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle,
  Receipt, CreditCard, Filter, ChevronLeft, ChevronRight, User,
  ArrowUpRight, ArrowDownRight, Calendar, Landmark,
  CircleDollarSign, FileText, Percent, Scale, Briefcase,
  BadgeDollarSign, Coins, ChartLine, Building2, Wallet2,
  ShieldCheck, BarChart4, LineChart, Users, AlertOctagon, 
  Eye, History, UserX, UserCheck, Settings, Tag, Zap, Download,
  QrCode, Search
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Payment concepts
const CONCEPTS = {
  matricula: "Matrícula",
  mensualidad: "Mensualidad",
  taller: "Taller",
  uniforme: "Uniforme",
  material: "Material escolar",
  evento: "Evento",
  otros: "Otros"
};

// Payment methods
const METHODS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  yape: "Yape",
  plin: "Plin",
  tarjeta: "Tarjeta"
};

// Payment statuses - Premium banking colors
const PAYMENT_STATUSES = {
  pending: { label: "Pendiente", bgClass: "bg-amber-50", textClass: "text-amber-700", borderClass: "border-amber-200", dotClass: "bg-amber-500" },
  paid: { label: "Pagado", bgClass: "bg-emerald-50", textClass: "text-emerald-700", borderClass: "border-emerald-200", dotClass: "bg-emerald-500" },
  canceled: { label: "Anulado", bgClass: "bg-rose-50", textClass: "text-rose-700", borderClass: "border-rose-200", dotClass: "bg-rose-500" }
};

// Expense categories
const EXPENSE_CATEGORIES = {
  servicios: "Servicios",
  personal: "Personal",
  mantenimiento: "Mantenimiento",
  materiales: "Materiales",
  otros: "Otros"
};

// Peru IGV
const IGV_PERCENTAGE = 18;

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2
  }).format(amount || 0);
};

// Format number only
const formatNumber = (amount) => {
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

// ══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADER - Premium
// ══════════════════════════════════════════════════════════════════════════════
function AccountingSkeleton() {
  return (
    <div className="space-y-6" data-testid="accounting-skeleton">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl p-6 animate-pulse shadow-sm border border-gray-100">
            <div className="h-4 bg-gray-100 rounded w-1/2 mb-4" />
            <div className="h-8 bg-gray-100 rounded w-3/4" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-6 animate-pulse shadow-sm border border-gray-100">
        <div className="h-6 bg-gray-100 rounded w-1/4 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-50 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STAT CARD COMPONENT - Premium Banking Design
// ══════════════════════════════════════════════════════════════════════════════
function StatCard({ title, value, subtitle, icon: Icon, trend, trendValue, variant = "default" }) {
  const variants = {
    default: {
      iconBg: "bg-gradient-to-br from-slate-600 to-slate-700",
      iconColor: "text-white",
      valueColor: "text-slate-800",
      cardClass: ""
    },
    income: {
      iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600",
      iconColor: "text-white",
      valueColor: "text-emerald-700",
      cardClass: "border-l-4 border-l-emerald-500"
    },
    expense: {
      iconBg: "bg-gradient-to-br from-rose-500 to-pink-600",
      iconColor: "text-white",
      valueColor: "text-rose-700",
      cardClass: "border-l-4 border-l-rose-500"
    },
    pending: {
      iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
      iconColor: "text-white",
      valueColor: "text-amber-700",
      cardClass: "border-l-4 border-l-amber-500"
    },
    balance: {
      iconBg: "bg-gradient-to-br from-blue-600 to-indigo-700",
      iconColor: "text-white",
      valueColor: "text-blue-700",
      cardClass: "border-l-4 border-l-blue-600"
    }
  };

  const style = variants[variant];

  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 ${style.cardClass}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 ${style.iconBg} rounded-xl flex items-center justify-center shadow-lg`}>
          <Icon className={`w-5 h-5 ${style.iconColor}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
            trend === "up" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          }`}>
            {trend === "up" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {trendValue}
          </div>
        )}
      </div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{title}</p>
      <p className={`text-2xl font-bold ${style.valueColor} tracking-tight`}>{value}</p>
      {subtitle && (
        <p className="text-xs text-gray-400 mt-1.5">{subtitle}</p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB - Premium Banking Design
// ══════════════════════════════════════════════════════════════════════════════
function DashboardTab({ summary, loading, debtorsSummary }) {
  if (loading) return <AccountingSkeleton />;
  
  return (
    <div className="space-y-6">
      {/* Period header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-2xl px-6 py-5 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center">
            <BarChart4 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Resumen Financiero</h2>
            <p className="text-sm text-slate-300">{summary?.period?.month_name} {summary?.period?.year}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-xl">
          <Percent className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">IGV: {IGV_PERCENTAGE}%</span>
        </div>
      </div>
      
      {/* 4 Key KPI Cards - Single Row */}
      <div className="grid grid-cols-4 gap-5">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 border-l-amber-500">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg mb-3">
            <BadgeDollarSign className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Deuda Total</p>
          <p className="text-2xl font-bold text-amber-600" data-testid="total-debt">S/ {formatNumber(debtorsSummary?.total_debt)}</p>
          <p className="text-xs text-gray-400 mt-1">pendiente</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 border-l-red-500">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg mb-3">
            <UserX className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Morosos</p>
          <p className="text-2xl font-bold text-red-600" data-testid="morosos-count">{debtorsSummary?.morosos_count || 0}</p>
          <p className="text-xs text-gray-400 mt-1">alumnos</p>
        </div>
        <StatCard title="Por Cobrar" value={`S/ ${formatNumber(summary?.pendientes?.total)}`} subtitle={`${summary?.pendientes?.count || 0} pagos pendientes`} icon={Clock} variant="pending" />
        <StatCard title="Ingresos" value={`S/ ${formatNumber(summary?.ingresos?.total)}`} subtitle={`${summary?.ingresos?.count || 0} pagos confirmados`} icon={TrendingUp} variant="income" />
      </div>

      {/* Charts Row 1: Pie + Bar side by side */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Chart 1: Estado de Pagos (Pie) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" data-testid="chart-estado-pagos">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm">Estado de Pagos de los Alumnos</h3>
            <p className="text-xs text-gray-400 mt-0.5">Distribución actual</p>
          </div>
          <div className="p-4 flex items-center justify-center" style={{ height: 260 }}>
            {debtorsSummary ? (() => {
              const pieData = [
                { name: "Al Día", value: debtorsSummary.al_dia_count, color: "#10b981" },
                { name: "Morosos", value: debtorsSummary.morosos_count, color: "#ef4444" }
              ];
              const total = debtorsSummary.al_dia_count + debtorsSummary.morosos_count;
              return (
                <div className="flex items-center gap-6 w-full">
                  <ResponsiveContainer width="55%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `${v} alumnos`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-4">
                    {pieData.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <div>
                          <p className="text-sm font-semibold text-gray-700">{item.name}</p>
                          <p className="text-lg font-bold" style={{ color: item.color }}>{item.value} <span className="text-xs text-gray-400 font-normal">({total > 0 ? Math.round((item.value / total) * 100) : 0}%)</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })() : <p className="text-gray-400 text-sm">Sin datos</p>}
          </div>
        </div>

        {/* Chart 2: Resumen Financiero Mensual (Bar) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" data-testid="chart-ingresos-egresos">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm">Resumen Financiero Mensual</h3>
            <p className="text-xs text-gray-400 mt-0.5">{summary?.period?.month_name} {summary?.period?.year}</p>
          </div>
          <div className="p-4" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: "Ingresos", monto: summary?.ingresos?.total || 0 },
                { name: "Por Cobrar", monto: summary?.pendientes?.total || 0 },
                { name: "Deuda Total", monto: debtorsSummary?.total_debt || 0 },
                { name: "Egresos", monto: summary?.egresos?.total || 0 },
                { name: "Balance", monto: summary?.balance || 0 }
              ]} barSize={44}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `S/${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => `S/ ${formatNumber(v)}`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                <Bar dataKey="monto" radius={[8, 8, 0, 0]} label={{ position: 'top', fontSize: 11, fontWeight: 700, fill: '#334155', formatter: (v) => `S/ ${formatNumber(v)}` }}>
                  {["#10b981", "#f59e0b", "#ef4444", "#f43f5e", "#3b82f6"].map((c, i) => <Cell key={i} fill={c} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart 3: Evolución de Cobranza (Area) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" data-testid="chart-evolucion">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Evolución de Cobranza</h3>
            <p className="text-xs text-gray-400 mt-0.5">Últimos 6 meses</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-gray-500">Ingresos</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-500" /><span className="text-gray-500">Egresos</span></div>
          </div>
        </div>
        <div className="p-4" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={summary?.evolution || []}>
              <defs>
                <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradEgresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `S/${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => `S/ ${formatNumber(v)}`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
              <Area type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2.5} fill="url(#gradIngresos)" name="Ingresos" />
              <Area type="monotone" dataKey="egresos" stroke="#f43f5e" strokeWidth={2.5} fill="url(#gradEgresos)" name="Egresos" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENTS TAB - Premium Banking Design
// ══════════════════════════════════════════════════════════════════════════════
function PaymentsTab({ payments, loading, total, page, totalPages, onPageChange, onCreateNew, onEdit, onConfirm, onCancel, onReactivate, onDelete, filterStatus, setFilterStatus, dateFrom, dateTo, onDateFilter, onDateClear, periodSummary, summaryLoading, token, searchStudentId, setSearchStudentId, financialSettings }) {
  const [studentSearch, setStudentSearch] = useState("");
  const [studentResults, setStudentResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudentName, setSelectedStudentName] = useState("");
  const searchRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  // Calculate mora preview for pending payments in the table
  const calcMoraForPayment = (payment) => {
    if (payment.payment_status !== "pending" || !financialSettings) return null;
    const fs = financialSettings;
    if (!fs.interes_activo) return null;
    const concept = (payment.concept || "").toLowerCase();
    const conceptos = payment.conceptos || [];
    let isMensualidad = concept.includes("mensualidad");
    if (!isMensualidad) isMensualidad = conceptos.some(c => (c.concepto || "").toLowerCase().includes("mensualidad"));
    if (!isMensualidad || !payment.pension_month) return null;
    const diaVenc = parseInt(fs.pronto_pago_fecha_limite || fs.dia_vencimiento_mensualidad || 5);
    const interesValor = parseFloat(fs.interes_valor) || 0;
    if (interesValor <= 0) return null;
    const pm = payment.pension_month;
    try {
      const [year, month] = pm.split("-").map(Number);
      const deadline = new Date(year, month - 1, diaVenc);
      const today = new Date();
      const daysLate = Math.max(Math.floor((today - deadline) / (1000 * 60 * 60 * 24)), 0);
      if (daysLate <= 0) return null;
      let mensBase = 0;
      for (const c of conceptos) {
        if ((c.concepto || "").toLowerCase().includes("mensualidad")) mensBase += c.monto || 0;
      }
      if (mensBase === 0) mensBase = payment.amount_base || 0;
      let mora = 0;
      if ((fs.interes_tipo || "porcentaje") === "porcentaje") {
        mora = Math.round(mensBase * (interesValor / 30 / 100) * daysLate * 100) / 100;
      } else {
        mora = Math.round((interesValor / 30) * daysLate * 100) / 100;
      }
      if (mora <= 0) return null;
      return { mora, daysLate, totalConMora: Math.round((payment.total_amount + mora) * 100) / 100 };
    } catch { return null; }
  };

  useEffect(() => {
    if (!studentSearch.trim() || studentSearch.length < 2) {
      setStudentResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await axios.get(`${API}/users/students/search?q=${encodeURIComponent(studentSearch)}`, { headers });
        setStudentResults(Array.isArray(res.data) ? res.data.slice(0, 8) : []);
        setShowResults(true);
      } catch { setStudentResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearch]);

  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectStudent = (student) => {
    setSearchStudentId(student.id);
    setSelectedStudentName(`${student.name || ""} ${student.last_name || ""}`.trim());
    setStudentSearch("");
    setShowResults(false);
  };

  const clearStudentFilter = () => {
    setSearchStudentId("");
    setSelectedStudentName("");
    setStudentSearch("");
  };
  const handleDownloadBoleta = async (paymentId, numeroBoleta) => {
    try {
      const response = await fetch(`${API}/contabilidad/boletas/${paymentId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Error al descargar boleta");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Boleta_${numeroBoleta || "comprobante"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      const { toast } = await import("sonner");
      toast.error("Error al descargar la boleta");
    }
  };

  return (
    <div className="space-y-5">
      {/* Date filter */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <AccountingDateFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onFilter={onDateFilter}
          onClear={onDateClear}
        />
      </div>

      {/* Summary cards */}
      <AccountingSummaryCards summary={periodSummary} loading={summaryLoading} />

      {/* Student search bar - prominent */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100" ref={searchRef}>
        <div className="flex items-center gap-3">
          {selectedStudentName ? (
            <div className="flex items-center gap-3 flex-1">
              <Search className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-500">Filtrando por:</span>
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm">
                <User className="w-4 h-4 text-blue-500" />
                <span className="text-blue-700 font-semibold">{selectedStudentName}</span>
                <button onClick={clearStudentFilter} className="text-blue-400 hover:text-blue-600 ml-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                onFocus={() => studentResults.length > 0 && setShowResults(true)}
                placeholder="Buscar alumno por nombre o apellido..."
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 focus:bg-white outline-none transition-all placeholder:text-gray-400"
                data-testid="student-search-input"
              />
              {searchLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
            </div>
          )}
        </div>
        {showResults && studentResults.length > 0 && (
          <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto" data-testid="student-search-results">
            {studentResults.map(s => (
              <button
                key={s.id}
                onClick={() => selectStudent(s)}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 border-b border-gray-50 last:border-0 transition-colors"
              >
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">
                  {(s.name || "?")[0]}{(s.last_name || "?")[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.name} {s.last_name}</p>
                  <p className="text-xs text-gray-400">{s.grade_name || ""} {s.section_name || ""}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Header - Status filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-500">Estado:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus("")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterStatus === ""
                  ? "bg-slate-800 text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Todos
            </button>
            {Object.entries(PAYMENT_STATUSES).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  filterStatus === key
                    ? `${val.bgClass} ${val.textClass} border ${val.borderClass}`
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${val.dotClass}`} />
                {val.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onCreateNew}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2"
          data-testid="create-payment-btn"
        >
          <Plus className="w-4 h-4" />
          Nuevo Ingreso
        </button>
      </div>
      
      {/* Table - Premium design */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Estudiante</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Concepto</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Mes</th>
                <th className="px-5 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Base</th>
                <th className="px-5 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">IGV</th>
                <th className="px-5 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Método</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-5 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Receipt className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold">Sin registros en este periodo</p>
                    <p className="text-sm text-gray-400 mt-1">Registra tu primer ingreso</p>
                  </td>
                </tr>
              ) : (
                payments.map(payment => {
                  const statusInfo = PAYMENT_STATUSES[payment.payment_status] || PAYMENT_STATUSES.pending;
                  const moraInfo = calcMoraForPayment(payment);
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50/50 transition-colors" data-testid={`payment-row-${payment.id}`}>
                      <td className="px-5 py-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${statusInfo.bgClass} ${statusInfo.textClass}`}>
                          <div className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
                          {statusInfo.label}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {payment.student_photo ? (
                            <img src={payment.student_photo} alt="" className="w-9 h-9 rounded-lg object-cover" />
                          ) : (
                            <div className="w-9 h-9 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                              <User className="w-4 h-4 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{payment.student_name}</p>
                            <p className="text-xs text-gray-400">{payment.grade_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <span className="text-sm text-gray-600 font-medium" title={payment.concept_label_full || payment.concept_label}>
                            {payment.concept_label}
                          </span>
                          {payment.conceptos && payment.conceptos.length > 1 && (
                            <div className="text-xs text-gray-400 mt-0.5">
                              {payment.conceptos.map(c => `${c.concepto}: S/ ${formatNumber(c.monto)}`).join(" | ")}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-gray-500">{payment.pension_month_label || "-"}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm text-gray-600 font-medium">S/ {formatNumber(payment.amount_base)}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm text-gray-400">
                          {payment.igv_applicable ? `S/ ${formatNumber(payment.igv_amount)}` : "-"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-bold text-gray-800">S/ {formatNumber(payment.total_amount)}</span>
                        {moraInfo && (
                          <div className="mt-1">
                            <span className="text-xs text-rose-500 font-semibold">+S/ {formatNumber(moraInfo.mora)} mora</span>
                            <span className="text-xs text-gray-400 ml-1">({moraInfo.daysLate}d)</span>
                            <div className="text-xs font-bold text-rose-600">Total: S/ {formatNumber(moraInfo.totalConMora)}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-gray-600">{payment.method_label}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-gray-500">{payment.payment_date}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="flex items-center justify-center gap-1">
                          {payment.payment_status !== "canceled" && (
                            <>
                              <button
                                onClick={() => onEdit(payment)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar"
                                data-testid={`edit-payment-${payment.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onCancel(payment)}
                                className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Anular"
                                data-testid={`cancel-payment-${payment.id}`}
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onDelete(payment)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar pago"
                                data-testid={`delete-payment-${payment.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {/* Boleta PDF download */}
                          {payment.boleta_disponible ? (
                            <button
                              onClick={() => handleDownloadBoleta(payment.id, payment.numero_boleta)}
                              className={`p-2 rounded-lg transition-colors ${payment.boleta_anulada ? "text-rose-400 hover:text-rose-600 hover:bg-rose-50" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
                              title={payment.boleta_anulada ? `Boleta ${payment.numero_boleta} (Anulada)` : `Descargar ${payment.numero_boleta}`}
                              data-testid={`download-boleta-${payment.id}`}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          ) : (
                            <span
                              className="p-2 text-gray-200 cursor-not-allowed inline-block"
                              title="Sin boleta emitida"
                              data-testid={`no-boleta-${payment.id}`}
                            >
                              <FileText className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                          {payment.payment_status === "pending" && (
                            <button
                              onClick={() => onConfirm(payment)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="Confirmar pago"
                              data-testid={`confirm-payment-${payment.id}`}
                            >
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              Confirmar pago
                            </button>
                          )}
                          {payment.payment_status === "canceled" && (
                            <button
                              onClick={() => onReactivate(payment)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                              title="Reactivar como pendiente"
                              data-testid={`reactivate-payment-${payment.id}`}
                            >
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                              Reactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination - Premium */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
            <span className="text-sm text-gray-500 font-medium">
              {total} registros
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 font-medium px-3">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPENSES TAB - Premium Banking Design
// ══════════════════════════════════════════════════════════════════════════════
function ExpensesTab({ expenses, loading, total, page, totalPages, onPageChange, onCreateNew, onEdit, onDelete, filterCategory, setFilterCategory, dateFrom, dateTo, onDateFilter, onDateClear, periodSummary, summaryLoading }) {
  return (
    <div className="space-y-5">
      {/* Date filter */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <AccountingDateFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onFilter={onDateFilter}
          onClear={onDateClear}
        />
      </div>

      {/* Summary cards */}
      <AccountingSummaryCards summary={periodSummary} loading={summaryLoading} />

      {/* Header - Premium style */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-500">Categoria:</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 bg-gray-100 border-0 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
            data-testid="filter-expense-category"
          >
            <option value="">Todas</option>
            {Object.entries(EXPENSE_CATEGORIES).map(([key, val]) => (
              <option key={key} value={key}>{val}</option>
            ))}
          </select>
        </div>
        <button
          onClick={onCreateNew}
          className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2"
          data-testid="create-expense-btn"
        >
          <Plus className="w-4 h-4" />
          Nuevo Egreso
        </button>
      </div>
      
      {/* Table - Premium design */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Descripción</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Proveedor</th>
                <th className="px-5 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Base</th>
                <th className="px-5 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">IGV</th>
                <th className="px-5 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-5 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <CreditCard className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold">Sin registros en este periodo</p>
                    <p className="text-sm text-gray-400 mt-1">Registra tu primer egreso</p>
                  </td>
                </tr>
              ) : (
                expenses.map(expense => (
                  <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors" data-testid={`expense-row-${expense.id}`}>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-500 font-medium">{expense.expense_date}</span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-800">{expense.title}</p>
                      {expense.description && (
                        <p className="text-xs text-gray-400 truncate max-w-[200px]">{expense.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold">
                        {expense.category_label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-600">{expense.provider_name || "-"}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm text-gray-600 font-medium">S/ {formatNumber(expense.amount_base)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm text-gray-400">
                        {expense.igv_applicable ? `S/ ${formatNumber(expense.igv_amount)}` : "-"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-bold text-rose-600">S/ {formatNumber(expense.total_amount)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onEdit(expense)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                          data-testid={`edit-expense-${expense.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(expense)}
                          className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Eliminar"
                          data-testid={`delete-expense-${expense.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination - Premium */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
            <span className="text-sm text-gray-500 font-medium">
              {total} registros
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 font-medium px-3">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT AUTOCOMPLETE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
function StudentAutocomplete({ students, grades, sections, selectedId, onSelect, onClear }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const ref = useRef(null);

  const selected = selectedId ? students.find(s => s.id === selectedId) : null;

  const getGradeName = (gId) => {
    const g = grades.find(gr => gr.id === gId);
    return g ? `${g.nivel_nombre} - ${g.nombre}` : "";
  };
  const getSectionName = (sId) => {
    const s = sections.find(sec => sec.id === sId);
    return s ? s.nombre : "";
  };

  const filteredSections = gradeId ? sections.filter(s => s.grado_id === gradeId) : [];

  const filteredStudents = students.filter(s => {
    if (gradeId && s.grado_id !== gradeId) return false;
    if (sectionId && s.seccion_id !== sectionId) return false;
    if (search) {
      const fullName = `${s.name || ""} ${s.last_name || ""}`.toLowerCase();
      if (!fullName.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = (s) => `${(s.name || "")[0] || ""}${(s.last_name || "")[0] || ""}`.toUpperCase();

  return (
    <div className="mb-6" ref={ref} data-testid="student-autocomplete">
      <label className="block text-sm font-bold text-gray-700 mb-2">Estudiante *</label>

      {/* Grade & Section filters */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <select
          value={gradeId}
          onChange={(e) => { setGradeId(e.target.value); setSectionId(""); }}
          className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          data-testid="filter-grade-select"
        >
          <option value="">Todos los grados</option>
          {grades.map(g => (
            <option key={g.id} value={g.id}>{g.nivel_nombre} - {g.nombre}</option>
          ))}
        </select>
        <select
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          disabled={!gradeId}
          className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
          data-testid="filter-section-select"
        >
          <option value="">Todas las secciones</option>
          {filteredSections.map(s => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </div>

      {/* Selected student display */}
      <div className="relative">
        {selected ? (
          <div
            className="flex items-center justify-between px-4 py-3 bg-gray-50 border-2 border-emerald-300 rounded-xl cursor-pointer"
            onClick={() => setOpen(!open)}
          >
            <div className="flex items-center gap-3">
              {selected.photo_url ? (
                <img src={selected.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                  {initials(selected)}
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-gray-800">{selected.name} {selected.last_name}</p>
                <p className="text-xs text-gray-400">{getGradeName(selected.grado_id)} {getSectionName(selected.seccion_id)}</p>
              </div>
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); onClear(); setSearch(""); }} className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            className="flex items-center px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:border-emerald-300 transition-colors"
            onClick={() => setOpen(true)}
          >
            <User className="w-4 h-4 text-gray-400 mr-3" />
            <span className="text-sm text-gray-400">Buscar estudiante...</span>
          </div>
        )}

        {open && (
          <div className="absolute z-[200] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden" data-testid="student-dropdown">
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <Filter className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre..."
                  className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-gray-400"
                  autoFocus
                  data-testid="student-search-input"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">
                  {gradeId ? "Sin estudiantes en este grado/seccion" : "Selecciona un grado para ver estudiantes"}
                </p>
              ) : (
                filteredStudents.map(s => (
                  <div
                    key={s.id}
                    onClick={() => { onSelect(s); setOpen(false); setSearch(""); }}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                      s.id === selectedId ? "bg-emerald-50" : "hover:bg-gray-50"
                    }`}
                    data-testid={`student-option-${s.id}`}
                  >
                    {s.photo_url ? (
                      <img src={s.photo_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {initials(s)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate">{s.name} {s.last_name}</p>
                      <p className="text-xs text-gray-400 truncate">{getGradeName(s.grado_id)} {getSectionName(s.seccion_id)}</p>
                    </div>
                    {s.id === selectedId && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENT FORM MODAL - Premium Banking Design
// ══════════════════════════════════════════════════════════════════════════════
function PaymentFormModal({ isOpen, onClose, payment, onSave, grades, sections, students, financialSettings }) {
  const headers = { Authorization: `Bearer ${localStorage.getItem("token") || ""}` };
  const [paymentConcepts, setPaymentConcepts] = useState([]);
  const [studentPaidConcepts, setStudentPaidConcepts] = useState([]);
  const [studentPension, setStudentPension] = useState(null);

  // Load active payment concepts
  useEffect(() => {
    if (isOpen) {
      axios.get(`${API}/accounting/payment-concepts`, { headers })
        .then(r => setPaymentConcepts(r.data.concepts || []))
        .catch(() => {});
    }
  }, [isOpen]);

  // Load student's already-paid concepts for current year
  const loadStudentPaidConcepts = (studentId) => {
    if (!studentId) { setStudentPaidConcepts([]); setStudentPension(null); return; }
    const currentYear = new Date().getFullYear();
    axios.get(`${API}/accounting/student-paid-concepts/${studentId}?year=${currentYear}`, { headers })
      .then(r => setStudentPaidConcepts(r.data.paid_concepts || []))
      .catch(() => setStudentPaidConcepts([]));
    // Also load student pension with discounts
    axios.get(`${API}/accounting/students/${studentId}/pension`, { headers })
      .then(r => setStudentPension(r.data))
      .catch(() => setStudentPension(null));
  };

  // Filter out "unico" concepts already paid by this student
  const availableConcepts = useMemo(() => 
    paymentConcepts.filter(c => {
      if (c.concept_type === "unico" && studentPaidConcepts.includes(c.name)) return false;
      return true;
    }),
    [paymentConcepts, studentPaidConcepts]
  );

  const getDefaultAmount = (conceptName) => {
    const found = paymentConcepts.find(c => c.name === conceptName);
    if (found && found.amount > 0) {
      // For mensualidad, use student's individual pension if available
      if ((conceptName.toLowerCase() === "mensualidad") && studentPension && studentPension.final_pension > 0) {
        return studentPension.final_pension.toString();
      }
      return found.amount.toString();
    }
    // Fallback to financial settings
    if (conceptName.toLowerCase() === "matricula" || conceptName === "Matrícula") {
      const val = financialSettings?.matricula || financialSettings?.matricula_monto || 0;
      return val > 0 ? val.toString() : "";
    }
    if (conceptName.toLowerCase() === "mensualidad") {
      // Use student pension if available
      if (studentPension && studentPension.final_pension > 0) {
        return studentPension.final_pension.toString();
      }
      const val = financialSettings?.pension_mensual || 0;
      return val > 0 ? val.toString() : "";
    }
    if (found) return found.amount.toString();
    return "";
  };

  const [formData, setFormData] = useState({
    student_id: "",
    grade_id: "",
    section_id: "",
    concept: "",
    description: "",
    amount_base: "",
    igv_applicable: false,
    igv_percentage: IGV_PERCENTAGE,
    payment_method: "efectivo",
    payment_status: "paid",
    payment_date: new Date().toISOString().split("T")[0],
    pension_month: "",
    receipt_number: "",
    notes: ""
  });
  const [addedConcepts, setAddedConcepts] = useState([]);
  const [filteredSections, setFilteredSections] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [applyInterest, setApplyInterest] = useState(false);
  const isEditMode = !!payment?.id;
  const hasMensualidadConcept = addedConcepts.some(c => c.concepto.toLowerCase() === "mensualidad");

  // Financial settings
  const fs = financialSettings || {};
  const prontoPagoActivo = fs.pronto_pago_activo === true;
  const prontoPagoMonto = parseFloat(fs.pronto_pago_monto) || 0;
  const pensionMensual = parseFloat(fs.pension_mensual) || 0;
  const prontoPagoDescuento = pensionMensual > 0 && prontoPagoMonto > 0 ? pensionMensual - prontoPagoMonto : 0;
  const prontoPagoFechaLimite = parseInt(fs.pronto_pago_fecha_limite) || 5;
  const isMensualidad = isEditMode ? formData.concept.toLowerCase() === "mensualidad" : hasMensualidadConcept;
  const canApplyDiscount = prontoPagoActivo && isMensualidad && prontoPagoDescuento > 0;

  // Interest logic
  const interesActivo = fs.interes_activo === true;
  const interesTipo = fs.interes_tipo || "porcentaje";
  const interesValor = parseFloat(fs.interes_valor) || 0;
  const canApplyInterest = interesActivo && isMensualidad && interesValor > 0;

  // Calculate days late based on pension_month and payment_date
  const calcDaysLate = () => {
    if (!formData.pension_month || !formData.payment_date) return 0;
    const [year, month] = formData.pension_month.split("-").map(Number);
    const deadline = new Date(year, month - 1, prontoPagoFechaLimite);
    const payDate = new Date(formData.payment_date + "T12:00:00");
    const diff = Math.floor((payDate - deadline) / (1000 * 60 * 60 * 24));
    return Math.max(diff, 0);
  };
  const daysLate = calcDaysLate();

  // Calculate interest amount
  const calcInterestAmount = (base) => {
    if (!applyInterest || !canApplyInterest || daysLate <= 0) return 0;
    if (interesTipo === "porcentaje") {
      const dailyRate = interesValor / 30 / 100;
      return Math.round(base * dailyRate * daysLate * 100) / 100;
    }
    // Fixed monthly amount → daily
    const dailyFixed = interesValor / 30;
    return Math.round(dailyFixed * daysLate * 100) / 100;
  };

  // Auto-detect discount and interest based on dates
  useEffect(() => {
    if (canApplyDiscount && formData.payment_date) {
      const payDay = new Date(formData.payment_date + "T12:00:00").getDate();
      setApplyDiscount(payDay <= prontoPagoFechaLimite);
    } else {
      setApplyDiscount(false);
    }
    if (canApplyInterest) {
      setApplyInterest(daysLate > 0);
    } else {
      setApplyInterest(false);
    }
  }, [formData.payment_date, formData.pension_month, canApplyDiscount, canApplyInterest, prontoPagoFechaLimite]);

  // Multi-concept total calculation
  const multiConceptSubtotal = addedConcepts.reduce((sum, c) => sum + (c.monto || 0), 0);
  const amountBase = isEditMode ? (parseFloat(formData.amount_base) || 0) : multiConceptSubtotal;
  
  // For multi-concept: only apply discount/interest to the Mensualidad portion
  const mensualidadAmount = isEditMode
    ? amountBase
    : addedConcepts.filter(c => c.concepto.toLowerCase() === "mensualidad").reduce((s, c) => s + (c.monto || 0), 0);
  const discountAmount = (applyDiscount && canApplyDiscount) ? Math.min(prontoPagoDescuento, mensualidadAmount) : 0;
  const amountAfterDiscount = Math.max(amountBase - discountAmount, 0);
  const interestBase = Math.max(mensualidadAmount - discountAmount, 0);
  const interestAmount = calcInterestAmount(interestBase);
  const amountWithInterest = amountAfterDiscount + interestAmount;
  const igvAmount = formData.igv_applicable ? amountWithInterest * (formData.igv_percentage / 100) : 0;
  const totalAmount = amountWithInterest + igvAmount;


  useEffect(() => {
    if (payment) {
      setFormData({
        student_id: payment.student_id || "",
        grade_id: payment.grade_id || "",
        section_id: payment.section_id || "",
        concept: payment.concept || "mensualidad",
        description: payment.description || "",
        amount_base: payment.amount_base?.toString() || "",
        igv_applicable: payment.igv_applicable ?? false,
        igv_percentage: payment.igv_percentage || IGV_PERCENTAGE,
        payment_method: payment.payment_method || "efectivo",
        payment_status: payment.payment_status || "pending",
        payment_date: payment.payment_date || new Date().toISOString().split("T")[0],
        pension_month: payment.pension_month || "",
        receipt_number: payment.receipt_number || "",
        notes: payment.notes || ""
      });
      setAddedConcepts([]);
    } else {
      // For new payments, start with empty concept (user must select)
      setFormData(prev => ({
        ...prev,
        concept: "",
        amount_base: "",
        ...(prev.student_id ? {} : {
          student_id: "",
          grade_id: "",
          section_id: "",
        }),
        description: prev.student_id ? prev.description : "",
        igv_applicable: false,
        igv_percentage: IGV_PERCENTAGE,
        payment_method: prev.student_id ? prev.payment_method : "efectivo",
        payment_status: prev.student_id ? prev.payment_status : "paid",
        payment_date: prev.payment_date || new Date().toISOString().split("T")[0],
        pension_month: prev.student_id ? prev.pension_month : "",
        receipt_number: prev.student_id ? prev.receipt_number : "",
        notes: prev.student_id ? prev.notes : ""
      }));
      setAddedConcepts([]);
    }
    setError("");
  }, [payment, isOpen, availableConcepts]);

  // Auto-fill amount when concept changes (only for new payments)
  const handleConceptChange = (newConcept) => {
    if (!newConcept) return;
    // Editing existing single-concept payment
    if (payment?.id) {
      const updates = { concept: newConcept };
      updates.amount_base = getDefaultAmount(newConcept);
      setFormData(prev => ({ ...prev, ...updates }));
      return;
    }
    // New payment: add concept to list
    if (addedConcepts.find(c => c.concepto === newConcept)) return; // No duplicates
    const defaultAmt = parseFloat(getDefaultAmount(newConcept)) || 0;
    setAddedConcepts(prev => [...prev, { concepto: newConcept, monto: defaultAmt }]);
    setFormData(prev => ({ ...prev, concept: "" })); // Reset selector
  };

  const removeAddedConcept = (conceptName) => {
    setAddedConcepts(prev => prev.filter(c => c.concepto !== conceptName));
  };

  const updateAddedConceptAmount = (conceptName, newAmount) => {
    setAddedConcepts(prev => prev.map(c =>
      c.concepto === conceptName ? { ...c, monto: parseFloat(newAmount) || 0 } : c
    ));
  };

  // Filter out already-added concepts from the dropdown
  const dropdownConcepts = useMemo(() =>
    availableConcepts.filter(c => !addedConcepts.find(ac => ac.concepto === c.name)),
    [availableConcepts, addedConcepts]
  );

  useEffect(() => {
    if (formData.grade_id) {
      setFilteredSections(sections.filter(s => s.grado_id === formData.grade_id));
    } else {
      setFilteredSections([]);
    }
  }, [formData.grade_id, sections]);

  useEffect(() => {
    if (formData.grade_id && formData.section_id) {
      setFilteredStudents(students.filter(s => 
        s.grado_id === formData.grade_id && s.seccion_id === formData.section_id
      ));
    } else {
      setFilteredStudents([]);
    }
  }, [formData.grade_id, formData.section_id, students]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.student_id) {
      setError("Selecciona un estudiante");
      return;
    }

    // Edit mode: single concept
    if (payment?.id) {
      if (!formData.amount_base || parseFloat(formData.amount_base) <= 0) {
        setError("Ingresa un monto válido");
        return;
      }
      setSaving(true);
      try {
        await onSave({ ...formData, amount_base: parseFloat(formData.amount_base) });
        onClose();
      } catch (err) {
        setError(err.response?.data?.detail || "Error al guardar pago");
      } finally {
        setSaving(false);
      }
      return;
    }

    // New payment: multi-concept mode
    if (addedConcepts.length === 0) {
      setError("Agrega al menos un concepto");
      return;
    }

    for (const c of addedConcepts) {
      if (!c.monto || c.monto <= 0) {
        setError(`El monto de "${c.concepto}" debe ser mayor a 0`);
        return;
      }
    }

    if (hasMensualidadConcept && !formData.pension_month) {
      setError("Selecciona el mes de pensión");
      return;
    }

    setSaving(true);
    try {
      const saveData = {
        student_id: formData.student_id,
        grade_id: formData.grade_id,
        section_id: formData.section_id,
        conceptos: addedConcepts,
        igv_applicable: formData.igv_applicable,
        igv_percentage: formData.igv_percentage,
        payment_method: formData.payment_method,
        payment_status: formData.payment_status,
        payment_date: formData.payment_date,
        pension_month: hasMensualidadConcept ? formData.pension_month : undefined,
        notes: formData.notes,
        description: formData.description,
        interest_amount: interestAmount > 0 ? Math.round(interestAmount * 100) / 100 : 0,
        discount_amount: discountAmount > 0 ? Math.round(discountAmount * 100) / 100 : 0,
      };
      await onSave(saveData);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar pago");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" data-testid="payment-form-modal">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header - Premium banking style */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {payment?.id ? "Editar Ingreso" : "Registrar Ingreso"}
              </h2>
              <p className="text-xs text-emerald-100">Complete los datos del pago</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Student selection - Autocomplete */}
          <StudentAutocomplete
            students={students}
            grades={grades}
            sections={sections}
            selectedId={formData.student_id}
            onSelect={(s) => {
              setFormData(prev => ({ ...prev, student_id: s.id, grade_id: s.grado_id || "", section_id: s.seccion_id || "" }));
              loadStudentPaidConcepts(s.id);
            }}
            onClear={() => {
              setFormData(prev => ({ ...prev, student_id: "", grade_id: "", section_id: "", concept: "", amount_base: "" }));
              setStudentPaidConcepts([]);
              setStudentPension(null);
            }}
          />

          {/* Student Discounts Breakdown - shown when student is selected */}
          {formData.student_id && studentPension && studentPension.discounts && studentPension.discounts.length > 0 && (
            <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl" data-testid="payment-student-discounts">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-gray-700">Descuentos del alumno</span>
                <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                  {studentPension.discounts.length} descuento{studentPension.discounts.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {studentPension.discounts.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1.5">
                      {d.origin === "automatic" ? (
                        <span className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center flex-shrink-0"><Zap className="w-3 h-3 text-blue-600" /></span>
                      ) : (
                        <span className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center flex-shrink-0"><User className="w-3 h-3 text-gray-500" /></span>
                      )}
                      {d.name}
                      <span className="text-xs text-gray-400">({d.type === "percentage" ? `${d.value}%` : `S/ ${d.value}`})</span>
                    </span>
                    <span className="font-semibold text-rose-500">- S/ {formatNumber(d.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-blue-200 text-sm">
                  <span className="text-gray-600">Base: S/ {formatNumber(studentPension.base_pension)}</span>
                  <span className="font-bold text-emerald-600">Pension individual: S/ {formatNumber(studentPension.final_pension)}</span>
                </div>
              </div>
              {studentPension.is_override && (
                <p className="text-xs text-amber-600 mt-2 font-medium">* Monto fijo manual (override)</p>
              )}
            </div>
          )}

          {/* Concept selector — adds to list for new payments */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Concepto</label>
              {isEditMode ? (
                <select
                  value={formData.concept}
                  onChange={(e) => handleConceptChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  data-testid="concept-select"
                >
                  <option value="">Seleccionar concepto</option>
                  {availableConcepts.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <select
                  value=""
                  onChange={(e) => handleConceptChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  data-testid="concept-select"
                >
                  <option value="">Agregar concepto...</option>
                  {dropdownConcepts.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Método de Pago</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {Object.entries(METHODS).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Added concepts list (new payment mode) */}
          {!isEditMode && addedConcepts.length > 0 && (
            <div className="mb-6 space-y-2" data-testid="added-concepts-list">
              {addedConcepts.map((c, idx) => (
                <div key={c.concepto} className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 animate-in slide-in-from-top-1 duration-200" data-testid={`concept-item-${idx}`}>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-gray-800">{c.concepto}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium">S/</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={c.monto || ""}
                      onChange={(e) => updateAddedConceptAmount(c.concepto, e.target.value)}
                      className="w-28 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      data-testid={`concept-amount-${idx}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAddedConcept(c.concepto)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    data-testid={`concept-remove-${idx}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pension Month - shown when concept is mensualidad */}
          {(hasMensualidadConcept || (isEditMode && formData.concept.toLowerCase() === "mensualidad")) && (
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">Mes de Pensión *</label>
              <input
                type="month"
                value={formData.pension_month}
                onChange={(e) => setFormData(prev => ({ ...prev, pension_month: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                data-testid="pension-month-input"
              />
              <p className="text-xs text-gray-400 mt-1">Selecciona el mes al que corresponde esta pensión</p>
            </div>
          )}

          {/* Amount calculator */}
          {(addedConcepts.length > 0 || isEditMode) && (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 mb-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <CircleDollarSign className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-bold text-gray-700">Cálculo del Monto</span>
            </div>

            {/* Edit mode: editable single amount */}
            {isEditMode && (
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Monto Base (S/.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount_base}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount_base: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-lg font-bold text-gray-700"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer select-none bg-white px-4 py-3 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    checked={formData.igv_applicable}
                    onChange={(e) => setFormData(prev => ({ ...prev, igv_applicable: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-semibold text-gray-700">Incluye IGV (18%)</span>
                </label>
              </div>
            </div>
            )}

            {/* New mode: IGV checkbox only */}
            {!isEditMode && (
              <div className="mb-4">
                <label className="flex items-center gap-3 cursor-pointer select-none bg-white px-4 py-3 rounded-xl border border-gray-200 w-fit">
                  <input
                    type="checkbox"
                    checked={formData.igv_applicable}
                    onChange={(e) => setFormData(prev => ({ ...prev, igv_applicable: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-semibold text-gray-700">Incluye IGV (18%)</span>
                </label>
              </div>
            )}
            
            <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Subtotal</span>
                <span className="font-bold text-gray-700">S/ {formatNumber(amountBase)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Pronto Pago (sobre Mensualidad)</span>
                  <span className="font-bold text-emerald-600">- S/ {formatNumber(discountAmount)}</span>
                </div>
              )}
              {interestAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Mora ({daysLate} dia{daysLate !== 1 ? "s" : ""} - sobre Mensualidad)</span>
                  <span className="font-bold text-rose-500">+ S/ {formatNumber(interestAmount)}</span>
                </div>
              )}
              {formData.igv_applicable && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">IGV (18%)</span>
                  <span className="font-bold text-amber-600">S/ {formatNumber(igvAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base pt-3 border-t border-gray-100">
                <span className="font-bold text-gray-700">Total a Pagar</span>
                <span className="text-xl font-bold text-emerald-600">S/ {formatNumber(totalAmount)}</span>
              </div>
            </div>
          </div>
          )}

          {/* Status and date */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Estado</label>
              <select
                value={formData.payment_status}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_status: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="pending">Pendiente</option>
                <option value="paid">Pagado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Fecha</label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Notas (opcional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Observaciones adicionales..."
              rows={2}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
            data-testid="save-payment-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {payment?.id ? "Actualizar" : addedConcepts.length > 1 ? `Registrar (${addedConcepts.length} conceptos)` : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXPENSE FORM MODAL - Premium Banking Design
// ══════════════════════════════════════════════════════════════════════════════
function ExpenseFormModal({ isOpen, onClose, expense, onSave }) {
  const [formData, setFormData] = useState({
    title: "",
    category: "servicios",
    description: "",
    amount_base: "",
    igv_applicable: false,
    igv_percentage: IGV_PERCENTAGE,
    expense_date: new Date().toISOString().split("T")[0],
    payment_method: "transferencia",
    provider_name: "",
    notes: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const amountBase = parseFloat(formData.amount_base) || 0;
  const igvAmount = formData.igv_applicable ? amountBase * (formData.igv_percentage / 100) : 0;
  const totalAmount = amountBase + igvAmount;

  useEffect(() => {
    if (expense) {
      setFormData({
        title: expense.title || "",
        category: expense.category || "servicios",
        description: expense.description || "",
        amount_base: expense.amount_base?.toString() || "",
        igv_applicable: expense.igv_applicable ?? false,
        igv_percentage: expense.igv_percentage || IGV_PERCENTAGE,
        expense_date: expense.expense_date || new Date().toISOString().split("T")[0],
        payment_method: expense.payment_method || "transferencia",
        provider_name: expense.provider_name || "",
        notes: expense.notes || ""
      });
    } else {
      setFormData({
        title: "",
        category: "servicios",
        description: "",
        amount_base: "",
        igv_applicable: false,
        igv_percentage: IGV_PERCENTAGE,
        expense_date: new Date().toISOString().split("T")[0],
        payment_method: "transferencia",
        provider_name: "",
        notes: ""
      });
    }
    setError("");
  }, [expense, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.title.trim()) {
      setError("El título es requerido");
      return;
    }
    if (!formData.amount_base || parseFloat(formData.amount_base) <= 0) {
      setError("Ingresa un monto válido");
      return;
    }

    setSaving(true);
    try {
      await onSave({ ...formData, amount_base: parseFloat(formData.amount_base) });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar egreso");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" data-testid="expense-form-modal">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header - Premium banking style */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {expense?.id ? "Editar Egreso" : "Registrar Egreso"}
              </h2>
              <p className="text-xs text-rose-100">Complete los datos del gasto</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Title */}
          <div className="mb-5">
            <label className="block text-sm font-bold text-gray-700 mb-2">Descripción del Gasto</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ej: Pago de luz - Enero 2026"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>

          {/* Category and provider */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Categoría</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              >
                {Object.entries(EXPENSE_CATEGORIES).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Proveedor</label>
              <input
                type="text"
                value={formData.provider_name}
                onChange={(e) => setFormData(prev => ({ ...prev, provider_name: e.target.value }))}
                placeholder="Nombre del proveedor"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Amount and IGV - Premium calculator style */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 mb-5 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <CircleDollarSign className="w-5 h-5 text-rose-500" />
              <span className="text-sm font-bold text-gray-700">Cálculo del Monto</span>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Monto Base (S/.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount_base}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount_base: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer select-none bg-white px-4 py-3 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    checked={formData.igv_applicable}
                    onChange={(e) => setFormData(prev => ({ ...prev, igv_applicable: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-sm font-semibold text-gray-700">Incluye IGV (18%)</span>
                </label>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 font-medium">Subtotal</span>
                <span className="font-bold text-gray-700">S/ {formatNumber(amountBase)}</span>
              </div>
              {formData.igv_applicable && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">IGV (18%)</span>
                  <span className="font-bold text-amber-600">S/ {formatNumber(igvAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base pt-3 border-t border-gray-100">
                <span className="font-bold text-gray-700">Total Egreso</span>
                <span className="text-xl font-bold text-rose-600">S/ {formatNumber(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Date and method */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Fecha</label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData(prev => ({ ...prev, expense_date: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Método de Pago</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              >
                {Object.entries(METHODS).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Notas (opcional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Observaciones adicionales..."
              rows={2}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
            data-testid="save-expense-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {expense?.id ? "Actualizar" : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT - Premium Banking Design
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// STUDENT HISTORY MODAL
// ══════════════════════════════════════════════════════════════════════════════
function StudentHistoryModal({ isOpen, onClose, studentId, token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (isOpen && studentId) {
      setLoading(true);
      axios.get(`${API}/accounting/student-history/${studentId}`, { headers })
        .then(res => setData(res.data))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }
  }, [isOpen, studentId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" data-testid="student-history-modal">
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
              {/* Totals */}
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

              {/* Matricula */}
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

              {/* Mensualidades */}
              {data.mensualidades.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Mensualidades</h3>
                  <div className="space-y-1.5">
                    {data.mensualidades.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100" data-testid={`history-item-${m.pension_month}`}>
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

              {/* Otros */}
              {data.otros.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Otros Pagos</h3>
                  {data.otros.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <span className="text-sm font-medium text-gray-700">{m.concept_label}</span>
                      <span className="text-sm font-bold text-gray-800">S/ {formatNumber(m.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MOROSOS TAB
// ══════════════════════════════════════════════════════════════════════════════
// Collapsible pending months cell
function PendingMonthsCell({ months }) {
  const [expanded, setExpanded] = useState(false);
  if (!months || months.length === 0) {
    return <span className="text-xs italic" style={{ color: "#9CA3AF" }}>Al día en meses</span>;
  }
  return (
    <div className="min-w-[160px]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 group cursor-pointer"
        data-testid="toggle-pending-months"
      >
        <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold" style={{ background: "#FCEBEB", color: "#A32D2D" }}>
          {months.length}
        </span>
        <span className="text-[13px] font-medium" style={{ color: "#A32D2D" }}>
          {months.length} {months.length === 1 ? "mes" : "meses"} sin pagar
        </span>
        <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-1 mt-2">
          {months.map((m, i) => (
            <span key={i} className="text-[11px] px-2 py-0.5 rounded" style={{ background: "#F5F5F4", color: "#6B6B67" }}>{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// Student initials helper
function getInitials(name) {
  if (!name || name === "Desconocido") return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function MorososTab({ loading, debtors, debtorsSummary, onViewHistory }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? debtors : debtors.filter(d => d.status === filter);
  const avgDebt = debtorsSummary?.morosos_count > 0 ? (debtorsSummary.total_debt / debtorsSummary.morosos_count) : 0;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className={`bg-white rounded-xl p-5 border shadow-sm border-l-4 border-l-red-500 cursor-pointer hover:shadow-md transition-all ${filter === "moroso" ? "border-red-300 ring-1 ring-red-200" : "border-gray-100"}`}
          onClick={() => setFilter(filter === "moroso" ? "all" : "moroso")}
          data-testid="card-morosos"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center"><UserX className="w-5 h-5 text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold text-red-600">{debtorsSummary?.morosos_count || 0}</p>
              <p className="text-xs text-gray-500">Morosos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><BadgeDollarSign className="w-5 h-5 text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold text-amber-600">S/ {formatNumber(debtorsSummary?.total_debt)}</p>
              <p className="text-xs text-gray-500">Deuda Total</p>
            </div>
          </div>
        </div>
        <div
          className={`bg-white rounded-xl p-5 border shadow-sm border-l-4 border-l-emerald-500 cursor-pointer hover:shadow-md transition-all ${filter === "al_dia" ? "border-emerald-300 ring-1 ring-emerald-200" : "border-gray-100"}`}
          onClick={() => setFilter(filter === "al_dia" ? "all" : "al_dia")}
          data-testid="card-al-dia"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center"><UserCheck className="w-5 h-5 text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{debtorsSummary?.al_dia_count || 0}</p>
              <p className="text-xs text-gray-500">Al Día</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 bg-white rounded-xl p-3 shadow-sm border border-gray-100">
        <span className="text-sm font-medium text-gray-500 mr-2">Filtrar:</span>
        {[{key: "all", label: "Todos"}, {key: "moroso", label: "Morosos"}, {key: "al_dia", label: "Al Día"}].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f.key ? "bg-slate-800 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            data-testid={`filter-${f.key}`}
          >{f.label}</button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="morosos-table">
            <thead>
              <tr className="border-b border-gray-100" style={{ background: "#FAFAF9" }}>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#8C8C88" }}>Estado</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#8C8C88" }}>Alumno</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#8C8C88" }}>Deuda</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#8C8C88" }}>Meses Pendientes</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#8C8C88" }}>Último Pago</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#8C8C88" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-16 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><Users className="w-8 h-8 text-gray-300" /></div>
                  <p className="text-gray-500 font-semibold">Sin resultados</p>
                </td></tr>
              ) : filtered.map(d => (
                <tr
                  key={d.student_id}
                  className="transition-colors hover:bg-[#FAFAF9]"
                  style={{ borderBottom: "0.5px solid #E8E8E5" }}
                  data-testid={`debtor-row-${d.student_id}`}
                >
                  {/* Estado */}
                  <td className="px-4 py-4">
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                      style={d.status === "moroso"
                        ? { background: "#FCEBEB", color: "#A32D2D" }
                        : { background: "#ECFDF5", color: "#166534" }
                      }
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: d.status === "moroso" ? "#A32D2D" : "#22C55E" }}
                      />
                      {d.status === "moroso" ? "Moroso" : "Al Día"}
                    </div>
                  </td>
                  {/* Alumno (con grado fusionado) */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                        style={{ background: "#F5F5F4", color: "#6B6B67" }}
                      >
                        {getInitials(d.student_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{d.student_name}</p>
                        <p className="text-xs" style={{ color: "#9CA3AF" }}>{d.grade_name} - {d.section_name}</p>
                      </div>
                    </div>
                  </td>
                  {/* Deuda */}
                  <td className="px-4 py-4 text-right">
                    <span className="text-sm font-medium" style={{ color: d.total_pending > 0 ? "#A32D2D" : "#166534" }}>
                      S/ {formatNumber(d.total_pending)}
                    </span>
                  </td>
                  {/* Meses Pendientes (colapsable) */}
                  <td className="px-4 py-4">
                    <PendingMonthsCell months={d.pending_months} />
                  </td>
                  {/* Último Pago */}
                  <td className="px-4 py-4 text-right">
                    <span className="text-[13px]" style={{ color: "#9CA3AF" }}>{d.last_payment_date || "-"}</span>
                  </td>
                  {/* Acciones */}
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => onViewHistory(d.student_id)}
                      className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors mx-auto"
                      title="Ver historial"
                      data-testid={`view-history-${d.student_id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


function ConfigTab({ token, user, onGenerateBilling }) {
  const [subTab, setSubTab] = useState("financiero");
  return (
    <div data-testid="config-tab-wrapper">
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setSubTab("financiero")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            subTab === "financiero" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
          data-testid="subtab-financiero"
        >
          Configuracion Financiera
        </button>
        <button
          onClick={() => setSubTab("boletas")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            subTab === "boletas" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
          data-testid="subtab-boletas"
        >
          Datos para Boletas
        </button>
      </div>
      {subTab === "financiero" && <FinancialSettingsTab token={token} user={user} onGenerateBilling={onGenerateBilling} />}
      {subTab === "boletas" && <ConfiguracionBoletaTab token={token} user={user} />}
    </div>
  );
}


export default function AccountingPage({ user, token, subdomain, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // RBAC: Check if user can access accounting
  const hasAccess = canAccessSection(user, 'accounting');
  
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(1);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const [expensesPage, setExpensesPage] = useState(1);
  const [expensesTotalPages, setExpensesTotalPages] = useState(1);
  
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("");
  const [filterExpenseCategory, setFilterExpenseCategory] = useState("");
  
  // Date range filter state (shared across tabs)
  const [dateFrom, setDateFrom] = useState(getDefaultDates().from);
  const [dateTo, setDateTo] = useState(getDefaultDates().to);
  const [periodSummary, setPeriodSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [searchStudentId, setSearchStudentId] = useState("");
  
  // Confirmation modal states
  const [showConfirmPaymentModal, setShowConfirmPaymentModal] = useState(false);
  const [showCancelPaymentModal, setShowCancelPaymentModal] = useState(false);
  const [showDeleteExpenseModal, setShowDeleteExpenseModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [processing, setProcessing] = useState(false);
  
  // Debtors state
  const [debtors, setDebtors] = useState([]);
  const [debtorsSummary, setDebtorsSummary] = useState(null);
  const [debtorsLoading, setDebtorsLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [boletaPreview, setBoletaPreview] = useState({ open: false, ingresoId: null, numeroBoleta: null });
  const [historyStudentId, setHistoryStudentId] = useState(null);
  const [financialSettings, setFinancialSettings] = useState(null);
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) loadPayments();
  }, [filterPaymentStatus, paymentsPage, dateFrom, dateTo, searchStudentId]);

  useEffect(() => {
    if (!loading) loadExpenses();
  }, [filterExpenseCategory, expensesPage, dateFrom, dateTo]);

  useEffect(() => {
    if (!loading) loadPeriodSummary(dateFrom, dateTo);
  }, [dateFrom, dateTo]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [settingsRes, gradesRes, sectionsRes, usersRes, summaryRes, finSettingsRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/sections`, { headers }),
        axios.get(`${API}/users`, { headers }),
        axios.get(`${API}/accounting/summary`, { headers }),
        axios.get(`${API}/accounting/financial-settings`, { headers }).catch(() => null)
      ]);
      
      setSettings(settingsRes.data);
      setGrades(gradesRes.data.filter(g => g.activo));
      setSections(sectionsRes.data.filter(s => s.activo));
      setStudents(usersRes.data.filter(u => u.role === "student"));
      setSummary(summaryRes.data);
      if (finSettingsRes) setFinancialSettings(finSettingsRes.data);
      
      await Promise.all([loadPayments(), loadExpenses(), loadDebtors(), loadPeriodSummary(dateFrom, dateTo)]);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const res = await axios.get(`${API}/accounting/summary`, { headers });
      setSummary(res.data);
    } catch (err) {
      console.error("Error loading summary:", err);
    }
  };

  const loadPayments = async () => {
    try {
      const params = { page: paymentsPage, limit: 20 };
      if (filterPaymentStatus) params.status = filterPaymentStatus;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (searchStudentId) params.student_id = searchStudentId;
      const res = await axios.get(`${API}/accounting/payments`, { headers, params });
      setPayments(res.data.payments || []);
      setPaymentsTotal(res.data.total || 0);
      setPaymentsTotalPages(res.data.total_pages || 1);
    } catch (err) {
      console.error("Error loading payments:", err);
    }
  };

  const loadExpenses = async () => {
    try {
      const params = { page: expensesPage, limit: 20 };
      if (filterExpenseCategory) params.category = filterExpenseCategory;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await axios.get(`${API}/accounting/expenses`, { headers, params });
      setExpenses(res.data.expenses || []);
      setExpensesTotal(res.data.total || 0);
      setExpensesTotalPages(res.data.total_pages || 1);
    } catch (err) {
      console.error("Error loading expenses:", err);
    }
  };

  const loadDebtors = async () => {
    setDebtorsLoading(true);
    try {
      const res = await axios.get(`${API}/accounting/debtors`, { headers });
      setDebtors(res.data.debtors || []);
      setDebtorsSummary(res.data.summary || null);
    } catch (err) {
      console.error("Error loading debtors:", err);
    } finally {
      setDebtorsLoading(false);
    }
  };

  const loadPeriodSummary = async (from, to) => {
    setSummaryLoading(true);
    try {
      const params = {};
      if (from) params.date_from = from;
      if (to) params.date_to = to;
      const res = await axios.get(`${API}/accounting/period-summary`, { headers, params });
      setPeriodSummary(res.data);
    } catch (err) {
      console.error("Error loading period summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleDateFilter = (from, to) => {
    setDateFrom(from);
    setDateTo(to);
    setPaymentsPage(1);
    setExpensesPage(1);
  };

  const handleDateClear = () => {
    const defaults = getDefaultDates();
    setDateFrom(defaults.from);
    setDateTo(defaults.to);
    setPaymentsPage(1);
    setExpensesPage(1);
  };

  const handleSavePayment = async (data) => {
    if (editingPayment?.id) {
      await axios.put(`${API}/accounting/payments/${editingPayment.id}`, data, { headers });
    } else {
      const res = await axios.post(`${API}/accounting/payments`, data, { headers });
      const payment = res.data?.payment;
      const deletedCount = res.data?.deleted_pending || 0;
      
      if (payment?.boleta_disponible && payment?.numero_boleta) {
        const { toast } = await import("sonner");
        let msg = `Boleta ${payment.numero_boleta} emitida`;
        if (deletedCount > 0) msg += `. ${deletedCount} cuota${deletedCount > 1 ? 's' : ''} pendiente${deletedCount > 1 ? 's' : ''} anterior${deletedCount > 1 ? 'es' : ''} fueron eliminada${deletedCount > 1 ? 's' : ''} automaticamente`;
        toast.success(msg);
        setShowPaymentModal(false);
        setEditingPayment(null);
        setBoletaPreview({ open: true, ingresoId: payment.id, numeroBoleta: payment.numero_boleta });
      } else if (payment && !payment.boleta_disponible) {
        const { toast } = await import("sonner");
        let msg = "Pago registrado.";
        if (deletedCount > 0) msg += ` ${deletedCount} cuota${deletedCount > 1 ? 's' : ''} pendiente${deletedCount > 1 ? 's' : ''} anterior${deletedCount > 1 ? 'es' : ''} fueron eliminada${deletedCount > 1 ? 's' : ''} automaticamente.`;
        else msg += " Configura los datos del emisor en Configuracion > Datos para Boletas para emitir boletas.";
        toast.info(msg, { duration: 6000 });
      }
    }
    loadPayments();
    loadSummary();
    loadDebtors();
    loadPeriodSummary(dateFrom, dateTo);
  };

  const handleConfirmPaymentClick = (payment) => {
    setSelectedPayment(payment);
    setShowConfirmPaymentModal(true);
  };

  // Calculate mora preview for confirm modal
  const calcConfirmMoraPreview = () => {
    if (!selectedPayment) return { mora: 0, newTotal: selectedPayment?.total_amount || 0, daysLate: 0 };
    const fs = financialSettings || {};
    const concept = (selectedPayment.concept || "").toLowerCase();
    const conceptos = selectedPayment.conceptos || [];
    let isMensualidad = concept.includes("mensualidad");
    if (!isMensualidad) {
      isMensualidad = conceptos.some(c => (c.concepto || "").toLowerCase().includes("mensualidad"));
    }
    if (!isMensualidad || !selectedPayment.pension_month || !fs.interes_activo) {
      return { mora: 0, newTotal: selectedPayment.total_amount || 0, daysLate: 0 };
    }
    const diaVenc = parseInt(fs.pronto_pago_fecha_limite || fs.dia_vencimiento_mensualidad || 5);
    const interesTipo = fs.interes_tipo || "porcentaje";
    const interesValor = parseFloat(fs.interes_valor) || 0;
    if (interesValor <= 0) return { mora: 0, newTotal: selectedPayment.total_amount || 0, daysLate: 0 };
    const pm = selectedPayment.pension_month;
    const [year, month] = pm.split("-").map(Number);
    const deadline = new Date(year, month - 1, diaVenc);
    const today = new Date();
    const daysLate = Math.max(Math.floor((today - deadline) / (1000 * 60 * 60 * 24)), 0);
    if (daysLate <= 0) return { mora: 0, newTotal: selectedPayment.total_amount || 0, daysLate: 0 };
    let mensBase = 0;
    for (const c of conceptos) {
      if ((c.concepto || "").toLowerCase().includes("mensualidad")) mensBase += c.monto || 0;
    }
    if (mensBase === 0) mensBase = selectedPayment.amount_base || 0;
    let mora = 0;
    if (interesTipo === "porcentaje") {
      mora = Math.round(mensBase * (interesValor / 30 / 100) * daysLate * 100) / 100;
    } else {
      mora = Math.round((interesValor / 30) * daysLate * 100) / 100;
    }
    return { mora, newTotal: Math.round(((selectedPayment.total_amount || 0) + mora) * 100) / 100, daysLate };
  };
  const confirmMoraPreview = calcConfirmMoraPreview();
  
  const handleConfirmPayment = async () => {
    if (!selectedPayment) return;
    setProcessing(true);
    try {
      const res = await axios.put(`${API}/accounting/payments/${selectedPayment.id}/confirm`, {}, { headers });
      const data = res.data;
      loadPayments();
      loadSummary();
      loadDebtors();
      setShowConfirmPaymentModal(false);
      setSelectedPayment(null);

      const interestApplied = data?.interest_applied || 0;
      // Open boleta PDF if emitted
      if (data?.boleta_disponible && data?.numero_boleta) {
        const { toast } = await import("sonner");
        let msg = `Pago confirmado. Boleta ${data.numero_boleta} emitida`;
        if (interestApplied > 0) msg += `. Mora aplicada: +S/ ${interestApplied.toFixed(2)}`;
        toast.success(msg);
        setBoletaPreview({ open: true, ingresoId: selectedPayment.id, numeroBoleta: data.numero_boleta });
      } else {
        const { toast } = await import("sonner");
        let msg = "Pago confirmado correctamente";
        if (interestApplied > 0) msg += `. Mora aplicada: +S/ ${interestApplied.toFixed(2)}`;
        toast.success(msg);
      }
    } catch (err) {
      const { toast } = await import("sonner");
      toast.error(err.response?.data?.detail || "Error al confirmar pago");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelPaymentClick = (payment) => {
    setSelectedPayment(payment);
    setShowCancelPaymentModal(true);
  };
  
  const handleCancelPayment = async () => {
    if (!selectedPayment) return;
    setProcessing(true);
    try {
      await axios.put(`${API}/accounting/payments/${selectedPayment.id}/cancel`, {}, { headers });
      loadPayments();
      loadSummary();
      setShowCancelPaymentModal(false);
      setSelectedPayment(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al anular pago");
    } finally {
      setProcessing(false);
    }
  };

  const handleReactivatePayment = async (payment) => {
    try {
      await axios.put(`${API}/accounting/payments/${payment.id}/reactivate`, {}, { headers });
      const { toast } = await import("sonner");
      toast.success("Pago reactivado como pendiente");
      loadPayments();
      loadSummary();
      loadDebtors();
    } catch (err) {
      const { toast } = await import("sonner");
      toast.error(err.response?.data?.detail || "Error al reactivar pago");
    }
  };


  const handleDeletePayment = async (payment) => {
    const { toast } = await import("sonner");
    if (!window.confirm(`¿Está seguro de ELIMINAR permanentemente este pago de ${payment.student_name || "alumno"}? Esta acción no se puede deshacer.`)) return;
    try {
      await axios.delete(`${API}/accounting/payments/${payment.id}`, { headers });
      toast.success("Pago eliminado correctamente");
      loadPayments();
      loadSummary();
      loadDebtors();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar pago");
    }
  };


  const handleSaveExpense = async (data) => {
    if (editingExpense?.id) {
      await axios.put(`${API}/accounting/expenses/${editingExpense.id}`, data, { headers });
    } else {
      await axios.post(`${API}/accounting/expenses`, data, { headers });
    }
    loadExpenses();
    loadSummary();
    loadPeriodSummary(dateFrom, dateTo);
  };

  const handleDeleteExpenseClick = (expense) => {
    setSelectedExpense(expense);
    setShowDeleteExpenseModal(true);
  };
  
  const handleDeleteExpense = async () => {
    if (!selectedExpense) return;
    setProcessing(true);
    try {
      await axios.delete(`${API}/accounting/expenses/${selectedExpense.id}`, { headers });
      loadExpenses();
      loadSummary();
      setShowDeleteExpenseModal(false);
      setSelectedExpense(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-slate-600 animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500 font-medium">Cargando datos financieros...</p>
        </div>
      </div>
    );
  }

  // RBAC: Show access denied if user doesn't have permission
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar 
          active="contabilidad"
          onNavigate={() => {}}
          expanded={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          schoolName={settings?.system_name}
          subdomain={subdomain}
          user={user}
        />
        <div className="flex-1 flex flex-col">
          <DashboardHeader
            user={user}
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            onLogout={onLogout}
            subdomain={subdomain}
          />
          <AccessDenied 
            title="Acceso a Contabilidad Restringido"
            message="No tienes permisos para acceder al módulo de contabilidad."
            suggestion="El propietario puede habilitar el acceso desde Ajustes > Configuración de Roles."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex" data-testid="accounting-page">
      <Sidebar 
        active="contabilidad"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.system_name}
        subdomain={subdomain}
        user={user}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.system_name}
          subdomain={subdomain}
        />

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 pb-20 lg:pb-8">
          {/* Page header - Premium with icon */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
                <Landmark className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Contabilidad</h1>
                <p className="text-sm text-gray-500">Control de ingresos y egresos del colegio</p>
              </div>
            </div>
          </div>

          {/* Tabs - Premium style */}
          <div className="bg-white rounded-2xl border border-gray-100 p-1.5 mb-8 inline-flex shadow-sm">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === "dashboard"
                  ? "bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              data-testid="tab-dashboard"
            >
              Resumen
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === "payments"
                  ? "bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              data-testid="tab-payments"
            >
              Ingresos
            </button>
            <button
              onClick={() => setActiveTab("expenses")}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === "expenses"
                  ? "bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              data-testid="tab-expenses"
            >
              Egresos
            </button>
            <button
              onClick={() => setActiveTab("morosos")}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === "morosos"
                  ? "bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              data-testid="tab-morosos"
            >
              Morosos
              {debtorsSummary?.morosos_count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${activeTab === "morosos" ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>{debtorsSummary.morosos_count}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("config")}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === "config"
                  ? "bg-gradient-to-r from-slate-700 to-slate-800 text-white shadow-md"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              data-testid="tab-config"
            >
              <Settings className="w-4 h-4" />
              Configuracion
            </button>
            <button
              onClick={() => setActiveTab("yape")}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === "yape"
                  ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              data-testid="tab-yape"
            >
              {activeTab === "yape"
                ? <img src="/yape_logo_white.png" alt="Yape" className="w-6 h-6 rounded object-cover" />
                : <QrCode className="w-4 h-4" />
              }
              Cobro Yape
            </button>
          </div>

          {/* Tab content */}
          {activeTab === "dashboard" && (
            <DashboardTab
              summary={summary}
              loading={loading}
              debtorsSummary={debtorsSummary}
            />
          )}
          {activeTab === "payments" && (
            <PaymentsTab
              payments={payments}
              loading={loading}
              total={paymentsTotal}
              page={paymentsPage}
              totalPages={paymentsTotalPages}
              onPageChange={setPaymentsPage}
              onCreateNew={() => { setEditingPayment(null); setShowPaymentModal(true); }}
              onEdit={(p) => { setEditingPayment(p); setShowPaymentModal(true); }}
              onConfirm={handleConfirmPaymentClick}
              onCancel={handleCancelPaymentClick}
              onReactivate={handleReactivatePayment}
              onDelete={handleDeletePayment}
              filterStatus={filterPaymentStatus}
              setFilterStatus={setFilterPaymentStatus}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFilter={handleDateFilter}
              onDateClear={handleDateClear}
              periodSummary={periodSummary}
              summaryLoading={summaryLoading}
              token={token}
              searchStudentId={searchStudentId}
              setSearchStudentId={(id) => { setSearchStudentId(id); setPaymentsPage(1); }}
              financialSettings={financialSettings}
            />
          )}
          {activeTab === "expenses" && (
            <ExpensesTab
              expenses={expenses}
              loading={loading}
              total={expensesTotal}
              page={expensesPage}
              totalPages={expensesTotalPages}
              onPageChange={setExpensesPage}
              onCreateNew={() => { setEditingExpense(null); setShowExpenseModal(true); }}
              onEdit={(e) => { setEditingExpense(e); setShowExpenseModal(true); }}
              onDelete={handleDeleteExpenseClick}
              filterCategory={filterExpenseCategory}
              setFilterCategory={setFilterExpenseCategory}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFilter={handleDateFilter}
              onDateClear={handleDateClear}
              periodSummary={periodSummary}
              summaryLoading={summaryLoading}
            />
          )}
          {activeTab === "morosos" && (
            <MorososTab
              loading={debtorsLoading}
              debtors={debtors}
              debtorsSummary={debtorsSummary}
              onViewHistory={(studentId) => { setHistoryStudentId(studentId); setShowHistoryModal(true); }}
            />
          )}
          {activeTab === "config" && (
            <ConfigTab token={token} user={user} onGenerateBilling={() => setShowBillingModal(true)} />
          )}
          {activeTab === "yape" && (
            <div data-testid="yape-tab-content">
              <YapeConfigPanel token={token} />
              <YapePaymentVerification token={token} />
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <StudentHistoryModal
        isOpen={showHistoryModal}
        onClose={() => { setShowHistoryModal(false); setHistoryStudentId(null); }}
        studentId={historyStudentId}
        token={token}
      />
      <PaymentFormModal
        isOpen={showPaymentModal}
        onClose={() => { setShowPaymentModal(false); setEditingPayment(null); }}
        payment={editingPayment}
        onSave={handleSavePayment}
        grades={grades}
        sections={sections}
        students={students}
        financialSettings={financialSettings}
      />
      <ExpenseFormModal
        isOpen={showExpenseModal}
        onClose={() => { setShowExpenseModal(false); setEditingExpense(null); }}
        expense={editingExpense}
        onSave={handleSaveExpense}
      />
      
      {/* Confirm Payment Modal */}
      <ConfirmModal
        isOpen={showConfirmPaymentModal}
        onClose={() => { setShowConfirmPaymentModal(false); setSelectedPayment(null); }}
        onConfirm={handleConfirmPayment}
        loading={processing}
        title="Confirmar Pago"
        message={confirmMoraPreview.mora > 0
          ? `¿Confirmar el pago de S/ ${formatNumber(selectedPayment?.total_amount || 0)}?\n\nSe aplicara mora de S/ ${formatNumber(confirmMoraPreview.mora)} (${confirmMoraPreview.daysLate} dias de atraso).\nTotal final: S/ ${formatNumber(confirmMoraPreview.newTotal)}`
          : `¿Confirmar el pago de S/ ${formatNumber(selectedPayment?.total_amount || 0)}? Esta accion registrara el ingreso como confirmado.`
        }
        confirmText="Confirmar Pago"
        variant="success"
        icon="payment"
      />
      
      {/* Cancel Payment Modal */}
      <ConfirmModal
        isOpen={showCancelPaymentModal}
        onClose={() => { setShowCancelPaymentModal(false); setSelectedPayment(null); }}
        onConfirm={handleCancelPayment}
        loading={processing}
        title="Anular Pago"
        message="¿Estás seguro de anular este pago? Esta acción revertirá el ingreso registrado."
        confirmText="Anular Pago"
        variant="warning"
        icon="ban"
      />
      
      {/* Delete Expense Modal */}
      <ConfirmModal
        isOpen={showDeleteExpenseModal}
        onClose={() => { setShowDeleteExpenseModal(false); setSelectedExpense(null); }}
        onConfirm={handleDeleteExpense}
        loading={processing}
        title="Eliminar Egreso"
        message={`¿Estás seguro de eliminar este egreso? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        icon="delete"
      />
      <MobileBottomNav role={user?.role === "admin" ? "admin" : "owner"} />
      <FloatingHelpAvatar subdomain={subdomain} />

      <BoletaPreviewModal
        isOpen={boletaPreview.open}
        ingresoId={boletaPreview.ingresoId}
        numeroBoleta={boletaPreview.numeroBoleta}
        onClose={() => setBoletaPreview({ open: false, ingresoId: null, numeroBoleta: null })}
      />
      <GenerateBillingModal
        isOpen={showBillingModal}
        onClose={() => setShowBillingModal(false)}
        token={token}
        onSuccess={() => { loadDebtors(); loadPayments(); loadSummary(); }}
      />
    </div>
  );
}
