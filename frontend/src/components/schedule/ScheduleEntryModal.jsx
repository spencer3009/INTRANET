import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Calendar, X, AlertCircle, AlertTriangle, Loader2, Check, BookOpen } from "lucide-react";
import { TimePicker } from "../ui/time-picker";
import { Combobox } from "../ui/combobox";
import { SUBJECT_COLORS, getVisibleDays } from "./constants";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function ScheduleEntryModal({ isOpen, onClose, token, entry, onSuccess, grades, sections, teachers, type, preselectedData, existingSchedules, settings }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  
  const [form, setForm] = useState({
    grado_id: "",
    seccion_id: "",
    profesor_id: "",
    materia: "",
    subject_id: "",
    dia: "",
    hora_inicio: "",
    hora_fin: "",
    aula: "",
    color: SUBJECT_COLORS[0].value
  });

  const isEdit = !!entry;
  const headers = { Authorization: `Bearer ${token}` };

  // Load subjects when PROFESOR + GRADO + SECCION change
  useEffect(() => {
    const loadTeacherSubjects = async () => {
      if (!form.profesor_id || !form.grado_id || !form.seccion_id) {
        setSubjects([]);
        return;
      }
      
      setLoadingSubjects(true);
      try {
        const res = await axios.get(
          `${API}/academic/teacher-subjects?teacher_id=${form.profesor_id}&grade_id=${form.grado_id}&section_id=${form.seccion_id}`, 
          { headers }
        );
        setSubjects(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Error loading teacher subjects:", err);
        setSubjects([]);
      } finally {
        setLoadingSubjects(false);
      }
    };
    
    loadTeacherSubjects();
  }, [form.profesor_id, form.grado_id, form.seccion_id, token]);

  // Filter subjects by search
  const filteredSubjects = subjects.filter(s => 
    s.name?.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  // Handle subject selection
  const handleSelectSubject = (subject) => {
    setForm(p => ({ 
      ...p, 
      materia: subject.name,
      subject_id: subject.id,
      color: subject.color || p.color
    }));
    setSubjectSearch("");
    setShowSubjectDropdown(false);
  };

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      if (entry) {
        setForm({
          grado_id: entry.grado_id || "",
          seccion_id: entry.seccion_id || "",
          profesor_id: entry.profesor_id || "",
          materia: entry.materia || "",
          subject_id: entry.subject_id || "",
          dia: entry.dia || "",
          hora_inicio: entry.hora_inicio || "",
          hora_fin: entry.hora_fin || "",
          aula: entry.aula || "",
          color: entry.color || SUBJECT_COLORS[0].value
        });
      } else {
        // Calculate end time based on start time and block duration
        let calculatedEndTime = "";
        if (preselectedData?.hora_inicio) {
          const blockDuration = settings?.block_duration || 60; // Default 60 minutes
          const [startH, startM] = preselectedData.hora_inicio.split(':').map(Number);
          const totalMinutes = startH * 60 + (startM || 0) + blockDuration;
          const endH = Math.floor(totalMinutes / 60);
          const endM = totalMinutes % 60;
          calculatedEndTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
        }
        
        setForm({
          grado_id: preselectedData?.grado_id || "",
          seccion_id: preselectedData?.seccion_id || "",
          profesor_id: preselectedData?.profesor_id || "",
          materia: "",
          subject_id: "",
          dia: preselectedData?.dia || "",
          hora_inicio: preselectedData?.hora_inicio || "",
          hora_fin: calculatedEndTime,
          aula: "",
          color: SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)].value
        });
      }
      setError("");
      setConflicts([]);
      setSubjectSearch("");
      setShowSubjectDropdown(false);
    }
  }, [isOpen, entry, preselectedData]);

  // Check for conflicts
  const checkConflicts = useCallback(() => {
    if (!form.dia || !form.hora_inicio || !form.hora_fin) return [];
    
    // Convert time string "HH:MM" to minutes for accurate comparison
    const timeToMinutes = (timeStr) => {
      if (!timeStr) return 0;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + (minutes || 0);
    };
    
    const newStartMins = timeToMinutes(form.hora_inicio);
    const newEndMins = timeToMinutes(form.hora_fin);
    const foundConflicts = [];
    
    existingSchedules?.forEach(schedule => {
      if (isEdit && schedule.id === entry?.id) return;
      if (schedule.dia !== form.dia) return;
      
      const existStartMins = timeToMinutes(schedule.hora_inicio);
      const existEndMins = timeToMinutes(schedule.hora_fin);
      
      // Overlap exists only if: newStart < existEnd AND newEnd > existStart
      // Consecutive schedules (e.g., 07:00-08:00 and 08:00-09:00) should NOT conflict
      const hasOverlap = (newStartMins < existEndMins && newEndMins > existStartMins);
      
      if (hasOverlap) {
        if (form.profesor_id && schedule.profesor_id === form.profesor_id) {
          foundConflicts.push({
            type: "teacher",
            message: `El profesor ya tiene clase de ${schedule.materia} a esta hora`,
            schedule
          });
        }
        if (form.aula && schedule.aula && schedule.aula === form.aula) {
          foundConflicts.push({
            type: "room",
            message: `El aula ${form.aula} ya está ocupada con ${schedule.materia}`,
            schedule
          });
        }
        if (form.grado_id === schedule.grado_id && form.seccion_id === schedule.seccion_id) {
          foundConflicts.push({
            type: "section",
            message: `Esta sección ya tiene ${schedule.materia} a esta hora`,
            schedule
          });
        }
      }
    });
    
    return foundConflicts;
  }, [form, existingSchedules, isEdit, entry]);

  // Update conflicts when form changes
  useEffect(() => {
    const c = checkConflicts();
    setConflicts(c);
  }, [checkConflicts]);

  // Filter sections by grade
  const filteredSections = sections.filter(s => s.grado_id === form.grado_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.materia.trim()) {
      setError("Selecciona una materia");
      return;
    }
    if (!form.dia) {
      setError("Selecciona el día");
      return;
    }
    if (!form.hora_inicio || !form.hora_fin) {
      setError("Selecciona hora de inicio y fin");
      return;
    }
    if (form.hora_inicio >= form.hora_fin) {
      setError("La hora de fin debe ser posterior a la de inicio");
      return;
    }
    if (type === "clases" && !form.profesor_id) {
      setError("Selecciona el profesor");
      return;
    }
    
    if (conflicts.length > 0) {
      setError("Resuelve los conflictos antes de guardar");
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form, tipo: type };
      
      if (isEdit) {
        await axios.put(`${API}/schedules/${entry.id}`, payload, { headers });
      } else {
        await axios.post(`${API}/schedules`, payload, { headers });
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      if (typeof errorDetail === 'object' && errorDetail.message) {
        setError(errorDetail.message);
      } else {
        setError(errorDetail || "Error al guardar el horario");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4" data-testid="schedule-entry-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header - Fixed */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {isEdit ? "Editar Horario" : "Agregar Horario"}
                </h3>
                <p className="text-white/70 text-sm">
                  {type === "clases" ? "Horario de clase" : type === "profesores" ? "Horario de profesor" : "Horario de examen"}
                </p>
              </div>
            </div>
            <button data-testid="entry-modal-close" onClick={onClose} className="text-white/80 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Scrollable content */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Conflicts Warning */}
          {conflicts.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 text-amber-700 font-semibold mb-2">
                <AlertTriangle className="w-5 h-5" />
                Conflictos detectados
              </div>
              <ul className="space-y-1">
                {conflicts.map((c, i) => (
                  <li key={i} className="text-sm text-amber-600 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    {c.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Grade & Section (for classes) */}
          {type === "clases" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Grado</label>
                <select
                  value={form.grado_id}
                  onChange={(e) => setForm(p => ({ ...p, grado_id: e.target.value, seccion_id: "" }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Seleccionar...</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
              </div>
              <Combobox
                label="Sección"
                value={form.seccion_id}
                onChange={(val) => setForm(p => ({ ...p, seccion_id: val }))}
                placeholder="Seleccionar sección..."
                searchPlaceholder="Buscar sección..."
                disabled={!form.grado_id}
                required
                emptyMessage="No hay secciones para este grado"
                options={filteredSections.map(s => ({
                  id: s.id,
                  label: s.nombre,
                  sublabel: s.turno || s.nivel || "",
                  color: s.color || "#6366F1"
                }))}
              />
            </div>
          )}

          {/* Teacher */}
          {type === "clases" && (
            <Combobox
              label="Profesor"
              value={form.profesor_id}
              onChange={(val) => setForm(p => ({ ...p, profesor_id: val, materia: "", subject_id: "" }))}
              placeholder="Seleccionar profesor..."
              searchPlaceholder="Buscar profesor..."
              required
              disabled={!form.grado_id || !form.seccion_id}
              emptyMessage="No hay profesores disponibles"
              options={teachers.map(t => ({
                id: t.id,
                label: `${t.name} ${t.last_name || ""}`.trim(),
                sublabel: t.email || t.specialty || "",
                image: t.profile_image || t.photo_url || null
              }))}
            />
          )}

          {/* Subject */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Materia / Asignatura <span className="text-red-500">*</span>
            </label>
            
            {(!form.grado_id || !form.seccion_id || !form.profesor_id) && type === "clases" ? (
              <div className="w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {!form.grado_id ? "Primero selecciona un grado" : 
                 !form.seccion_id ? "Selecciona una sección" :
                 "Selecciona un profesor"}
              </div>
            ) : (
              <div className="relative">
                <div 
                  className={`w-full px-4 py-3 bg-slate-50 border rounded-xl flex items-center gap-2 cursor-pointer transition-all ${
                    showSubjectDropdown ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => !form.materia && setShowSubjectDropdown(true)}
                >
                  {form.materia ? (
                    <>
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: form.color }} />
                      <span className="flex-1 text-slate-800 font-medium">{form.materia}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setForm(p => ({ ...p, materia: "", subject_id: "" }));
                        }}
                        className="p-1 hover:bg-slate-200 rounded-full"
                      >
                        <X className="w-4 h-4 text-slate-400" />
                      </button>
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={subjectSearch}
                        onChange={(e) => {
                          setSubjectSearch(e.target.value);
                          setShowSubjectDropdown(true);
                        }}
                        onFocus={() => setShowSubjectDropdown(true)}
                        className="flex-1 bg-transparent border-0 focus:outline-none text-sm"
                        placeholder="Buscar asignatura..."
                      />
                      {loadingSubjects && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                    </>
                  )}
                </div>
                
                {/* Dropdown */}
                {showSubjectDropdown && !form.materia && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {loadingSubjects ? (
                      <div className="p-4 text-center text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Cargando...
                      </div>
                    ) : filteredSubjects.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-sm">
                        {subjects.length === 0 ? "Este profesor no tiene asignaturas en esta sección" : "Sin resultados"}
                      </div>
                    ) : (
                      filteredSubjects.map(subject => (
                        <button
                          key={subject.id}
                          type="button"
                          onClick={() => handleSelectSubject(subject)}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 transition-colors"
                        >
                          <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color || '#6366F1' }} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800">{subject.name}</p>
                            {subject.role && <p className="text-xs text-slate-500">{subject.role === 'titular' ? 'Titular' : 'Auxiliar'}</p>}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            
            {showSubjectDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowSubjectDropdown(false)} />}
          </div>

          {/* Day */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Día <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
              {getVisibleDays(settings).map(day => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, dia: day.id }))}
                  className={`px-2 py-3 rounded-xl border-2 text-center transition-all ${
                    form.dia === day.id
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <p className="font-semibold text-sm">{day.short}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <TimePicker
              label="Hora inicio *"
              value={form.hora_inicio}
              onChange={(val) => setForm(p => ({ ...p, hora_inicio: val }))}
            />
            <TimePicker
              label="Hora fin *"
              value={form.hora_fin}
              onChange={(val) => setForm(p => ({ ...p, hora_fin: val }))}
            />
          </div>

          {/* Room */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Aula (opcional)</label>
            <input
              type="text"
              value={form.aula}
              onChange={(e) => setForm(p => ({ ...p, aula: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: A-101, Laboratorio, etc."
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {SUBJECT_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, color: c.value }))}
                  className={`w-8 h-8 rounded-full transition-all ${
                    form.color === c.value ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          </div>

          {/* Buttons - Fixed at bottom */}
          <div className="flex gap-3 px-6 py-4 border-t border-slate-200 flex-shrink-0 bg-white">
            <button
              type="button"
              data-testid="entry-cancel-btn"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid="entry-submit-btn"
              disabled={loading || conflicts.length > 0}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {isEdit ? "Guardar" : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
