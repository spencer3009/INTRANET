import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { X, FileText, Upload, Check, AlertTriangle, Trash2, Loader2, CloudOff, Settings as SettingsIcon } from "lucide-react";
import { Link } from "react-router-dom";

const API = process.env.REACT_APP_BACKEND_URL;
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Lateral drawer to upload PDF report cards (libretas) per student/bimester.
 * Owner / admin only. Persists to Google Drive via /api/report-cards/upload.
 */
export default function LibretasUploadDrawer({
  open,
  onClose,
  token,
  levels = [],
  grades = [],
  sections = [],
  periods = [],
  defaultLevelId,
  defaultGradeId,
  defaultSectionId,
  defaultPeriodId,
}) {
  const [selectedLevel, setSelectedLevel] = useState(defaultLevelId || "");
  const [selectedGrade, setSelectedGrade] = useState(defaultGradeId || "");
  const [selectedSection, setSelectedSection] = useState(defaultSectionId || "");
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriodId || "");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [driveConnected, setDriveConnected] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const fileInputs = useRef({});

  const authHeaders = { Authorization: `Bearer ${token}` };
  const filteredGrades = selectedLevel ? grades.filter((g) => g.nivel_id === selectedLevel) : [];
  const filteredSections = selectedGrade ? sections.filter((s) => s.grado_id === selectedGrade) : [];

  useEffect(() => {
    if (!open) return;
    setSelectedLevel(defaultLevelId || "");
    setSelectedGrade(defaultGradeId || "");
    setSelectedSection(defaultSectionId || "");
    setSelectedPeriod(defaultPeriodId || "");
  }, [open, defaultLevelId, defaultGradeId, defaultSectionId, defaultPeriodId]);

  const loadRows = useCallback(async () => {
    if (!selectedSection || !selectedPeriod) {
      setRows([]); setError(""); return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API}/api/report-cards/by-section`, {
        headers: authHeaders,
        params: { section_id: selectedSection, period_id: selectedPeriod },
      });
      setRows(res.data?.students || []);
      setDriveConnected(Boolean(res.data?.drive_connected));
    } catch (err) {
      setError(err?.response?.data?.detail || "Error al cargar alumnos");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSection, selectedPeriod, token]);

  useEffect(() => { if (open) loadRows(); }, [open, loadRows]);

  const handlePickFile = (studentId) => {
    const inp = fileInputs.current[studentId];
    if (inp) inp.click();
  };

  const handleFileChange = async (student, e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("Solo se aceptan archivos PDF");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(`El archivo "${f.name}" supera 10 MB`);
      return;
    }
    setError("");
    setUploadingId(student.student_id);
    try {
      const fd = new FormData();
      fd.append("student_id", student.student_id);
      fd.append("section_id", selectedSection);
      fd.append("period_id", selectedPeriod);
      fd.append("file", f);
      await axios.post(`${API}/api/report-cards/upload`, fd, {
        headers: { ...authHeaders, "Content-Type": "multipart/form-data" },
      });
      await loadRows();
    } catch (err) {
      setError(err?.response?.data?.detail || "Error al subir la libreta");
    } finally {
      setUploadingId(null);
    }
  };

  const handleDelete = async (row) => {
    if (!row.report_card_id) return;
    if (!window.confirm(`¿Eliminar la libreta cargada de ${row.student_name}?`)) return;
    setDeletingId(row.report_card_id);
    setError("");
    try {
      await axios.delete(`${API}/api/report-cards/${row.report_card_id}`, { headers: authHeaders });
      await loadRows();
    } catch (err) {
      setError(err?.response?.data?.detail || "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  const uploadedCount = rows.filter((r) => r.uploaded).length;
  const totalCount = rows.length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" data-testid="libretas-upload-drawer">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-violet-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900" data-testid="libretas-drawer-title">Cargar libretas</h2>
              <p className="text-xs text-slate-500">Subir un PDF por alumno y bimestre</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" data-testid="libretas-drawer-close">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </header>

        {/* Drive status banner */}
        {!driveConnected && (
          <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3" data-testid="drive-disconnected-banner">
            <CloudOff className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800 leading-relaxed">
              <strong className="block font-semibold mb-0.5">Google Drive desconectado</strong>
              No se pueden subir libretas hasta que conectes Google Drive.{" "}
              <Link to="/settings" className="underline font-semibold inline-flex items-center gap-1">
                <SettingsIcon className="w-3.5 h-3.5" /> Ir a Ajustes
              </Link>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nivel</label>
            <select
              value={selectedLevel}
              onChange={(e) => { setSelectedLevel(e.target.value); setSelectedGrade(""); setSelectedSection(""); }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              data-testid="libretas-filter-level"
            >
              <option value="">Selecciona</option>
              {levels.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Grado</label>
            <select
              value={selectedGrade}
              onChange={(e) => { setSelectedGrade(e.target.value); setSelectedSection(""); }}
              disabled={!selectedLevel}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-slate-100"
              data-testid="libretas-filter-grade"
            >
              <option value="">Selecciona</option>
              {filteredGrades.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Sección</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              disabled={!selectedGrade}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-slate-100"
              data-testid="libretas-filter-section"
            >
              <option value="">Selecciona</option>
              {filteredSections.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Bimestre</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              data-testid="libretas-filter-period"
            >
              <option value="">Selecciona</option>
              {periods.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3 flex items-start gap-2" data-testid="libretas-error">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Counter */}
        {selectedSection && selectedPeriod && (
          <div className="px-6 py-3 text-xs text-slate-600 border-b border-slate-100">
            <strong className="text-slate-800">{uploadedCount}</strong> de <strong className="text-slate-800">{totalCount}</strong> alumnos con libreta cargada
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
            </div>
          )}
          {!loading && !selectedSection && (
            <div className="text-center text-sm text-slate-500 py-12">
              Selecciona <strong>nivel</strong>, <strong>grado</strong>, <strong>sección</strong> y <strong>bimestre</strong> para empezar.
            </div>
          )}
          {!loading && selectedSection && rows.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-12">
              No hay alumnos matriculados en esta sección.
            </div>
          )}
          {!loading && rows.length > 0 && (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li
                  key={r.student_id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:border-violet-300 bg-white"
                  data-testid={`libreta-row-${r.student_id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {r.photo_url ? (
                      <img src={r.photo_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-600 font-semibold flex-shrink-0">
                        {(r.student_name || "?").charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate" title={r.student_name}>{r.student_name}</p>
                      {r.uploaded ? (
                        <p className="text-xs text-emerald-700 flex items-center gap-1">
                          <Check className="w-3 h-3" /> {r.file_name} {r.file_size ? `(${Math.round(r.file_size/1024)} KB)` : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">Sin libreta cargada</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <input
                      ref={(el) => { fileInputs.current[r.student_id] = el; }}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => handleFileChange(r, e)}
                      data-testid={`libreta-file-input-${r.student_id}`}
                    />
                    <button
                      type="button"
                      onClick={() => handlePickFile(r.student_id)}
                      disabled={uploadingId === r.student_id || !driveConnected}
                      className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid={`libreta-upload-btn-${r.student_id}`}
                    >
                      {uploadingId === r.student_id ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo</>
                      ) : r.uploaded ? (
                        <><Upload className="w-3.5 h-3.5" /> Reemplazar</>
                      ) : (
                        <><Upload className="w-3.5 h-3.5" /> Subir PDF</>
                      )}
                    </button>
                    {r.uploaded && (
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        disabled={deletingId === r.report_card_id}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title="Eliminar libreta"
                        data-testid={`libreta-delete-btn-${r.student_id}`}
                      >
                        {deletingId === r.report_card_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="px-6 py-3 border-t border-slate-200 text-xs text-slate-500">
          Solo PDF · máx. 10 MB · Se almacena en Google Drive del colegio
        </footer>
      </aside>
    </div>
  );
}
