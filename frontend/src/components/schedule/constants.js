import { Calendar, FileText } from "lucide-react";

// Exam types configuration
export const EXAM_TYPES = [
  { id: "parcial", label: "Parcial", color: "#6366F1", icon: "📝" },
  { id: "final", label: "Final", color: "#DC2626", icon: "📋" },
  { id: "práctica", label: "Práctica", color: "#059669", icon: "✍️" },
  { id: "quiz", label: "Quiz", color: "#F59E0B", icon: "⚡" }
];

// Tab configurations (only Clases and Exámenes)
export const SCHEDULE_TABS = [
  { id: "clases", label: "Horario de Clases", icon: Calendar, description: "Horarios por grado y sección" },
  { id: "examenes", label: "Horario de Exámenes", icon: FileText, description: "Calendario de evaluaciones" }
];

// All days of the week (full list)
export const ALL_DAYS = [
  { id: "lunes", label: "Lunes", short: "Lun" },
  { id: "martes", label: "Martes", short: "Mar" },
  { id: "miercoles", label: "Miércoles", short: "Mié" },
  { id: "jueves", label: "Jueves", short: "Jue" },
  { id: "viernes", label: "Viernes", short: "Vie" },
  { id: "sabado", label: "Sábado", short: "Sáb" },
  { id: "domingo", label: "Domingo", short: "Dom" }
];

// Function to get visible days based on settings
export const getVisibleDays = (settings) => {
  let days = ALL_DAYS.slice(0, 5); // Lunes a Viernes por defecto
  if (settings?.include_saturday) {
    days = [...days, ALL_DAYS[5]];
  }
  if (settings?.include_sunday) {
    days = [...days, ALL_DAYS[6]];
  }
  return days;
};

// Color palette for subjects
export const SUBJECT_COLORS = [
  { name: "Azul", value: "#3B82F6", bg: "bg-blue-500", light: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
  { name: "Verde", value: "#10B981", bg: "bg-emerald-500", light: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300" },
  { name: "Naranja", value: "#F59E0B", bg: "bg-amber-500", light: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
  { name: "Rojo", value: "#EF4444", bg: "bg-red-500", light: "bg-red-100", text: "text-red-700", border: "border-red-300" },
  { name: "Morado", value: "#8B5CF6", bg: "bg-violet-500", light: "bg-violet-100", text: "text-violet-700", border: "border-violet-300" },
  { name: "Rosa", value: "#EC4899", bg: "bg-pink-500", light: "bg-pink-100", text: "text-pink-700", border: "border-pink-300" },
  { name: "Cyan", value: "#06B6D4", bg: "bg-cyan-500", light: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-300" },
  { name: "Índigo", value: "#6366F1", bg: "bg-indigo-500", light: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-300" },
  { name: "Teal", value: "#14B8A6", bg: "bg-teal-500", light: "bg-teal-100", text: "text-teal-700", border: "border-teal-300" },
  { name: "Slate", value: "#64748B", bg: "bg-slate-500", light: "bg-slate-100", text: "text-slate-700", border: "border-slate-300" }
];

// Break types configuration
export const BREAK_TYPES = [
  { id: "break", label: "Recreo", icon: "☕", color: "#FCD34D", bgClass: "bg-yellow-100", textClass: "text-yellow-700", borderClass: "border-yellow-400" },
  { id: "lunch", label: "Almuerzo", icon: "🍽️", color: "#FB923C", bgClass: "bg-orange-100", textClass: "text-orange-700", borderClass: "border-orange-400" },
  { id: "event", label: "Evento", icon: "🎉", color: "#60A5FA", bgClass: "bg-blue-100", textClass: "text-blue-700", borderClass: "border-blue-400" }
];
