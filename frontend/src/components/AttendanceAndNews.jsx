import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { CheckCircle, AlertTriangle, XCircle, TrendingUp, Newspaper, Clock, Pin } from "lucide-react";

const attendanceData = [
  { name: "Presentes", value: 89, color: "#10b981" },
  { name: "Tardanzas", value: 7, color: "#e1b82c" },
  { name: "Ausentes", value: 4, color: "#ef4444" },
];

const legendItems = [
  { label: "Presentes", value: "89%", icon: CheckCircle, color: "text-emerald-500" },
  { label: "Tardanzas", value: "7%", icon: AlertTriangle, color: "text-[#e1b82c]" },
  { label: "Ausentes", value: "4%", icon: XCircle, color: "text-red-500" },
];

// Helper function to format relative time
function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `Hace ${diffMins} minutos`;
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// Helper function to get tag info based on news category
function getTagInfo(news) {
  if (news.pinned) {
    return { tag: "Destacado", tagColor: "bg-[#e1b82c] text-[#001f4b]" };
  }
  
  const categoryMap = {
    announcement: { tag: "Anuncio", tagColor: "bg-[#001f4b] text-white" },
    academic: { tag: "Académico", tagColor: "bg-[#5c85d6]/15 text-[#5c85d6]" },
    event: { tag: "Evento", tagColor: "bg-emerald-100 text-emerald-700" },
    achievement: { tag: "Logro", tagColor: "bg-amber-100 text-amber-700" },
    sports: { tag: "Deportes", tagColor: "bg-orange-100 text-orange-700" },
    cultural: { tag: "Cultural", tagColor: "bg-purple-100 text-purple-700" },
    administrative: { tag: "Administrativo", tagColor: "bg-slate-100 text-slate-600" },
  };
  
  return categoryMap[news.category] || { tag: "Aviso", tagColor: "bg-slate-100 text-slate-600" };
}

// Default announcements for when no news is available
const defaultAnnouncements = [
  {
    id: 1,
    title: "Inscripciones abiertas para talleres extracurriculares",
    time: "Hace 2 horas",
    tag: "Nuevo",
    tagColor: "bg-[#001f4b] text-white",
  },
  {
    id: 2,
    title: "Cambio de horario: Educación Física pasa a viernes",
    time: "Hace 5 horas",
    tag: "Importante",
    tagColor: "bg-[#e1b82c] text-[#001f4b]",
  },
  {
    id: 3,
    title: "Resultados del concurso de ortografía publicados",
    time: "Ayer",
    tag: "Académico",
    tagColor: "bg-[#5c85d6]/15 text-[#5c85d6]",
  },
  {
    id: 4,
    title: "Reunión de coordinadores reprogramada al jueves",
    time: "Hace 2 días",
    tag: "Aviso",
    tagColor: "bg-slate-100 text-slate-600",
  },
];

export default function AttendanceAndNews({ news = [] }) {
  // Use real news if available, otherwise show defaults
  const displayNews = news.length > 0 ? news.slice(0, 4) : defaultAnnouncements;
  const hasRealNews = news.length > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="attendance-news-panel">
      {/* Attendance Chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-testid="attendance-chart">
        <div className="flex items-center justify-between mb-2">
          <h3
            className="text-base font-bold text-[#001f4b]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Asistencia del Mes
          </h3>
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
            <TrendingUp className="w-3.5 h-3.5" /> +2.3%
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-4">Febrero 2026 — Resumen general</p>

        <div className="flex items-center gap-6">
          <div className="w-36 h-36 relative flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={62}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {attendanceData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-[#001f4b]" style={{ fontFamily: "Manrope, sans-serif" }}>
                89%
              </span>
              <span className="text-[10px] text-slate-400 font-medium">asistencia</span>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {legendItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-sm text-slate-600">{item.label}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-800">{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Announcements */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-testid="announcements-panel">
        <div className="flex items-center justify-between mb-1">
          <h3
            className="text-base font-bold text-[#001f4b]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Noticias y Avisos
          </h3>
          {hasRealNews && (
            <span className="text-xs text-[#5c85d6] font-medium px-2 py-1 bg-[#5c85d6]/10 rounded-lg">
              {news.length} {news.length === 1 ? 'noticia' : 'noticias'}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-4">
          {hasRealNews ? "Comunicados recientes" : "Comunicados recientes del colegio"}
        </p>

        <div className="space-y-3">
          {hasRealNews ? (
            // Show real news
            displayNews.map((item) => {
              const { tag, tagColor } = getTagInfo(item);
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                  data-testid={`announcement-${item.id}`}
                >
                  <div className="w-1 h-full min-h-[40px] rounded-full bg-[#001f4b]/10 group-hover:bg-[#e1b82c] transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {item.pinned && (
                        <Pin className="w-3 h-3 text-[#e1b82c]" />
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tagColor}`}>
                        {tag}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(item.published_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            // Show default announcements
            displayNews.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                data-testid={`announcement-${item.id}`}
              >
                <div className="w-1 h-full min-h-[40px] rounded-full bg-[#001f4b]/10 group-hover:bg-[#e1b82c] transition-colors flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 leading-snug">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.tagColor}`}>
                      {item.tag}
                    </span>
                    <span className="text-[11px] text-slate-400">{item.time}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {hasRealNews && news.length > 4 && (
          <button className="w-full mt-4 py-2 text-sm font-medium text-[#5c85d6] hover:text-[#001f4b] hover:bg-slate-50 rounded-lg transition-colors">
            Ver todas las noticias →
          </button>
        )}
      </div>
    </div>
  );
}
