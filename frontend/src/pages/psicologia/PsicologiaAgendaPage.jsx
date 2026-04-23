import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/App";
import PsicologiaLayout from "@/components/PsicologiaLayout";
import {
  Plus, ChevronLeft, ChevronRight, Calendar, Clock,
  User, MapPin, X, Save, AlertTriangle, Check, Trash2, Edit2,
  FileText, Eye
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TYPE_COLORS = {
  sesion_individual: { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-300", accent: "#8B5CF6" },
  sesion_grupal: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", accent: "#3B82F6" },
  sesion_familiar: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300", accent: "#10B981" },
  reunion_padres: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300", accent: "#F59E0B" },
  observacion_aula: { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-300", accent: "#06B6D4" },
  evaluacion: { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-300", accent: "#EC4899" },
  otro: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300", accent: "#6B7280" },
};

const TYPE_LABELS = {
  sesion_individual: "Individual", sesion_grupal: "Grupal", sesion_familiar: "Familiar",
  reunion_padres: "Reunion padres", observacion_aula: "Obs. aula", evaluacion: "Evaluación", otro: "Otro"
};

const DURATIONS = [15, 30, 45, 60, 90, 120];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7am to 6pm

function getWeekDays(refDate) {
  const d = new Date(refDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return dt;
  });
}

function formatShortDate(d) { return d.toLocaleDateString("es-PE", { weekday: "short", day: "numeric" }); }
function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

export default function PsicologiaAgendaPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { getSchoolPath } = useTenant();
  const [view, setView] = useState("week");
  const [refDate, setRefDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [editingAppt, setEditingAppt] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  const weekDays = useMemo(() => getWeekDays(refDate), [refDate.toDateString()]);
  const startDate = view === "week" ? weekDays[0] : new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const endDate = view === "week" ? weekDays[6] : new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const s = startDate.toISOString();
      const e = endDate.toISOString();
      const res = await fetch(`${API}/v1/psychology/appointments?start_date=${s}&end_date=${e}`, { headers });
      if (res.ok) { const d = await res.json(); setAppointments(d.appointments || []); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [refDate.toDateString(), view]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const navigate_date = (dir) => {
    const d = new Date(refDate);
    if (view === "week") d.setDate(d.getDate() + dir * 7);
    else if (view === "day") d.setDate(d.getDate() + dir);
    else d.setMonth(d.getMonth() + dir);
    setRefDate(d);
  };

  const deleteAppt = async (id, scope = "single") => {
    if (!window.confirm("Eliminar esta cita?")) return;
    await fetch(`${API}/v1/psychology/appointments/${id}?delete_scope=${scope}`, { method: "DELETE", headers });
    setSelectedAppt(null);
    fetchAppointments();
  };

  const updateStatus = async (id, status, notes = "") => {
    const res = await fetch(`${API}/v1/psychology/appointments/${id}/status`, {
      method: "PUT", headers: jsonHeaders, body: JSON.stringify({ status, notes_post: notes })
    });
    if (res.ok) {
      const d = await res.json();
      setSelectedAppt(null);
      fetchAppointments();
      if (d.suggest_create_session && d.student_id) {
        if (window.confirm("Cita completada. Deseas registrar una sesión clinica para este estudiante?")) {
          navigate(getSchoolPath(`/psicologia/fichas/${d.student_id}`));
        }
      }
    }
  };

  const onSaved = () => { setShowCreate(false); setEditingAppt(null); fetchAppointments(); };

  const today = new Date();

  return (
    <PsicologiaLayout user={user} token={token} onLogout={onLogout} activeSection="agenda">
      <div data-testid="psicologia-agenda">
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-800">Agenda</h1>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-0.5">
          {["day", "week", "month"].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${view === v ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              data-testid={`view-${v}`}>
              {v === "day" ? "Día" : v === "week" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate_date(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setRefDate(new Date())} className="px-2 py-1 text-xs font-medium text-violet-600 hover:bg-violet-50 rounded-lg">Hoy</button>
          <button onClick={() => navigate_date(1)} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <span className="text-sm font-medium text-slate-700 hidden sm:block min-w-[120px]">
          {view === "day" ? refDate.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" }) :
            view === "week" ? `${weekDays[0].toLocaleDateString("es-PE", { day: "numeric", month: "short" })} - ${weekDays[6].toLocaleDateString("es-PE", { day: "numeric", month: "short" })}` :
            refDate.toLocaleDateString("es-PE", { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => { setEditingAppt(null); setShowCreate(true); }}
          className="px-3 py-2 bg-violet-600 text-white text-xs font-medium rounded-xl hover:bg-violet-700 flex items-center gap-1.5"
          data-testid="new-appointment-btn">
          <Plus className="w-3.5 h-3.5" /> Nueva cita
        </button>
      </div>

      <div className="px-2 sm:px-4 py-2">
        {view === "month" ? (
          <MonthView appointments={appointments} refDate={refDate} onDayClick={(d) => { setRefDate(d); setView("day"); }} today={today} />
        ) : (
          <WeekDayView
            appointments={appointments}
            days={view === "day" ? [refDate] : weekDays}
            today={today}
            onApptClick={setSelectedAppt}
            loading={loading}
          />
        )}
      </div>

      {selectedAppt && (
        <AppointmentDetail
          appt={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onEdit={() => { setEditingAppt(selectedAppt); setShowCreate(true); setSelectedAppt(null); }}
          onDelete={(scope) => deleteAppt(selectedAppt.id, scope)}
          onComplete={() => updateStatus(selectedAppt.id, "completada")}
          onCancel={() => updateStatus(selectedAppt.id, "cancelada")}
          onNoShow={() => updateStatus(selectedAppt.id, "no_asistio")}
          getSchoolPath={getSchoolPath}
          navigate={navigate}
        />
      )}

      {showCreate && (
        <AppointmentModal
          token={token}
          editing={editingAppt}
          onSaved={onSaved}
          onClose={() => { setShowCreate(false); setEditingAppt(null); }}
          defaultDate={refDate}
        />
      )}
    </div>
    </PsicologiaLayout>
  );
}

function WeekDayView({ appointments, days, today, onApptClick, loading }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
      <div className="flex">
        <div className="w-14 flex-shrink-0" />
        {days.map(d => (
          <div key={d.toISOString()} className={`flex-1 text-center py-2 border-b border-l border-slate-100 ${isSameDay(d, today) ? "bg-violet-50" : ""}`}>
            <p className="text-[10px] text-slate-500 uppercase">{d.toLocaleDateString("es-PE", { weekday: "short" })}</p>
            <p className={`text-sm font-bold ${isSameDay(d, today) ? "text-violet-600" : "text-slate-800"}`}>{d.getDate()}</p>
          </div>
        ))}
      </div>
      <div className="relative" style={{ height: `${HOURS.length * 60}px` }}>
        {HOURS.map((h, i) => (
          <div key={h} className="absolute left-0 right-0 flex" style={{ top: `${i * 60}px`, height: "60px" }}>
            <div className="w-14 flex-shrink-0 text-right pr-2 pt-0 text-[10px] text-slate-400">{h}:00</div>
            <div className="flex-1 flex">
              {days.map(d => (
                <div key={d.toISOString()} className={`flex-1 border-l border-t border-slate-100 ${isSameDay(d, today) ? "bg-violet-50/30" : ""}`} />
              ))}
            </div>
          </div>
        ))}
        {/* Appointment blocks */}
        {appointments.map(appt => {
          const dt = new Date(appt.date);
          const dayIdx = days.findIndex(d => isSameDay(d, dt));
          if (dayIdx === -1) return null;
          const hour = dt.getHours() + dt.getMinutes() / 60;
          const top = (hour - HOURS[0]) * 60;
          const height = Math.max((appt.duration_minutes || 45) * (60 / 60), 20);
          const colors = TYPE_COLORS[appt.appointment_type] || TYPE_COLORS.otro;
          const colWidth = 100 / days.length;
          const left = 56 + (dayIdx * (100 - 3.5) / days.length) * (window.innerWidth < 640 ? 3 : 1);

          return (
            <button key={appt.id}
              onClick={() => onApptClick(appt)}
              className={`absolute rounded-lg px-1.5 py-0.5 border ${colors.bg} ${colors.border} ${colors.text} overflow-hidden hover:shadow-md transition-shadow cursor-pointer text-left`}
              style={{
                top: `${top}px`, height: `${height}px`,
                left: `calc(56px + ${dayIdx} * ((100% - 56px) / ${days.length}) + 2px)`,
                width: `calc((100% - 56px) / ${days.length} - 4px)`,
                zIndex: 10
              }}
              data-testid={`appt-${appt.id}`}
            >
              <p className="text-[10px] font-semibold truncate leading-tight">{appt.title}</p>
              {height > 30 && <p className="text-[9px] opacity-70 truncate">{dt.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</p>}
              {height > 45 && appt.student_name && <p className="text-[9px] opacity-60 truncate">{appt.student_name}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ appointments, refDate, onDayClick, today }) {
  const year = refDate.getFullYear(), month = refDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
  const dayNames = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

  return (
    <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
      <div className="grid grid-cols-7">
        {dayNames.map(n => <div key={n} className="py-2 text-center text-[10px] font-medium text-slate-500 uppercase border-b border-slate-100">{n}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} className="min-h-[80px] border-b border-r border-slate-100 bg-slate-50/50" />;
          const dayAppts = appointments.filter(a => isSameDay(new Date(a.date), d));
          const isToday = isSameDay(d, today);
          return (
            <button key={d.toISOString()} onClick={() => onDayClick(d)}
              className={`min-h-[80px] p-1.5 border-b border-r border-slate-100 text-left hover:bg-violet-50/50 ${isToday ? "bg-violet-50" : ""}`}>
              <p className={`text-xs font-medium ${isToday ? "text-violet-600" : "text-slate-700"}`}>{d.getDate()}</p>
              <div className="mt-1 space-y-0.5">
                {dayAppts.slice(0, 3).map(a => {
                  const c = TYPE_COLORS[a.appointment_type] || TYPE_COLORS.otro;
                  return <div key={a.id} className={`h-1.5 rounded-full ${c.bg}`} title={a.title} />;
                })}
                {dayAppts.length > 3 && <p className="text-[9px] text-slate-400">+{dayAppts.length - 3} mas</p>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AppointmentDetail({ appt, onClose, onEdit, onDelete, onComplete, onCancel, onNoShow, getSchoolPath, navigate }) {
  const c = TYPE_COLORS[appt.appointment_type] || TYPE_COLORS.otro;
  const dt = new Date(appt.date);
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()} data-testid="appointment-detail">
        <div className={`px-5 py-4 rounded-t-2xl flex items-center justify-between`} style={{ backgroundColor: c.accent + "15" }}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.accent }} />
            <span className={`text-xs font-medium ${c.text}`}>{TYPE_LABELS[appt.appointment_type] || appt.appointment_type}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${appt.status === "completada" ? "bg-green-100 text-green-700" : appt.status === "cancelada" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>{appt.status}</span>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-white/50 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <h3 className="text-base font-bold text-slate-800">{appt.title}</h3>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="w-4 h-4 text-slate-400" />
            {dt.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="w-4 h-4 text-slate-400" />
            {dt.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })} - {appt.duration_minutes} min
          </div>
          {appt.location && <div className="flex items-center gap-2 text-sm text-slate-600"><MapPin className="w-4 h-4 text-slate-400" />{appt.location}</div>}
          {appt.student_name && (
            <button type="button" onClick={() => { onClose(); navigate(getSchoolPath(`/psicologia/fichas/${appt.student_id}`)); }}
              className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700">
              <User className="w-4 h-4" />{appt.student_name} {appt.student_grade ? `(${appt.student_grade})` : ""}
            </button>
          )}
          {appt.parent_name && <div className="flex items-center gap-2 text-sm text-slate-600"><User className="w-4 h-4 text-slate-400" />Padre: {appt.parent_name}</div>}
          {appt.description && <p className="text-sm text-slate-500">{appt.description}</p>}
          {appt.notes_post && <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs font-medium text-slate-500 mb-1">Notas post-cita</p><p className="text-sm text-slate-700">{appt.notes_post}</p></div>}
        </div>
        {appt.status === "programada" && (
          <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap gap-2">
            <button type="button" onClick={onEdit} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1" data-testid="edit-appt"><Edit2 className="w-3 h-3" /> Editar</button>
            <button type="button" onClick={onComplete} className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1" data-testid="complete-appt"><Check className="w-3 h-3" /> Completar</button>
            <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50" data-testid="cancel-appt">Cancelar</button>
            <button type="button" onClick={onNoShow} className="px-3 py-1.5 text-xs font-medium text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50">No asistio</button>
            <button type="button" onClick={() => onDelete("single")} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-500 flex items-center gap-1"><Trash2 className="w-3 h-3" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function AppointmentModal({ token, editing, onSaved, onClose, defaultDate }) {
  const [form, setForm] = useState({
    title: editing?.title || "",
    appointment_type: editing?.appointment_type || "sesion_individual",
    date: editing?.date?.slice(0, 10) || defaultDate.toISOString().slice(0, 10),
    time: editing?.date ? new Date(editing.date).toTimeString().slice(0, 5) : "10:00",
    duration_minutes: editing?.duration_minutes || 45,
    student_id: editing?.student_id || "",
    parent_id: editing?.parent_id || "",
    location: editing?.location || "",
    description: editing?.description || "",
    recurrence_type: "none",
    recurrence_end_date: "",
  });
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState(editing?.student_name || "");
  const [conflict, setConflict] = useState(null);
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (studentSearch.length < 2) { setStudents([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/v1/psychology/students?search=${encodeURIComponent(studentSearch)}&limit=8`, { headers });
        if (res.ok) { const d = await res.json(); setStudents(d.students || []); }
      } catch(e) {}
    }, 300);
    return () => clearTimeout(t);
  }, [studentSearch]);

  useEffect(() => {
    if (!form.date || !form.time) return;
    const t = setTimeout(async () => {
      try {
        const dt = `${form.date}T${form.time}:00`;
        const url = `${API}/v1/psychology/appointments/check-conflict?date=${dt}&duration_minutes=${form.duration_minutes}${editing ? `&exclude_id=${editing.id}` : ""}`;
        const res = await fetch(url, { headers });
        if (res.ok) { const d = await res.json(); setConflict(d.has_conflict ? d.conflict : null); }
      } catch(e) {}
    }, 500);
    return () => clearTimeout(t);
  }, [form.date, form.time, form.duration_minutes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const dateISO = `${form.date}T${form.time}:00`;
    const body = {
      title: form.title, appointment_type: form.appointment_type, date: dateISO,
      duration_minutes: parseInt(form.duration_minutes), location: form.location, description: form.description,
      student_id: form.student_id || null, parent_id: form.parent_id || null,
    };
    if (!editing) {
      body.recurrence_type = form.recurrence_type;
      body.recurrence_end_date = form.recurrence_end_date ? `${form.recurrence_end_date}T23:59:59` : null;
    }
    try {
      const url = editing ? `${API}/v1/psychology/appointments/${editing.id}` : `${API}/v1/psychology/appointments`;
      const res = await fetch(url, { method: editing ? "PUT" : "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) onSaved();
    } catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-auto shadow-xl" data-testid="appointment-modal">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-semibold text-slate-800">{editing ? "Editar Cita" : "Nueva Cita"}</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Título *</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="appt-title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo *</label>
              <select value={form.appointment_type} onChange={e => setForm(f => ({...f, appointment_type: e.target.value}))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="appt-type">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Duracion</label>
              <select value={form.duration_minutes} onChange={e => setForm(f => ({...f, duration_minutes: e.target.value}))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="appt-duration">
                {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="appt-date" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hora *</label>
              <input type="time" value={form.time} onChange={e => setForm(f => ({...f, time: e.target.value}))} required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="appt-time" />
            </div>
          </div>
          {conflict && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">Conflicto: Ya tienes "{conflict.title}" a esta hora</p>
            </div>
          )}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-600 mb-1">Estudiante (opcional)</label>
            <input type="text" value={studentSearch} onChange={e => { setStudentSearch(e.target.value); setForm(f => ({...f, student_id: ""})); }}
              placeholder="Buscar..." className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="appt-student" />
            {students.length > 0 && !form.student_id && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-32 overflow-y-auto">
                {students.map(s => (
                  <button key={s.id} type="button" onClick={() => { setForm(f => ({...f, student_id: s.id})); setStudentSearch(`${s.name} ${s.last_name}`); setStudents([]); }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-violet-50">{s.name} {s.last_name} <span className="text-xs text-slate-400">{s.grade}</span></button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ubicación</label>
            <input type="text" value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))}
              placeholder="Ej: Consultorio, Aula 3B" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" data-testid="appt-location" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/20" rows={2} data-testid="appt-description" />
          </div>
          {!editing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Recurrencia</label>
                <select value={form.recurrence_type} onChange={e => setForm(f => ({...f, recurrence_type: e.target.value}))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20">
                  <option value="none">Sin repeticion</option><option value="weekly">Semanal</option><option value="biweekly">Quincenal</option><option value="monthly">Mensual</option>
                </select>
              </div>
              {form.recurrence_type !== "none" && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Repetir hasta</label>
                  <input type="date" value={form.recurrence_end_date} onChange={e => setForm(f => ({...f, recurrence_end_date: e.target.value}))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
                </div>
              )}
            </div>
          )}
          <button type="submit" disabled={saving || !form.title}
            className="w-full py-2.5 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50"
            data-testid="save-appt-btn">
            {saving ? "Guardando..." : editing ? "Guardar Cambios" : "Crear Cita"}
          </button>
        </form>
      </div>
    </div>
  );
}
