import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AdminSidebar from "@/components/AdminSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import ConfirmModal from "@/components/ConfirmModal";
import {
  Calendar, Layers, GraduationCap, Users2, Clock, BookOpen,
  Plus, Pencil, Trash2, Loader2, AlertCircle, Check, X,
  ChevronRight, ToggleLeft, ToggleRight, ArrowLeft
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Tab Button Component
function TabButton({ active, icon: Icon, label, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
        active 
          ? 'bg-purple-100 text-purple-700 shadow-sm' 
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className={`w-5 h-5 ${active ? 'text-purple-600' : 'text-slate-400'}`} />
      <span>{label}</span>
      {count !== undefined && (
        <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${
          active ? 'bg-purple-200 text-purple-700' : 'bg-slate-200 text-slate-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// Generic Item Row for simple CRUD items
function ItemRow({ item, onEdit, onDelete, onToggle, showToggle = true, extraInfo }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 rounded-lg transition-colors group">
      <div className="flex items-center gap-3">
        {showToggle && (
          <button
            onClick={() => onToggle(item)}
            className={`p-1 rounded-lg transition-colors ${
              item.activo ? 'text-emerald-600 hover:bg-emerald-100' : 'text-slate-400 hover:bg-slate-100'
            }`}
            title={item.activo ? 'Activo - Click para desactivar' : 'Inactivo - Click para activar'}
          >
            {item.activo ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
          </button>
        )}
        <div>
          <p className="font-medium text-slate-800">{item.nombre}</p>
          {extraInfo && <p className="text-xs text-slate-500">{extraInfo}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(item)}
          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(item)}
          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Simple Modal for Add/Edit
function SimpleModal({ isOpen, onClose, title, onSave, loading, children }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// Periods Modal - Full CRUD for periods within a year
function PeriodsModal({ isOpen, onClose, year, periods, loading, headers, onRefresh, allYears }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [formData, setFormData] = useState({ nombre: "", fecha_inicio: "", fecha_fin: "", orden: 1, activo: true });
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [periodToDelete, setPeriodToDelete] = useState(null);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneFromYear, setCloneFromYear] = useState("");
  const [cloning, setCloning] = useState(false);
  
  if (!isOpen || !year) return null;
  
  const yearsWithPeriods = allYears.filter(y => y.period_count > 0 && y.id !== year.id);
  
  const handleSavePeriod = async () => {
    if (!formData.nombre.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...formData,
        academic_year_id: year.id
      };
      
      if (editingPeriod) {
        await axios.put(`${API}/academic/periods/${editingPeriod.id}`, payload, { headers });
      } else {
        await axios.post(`${API}/academic/periods`, payload, { headers });
      }
      onRefresh();
      setShowAddModal(false);
      setEditingPeriod(null);
      setFormData({ nombre: "", fecha_inicio: "", fecha_fin: "", orden: periods.length + 1, activo: true });
    } catch (err) {
      alert(err.response?.data?.detail || "Error al guardar período");
    } finally {
      setSaving(false);
    }
  };
  
  const handleDeletePeriod = async () => {
    if (!periodToDelete) return;
    try {
      await axios.delete(`${API}/academic/periods/${periodToDelete.id}`, { headers });
      onRefresh();
      setShowDeleteModal(false);
      setPeriodToDelete(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar período");
    }
  };
  
  const handleClonePeriods = async () => {
    if (!cloneFromYear) return;
    setCloning(true);
    try {
      await axios.post(`${API}/academic/periods/clone`, {
        source_year_id: cloneFromYear,
        target_year_id: year.id
      }, { headers });
      onRefresh();
      setShowCloneModal(false);
      setCloneFromYear("");
    } catch (err) {
      alert(err.response?.data?.detail || "Error al clonar períodos");
    } finally {
      setCloning(false);
    }
  };
  
  const handleEditPeriod = (period) => {
    setEditingPeriod(period);
    setFormData({
      nombre: period.nombre,
      fecha_inicio: period.fecha_inicio || "",
      fecha_fin: period.fecha_fin || "",
      orden: period.orden || 1,
      activo: period.activo !== false
    });
    setShowAddModal(true);
  };
  
  const handleTogglePeriod = async (period) => {
    try {
      await axios.put(`${API}/academic/periods/${period.id}`, {
        ...period,
        activo: !period.activo
      }, { headers });
      onRefresh();
    } catch (err) {
      console.error("Error toggling period:", err);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Períodos del Año {year.year}</h3>
            <p className="text-sm text-slate-500">{periods.length} período(s) configurado(s)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : periods.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 mb-4">No hay períodos configurados para este año</p>
              {yearsWithPeriods.length > 0 && (
                <button
                  onClick={() => setShowCloneModal(true)}
                  className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                >
                  Clonar de otro año →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {periods.sort((a, b) => a.orden - b.orden).map((period) => (
                <div 
                  key={period.id} 
                  className="flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleTogglePeriod(period)}
                      className={`p-1 rounded-lg transition-colors ${
                        period.activo ? 'text-emerald-600 hover:bg-emerald-100' : 'text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {period.activo ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                    </button>
                    <div>
                      <p className="font-medium text-slate-800">{period.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {period.fecha_inicio && period.fecha_fin 
                          ? `${period.fecha_inicio} - ${period.fecha_fin}` 
                          : "Fechas no configuradas"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-slate-400 mr-2">Orden: {period.orden}</span>
                    <button
                      onClick={() => handleEditPeriod(period)}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setPeriodToDelete(period); setShowDeleteModal(true); }}
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex justify-between gap-3 px-6 py-4 border-t border-slate-200">
          {yearsWithPeriods.length > 0 && periods.length === 0 && (
            <button
              onClick={() => setShowCloneModal(true)}
              className="px-4 py-2 text-purple-600 font-medium hover:bg-purple-50 rounded-xl flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Clonar períodos
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => { 
              setEditingPeriod(null); 
              setFormData({ nombre: "", fecha_inicio: "", fecha_fin: "", orden: periods.length + 1, activo: true }); 
              setShowAddModal(true); 
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Agregar período
          </button>
        </div>
      </div>
      
      {/* Add/Edit Period Sub-Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                {editingPeriod ? "Editar Período" : "Nuevo Período"}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  placeholder="Ej: Bimestre I, Trimestre 1..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha inicio</label>
                  <input
                    type="date"
                    value={formData.fecha_inicio}
                    onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha fin</label>
                  <input
                    type="date"
                    value={formData.fecha_fin}
                    onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Orden</label>
                <input
                  type="number"
                  value={formData.orden}
                  onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  min={1}
                  max={10}
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-slate-700">Activo</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePeriod}
                disabled={saving || !formData.nombre.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-medium rounded-xl flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Clone Periods Sub-Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowCloneModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Clonar Períodos</h3>
              <button onClick={() => setShowCloneModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Selecciona el año del cual deseas copiar la estructura de períodos al año <strong>{year.year}</strong>.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Clonar desde</label>
                <select
                  value={cloneFromYear}
                  onChange={(e) => setCloneFromYear(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                >
                  <option value="">Seleccionar año</option>
                  {yearsWithPeriods.map(y => (
                    <option key={y.id} value={y.id}>
                      {y.year} ({y.period_count} período{y.period_count !== 1 ? "s" : ""})
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700">
                  Se copiarán los nombres y orden de los períodos. Las fechas se ajustarán automáticamente al nuevo año.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setShowCloneModal(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleClonePeriods}
                disabled={cloning || !cloneFromYear}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-medium rounded-xl flex items-center gap-2"
              >
                {cloning ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                Clonar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setPeriodToDelete(null); }}
        onConfirm={handleDeletePeriod}
        title="Eliminar Período"
        message={`¿Eliminar el período "${periodToDelete?.nombre}"?`}
        confirmText="Eliminar"
        confirmVariant="danger"
      />
    </div>
  );
}

// Academic Years Tab Content
function AcademicYearsTab({ token, headers }) {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ year: new Date().getFullYear() + 1, status: "futuro", clone_from_year: null });
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showPeriodsModal, setShowPeriodsModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get(`${API}/academic/years`, { headers });
      setYears(res.data || []);
    } catch (err) {
      console.error("Error loading years:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPeriods = async (yearId) => {
    setLoadingPeriods(true);
    try {
      const res = await axios.get(`${API}/academic/periods?academic_year_id=${yearId}`, { headers });
      setPeriods(res.data || []);
    } catch (err) {
      console.error("Error loading periods:", err);
      setPeriods([]);
    } finally {
      setLoadingPeriods(false);
    }
  };

  const handleSave = async () => {
    if (!formData.year) return;
    setSaving(true);
    try {
      if (editingItem) {
        await axios.put(`${API}/academic/years/${editingItem.id}`, formData, { headers });
      } else {
        const payload = { ...formData };
        if (!payload.clone_from_year) delete payload.clone_from_year;
        await axios.post(`${API}/academic/years`, payload, { headers });
      }
      loadData();
      setShowModal(false);
      setEditingItem(null);
      setFormData({ year: new Date().getFullYear() + 1, status: "futuro", clone_from_year: null });
    } catch (err) {
      alert(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      year: item.year,
      status: item.status || "futuro",
      clone_from_year: null
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await axios.delete(`${API}/academic/years/${itemToDelete.id}`, { headers });
      loadData();
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar");
    }
  };

  const handleViewPeriods = (year) => {
    setSelectedYear(year);
    loadPeriods(year.id);
    setShowPeriodsModal(true);
  };

  const getStatusBadge = (status) => {
    const styles = {
      activo: "bg-emerald-100 text-emerald-700",
      cerrado: "bg-slate-100 text-slate-600",
      futuro: "bg-blue-100 text-blue-700"
    };
    const labels = {
      activo: "Activo",
      cerrado: "Cerrado",
      futuro: "Planificado"
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.futuro}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Get years that have periods for cloning
  const yearsWithPeriods = years.filter(y => y.period_count > 0);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{years.length} año(s) académico(s)</p>
        <button
          onClick={() => { setEditingItem(null); setFormData({ year: new Date().getFullYear() + 1, status: "futuro", clone_from_year: null }); setShowModal(true); }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {years.length === 0 ? (
          <p className="text-center py-8 text-slate-500">No hay años académicos</p>
        ) : (
          years.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 rounded-lg transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{item.year}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getStatusBadge(item.status)}
                    <button
                      onClick={() => handleViewPeriods(item)}
                      className="text-xs text-purple-600 hover:text-purple-800 hover:underline"
                    >
                      {item.period_count > 0 ? `${item.period_count} período(s)` : "Sin períodos"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleViewPeriods(item)}
                  className="p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  title="Ver/Gestionar períodos"
                >
                  <BookOpen className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleEdit(item)}
                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setItemToDelete(item); setShowDeleteModal(true); }}
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <SimpleModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? "Editar Año Académico" : "Nuevo Año Académico"}
        onSave={handleSave}
        loading={saving}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Año *</label>
            <input
              type="number"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              min={2020}
              max={2050}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              <option value="futuro">Planificado</option>
              <option value="activo">Activo</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>
          {!editingItem && yearsWithPeriods.length > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <label className="block text-sm font-medium text-purple-800 mb-2">
                <BookOpen className="w-4 h-4 inline mr-1" />
                Clonar períodos de otro año (opcional)
              </label>
              <select
                value={formData.clone_from_year || ""}
                onChange={(e) => setFormData({ ...formData, clone_from_year: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
              >
                <option value="">No clonar - crear vacío</option>
                {yearsWithPeriods.map(y => (
                  <option key={y.id} value={y.year}>
                    {y.year} ({y.period_count} período{y.period_count !== 1 ? "s" : ""})
                  </option>
                ))}
              </select>
              <p className="text-xs text-purple-600 mt-2">
                Se copiarán los nombres y orden de los períodos. Las fechas deberán ajustarse manualmente.
              </p>
            </div>
          )}
        </div>
      </SimpleModal>

      {/* Periods Modal */}
      <PeriodsModal
        isOpen={showPeriodsModal}
        onClose={() => { setShowPeriodsModal(false); setSelectedYear(null); setPeriods([]); }}
        year={selectedYear}
        periods={periods}
        loading={loadingPeriods}
        headers={headers}
        onRefresh={() => { loadPeriods(selectedYear?.id); loadData(); }}
        allYears={years}
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setItemToDelete(null); }}
        onConfirm={handleDelete}
        title="Eliminar Año Académico"
        message={`¿Eliminar el año "${itemToDelete?.year}"?`}
        confirmText="Eliminar"
        confirmVariant="danger"
      />
    </div>
  );
}

// Levels Tab Content
function LevelsTab({ token, headers }) {
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ nombre: "", descripcion: "", orden: 0, activo: true });
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get(`${API}/academic/levels`, { headers });
      setLevels(res.data || []);
    } catch (err) {
      console.error("Error loading levels:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) return;
    setSaving(true);
    try {
      if (editingItem) {
        await axios.put(`${API}/academic/levels/${editingItem.id}`, formData, { headers });
      } else {
        await axios.post(`${API}/academic/levels`, formData, { headers });
      }
      loadData();
      setShowModal(false);
      setEditingItem(null);
      setFormData({ nombre: "", descripcion: "", orden: 0, activo: true });
    } catch (err) {
      alert(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ nombre: item.nombre, descripcion: item.descripcion || "", orden: item.orden || 0, activo: item.activo });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await axios.delete(`${API}/academic/levels/${itemToDelete.id}`, { headers });
      loadData();
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar");
    }
  };

  const handleToggle = async (item) => {
    try {
      await axios.put(`${API}/academic/levels/${item.id}`, { ...item, activo: !item.activo }, { headers });
      loadData();
    } catch (err) {
      console.error("Error toggling:", err);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{levels.length} nivel(es)</p>
        <button
          onClick={() => { setEditingItem(null); setFormData({ nombre: "", descripcion: "", orden: levels.length, activo: true }); setShowModal(true); }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {levels.length === 0 ? (
          <p className="text-center py-8 text-slate-500">No hay niveles educativos</p>
        ) : (
          levels.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onDelete={(i) => { setItemToDelete(i); setShowDeleteModal(true); }}
              onToggle={handleToggle}
              extraInfo={item.descripcion}
            />
          ))
        )}
      </div>

      <SimpleModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? "Editar Nivel" : "Nuevo Nivel"}
        onSave={handleSave}
        loading={saving}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              placeholder="Ej: Primaria"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
            <input
              type="text"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              placeholder="Descripción opcional"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-slate-700">Activo</span>
          </label>
        </div>
      </SimpleModal>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setItemToDelete(null); }}
        onConfirm={handleDelete}
        title="Eliminar Nivel"
        message={`¿Eliminar "${itemToDelete?.nombre}"?`}
        confirmText="Eliminar"
        confirmVariant="danger"
      />
    </div>
  );
}

// Grades Tab Content  
function GradesTab({ token, headers }) {
  const [grades, setGrades] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ nombre: "", nivel_id: "", orden: 0, activo: true });
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [gradesRes, levelsRes] = await Promise.all([
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/levels`, { headers })
      ]);
      setGrades(gradesRes.data || []);
      setLevels(levelsRes.data || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nombre.trim() || !formData.nivel_id) return;
    setSaving(true);
    try {
      if (editingItem) {
        await axios.put(`${API}/academic/grades/${editingItem.id}`, formData, { headers });
      } else {
        await axios.post(`${API}/academic/grades`, formData, { headers });
      }
      loadData();
      setShowModal(false);
      setEditingItem(null);
      setFormData({ nombre: "", nivel_id: "", orden: 0, activo: true });
    } catch (err) {
      alert(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ nombre: item.nombre, nivel_id: item.nivel_id, orden: item.orden || 0, activo: item.activo });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await axios.delete(`${API}/academic/grades/${itemToDelete.id}`, { headers });
      loadData();
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar");
    }
  };

  const handleToggle = async (item) => {
    try {
      await axios.put(`${API}/academic/grades/${item.id}`, { ...item, activo: !item.activo }, { headers });
      loadData();
    } catch (err) {
      console.error("Error toggling:", err);
    }
  };

  const getLevelName = (levelId) => levels.find(l => l.id === levelId)?.nombre || "Sin nivel";

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{grades.length} grado(s)</p>
        <button
          onClick={() => { setEditingItem(null); setFormData({ nombre: "", nivel_id: levels[0]?.id || "", orden: grades.length, activo: true }); setShowModal(true); }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {grades.length === 0 ? (
          <p className="text-center py-8 text-slate-500">No hay grados</p>
        ) : (
          grades.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onDelete={(i) => { setItemToDelete(i); setShowDeleteModal(true); }}
              onToggle={handleToggle}
              extraInfo={getLevelName(item.nivel_id)}
            />
          ))
        )}
      </div>

      <SimpleModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? "Editar Grado" : "Nuevo Grado"}
        onSave={handleSave}
        loading={saving}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nivel *</label>
            <select
              value={formData.nivel_id}
              onChange={(e) => setFormData({ ...formData, nivel_id: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              <option value="">Seleccionar nivel...</option>
              {levels.filter(l => l.activo).map(level => (
                <option key={level.id} value={level.id}>{level.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              placeholder="Ej: 1° Grado"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-slate-700">Activo</span>
          </label>
        </div>
      </SimpleModal>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setItemToDelete(null); }}
        onConfirm={handleDelete}
        title="Eliminar Grado"
        message={`¿Eliminar "${itemToDelete?.nombre}"?`}
        confirmText="Eliminar"
        confirmVariant="danger"
      />
    </div>
  );
}

// Sections Tab Content
function SectionsTab({ token, headers }) {
  const [sections, setSections] = useState([]);
  const [grades, setGrades] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ nombre: "", grado_id: "", capacidad: 30, activo: true });
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sectionsRes, gradesRes, levelsRes] = await Promise.all([
        axios.get(`${API}/academic/sections`, { headers }),
        axios.get(`${API}/academic/grades`, { headers }),
        axios.get(`${API}/academic/levels`, { headers })
      ]);
      setSections(sectionsRes.data || []);
      setGrades(gradesRes.data || []);
      setLevels(levelsRes.data || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nombre.trim() || !formData.grado_id) return;
    setSaving(true);
    try {
      if (editingItem) {
        await axios.put(`${API}/academic/sections/${editingItem.id}`, formData, { headers });
      } else {
        await axios.post(`${API}/academic/sections`, formData, { headers });
      }
      loadData();
      setShowModal(false);
      setEditingItem(null);
      setFormData({ nombre: "", grado_id: "", capacidad: 30, activo: true });
    } catch (err) {
      alert(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ nombre: item.nombre, grado_id: item.grado_id, capacidad: item.capacidad || 30, activo: item.activo });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await axios.delete(`${API}/academic/sections/${itemToDelete.id}`, { headers });
      loadData();
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar");
    }
  };

  const handleToggle = async (item) => {
    try {
      await axios.put(`${API}/academic/sections/${item.id}`, { ...item, activo: !item.activo }, { headers });
      loadData();
    } catch (err) {
      console.error("Error toggling:", err);
    }
  };

  const getGradeInfo = (gradeId) => {
    const grade = grades.find(g => g.id === gradeId);
    if (!grade) return "Sin grado";
    const level = levels.find(l => l.id === grade.nivel_id);
    return `${grade.nombre} - ${level?.nombre || ""}`;
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{sections.length} sección(es)</p>
        <button
          onClick={() => { setEditingItem(null); setFormData({ nombre: "", grado_id: grades[0]?.id || "", capacidad: 30, activo: true }); setShowModal(true); }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nueva
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {sections.length === 0 ? (
          <p className="text-center py-8 text-slate-500">No hay secciones</p>
        ) : (
          sections.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onDelete={(i) => { setItemToDelete(i); setShowDeleteModal(true); }}
              onToggle={handleToggle}
              extraInfo={`${getGradeInfo(item.grado_id)} • Cap: ${item.capacidad || 30}`}
            />
          ))
        )}
      </div>

      <SimpleModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? "Editar Sección" : "Nueva Sección"}
        onSave={handleSave}
        loading={saving}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Grado *</label>
            <select
              value={formData.grado_id}
              onChange={(e) => setFormData({ ...formData, grado_id: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              <option value="">Seleccionar grado...</option>
              {grades.filter(g => g.activo).map(grade => {
                const level = levels.find(l => l.id === grade.nivel_id);
                return (
                  <option key={grade.id} value={grade.id}>{grade.nombre} - {level?.nombre}</option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              placeholder="Ej: A, B, Única"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Capacidad</label>
            <input
              type="number"
              value={formData.capacidad}
              onChange={(e) => setFormData({ ...formData, capacidad: parseInt(e.target.value) || 30 })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              min={1}
              max={100}
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-slate-700">Activo</span>
          </label>
        </div>
      </SimpleModal>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setItemToDelete(null); }}
        onConfirm={handleDelete}
        title="Eliminar Sección"
        message={`¿Eliminar "${itemToDelete?.nombre}"?`}
        confirmText="Eliminar"
        confirmVariant="danger"
      />
    </div>
  );
}

// Shifts Tab Content
function ShiftsTab({ token, headers }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ nombre: "", hora_inicio: "08:00", hora_fin: "13:00", activo: true });
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get(`${API}/academic/shifts`, { headers });
      setShifts(res.data || []);
    } catch (err) {
      console.error("Error loading shifts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) return;
    setSaving(true);
    try {
      if (editingItem) {
        await axios.put(`${API}/academic/shifts/${editingItem.id}`, formData, { headers });
      } else {
        await axios.post(`${API}/academic/shifts`, formData, { headers });
      }
      loadData();
      setShowModal(false);
      setEditingItem(null);
      setFormData({ nombre: "", hora_inicio: "08:00", hora_fin: "13:00", activo: true });
    } catch (err) {
      alert(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ nombre: item.nombre, hora_inicio: item.hora_inicio || "08:00", hora_fin: item.hora_fin || "13:00", activo: item.activo });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await axios.delete(`${API}/academic/shifts/${itemToDelete.id}`, { headers });
      loadData();
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar");
    }
  };

  const handleToggle = async (item) => {
    try {
      await axios.put(`${API}/academic/shifts/${item.id}`, { ...item, activo: !item.activo }, { headers });
      loadData();
    } catch (err) {
      console.error("Error toggling:", err);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{shifts.length} turno(s)</p>
        <button
          onClick={() => { setEditingItem(null); setFormData({ nombre: "", hora_inicio: "08:00", hora_fin: "13:00", activo: true }); setShowModal(true); }}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {shifts.length === 0 ? (
          <p className="text-center py-8 text-slate-500">No hay turnos</p>
        ) : (
          shifts.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onDelete={(i) => { setItemToDelete(i); setShowDeleteModal(true); }}
              onToggle={handleToggle}
              extraInfo={`${item.hora_inicio || "08:00"} - ${item.hora_fin || "13:00"}`}
            />
          ))
        )}
      </div>

      <SimpleModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? "Editar Turno" : "Nuevo Turno"}
        onSave={handleSave}
        loading={saving}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              placeholder="Ej: Mañana, Tarde"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hora inicio</label>
              <input
                type="time"
                value={formData.hora_inicio}
                onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hora fin</label>
              <input
                type="time"
                value={formData.hora_fin}
                onChange={(e) => setFormData({ ...formData, hora_fin: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-slate-700">Activo</span>
          </label>
        </div>
      </SimpleModal>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setItemToDelete(null); }}
        onConfirm={handleDelete}
        title="Eliminar Turno"
        message={`¿Eliminar "${itemToDelete?.nombre}"?`}
        confirmText="Eliminar"
        confirmVariant="danger"
      />
    </div>
  );
}

// Main Component
export default function AdminAcademicStructurePage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState("years");
  const [counts, setCounts] = useState({ years: 0, levels: 0, grades: 0, sections: 0, shifts: 0 });

  const headers = { Authorization: `Bearer ${token}` };
  const subdomain = user?.subdomain;

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [yearsRes, levelsRes, gradesRes, sectionsRes, shiftsRes, settingsRes] = await Promise.all([
          axios.get(`${API}/academic/years`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/academic/levels`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/academic/grades`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/academic/sections`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/academic/shifts`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/settings`, { headers }).catch(() => ({ data: null }))
        ]);
        setCounts({
          years: yearsRes.data?.length || 0,
          levels: levelsRes.data?.length || 0,
          grades: gradesRes.data?.length || 0,
          sections: sectionsRes.data?.length || 0,
          shifts: shiftsRes.data?.length || 0
        });
        if (settingsRes.data) setSettings(settingsRes.data);
      } catch (err) {
        console.error("Error loading counts:", err);
      }
    };
    loadInitialData();
  }, [token]);

  const navigateTo = (path) => {
    if (subdomain) {
      navigate(`/${subdomain}${path}`);
    } else {
      navigate(path);
    }
  };

  const tabs = [
    { id: "years", label: "Años Académicos", icon: Calendar, count: counts.years },
    { id: "levels", label: "Niveles", icon: Layers, count: counts.levels },
    { id: "grades", label: "Grados", icon: GraduationCap, count: counts.grades },
    { id: "sections", label: "Secciones", icon: Users2, count: counts.sections },
    { id: "shifts", label: "Turnos", icon: Clock, count: counts.shifts },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="admin-academic-structure-page">
      <AdminSidebar
        active="estructura"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.school_name || "EduNet"}
        subdomain={subdomain}
        user={user}
      />

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.school_name}
          subdomain={subdomain}
        />

        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {/* Page Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigateTo('/admin')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Estructura Académica</h1>
              <p className="text-sm text-slate-500">Gestiona años, niveles, grados, secciones y turnos</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                {tabs.map((tab) => (
                  <TabButton
                    key={tab.id}
                    active={activeTab === tab.id}
                    icon={tab.icon}
                    label={tab.label}
                    count={tab.count}
                    onClick={() => setActiveTab(tab.id)}
                  />
                ))}
              </div>
            </div>

            <div className="lg:col-span-3">
              {activeTab === "years" && <AcademicYearsTab token={token} headers={headers} />}
              {activeTab === "levels" && <LevelsTab token={token} headers={headers} />}
              {activeTab === "grades" && <GradesTab token={token} headers={headers} />}
              {activeTab === "sections" && <SectionsTab token={token} headers={headers} />}
              {activeTab === "shifts" && <ShiftsTab token={token} headers={headers} />}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
