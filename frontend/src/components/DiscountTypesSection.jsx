import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Tag, Plus, Edit2, Trash2, Zap, Hand, ToggleLeft, ToggleRight, X, Loader2, Settings, AlertCircle, Users } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AUTOMATIC_RULES = [
  { value: "has_active_siblings", label: "Tiene hermanos activos", description: "Se aplica cuando el alumno tiene al menos un hermano con estado activo/matriculado en el mismo año escolar." }
];

function DiscountTypeModal({ isOpen, onClose, onSave, editingType }) {
  const [form, setForm] = useState({
    name: "", description: "", discount_type: "percentage", value: "",
    application_mode: "manual", automatic_rule: "", is_active: true
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editingType) {
      setForm({
        name: editingType.name || "",
        description: editingType.description || "",
        discount_type: editingType.discount_type || "percentage",
        value: editingType.value?.toString() || "",
        application_mode: editingType.application_mode || "manual",
        automatic_rule: editingType.automatic_rule || "",
        is_active: editingType.is_active !== false,
      });
    } else {
      setForm({ name: "", description: "", discount_type: "percentage", value: "", application_mode: "manual", automatic_rule: "", is_active: true });
    }
    setError("");
  }, [editingType, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("El nombre es requerido"); return; }
    if (!form.value || parseFloat(form.value) <= 0) { setError("El valor debe ser mayor a 0"); return; }
    if (form.discount_type === "percentage" && parseFloat(form.value) > 100) { setError("El porcentaje no puede ser mayor a 100"); return; }
    if (form.application_mode === "automatic" && !form.automatic_rule) { setError("Selecciona una regla automatica"); return; }

    setSaving(true);
    try {
      await onSave({
        ...form,
        value: parseFloat(form.value),
        automatic_rule: form.application_mode === "automatic" ? form.automatic_rule : null,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" data-testid="discount-type-modal">
        <div className="bg-gradient-to-r from-[#001f4b] to-[#0a3068] px-6 py-5 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">
              {editingType ? "Editar Descuento" : "Nuevo Tipo de Descuento"}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre del descuento *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
              placeholder="Ej: Descuento por hermanos"
              maxLength={100}
              data-testid="discount-name-input"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descripcion (opcional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 resize-none"
              rows={2}
              placeholder="Descripcion opcional para el administrador"
              data-testid="discount-description-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tipo de descuento</label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm(p => ({ ...p, discount_type: e.target.value }))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
                data-testid="discount-type-select"
              >
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed_amount">Monto fijo (S/)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Valor *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {form.discount_type === "percentage" ? "%" : "S/"}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={form.discount_type === "percentage" ? "100" : undefined}
                  value={form.value}
                  onChange={(e) => setForm(p => ({ ...p, value: e.target.value }))}
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
                  placeholder={form.discount_type === "percentage" ? "10" : "50.00"}
                  data-testid="discount-value-input"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Modo de aplicacion</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "manual", label: "Manual", icon: Hand, desc: "Asignado por el admin" },
                { value: "automatic", label: "Automatico", icon: Zap, desc: "Calculado por el sistema" },
              ].map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    form.application_mode === opt.value
                      ? opt.value === "automatic" ? "border-blue-300 bg-blue-50" : "border-slate-300 bg-slate-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  data-testid={`mode-${opt.value}`}
                >
                  <input type="radio" name="mode" value={opt.value} checked={form.application_mode === opt.value}
                    onChange={() => setForm(p => ({ ...p, application_mode: opt.value, automatic_rule: opt.value === "manual" ? "" : p.automatic_rule }))}
                    className="mt-0.5 w-4 h-4 text-blue-600" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <opt.icon className="w-3.5 h-3.5 text-slate-500" />
                      <p className="text-sm font-bold text-slate-700">{opt.label}</p>
                    </div>
                    <p className="text-xs text-slate-400">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {form.application_mode === "automatic" && (
            <div className="animate-in fade-in">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Regla automatica</label>
              <select
                value={form.automatic_rule}
                onChange={(e) => setForm(p => ({ ...p, automatic_rule: e.target.value }))}
                className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
                data-testid="automatic-rule-select"
              >
                <option value="">Seleccionar regla...</option>
                {AUTOMATIC_RULES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {form.automatic_rule && (
                <p className="text-xs text-blue-600 mt-1.5 bg-blue-50 p-2 rounded-lg border border-blue-100">
                  {AUTOMATIC_RULES.find(r => r.value === form.automatic_rule)?.description}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 cursor-pointer" data-testid="discount-active-toggle">
              <span className="text-sm font-semibold text-slate-700">Estado:</span>
              <button type="button" onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                className={`relative w-12 h-7 rounded-full transition-colors ${form.is_active ? "bg-emerald-500" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${form.is_active ? "translate-x-5" : ""}`} />
              </button>
              <span className={`text-sm font-medium ${form.is_active ? "text-emerald-600" : "text-slate-400"}`}>
                {form.is_active ? "Activo" : "Inactivo"}
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-3 bg-[#001f4b] text-white rounded-xl font-semibold text-sm hover:bg-[#0a3068] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="save-discount-type-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingType ? "Actualizar" : "Crear Descuento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DiscountTypesSection({ token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const loadTypes = async () => {
    try {
      const res = await axios.get(`${API}/accounting/discount-types`, { headers });
      setTypes(res.data);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { loadTypes(); }, []);

  const handleSave = async (data) => {
    if (editing) {
      await axios.put(`${API}/accounting/discount-types/${editing.id}`, data, { headers });
      toast.success("Tipo de descuento actualizado");
    } else {
      await axios.post(`${API}/accounting/discount-types`, data, { headers });
      toast.success("Tipo de descuento creado");
    }
    loadTypes();
  };

  const handleDelete = async (dt) => {
    if (!window.confirm(`Eliminar el descuento "${dt.name}"?`)) return;
    try {
      await axios.delete(`${API}/accounting/discount-types/${dt.id}`, { headers });
      toast.success("Descuento eliminado");
      loadTypes();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/accounting/discounts/sync`, {}, { headers });
      toast.success(`Sincronizacion completada: ${res.data.assigned} asignados, ${res.data.removed} removidos`);
      loadTypes();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al sincronizar");
    } finally { setSyncing(false); }
  };

  const hasAutomatic = types.some(t => t.application_mode === "automatic");

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm" data-testid="discount-types-section">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Tag className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-700">Tipos de Descuento</h3>
          <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">{types.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasAutomatic && (
            <button onClick={handleSync} disabled={syncing}
              className="px-3 py-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              data-testid="sync-discounts-btn">
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Sincronizar
            </button>
          )}
          <button onClick={() => { setEditing(null); setShowModal(true); }}
            className="px-3 py-2 text-xs font-semibold text-white bg-[#001f4b] rounded-lg hover:bg-[#0a3068] transition-colors flex items-center gap-1.5"
            data-testid="add-discount-type-btn">
            <Plus className="w-3.5 h-3.5" /> Agregar descuento
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : types.length === 0 ? (
          <div className="text-center py-8">
            <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No hay tipos de descuento configurados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {types.map(dt => (
              <div key={dt.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                dt.is_active ? "border-slate-200 bg-white hover:border-slate-300" : "border-slate-100 bg-slate-50 opacity-60"
              }`} data-testid={`discount-type-${dt.id}`}>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    dt.application_mode === "automatic" ? "bg-blue-100" : "bg-slate-100"
                  }`}>
                    {dt.application_mode === "automatic"
                      ? <Zap className="w-5 h-5 text-blue-600" />
                      : <Hand className="w-5 h-5 text-slate-500" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-800 truncate">{dt.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        dt.application_mode === "automatic"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-200 text-slate-600"
                      }`}>
                        {dt.application_mode === "automatic" ? "Automatico" : "Manual"}
                      </span>
                      {!dt.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600">Inactivo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-semibold text-slate-500">
                        {dt.discount_type === "percentage" ? `${dt.value}%` : `S/ ${dt.value.toFixed(2)}`}
                      </span>
                      {dt.description && <span className="text-xs text-slate-400 truncate max-w-[200px]">{dt.description}</span>}
                      {dt.assigned_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Users className="w-3 h-3" /> {dt.assigned_count} alumno{dt.assigned_count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <button onClick={() => { setEditing(dt); setShowModal(true); }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    data-testid={`edit-discount-${dt.id}`}>
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(dt)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    data-testid={`delete-discount-${dt.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DiscountTypeModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onSave={handleSave}
        editingType={editing}
      />
    </div>
  );
}
