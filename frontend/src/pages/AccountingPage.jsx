import { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import { 
  Wallet, Plus, X, Loader2, AlertCircle, Check, Edit2, Trash2, 
  TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, DollarSign,
  Receipt, CreditCard, Building, Filter, ChevronLeft, ChevronRight, User,
  ArrowUpRight, ArrowDownRight, MoreHorizontal, Calendar, Banknote,
  PiggyBank, CircleDollarSign, FileText
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

// Payment statuses - softer colors
const PAYMENT_STATUSES = {
  pending: { label: "Pendiente", color: "#F59E0B", bgClass: "bg-amber-50", textClass: "text-amber-600", dotClass: "bg-amber-400" },
  paid: { label: "Pagado", color: "#10B981", bgClass: "bg-emerald-50", textClass: "text-emerald-600", dotClass: "bg-emerald-400" },
  canceled: { label: "Anulado", color: "#EF4444", bgClass: "bg-red-50", textClass: "text-red-500", dotClass: "bg-red-400" }
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
// SKELETON LOADER
// ══════════════════════════════════════════════════════════════════════════════
function AccountingSkeleton() {
  return (
    <div className="space-y-6" data-testid="accounting-skeleton">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl p-6 animate-pulse border border-slate-100">
            <div className="h-4 bg-slate-100 rounded w-1/2 mb-4" />
            <div className="h-8 bg-slate-100 rounded w-3/4" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-6 animate-pulse border border-slate-100">
        <div className="h-6 bg-slate-100 rounded w-1/4 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-50 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STAT CARD COMPONENT - Premium Design
// ══════════════════════════════════════════════════════════════════════════════
function StatCard({ title, value, subtitle, icon: Icon, trend, trendValue, variant = "default" }) {
  const variants = {
    default: {
      iconBg: "bg-slate-100",
      iconColor: "text-slate-600",
      valueColor: "text-slate-900"
    },
    success: {
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-700"
    },
    danger: {
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
      valueColor: "text-red-600"
    },
    warning: {
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      valueColor: "text-amber-700"
    },
    info: {
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      valueColor: "text-blue-700"
    }
  };

  const style = variants[variant];

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 ${style.iconBg} rounded-xl flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${style.iconColor}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm font-medium ${
            trend === "up" ? "text-emerald-600" : "text-red-500"
          }`}>
            {trend === "up" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {trendValue}
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <p className={`text-2xl font-bold ${style.valueColor}`}>{value}</p>
      {subtitle && (
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB - Premium Design
// ══════════════════════════════════════════════════════════════════════════════
function DashboardTab({ summary, loading, onViewPayment, onViewExpense }) {
  if (loading) return <AccountingSkeleton />;
  
  return (
    <div className="space-y-6">
      {/* Period header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            Resumen Financiero
          </h2>
          <p className="text-sm text-slate-500">
            {summary?.period?.month_name} {summary?.period?.year}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-sm text-slate-600">
          <FileText className="w-4 h-4" />
          IGV: {IGV_PERCENTAGE}%
        </div>
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Ingresos Confirmados"
          value={`S/ ${formatNumber(summary?.ingresos?.total)}`}
          subtitle={`${summary?.ingresos?.count || 0} pagos registrados`}
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          title="Egresos Totales"
          value={`S/ ${formatNumber(summary?.egresos?.total)}`}
          subtitle={`${summary?.egresos?.count || 0} gastos registrados`}
          icon={TrendingDown}
          variant="danger"
        />
        <StatCard
          title="Pagos Pendientes"
          value={`S/ ${formatNumber(summary?.pendientes?.total)}`}
          subtitle={`${summary?.pendientes?.count || 0} por cobrar`}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Balance del Mes"
          value={`S/ ${formatNumber(summary?.balance)}`}
          subtitle="Ingresos - Egresos"
          icon={PiggyBank}
          variant={(summary?.balance || 0) >= 0 ? "info" : "danger"}
        />
      </div>

      {/* IGV Summary */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" />
            Detalle de Ingresos
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-sm text-slate-500">Base Imponible</span>
              <span className="text-sm font-semibold text-slate-700">S/ {formatNumber(summary?.ingresos?.base)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-sm text-slate-500">IGV (18%)</span>
              <span className="text-sm font-semibold text-slate-700">S/ {formatNumber(summary?.ingresos?.igv)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-slate-700">Total</span>
              <span className="text-base font-bold text-emerald-600">S/ {formatNumber(summary?.ingresos?.total)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-red-500" />
            Detalle de Egresos
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-sm text-slate-500">Base Imponible</span>
              <span className="text-sm font-semibold text-slate-700">S/ {formatNumber(summary?.egresos?.base)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <span className="text-sm text-slate-500">IGV (18%)</span>
              <span className="text-sm font-semibold text-slate-700">S/ {formatNumber(summary?.egresos?.igv)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-slate-700">Total</span>
              <span className="text-base font-bold text-red-500">S/ {formatNumber(summary?.egresos?.total)}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Recent transactions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent payments */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              Últimos Ingresos
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {summary?.recent_payments?.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Receipt className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400">No hay pagos registrados</p>
              </div>
            ) : (
              summary?.recent_payments?.map(payment => {
                const statusInfo = PAYMENT_STATUSES[payment.payment_status] || PAYMENT_STATUSES.pending;
                return (
                  <div 
                    key={payment.id} 
                    className="px-6 py-4 hover:bg-slate-50/50 cursor-pointer transition-colors"
                    onClick={() => onViewPayment(payment)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{payment.student_name}</p>
                          <p className="text-xs text-slate-400">{payment.concept_label}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-800">S/ {formatNumber(payment.total_amount)}</p>
                        <div className="flex items-center gap-1.5 justify-end mt-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                          <span className={`text-xs ${statusInfo.textClass}`}>{statusInfo.label}</span>
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
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              Últimos Egresos
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {summary?.recent_expenses?.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <CreditCard className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400">No hay egresos registrados</p>
              </div>
            ) : (
              summary?.recent_expenses?.map(expense => (
                <div 
                  key={expense.id} 
                  className="px-6 py-4 hover:bg-slate-50/50 cursor-pointer transition-colors"
                  onClick={() => onViewExpense(expense)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{expense.title}</p>
                        <p className="text-xs text-slate-400">{expense.category_label}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-500">- S/ {formatNumber(expense.total_amount)}</p>
                      <p className="text-xs text-slate-400 mt-1">{expense.expense_date}</p>
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
// PAYMENTS TAB - Premium Design
// ══════════════════════════════════════════════════════════════════════════════
function PaymentsTab({ payments, loading, total, page, totalPages, onPageChange, onCreateNew, onEdit, onConfirm, onCancel, filterStatus, setFilterStatus }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Filtrar:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus("")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filterStatus === ""
                  ? "bg-slate-800 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
            >
              Todos
            </button>
            {Object.entries(PAYMENT_STATUSES).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  filterStatus === key
                    ? `${val.bgClass} ${val.textClass} border border-current`
                    : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
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
          className="px-5 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors flex items-center gap-2"
          data-testid="create-payment-btn"
        >
          <Plus className="w-4 h-4" />
          Registrar Pago
        </button>
      </div>
      
      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Estudiante</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Concepto</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Base</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">IGV</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Método</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Receipt className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">No hay pagos registrados</p>
                    <p className="text-sm text-slate-400 mt-1">Comienza registrando tu primer pago</p>
                  </td>
                </tr>
              ) : (
                payments.map(payment => {
                  const statusInfo = PAYMENT_STATUSES[payment.payment_status] || PAYMENT_STATUSES.pending;
                  return (
                    <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`payment-row-${payment.id}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
                          <span className={`text-sm font-medium ${statusInfo.textClass}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{payment.student_name}</p>
                            <p className="text-xs text-slate-400">{payment.grade_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{payment.concept_label}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-slate-600">S/ {formatNumber(payment.amount_base)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-slate-400">
                          {payment.igv_applicable ? `S/ ${formatNumber(payment.igv_amount)}` : "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold text-slate-800">S/ {formatNumber(payment.total_amount)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{payment.method_label}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-500">{payment.payment_date}</span>
                      </td>
                      <td className="px-6 py-4">
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
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Editar"
                                data-testid={`edit-payment-${payment.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onCancel(payment)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              {total} pagos en total
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-600 px-3">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
// EXPENSES TAB - Premium Design
// ══════════════════════════════════════════════════════════════════════════════
function ExpensesTab({ expenses, loading, total, page, totalPages, onPageChange, onCreateNew, onEdit, onDelete, filterCategory, setFilterCategory }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Categoría:</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
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
          className="px-5 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors flex items-center gap-2"
          data-testid="create-expense-btn"
        >
          <Plus className="w-4 h-4" />
          Registrar Egreso
        </button>
      </div>
      
      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Descripción</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Proveedor</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Base</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">IGV</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <CreditCard className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">No hay egresos registrados</p>
                    <p className="text-sm text-slate-400 mt-1">Comienza registrando tu primer egreso</p>
                  </td>
                </tr>
              ) : (
                expenses.map(expense => (
                  <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`expense-row-${expense.id}`}>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-500">{expense.expense_date}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-800">{expense.title}</p>
                      {expense.description && (
                        <p className="text-xs text-slate-400 truncate max-w-[200px]">{expense.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                        {expense.category_label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{expense.provider_name || "-"}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm text-slate-600">S/ {formatNumber(expense.amount_base)}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm text-slate-400">
                        {expense.igv_applicable ? `S/ ${formatNumber(expense.igv_amount)}` : "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-semibold text-red-500">S/ {formatNumber(expense.total_amount)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onEdit(expense)}
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Editar"
                          data-testid={`edit-expense-${expense.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(expense)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              {total} egresos en total
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-600 px-3">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
// PAYMENT FORM MODAL - Premium Design
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
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              {payment?.id ? "Editar Pago" : "Registrar Pago"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Student selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-3">Estudiante</label>
            <div className="grid grid-cols-3 gap-3">
              <select
                value={formData.grade_id}
                onChange={(e) => setFormData(prev => ({ ...prev, grade_id: e.target.value, section_id: "", student_id: "" }))}
                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
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
                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
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
                className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
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
              <label className="block text-sm font-medium text-slate-700 mb-2">Concepto</label>
              <select
                value={formData.concept}
                onChange={(e) => setFormData(prev => ({ ...prev, concept: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {Object.entries(CONCEPTS).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Método de pago</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {Object.entries(METHODS).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount and IGV */}
          <div className="bg-slate-50 rounded-2xl p-5 mb-6">
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Monto Base (S/.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount_base}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount_base: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.igv_applicable}
                    onChange={(e) => setFormData(prev => ({ ...prev, igv_applicable: e.target.checked }))}
                    className="w-5 h-5 rounded border-slate-300 text-slate-800 focus:ring-slate-300"
                  />
                  <span className="text-sm text-slate-600">Incluye IGV (18%)</span>
                </label>
              </div>
            </div>
            
            <div className="border-t border-slate-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-700">S/ {formatNumber(amountBase)}</span>
              </div>
              {formData.igv_applicable && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">IGV (18%)</span>
                  <span className="font-medium text-slate-700">S/ {formatNumber(igvAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Total</span>
                <span className="font-bold text-emerald-600">S/ {formatNumber(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Status and date */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Estado</label>
              <select
                value={formData.payment_status}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_status: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="pending">Pendiente</option>
                <option value="paid">Pagado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Fecha</label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Notas (opcional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Observaciones adicionales..."
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
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
// EXPENSE FORM MODAL - Premium Design
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
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              {expense?.id ? "Editar Egreso" : "Registrar Egreso"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Title */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">Descripción del gasto</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ej: Pago de luz - Enero 2026"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          {/* Category and provider */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Categoría</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {Object.entries(EXPENSE_CATEGORIES).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Proveedor</label>
              <input
                type="text"
                value={formData.provider_name}
                onChange={(e) => setFormData(prev => ({ ...prev, provider_name: e.target.value }))}
                placeholder="Nombre del proveedor"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>

          {/* Amount and IGV */}
          <div className="bg-slate-50 rounded-2xl p-5 mb-5">
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Monto Base (S/.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount_base}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount_base: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.igv_applicable}
                    onChange={(e) => setFormData(prev => ({ ...prev, igv_applicable: e.target.checked }))}
                    className="w-5 h-5 rounded border-slate-300 text-slate-800 focus:ring-slate-300"
                  />
                  <span className="text-sm text-slate-600">Incluye IGV (18%)</span>
                </label>
              </div>
            </div>
            
            <div className="border-t border-slate-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-700">S/ {formatNumber(amountBase)}</span>
              </div>
              {formData.igv_applicable && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">IGV (18%)</span>
                  <span className="font-medium text-slate-700">S/ {formatNumber(igvAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Total</span>
                <span className="font-bold text-red-500">S/ {formatNumber(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Date and method */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Fecha</label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData(prev => ({ ...prev, expense_date: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Método de pago</label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {Object.entries(METHODS).map(([key, val]) => (
                  <option key={key} value={key}>{val}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Notas (opcional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Observaciones adicionales..."
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
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
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function AccountingPage({ user, token, subdomain, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  
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

  const handleConfirmPayment = async (payment) => {
    if (!window.confirm(`¿Confirmar pago de S/ ${formatNumber(payment.total_amount)}?`)) return;
    try {
      await axios.put(`${API}/accounting/payments/${payment.id}/confirm`, {}, { headers });
      loadPayments();
      loadSummary();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al confirmar pago");
    }
  };

  const handleCancelPayment = async (payment) => {
    if (!window.confirm(`¿Anular este pago?`)) return;
    try {
      await axios.put(`${API}/accounting/payments/${payment.id}/cancel`, {}, { headers });
      loadPayments();
      loadSummary();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al anular pago");
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

  const handleDeleteExpense = async (expense) => {
    if (!window.confirm(`¿Eliminar este egreso?`)) return;
    try {
      await axios.delete(`${API}/accounting/expenses/${expense.id}`, { headers });
      loadExpenses();
      loadSummary();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="accounting-page">
      <Sidebar 
        user={user} 
        settings={settings} 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        subdomain={subdomain}
        onLogout={onLogout}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 rounded-xl">
              <Wallet className="w-5 h-5 text-slate-600" />
            </button>
            {settings?.logo_url && (
              <img src={settings.logo_url} alt="Logo" className="h-9 w-auto object-contain" />
            )}
            <div>
              <h1 className="text-lg font-semibold text-slate-800">{settings?.system_name || "Instituto"}</h1>
              <p className="text-xs text-slate-400">Gestión Financiera</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-700">{user?.name} {user?.last_name}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
            {user?.photo_url ? (
              <img src={user.photo_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-white text-sm font-medium">
                {user?.name?.charAt(0) || "U"}
              </div>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          {/* Page header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Contabilidad</h1>
            </div>
            <p className="text-slate-500 ml-[52px]">Control de ingresos y egresos del colegio</p>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-2xl border border-slate-100 p-1.5 mb-8 inline-flex">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "dashboard"
                  ? "bg-slate-800 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              data-testid="tab-dashboard"
            >
              Resumen
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "payments"
                  ? "bg-slate-800 text-white"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              data-testid="tab-payments"
            >
              Ingresos
            </button>
            <button
              onClick={() => setActiveTab("expenses")}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === "expenses"
                  ? "bg-slate-800 text-white"
                  : "text-slate-500 hover:text-slate-700"
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
              onConfirm={handleConfirmPayment}
              onCancel={handleCancelPayment}
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
              onDelete={handleDeleteExpense}
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
    </div>
  );
}
