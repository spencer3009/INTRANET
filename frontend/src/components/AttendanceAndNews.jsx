import { useState, useEffect } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { CheckCircle, AlertTriangle, XCircle, TrendingUp, TrendingDown, Newspaper, Clock, Pin, X, Calendar, User, Loader2, Megaphone } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

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

// Helper function to format full date
function formatFullDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { 
    weekday: "long", 
    day: "numeric", 
    month: "long", 
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Helper function to get tag info based on news category
function getTagInfo(news) {
  if (news.pinned) {
    return { tag: "Destacado", tagColor: "bg-[#e1b82c] text-[#001f4b]" };
  }
  
  const categoryMap = {
    announcement: { tag: "Anuncio", tagColor: "bg-[#5c85d6] text-white" },
    academic: { tag: "Académico", tagColor: "bg-[#5c85d6]/15 text-[#5c85d6]" },
    event: { tag: "Evento", tagColor: "bg-emerald-100 text-emerald-700" },
    achievement: { tag: "Logro", tagColor: "bg-amber-100 text-amber-700" },
    sports: { tag: "Deportes", tagColor: "bg-orange-100 text-orange-700" },
    cultural: { tag: "Cultural", tagColor: "bg-purple-100 text-purple-700" },
    administrative: { tag: "Administrativo", tagColor: "bg-slate-100 text-slate-600" },
  };
  
  return categoryMap[news.category] || { tag: "Aviso", tagColor: "bg-slate-100 text-slate-600" };
}

// Category color accents for the modal
const categoryAccents = {
  announcement: { gradient: "from-[#5c85d6] to-[#7c9fe6]", iconBg: "bg-[#5c85d6]" },
  academic: { gradient: "from-[#5c85d6] to-[#8baaf0]", iconBg: "bg-[#5c85d6]" },
  event: { gradient: "from-[#10b981] to-[#34d399]", iconBg: "bg-emerald-500" },
  achievement: { gradient: "from-[#e1b82c] to-[#fbbf24]", iconBg: "bg-amber-500" },
  sports: { gradient: "from-[#f97316] to-[#fb923c]", iconBg: "bg-orange-500" },
  cultural: { gradient: "from-[#a855f7] to-[#c084fc]", iconBg: "bg-purple-500" },
  administrative: { gradient: "from-[#64748b] to-[#94a3b8]", iconBg: "bg-slate-500" },
};

// News Detail Modal
function NewsDetailModal({ news, onClose }) {
  if (!news) return null;
  
  const { tag, tagColor } = news.tag ? { tag: news.tag, tagColor: news.tagColor } : getTagInfo(news);
  const accent = categoryAccents[news.category] || categoryAccents.announcement;
  
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" data-testid="news-modal">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Colored accent bar */}
        <div className={`h-1.5 bg-gradient-to-r ${accent.gradient}`} />
        
        {/* Header */}
        <div className="px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`w-10 h-10 rounded-xl ${accent.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Newspaper className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {news.pinned && <Pin className="w-3.5 h-3.5 text-[#e1b82c]" />}
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${tagColor}`}>
                    {tag}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-[#001f4b] leading-snug" style={{ fontFamily: "Manrope, sans-serif" }}>
                  {news.title}
                </h2>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
              data-testid="news-modal-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Meta info */}
          <div className="flex items-center gap-3 mt-3 ml-[52px] text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {news.published_at ? formatFullDate(news.published_at) : news.time}
            </span>
            {news.author_name && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {news.author_name}
              </span>
            )}
          </div>
        </div>
        
        {/* Divider */}
        <div className="mx-6 border-t border-slate-100" />
        
        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto max-h-[50vh]">
          {news.image_url && (
            <img 
              src={news.image_url} 
              alt={news.title}
              className="w-full h-44 object-cover rounded-xl mb-5 border border-slate-100"
            />
          )}
          
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
            {news.content || news.excerpt || "No hay contenido adicional disponible."}
          </p>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100">
          <button
            onClick={onClose}
            className={`w-full py-2.5 bg-gradient-to-r ${accent.gradient} hover:opacity-90 text-white rounded-xl text-sm font-semibold transition-opacity`}
            data-testid="news-modal-close-btn"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AttendanceAndNews({ news = [], token }) {
  const [selectedNews, setSelectedNews] = useState(null);
  const [attData, setAttData] = useState(null);
  const [attLoading, setAttLoading] = useState(true);

  useEffect(() => {
    if (!token) { setAttLoading(false); return; }
    const headers = { Authorization: `Bearer ${token}` };
    axios.get(`${API}/api/dashboard/current-month-attendance`, { headers })
      .then(r => setAttData(r.data))
      .catch(() => {})
      .finally(() => setAttLoading(false));
  }, [token]);

  // Only show real news from the backend. If the school hasn't
  // published any, render an empty state instead of hard-coded mock
  // announcements to avoid confusing students with fake content.
  const displayNews = news.slice(0, 4);
  const hasRealNews = news.length > 0;

  // Build chart data from real attendance
  const presentPct = attData?.present_pct || 0;
  const latePct = attData?.late_pct || 0;
  const absentPct = attData?.absent_pct || 0;
  const hasAttData = attData && attData.total_records > 0;
  const trend = attData?.trend || 0;
  const isPositive = trend >= 0;

  const chartData = hasAttData ? [
    { name: "Presentes", value: presentPct, color: "#10b981" },
    { name: "Tardanzas", value: latePct, color: "#e1b82c" },
    { name: "Ausentes", value: absentPct, color: "#ef4444" },
  ] : [
    { name: "Sin datos", value: 100, color: "#e2e8f0" },
  ];

  const legendItemsReal = [
    { label: "Presentes", value: `${presentPct}%`, icon: CheckCircle, color: "text-emerald-500" },
    { label: "Tardanzas", value: `${latePct}%`, icon: AlertTriangle, color: "text-[#e1b82c]" },
    { label: "Ausentes", value: `${absentPct}%`, icon: XCircle, color: "text-red-500" },
  ];

  return (
    <>
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
            {hasAttData && (
            <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg ${isPositive ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
              {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {isPositive ? "+" : ""}{trend}%
            </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-4">
            {attData ? `${attData.month_name} ${attData.year}` : "Cargando..."} — {hasAttData ? `${attData.total_records} registros` : "Resumen general"}
          </p>

          {attLoading ? (
            <div className="flex items-center justify-center h-36">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
          ) : (
          <div className="flex items-center gap-6">
            <div className="w-36 h-36 relative flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={62}
                    paddingAngle={hasAttData ? 4 : 0}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-[#001f4b]" style={{ fontFamily: "Manrope, sans-serif" }}>
                  {hasAttData ? `${presentPct}%` : "—"}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">asistencia</span>
              </div>
            </div>

            <div className="flex-1 space-y-3">
              {hasAttData ? legendItemsReal.map((item) => {
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
              }) : (
                <p className="text-sm text-slate-400 text-center">No hay registros de asistencia este mes</p>
              )}
            </div>
          </div>
          )}
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
                    onClick={() => setSelectedNews(item)}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                    data-testid={`announcement-${item.id}`}
                  >
                    <div className="w-1 h-full min-h-[40px] rounded-full bg-[#001f4b]/10 group-hover:bg-[#e1b82c] transition-colors flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2 group-hover:text-[#001f4b]">{item.title}</p>
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
              // Empty state — no real news published yet by the school
              <div className="flex flex-col items-center justify-center py-10 text-center" data-testid="news-empty-state">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <Megaphone className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600">Aún no hay comunicados</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
                  Cuando el colegio publique noticias o avisos, los verás aquí.
                </p>
              </div>
            )}
          </div>

          {hasRealNews && news.length > 4 && (
            <button className="w-full mt-4 py-2 text-sm font-medium text-[#5c85d6] hover:text-[#001f4b] hover:bg-slate-50 rounded-lg transition-colors">
              Ver todas las noticias →
            </button>
          )}
        </div>
      </div>
      
      {/* News Detail Modal */}
      {selectedNews && (
        <NewsDetailModal news={selectedNews} onClose={() => setSelectedNews(null)} />
      )}
    </>
  );
}
