import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Plus, Edit2, Trash2, X, Check, Loader2, Tag, ToggleLeft, ToggleRight,
  CircleDollarSign, RefreshCw, FileText, ShieldCheck
} from "lucide-react";
import { ConfirmModal } from "./ui/ConfirmModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatNumber = (n) =>
  Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CONCEPT_TYPES = { recurrente: "Recurrente", unico: "Único" };

export default function PaymentConceptsSection({ token, user, onConceptsChange }) {
  const headers = { Authorization: `Bearer ${token}` };
  const isOwnerOrAdmin = user?.is_owner || ["owner", "director", "admin"].includes(user?.role);
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: "", amount: "", concept_type: "único", status: "active" });

  const loadConcepts = async () => {
    try {
      const res = await axios.get(`${API}/accounting/payment-concepts?include_inactive=true`, { headers });
      setConcepts(res.data.concepts || []);
      if (onConceptsChange) onConceptsChange(res.data.concepts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConcepts(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", amount: "", concept_type: "único", status: "active" });
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, amount: c.amount.toString(), concept_type: c.concept_type, status: c.status });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("El nombre es requerido"); return; }
    if (!form.amount || parseFloat(form.amount) < 0) { toast.error("El monto debe ser valido"); return; }
    setSaving(true);
    try {
      const payload = { ...form, amount: parseFloat(form.amount) };
      if (editing) {
        await axios.put(`${API}/accounting/payment-concepts/${editing.id}`, payload, { headers });
        toast.success("Concepto actualizado");
      } else {
        await axios.post(`${API}/accounting/payment-concepts`, payload, { headers });
        toast.success("Concepto creado");
      }
      setShowForm(false);
      loadConcepts();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (c) => {
    const newStatus = c.status === "active" ? "inactive" : "active";
    try {
      await axios.put(`${API}/accounting/payment-concepts/${c.id}`, { status: newStatus }, { headers });
      toast.success(newStatus === "active" ? "Concepto activado" : "Concepto desactivado");
      loadConcepts();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/accounting/payment-concepts/${deleteTarget.id}`, { headers });
      toast.success("Concepto eliminado");
      setDeleteTarget(null);
      loadConcepts();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="payment-concepts-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <Tag className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Conceptos de Pago</h3>
            <p className="text-xs text-slate-500">Define los conceptos de cobro y sus montos base</p>
          </div>
        </div>
        {isOwnerOrAdmin && (
          <button
            onClick={openNew}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
            data-testid="add-concept-btn"
          >
            <Plus className="w-4 h-4" />
            Nuevo Concepto
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Concepto</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Monto Base</th>
              <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
              <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
              {isOwnerOrAdmin && (
                <th className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {concepts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center">
                  <Tag className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No hay conceptos configurados</p>
                </td>
              </tr>
            ) : (
              concepts.map(c => (
                <tr key={c.id} className={`hover:bg-slate-50/50 transition-colors ${c.status === "inactive" ? "opacity-50" : ""} ${c.is_default ? "bg-blue-50/40" : ""}`} data-testid={`concept-row-${c.id}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-sm font-semibold ${c.is_default ? "text-blue-800" : "text-slate-800"}`}>{c.name}</span>
                      {c.is_default && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Principal
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-sm font-bold text-emerald-700">S/ {formatNumber(c.amount)}</span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      c.concept_type === "recurrente" ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-600"
                    }`}>
                      {c.concept_type === "recurrente" ? <RefreshCw className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      {CONCEPT_TYPES[c.concept_type] || c.concept_type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {isOwnerOrAdmin ? (
                      <button
                        onClick={() => handleToggleStatus(c)}
                        className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${
                          c.status === "active" ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                        data-testid={`toggle-status-${c.id}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${
                          c.status === "active" ? "translate-x-5" : "translate-x-0"
                        }`} />
                      </button>
                    ) : (
                      <span className={`text-xs font-semibold ${c.status === "active" ? "text-emerald-600" : "text-slate-400"}`}>
                        {c.status === "active" ? "Activo" : "Inactivo"}
                      </span>
                    )}
                  </td>
                  {isOwnerOrAdmin && (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                          data-testid={`edit-concept-${c.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {!c.is_default && (
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Eliminar"
                            data-testid={`delete-concept-${c.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" data-testid="concept-form-modal">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Tag className="w-5 h-5 text-white" />
                <h3 className="text-base font-bold text-white">
                  {editing ? "Editar Concepto" : "Nuevo Concepto"}
                </h3>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Nombre del Concepto</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Taller de Robotica"
                  disabled={editing?.is_default}
                  className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${editing?.is_default ? "opacity-60 cursor-not-allowed" : ""}`}
                  data-testid="concept-name-input"
                />
                {editing?.is_default && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> El nombre de conceptos principales no se puede modificar
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Monto Base (S/.)</label>
                <div className="relative">
                  <CircleDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    data-testid="concept-amount-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Tipo</label>
                  <select
                    value={form.concept_type}
                    onChange={(e) => setForm(prev => ({ ...prev, concept_type: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    data-testid="concept-type-select"
                  >
                    <option value="unico">Único</option>
                    <option value="recurrente">Recurrente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Estado</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    data-testid="concept-status-select"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                data-testid="save-concept-btn"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editing ? "Actualizar" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar Concepto"
        message={`¿Eliminar "${deleteTarget?.name}"? Los ingresos históricos no se veran afectados.`}
        confirmText="Eliminar"
        variant="danger"
        icon="delete"
      />
    </div>
  );
}
