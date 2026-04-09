import { useState, useEffect } from "react";
import axios from "axios";
import { Calendar, X, AlertCircle, Loader2, Check, Clock, User, Pencil, Trash2, FileText, Timer, Archive } from "lucide-react";
import { TimePicker } from "../ui/time-picker";
import { Combobox } from "../ui/combobox";
import { EXAM_TYPES } from "./constants";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Status badge for exams
export function ExamStatusBadge({ status }) {
  const config = {
    upcoming: { label: "Próximo", bg: "bg-blue-100", text: "text-blue-700", icon: Timer },
    ongoing: { label: "En curso", bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
    finished: { label: "Finalizado", bg: "bg-slate-100", text: "text-slate-600", icon: Archive }
  }[status] || { label: status, bg: "bg-slate-100", text: "text-slate-600", icon: Clock };
  
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// Exam card component
export function ExamCard({ exam, onEdit, onDelete }) {
  const typeConfig = EXAM_TYPES.find(t => t.id === exam.type) || EXAM_TYPES[0];
  
  return (
    <div 
      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
      style={{ borderLeftWidth: '4px', borderLeftColor: exam.subject_color || typeConfig.color }}
      data-testid={`exam-card-${exam.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h4 className="font-bold text-slate-800 truncate">{exam.subject_name}</h4>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: typeConfig.color }}>
              {typeConfig.icon} {typeConfig.label}
            </span>
            <ExamStatusBadge status={exam.status} />
          </div>
          <p className="text-sm text-slate-600 mb-2">{exam.title}</p>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{exam.start_time} - {exam.end_time}</span>
            <span className="text-slate-400">({exam.duration_minutes} min)</span>
          </div>
          {exam.teacher_name && (
            <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
              <User className="w-4 h-4" />
              {exam.teacher_name}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(exam)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" data-testid={`exam-edit-${exam.id}`}>
            <Pencil className="w-4 h-4 text-slate-500" />
          </button>
          <button onClick={() => onDelete(exam)} className="p-2 hover:bg-red-50 rounded-lg transition-colors" data-testid={`exam-delete-${exam.id}`}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Exam form panel (side panel)
export function ExamFormPanel({ isOpen, onClose, token, exam, onSuccess, gradeId, sectionId, subjects, teachers, selectedDate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    subject_id: "", teacher_id: "", date: "", start_time: "09:00", end_time: "10:30", type: "parcial", title: "", description: ""
  });

  const isEdit = !!exam;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (isOpen) {
      if (exam) {
        setForm({
          subject_id: exam.subject_id || "", teacher_id: exam.teacher_id || "",
          date: exam.date || "", start_time: exam.start_time || "09:00", end_time: exam.end_time || "10:30",
          type: exam.type || "parcial", title: exam.title || "", description: exam.description || ""
        });
      } else {
        setForm({
          subject_id: "", teacher_id: "",
          date: selectedDate || new Date().toISOString().split('T')[0],
          start_time: "09:00", end_time: "10:30", type: "parcial", title: "", description: ""
        });
      }
      setError("");
    }
  }, [isOpen, exam, selectedDate]);

  const calculateDuration = () => {
    if (!form.start_time || !form.end_time) return 0;
    const [startH, startM] = form.start_time.split(':').map(Number);
    const [endH, endM] = form.end_time.split(':').map(Number);
    return Math.max(0, (endH * 60 + endM) - (startH * 60 + startM));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.subject_id) { setError("Selecciona una materia"); return; }
    if (!form.teacher_id) { setError("Selecciona un profesor"); return; }
    if (!form.date) { setError("Selecciona una fecha"); return; }
    if (!form.title.trim()) { setError("Ingresa un título"); return; }
    if (form.end_time <= form.start_time) { setError("La hora fin debe ser mayor"); return; }

    setLoading(true);
    try {
      const payload = { ...form, grade_id: gradeId, section_id: sectionId };
      if (isEdit) {
        await axios.put(`${API}/exam-schedules/${exam.id}`, payload, { headers });
      } else {
        await axios.post(`${API}/exam-schedules`, payload, { headers });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const teacherOptions = teachers.map(t => ({
    value: t.id, label: `${t.name} ${t.last_name || ''}`.trim(), photo: t.profile_image || t.photo_url
  }));

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-[200] flex flex-col" data-testid="exam-form-panel">
      <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-purple-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{isEdit ? "Editar Examen" : "Programar Examen"}</h3>
              <p className="text-white/70 text-sm">{form.date}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5 text-white" /></button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
          <input type="date" value={form.date} onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg" data-testid="exam-date-input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Materia</label>
          <select value={form.subject_id} onChange={(e) => setForm(p => ({ ...p, subject_id: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg" data-testid="exam-subject-select">
            <option value="">Seleccionar...</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name || s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Profesor</label>
          <Combobox options={teacherOptions} value={form.teacher_id} onChange={(val) => setForm(p => ({ ...p, teacher_id: val }))} placeholder="Buscar..." showPhoto={true} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
          <input type="text" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Ej: Examen Parcial Unidad 1" className="w-full px-3 py-2 border border-slate-300 rounded-lg" data-testid="exam-title-input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
          <div className="grid grid-cols-2 gap-2">
            {EXAM_TYPES.map(type => (
              <button key={type.id} type="button" onClick={() => setForm(p => ({ ...p, type: type.id }))}
                className={`p-2 rounded-lg border-2 transition-all text-left ${form.type === type.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                <span className="mr-1">{type.icon}</span><span className="text-sm font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hora inicio</label>
            <TimePicker value={form.start_time} onChange={(val) => setForm(p => ({ ...p, start_time: val }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hora fin</label>
            <TimePicker value={form.end_time} onChange={(val) => setForm(p => ({ ...p, end_time: val }))} />
          </div>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
          <span className="text-sm text-slate-600">Duración:</span>
          <span className="font-bold text-indigo-600">{calculateDuration()} minutos</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
          <textarea value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Temas, indicaciones..." rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none" />
        </div>
      </form>

      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg font-medium">Cancelar</button>
        <button onClick={handleSubmit} disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2" data-testid="exam-submit-btn">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {isEdit ? "Actualizar" : "Programar"}
        </button>
      </div>
    </div>
  );
}

// Exam calendar component
export function ExamCalendar({ currentMonth, exams, onDayClick, selectedDate }) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const examsByDay = {};
  exams.forEach(exam => {
    const day = parseInt(exam.date.split('-')[2]);
    examsByDay[day] = (examsByDay[day] || 0) + 1;
  });

  const days = [];
  for (let i = 0; i < adjustedStartDay; i++) days.push(null);
  for (let day = 1; day <= totalDays; day++) days.push(day);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();
  const selectedDay = selectedDate ? parseInt(selectedDate.split('-')[2]) : null;
  const selectedMonth = selectedDate ? parseInt(selectedDate.split('-')[1]) - 1 : null;
  const selectedYear = selectedDate ? parseInt(selectedDate.split('-')[0]) : null;
  const isSelectedMonth = selectedYear === year && selectedMonth === month;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="exam-calendar">
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
        {weekDays.map(day => (
          <div key={day} className="py-2 text-center text-xs font-medium text-slate-500">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="h-16 bg-slate-50/50" />;
          const examCount = examsByDay[day] || 0;
          const isToday = isCurrentMonth && day === todayDate;
          const isSelected = isSelectedMonth && day === selectedDay;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return (
            <button key={day} onClick={() => onDayClick(dateStr)}
              className={`h-16 p-1 border-b border-r border-slate-100 hover:bg-indigo-50 transition-colors text-left flex flex-col ${isSelected ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-500' : ''}`}
              data-testid={`calendar-day-${day}`}>
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm ${isToday ? 'bg-indigo-600 text-white font-bold' : 'text-slate-700'}`}>{day}</span>
              {examCount > 0 && (
                <div className="mt-auto">
                  <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                    <FileText className="w-3 h-3" />{examCount}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
