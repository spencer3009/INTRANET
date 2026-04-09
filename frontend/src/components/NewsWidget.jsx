import { useState } from "react";
import { Newspaper, Clock, ChevronRight, Pin, X, Calendar, User } from "lucide-react";

const MOCK_NEWS = [
  {
    id: "n1",
    title: "Inscripciones abiertas para talleres extracurriculares",
    content: "Se informa a toda la comunidad educativa que las inscripciones para los talleres extracurriculares del año escolar 2026 ya están abiertas. Los interesados pueden acercarse a secretaría.",
    category: "announcement",
    pinned: true,
    published_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    author_name: "Dirección",
  },
  {
    id: "n2",
    title: "Cambio de horario: Educación Física pasa a viernes",
    content: "Por disposición de la coordinación académica, las clases de Educación Física se trasladarán al día viernes a partir de la próxima semana.",
    category: "academic",
    pinned: false,
    published_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    author_name: "Coordinación",
  },
  {
    id: "n3",
    title: "Resultados del concurso de ortografía publicados",
    content: "Ya están disponibles los resultados del concurso de ortografía. Felicitamos a todos los participantes.",
    category: "achievement",
    pinned: false,
    published_at: new Date(Date.now() - 86400000).toISOString(),
    author_name: "Académica",
  },
];

const CATEGORY_STYLES = {
  announcement: { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700" },
  academic: { dot: "bg-indigo-500", badge: "bg-indigo-100 text-indigo-700" },
  event: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  achievement: { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700" },
  sports: { dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700" },
  cultural: { dot: "bg-purple-500", badge: "bg-purple-100 text-purple-700" },
  administrative: { dot: "bg-slate-500", badge: "bg-slate-100 text-slate-600" },
};

const CATEGORY_LABELS = {
  announcement: "Anuncio",
  academic: "Académico",
  event: "Evento",
  achievement: "Logro",
  sports: "Deportes",
  cultural: "Cultural",
  administrative: "Admin",
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return new Date(dateStr).toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

function NewsDetailModal({ item, onClose }) {
  if (!item) return null;
  const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.announcement;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" data-testid="news-detail-modal">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className={`h-1.5 ${style.dot.replace("bg-", "bg-gradient-to-r from-")} to-slate-200`} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {item.pinned && <Pin className="w-3.5 h-3.5 text-amber-500" />}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                  {CATEGORY_LABELS[item.category] || "Noticia"}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-800 leading-snug">{item.title}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" data-testid="news-detail-close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(item.published_at).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })}</span>
            {item.author_name && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{item.author_name}</span>}
          </div>
        </div>
        <div className="border-t border-slate-100 mx-5" />
        <div className="p-5 overflow-y-auto max-h-[50vh]">
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{item.content}</p>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <button onClick={onClose} className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold transition-colors" data-testid="news-detail-close-btn">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function NewsWidget({ news = [] }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const items = news.length > 0 ? news.slice(0, 3) : MOCK_NEWS;
  const isMock = news.length === 0;

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-full flex flex-col" data-testid="news-widget">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Newspaper className="w-4 h-4 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-800 text-sm">Noticias</h3>
          </div>
          {isMock && (
            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">DEMO</span>
          )}
        </div>

        <div className="flex-1 divide-y divide-slate-100">
          {items.map((item) => {
            const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.announcement;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors flex items-start gap-3 group"
                data-testid={`news-item-${item.id}`}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 line-clamp-1 group-hover:text-slate-900">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {item.pinned && <Pin className="w-3 h-3 text-amber-500" />}
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(item.published_at)}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 mt-1 flex-shrink-0 transition-colors" />
              </button>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <button className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1" data-testid="news-view-all">
            Ver todas las noticias <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {selectedItem && <NewsDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </>
  );
}
