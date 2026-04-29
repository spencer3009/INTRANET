import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Users, Download, Upload, AlertTriangle, Loader2, X,
  FileSpreadsheet, CheckCircle2, Trash2, Check, Edit2,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function TeacherBulkImportPanel({ token, onImported }) {
  const headers = { Authorization: `Bearer ${token}` };

  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState("menu"); // menu | confirm | importing | result
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // Pending modal
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pending, setPending] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [pendingCount, setPendingCount] = useState(0);

  const loadPendingCount = async () => {
    try {
      const res = await axios.get(`${API}/teachers/pending`, { headers });
      setPendingCount((res.data || []).length);
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    loadPendingCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await axios.get(`${API}/teachers/template`, {
        headers, responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantilla_profesores.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Plantilla descargada");
    } catch {
      toast.error("Error al descargar plantilla");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      toast.error("Formato no soportado. Use .xlsx, .xls o .csv");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo excede 5MB");
      return;
    }
    setImportFile(file);
    setImportStep("confirm");
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportStep("importing");
    setImportProgress(10);
    const interval = setInterval(() => setImportProgress(p => Math.min(p + 8, 90)), 300);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const res = await axios.post(`${API}/teachers/import`, fd, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      clearInterval(interval);
      setImportProgress(100);
      setImportResult(res.data);
      setImportStep("result");
      loadPendingCount();
      if (onImported) onImported();
    } catch (err) {
      clearInterval(interval);
      toast.error(err.response?.data?.detail || "Error al importar");
      setImportStep("menu");
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadCredentials = async (batchId) => {
    try {
      const res = await axios.get(`${API}/teachers/import/${batchId}/credentials`, {
        headers, responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `credenciales_profesores_${batchId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Credenciales descargadas");
    } catch {
      toast.error("Error al descargar credenciales");
    }
  };

  const resetImport = () => {
    setImportStep("menu");
    setImportFile(null);
    setImportResult(null);
    setImportProgress(0);
  };

  const loadPending = async () => {
    setLoadingPending(true);
    try {
      const res = await axios.get(`${API}/teachers/pending`, { headers });
      setPending(res.data || []);
      setPendingCount((res.data || []).length);
    } catch {
      toast.error("Error al cargar pendientes");
    } finally {
      setLoadingPending(false);
    }
  };

  const handleEditStart = (row) => {
    setEditingId(row.id);
    setEditingData({
      name: row.name || "",
      last_name: row.last_name || "",
      dni: row.dni || "",
      email: row.email || "",
      phone: row.phone || "",
      gender: row.gender || "",
      address: row.address || "",
    });
  };

  const handleEditSave = async (id) => {
    try {
      const res = await axios.put(`${API}/teachers/pending/${id}`, editingData, { headers });
      const remainingErrors = res.data?.errors || [];
      if (remainingErrors.length === 0) {
        // Auto-activate now that it's valid
        try {
          const act = await axios.post(`${API}/teachers/pending/${id}/activate`, {}, { headers });
          toast.success(`Profesor creado. Usuario: ${act.data.username}`);
          setEditingId(null);
          loadPending();
          if (onImported) onImported();
        } catch (err) {
          toast.error(err.response?.data?.detail || "Error al activar");
        }
      } else {
        toast.success("Datos actualizados — aún hay errores por corregir");
        setEditingId(null);
        loadPending();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al actualizar");
    }
  };

  const handleRetry = async (id) => {
    try {
      const res = await axios.post(`${API}/teachers/pending/${id}/activate`, {}, { headers });
      toast.success(`Profesor creado. Usuario: ${res.data.username}`);
      loadPending();
      if (onImported) onImported();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al activar");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este registro pendiente?")) return;
    try {
      await axios.delete(`${API}/teachers/pending/${id}`, { headers });
      toast.success("Pendiente eliminado");
      loadPending();
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <>
      {/* ═══════ 3-button card ═══════ */}
      <div className="bg-white rounded-2xl border-2 border-emerald-200 p-6 mb-6 shadow-sm" data-testid="teacher-import-block">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <Users className="w-9 h-9 text-white" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-bold text-slate-800">Importación Masiva de Profesores</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Descarga la plantilla, completa los datos de los profesores y sube el archivo para crearlos automáticamente en el sistema.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
            <button
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
              data-testid="teacher-download-template-btn"
            >
              {downloadingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloadingTemplate ? "Generando..." : "Descargar Plantilla"}
            </button>
            <button
              onClick={() => { setShowImportModal(true); resetImport(); }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5"
              data-testid="teacher-import-btn"
            >
              <Upload className="w-4 h-4" /> Importar Archivo
            </button>
            <button
              onClick={() => { setShowPendingModal(true); loadPending(); }}
              className="relative flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-semibold transition-all hover:shadow-lg"
              data-testid="teacher-pending-btn"
            >
              <AlertTriangle className="w-4 h-4" /> Pendientes
              {pendingCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md"
                  data-testid="teacher-pending-badge"
                >
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════ IMPORT MODAL ═══════ */}
      {showImportModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!importing) { setShowImportModal(false); resetImport(); } }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" data-testid="teacher-import-modal">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Importar Profesores</h3>
              {!importing && (
                <button onClick={() => { setShowImportModal(false); resetImport(); }} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-6">
              {importStep === "menu" && (
                <div>
                  <div
                    className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${dragOver ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-emerald-300"}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
                    data-testid="teacher-import-dropzone"
                  >
                    <Upload className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-700">Arrastra tu archivo aquí</p>
                    <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar</p>
                    <p className="text-[10px] text-slate-400 mt-2">.xlsx, .xls, .csv (max 5MB)</p>
                    <input
                      type="file" accept=".xlsx,.xls,.csv" className="hidden" id="teacher-file-input"
                      onChange={(e) => handleFileSelect(e.target.files[0])}
                    />
                    <button
                      onClick={() => document.getElementById("teacher-file-input").click()}
                      className="mt-4 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors"
                      data-testid="teacher-select-file-btn"
                    >
                      Seleccionar archivo
                    </button>
                  </div>
                  <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-xs text-emerald-700">Usuario y contraseña se generan automáticamente a partir del DNI. Se crea un QR para cada profesor.</p>
                  </div>
                </div>
              )}

              {importStep === "confirm" && importFile && (
                <div>
                  <div className="bg-slate-50 rounded-xl p-5 mb-5">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{importFile.name}</p>
                        <p className="text-xs text-slate-400">{(importFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-5">¿Deseas proceder con la importación de profesores?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setImportFile(null); setImportStep("menu"); }}
                      className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleImport}
                      className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
                      data-testid="teacher-confirm-import-btn"
                    >
                      Confirmar Importación
                    </button>
                  </div>
                </div>
              )}

              {importStep === "importing" && (
                <div className="text-center py-6">
                  <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto mb-4" />
                  <p className="font-semibold text-slate-800">Procesando profesores... {importProgress}%</p>
                  <div className="w-full bg-slate-200 rounded-full h-3 mt-4">
                    <div className="bg-emerald-600 h-3 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-3">No cierres esta página</p>
                </div>
              )}

              {importStep === "result" && importResult && (
                <div>
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-600" data-testid="teacher-result-created">{importResult.summary.created}</p>
                      <p className="text-xs text-emerald-600 font-medium">Creados</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600" data-testid="teacher-result-updated">{importResult.summary.updated}</p>
                      <p className="text-xs text-blue-600 font-medium">Actualizados</p>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-rose-600" data-testid="teacher-result-errors">{importResult.summary.errors}</p>
                      <p className="text-xs text-rose-600 font-medium">Con errores</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-slate-600">{(importResult.summary.processing_time_ms / 1000).toFixed(1)}s</p>
                      <p className="text-xs text-slate-500 font-medium">Tiempo</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {importResult.credentials_available && (
                      <button
                        onClick={() => handleDownloadCredentials(importResult.batch_id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
                        data-testid="teacher-download-credentials-btn"
                      >
                        <Download className="w-4 h-4" /> Descargar Credenciales
                      </button>
                    )}
                    {importResult.summary.errors > 0 && (
                      <button
                        onClick={() => { setShowImportModal(false); resetImport(); setShowPendingModal(true); loadPending(); }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors"
                        data-testid="teacher-view-pending-btn"
                      >
                        <AlertTriangle className="w-4 h-4" /> Ver Pendientes ({importResult.summary.errors})
                      </button>
                    )}
                    <button
                      onClick={() => { setShowImportModal(false); resetImport(); }}
                      className="w-full px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ PENDING MODAL ═══════ */}
      {showPendingModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPendingModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" data-testid="teacher-pending-modal">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Profesores Pendientes</h3>
                <p className="text-xs text-slate-400">{pending.length} registro{pending.length !== 1 ? "s" : ""} con errores</p>
              </div>
              <button onClick={() => setShowPendingModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {loadingPending ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
              ) : pending.length === 0 ? (
                <div className="text-center py-10">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 font-medium">No hay profesores pendientes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map(p => (
                    <div key={p.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4" data-testid={`teacher-pending-${p.id}`}>
                      {editingId === p.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-slate-500">Nombre *</label>
                              <input
                                value={editingData.name || ""}
                                onChange={(e) => setEditingData(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                data-testid={`teacher-edit-name-${p.id}`}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">Apellido</label>
                              <input
                                value={editingData.last_name || ""}
                                onChange={(e) => setEditingData(prev => ({ ...prev, last_name: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">DNI *</label>
                              <input
                                value={editingData.dni || ""}
                                onChange={(e) => setEditingData(prev => ({ ...prev, dni: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                data-testid={`teacher-edit-dni-${p.id}`}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">Correo</label>
                              <input
                                value={editingData.email || ""}
                                onChange={(e) => setEditingData(prev => ({ ...prev, email: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">Celular</label>
                              <input
                                value={editingData.phone || ""}
                                onChange={(e) => setEditingData(prev => ({ ...prev, phone: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">Género</label>
                              <select
                                value={editingData.gender || ""}
                                onChange={(e) => setEditingData(prev => ({ ...prev, gender: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                              >
                                <option value="">—</option>
                                <option value="Masculino">Masculino</option>
                                <option value="Femenino">Femenino</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleEditSave(p.id)}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 flex items-center gap-1.5"
                              data-testid={`teacher-edit-save-${p.id}`}
                            >
                              <Check className="w-4 h-4" /> Guardar y reintentar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 text-sm">
                              {(p.name || "—")} {(p.last_name || "")}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">DNI: {p.dni || "—"}</p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(p.errors || []).map((err, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[11px] font-medium rounded-full"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  {err}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              onClick={() => handleEditStart(p)}
                              className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200 flex items-center gap-1"
                              data-testid={`teacher-edit-btn-${p.id}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Editar
                            </button>
                            {(!(p.errors || []).length) && (
                              <button
                                onClick={() => handleRetry(p.id)}
                                className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-200 flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" /> Reintentar
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold hover:bg-rose-200 flex items-center gap-1"
                              data-testid={`teacher-delete-btn-${p.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
