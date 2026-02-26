import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import AccessDenied from "../components/AccessDenied";
import { canAccessSection } from "../lib/permissions";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { 
  Plus, X, Loader2, AlertCircle, Check, Edit2, Trash2, 
  TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle,
  Receipt, CreditCard, Filter, ChevronLeft, ChevronRight, User,
  ArrowUpRight, ArrowDownRight, Calendar, Landmark,
  CircleDollarSign, FileText, Percent, Scale, Briefcase,
  BadgeDollarSign, Coins, ChartLine, Building2, Wallet2,
  ShieldCheck, BarChart4, LineChart, Users, AlertOctagon, 
  Eye, History, UserX, UserCheck
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
      
      {/* Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Ingresos" value={`S/ ${formatNumber(summary?.ingresos?.total)}`} subtitle={`${summary?.ingresos?.count || 0} pagos confirmados`} icon={TrendingUp} variant="income" />
        <StatCard title="Egresos" value={`S/ ${formatNumber(summary?.egresos?.total)}`} subtitle={`${summary?.egresos?.count || 0} gastos registrados`} icon={TrendingDown} variant="expense" />
        <StatCard title="Por Cobrar" value={`S/ ${formatNumber(summary?.pendientes?.total)}`} subtitle={`${summary?.pendientes?.count || 0} pagos pendientes`} icon={Clock} variant="pending" />
        <StatCard title="Balance" value={`S/ ${formatNumber(summary?.balance)}`} subtitle="Ingresos - Egresos" icon={Scale} variant="balance" />
      </div>

      {/* Student KPIs */}
      {debtorsSummary && (
        <div className="grid grid-cols-3 gap-5">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 border-l-red-500">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <UserX className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Alumnos Morosos</p>
            <p className="text-2xl font-bold text-red-600" data-testid="morosos-count">{debtorsSummary.morosos_count}</p>
            <p className="text-xs text-gray-400 mt-1">alumnos con deuda</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 border-l-amber-500">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <BadgeDollarSign className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Deuda Total</p>
            <p className="text-2xl font-bold text-amber-600" data-testid="total-debt">S/ {formatNumber(debtorsSummary.total_debt)}</p>
            <p className="text-xs text-gray-400 mt-1">pensiones pendientes</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 border-l-emerald-500">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Alumnos al Día</p>
            <p className="text-2xl font-bold text-emerald-600" data-testid="al-dia-count">{debtorsSummary.al_dia_count}</p>
            <p className="text-xs text-gray-400 mt-1">pagos al día</p>
          </div>
        </div>
      )}

      {/* IGV Detail Cards */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Income breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <Coins className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Detalle de Ingresos</h3>
                <p className="text-xs text-emerald-100">Desglose con IGV</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                <span className="text-sm text-gray-600">Base Imponible</span>
              </div>
              <span className="text-sm font-bold text-gray-800">S/ {formatNumber(summary?.ingresos?.base)}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                <span className="text-sm text-gray-600">IGV (18%)</span>
              </div>
              <span className="text-sm font-bold text-gray-800">S/ {formatNumber(summary?.ingresos?.igv)}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-bold text-gray-700">Total Ingresos</span>
              <span className="text-xl font-bold text-emerald-600">S/ {formatNumber(summary?.ingresos?.total)}</span>
            </div>
          </div>
        </div>

        {/* Expense breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Detalle de Egresos</h3>
                <p className="text-xs text-rose-100">Desglose con IGV</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                <span className="text-sm text-gray-600">Base Imponible</span>
              </div>
              <span className="text-sm font-bold text-gray-800">S/ {formatNumber(summary?.egresos?.base)}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                <span className="text-sm text-gray-600">IGV (18%)</span>
              </div>
              <span className="text-sm font-bold text-gray-800">S/ {formatNumber(summary?.egresos?.igv)}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-bold text-gray-700">Total Egresos</span>
              <span className="text-xl font-bold text-rose-600">S/ {formatNumber(summary?.egresos?.total)}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent transactions - Premium style */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Recent payments */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-sm">Últimos Ingresos</h3>
            </div>
            <span className="text-xs text-gray-400">Recientes</span>
          </div>
          <div className="divide-y divide-gray-50">
            {summary?.recent_payments?.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Receipt className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400 font-medium">No hay pagos registrados</p>
              </div>
            ) : (
              summary?.recent_payments?.map(payment => {
                const statusInfo = PAYMENT_STATUSES[payment.payment_status] || PAYMENT_STATUSES.pending;
                return (
                  <div 
                    key={payment.id} 
                    className="px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => onViewPayment(payment)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{payment.student_name}</p>
                          <p className="text-xs text-gray-400">{payment.concept_label}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-800">S/ {formatNumber(payment.total_amount)}</p>
                        <div className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bgClass} ${statusInfo.textClass}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                          {statusInfo.label}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        
        {/* Recent expenses */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-sm">Últimos Egresos</h3>
            </div>
            <span className="text-xs text-gray-400">Recientes</span>
          </div>
          <div className="divide-y divide-gray-50">
            {summary?.recent_expenses?.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <CreditCard className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400 font-medium">No hay egresos registrados</p>
              </div>
            ) : (
              summary?.recent_expenses?.map(expense => (
                <div 
                  key={expense.id} 
                  className="px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onViewExpense(expense)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-rose-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{expense.title}</p>
                        <p className="text-xs text-gray-400">{expense.category_label}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-rose-600">- S/ {formatNumber(expense.total_amount)}</p>
                      <p className="text-xs text-gray-400 mt-1">{expense.expense_date}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENTS TAB - Premium Banking Design
// ══════════════════════════════════════════════════════════════════════════════
function PaymentsTab({ payments, loading, total, page, totalPages, onPageChange, onCreateNew, onEdit, onConfirm, onCancel, filterStatus, setFilterStatus }) {
  return (
    <div className="space-y-5">
      {/* Header - Premium style */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
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
                  <td colSpan={9} className="px-5 py-16 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Receipt className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-semibold">No hay ingresos registrados</p>
                    <p className="text-sm text-gray-400 mt-1">Registra tu primer ingreso</p>
                  </td>
                </tr>
              ) : (
                payments.map(payment => {
                  const statusInfo = PAYMENT_STATUSES[payment.payment_status] || PAYMENT_STATUSES.pending;
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
                          <div className="w-9 h-9 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{payment.student_name}</p>
                            <p className="text-xs text-gray-400">{payment.grade_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-gray-600 font-medium">{payment.concept_label}</span>
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
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-gray-600">{payment.method_label}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-gray-500">{payment.payment_date}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1">
                          {payment.payment_status === "pending" && (
                            <button
                              onClick={() => onConfirm(payment)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Confirmar pago"
                              data-testid={`confirm-payment-${payment.id}`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
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
                            </>
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
function ExpensesTab({ expenses, loading, total, page, totalPages, onPageChange, onCreateNew, onEdit, onDelete, filterCategory, setFilterCategory }) {
  return (
    <div className="space-y-5">
      {/* Header - Premium style */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-500">Categoría:</span>
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
                    <p className="text-gray-500 font-semibold">No hay egresos registrados</p>
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
// PAYMENT FORM MODAL - Premium Banking Design
// ══════════════════════════════════════════════════════════════════════════════
function PaymentFormModal({ isOpen, onClose, payment, onSave, grades, sections, students }) {
  const [formData, setFormData] = useState({
    student_id: "",
    grade_id: "",
    section_id: "",
    concept: "mensualidad",
    description: "",
    amount_base: "",
    igv_applicable: true,
    igv_percentage: IGV_PERCENTAGE,
    payment_method: "efectivo",
    payment_status: "pending",
    payment_date: new Date().toISOString().split("T")[0],
    pension_month: "",
    receipt_number: "",
    notes: ""
  });
  const [filteredSections, setFilteredSections] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const amountBase = parseFloat(formData.amount_base) || 0;
  const igvAmount = formData.igv_applicable ? amountBase * (formData.igv_percentage / 100) : 0;
  const totalAmount = amountBase + igvAmount;

  useEffect(() => {
    if (payment) {
      setFormData({
        student_id: payment.student_id || "",
        grade_id: payment.grade_id || "",
        section_id: payment.section_id || "",
        concept: payment.concept || "mensualidad",
        description: payment.description || "",
        amount_base: payment.amount_base?.toString() || "",
        igv_applicable: payment.igv_applicable ?? true,
        igv_percentage: payment.igv_percentage || IGV_PERCENTAGE,
        payment_method: payment.payment_method || "efectivo",
        payment_status: payment.payment_status || "pending",
        payment_date: payment.payment_date || new Date().toISOString().split("T")[0],
        pension_month: payment.pension_month || "",
        receipt_number: payment.receipt_number || "",
        notes: payment.notes || ""
      });
    } else {
      setFormData({
        student_id: "",
        grade_id: "",
        section_id: "",
        concept: "mensualidad",
        description: "",
        amount_base: "",
        igv_applicable: true,
        igv_percentage: IGV_PERCENTAGE,
        payment_method: "efectivo",
        payment_status: "pending",
        payment_date: new Date().toISOString().split("T")[0],
        pension_month: "",
        receipt_number: "",
        notes: ""
      });
    }
    setError("");
  }, [payment, isOpen]);

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
    if (!formData.amount_base || parseFloat(formData.amount_base) <= 0) {
      setError("Ingresa un monto válido");
      return;
    }
    if (formData.concept === "mensualidad" && !formData.pension_month) {
      setError("Selecciona el mes de pensión");
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="payment-form-modal">
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

          {/* Student selection */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-3">Estudiante</label>
            <div className="grid grid-cols-3 gap-3">
              <select
                value={formData.grade_id}
                onChange={(e) => setFormData(prev => ({ ...prev, grade_id: e.target.value, section_id: "", student_id: "" }))}
                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Grado</option>
                {grades.map(g => (
                  <option key={g.id} value={g.id}>{g.nivel_nombre} - {g.nombre}</option>
                ))}
              </select>
              <select
                value={formData.section_id}
                onChange={(e) => setFormData(prev => ({ ...prev, section_id: e.target.value, student_id: "" }))}
                disabled={!formData.grade_id}
                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">Sección</option>
                {filteredSections.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              <select
                value={formData.student_id}
                onChange={(e) => setFormData(prev => ({ ...prev, student_id: e.target.value }))}
                disabled={!formData.section_id}
                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">Estudiante</option>
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.last_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Concept and method */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Concepto</label>
              <select
                value={formData.concept}
                onChange={(e) => setFormData(prev => ({ ...prev, concept: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {Object.entries(CONCEPTS).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
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

          {/* Pension Month - shown when concept is mensualidad */}
          {formData.concept === "mensualidad" && (
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

          {/* Amount and IGV - Premium calculator style */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 mb-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <CircleDollarSign className="w-5 h-5 text-emerald-600" />
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
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                <span className="font-bold text-gray-700">Total a Pagar</span>
                <span className="text-xl font-bold text-emerald-600">S/ {formatNumber(totalAmount)}</span>
              </div>
            </div>
          </div>

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
            {payment?.id ? "Actualizar" : "Registrar"}
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
    igv_applicable: true,
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
        igv_applicable: expense.igv_applicable ?? true,
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
        igv_applicable: true,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="expense-form-modal">
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
export default function AccountingPage({ user, token, subdomain, onLogout }) {
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
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  
  // Confirmation modal states
  const [showConfirmPaymentModal, setShowConfirmPaymentModal] = useState(false);
  const [showCancelPaymentModal, setShowCancelPaymentModal] = useState(false);
  const [showDeleteExpenseModal, setShowDeleteExpenseModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [processing, setProcessing] = useState(false);
  
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) loadPayments();
  }, [filterPaymentStatus, paymentsPage]);

  useEffect(() => {
    if (!loading) loadExpenses();
  }, [filterExpenseCategory, expensesPage]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [settingsRes, gradesRes, sectionsRes, usersRes, summaryRes] = await Promise.all([
        axios.get(`${API}/settings`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/sections`, { headers }),
        axios.get(`${API}/users`, { headers }),
        axios.get(`${API}/accounting/summary`, { headers })
      ]);
      
      setSettings(settingsRes.data);
      setGrades(gradesRes.data.filter(g => g.activo));
      setSections(sectionsRes.data.filter(s => s.activo));
      setStudents(usersRes.data.filter(u => u.role === "student"));
      setSummary(summaryRes.data);
      
      await Promise.all([loadPayments(), loadExpenses()]);
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
      const res = await axios.get(`${API}/accounting/expenses`, { headers, params });
      setExpenses(res.data.expenses || []);
      setExpensesTotal(res.data.total || 0);
      setExpensesTotalPages(res.data.total_pages || 1);
    } catch (err) {
      console.error("Error loading expenses:", err);
    }
  };

  const handleSavePayment = async (data) => {
    if (editingPayment?.id) {
      await axios.put(`${API}/accounting/payments/${editingPayment.id}`, data, { headers });
    } else {
      await axios.post(`${API}/accounting/payments`, data, { headers });
    }
    loadPayments();
    loadSummary();
  };

  const handleConfirmPaymentClick = (payment) => {
    setSelectedPayment(payment);
    setShowConfirmPaymentModal(true);
  };
  
  const handleConfirmPayment = async () => {
    if (!selectedPayment) return;
    setProcessing(true);
    try {
      await axios.put(`${API}/accounting/payments/${selectedPayment.id}/confirm`, {}, { headers });
      loadPayments();
      loadSummary();
      setShowConfirmPaymentModal(false);
      setSelectedPayment(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al confirmar pago");
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

  const handleSaveExpense = async (data) => {
    if (editingExpense?.id) {
      await axios.put(`${API}/accounting/expenses/${editingExpense.id}`, data, { headers });
    } else {
      await axios.post(`${API}/accounting/expenses`, data, { headers });
    }
    loadExpenses();
    loadSummary();
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
        <main className="flex-1 p-6 lg:p-8">
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
          </div>

          {/* Tab content */}
          {activeTab === "dashboard" && (
            <DashboardTab
              summary={summary}
              loading={loading}
              onViewPayment={(p) => { setEditingPayment(p); setShowPaymentModal(true); }}
              onViewExpense={(e) => { setEditingExpense(e); setShowExpenseModal(true); }}
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
              filterStatus={filterPaymentStatus}
              setFilterStatus={setFilterPaymentStatus}
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
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <PaymentFormModal
        isOpen={showPaymentModal}
        onClose={() => { setShowPaymentModal(false); setEditingPayment(null); }}
        payment={editingPayment}
        onSave={handleSavePayment}
        grades={grades}
        sections={sections}
        students={students}
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
        message={`¿Confirmar el pago de S/ ${formatNumber(selectedPayment?.total_amount || 0)}? Esta acción registrará el ingreso como confirmado.`}
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
    </div>
  );
}
