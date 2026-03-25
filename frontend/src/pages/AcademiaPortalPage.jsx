import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Sidebar from "@/components/Sidebar";
import DashboardHeader from "@/components/DashboardHeader";
import {
  Video, FolderOpen, Search, X, Loader2, Play, Clock,
  ChevronDown, ArrowLeft, GraduationCap, BookOpen, BarChart3,
  Share2, Check, Link2
} from "lucide-react";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

async function shareVideo(video, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  const url = video.youtube_url;
  const title = video.title;
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch {}
  } else {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }
}

const CAT_COLORS = [
  { bg: "bg-emerald-500", light: "bg-emerald-50 text-emerald-700", gradient: "from-emerald-500 to-emerald-600" },
  { bg: "bg-blue-500", light: "bg-blue-50 text-blue-700", gradient: "from-blue-500 to-blue-600" },
  { bg: "bg-violet-500", light: "bg-violet-50 text-violet-700", gradient: "from-violet-500 to-violet-600" },
  { bg: "bg-amber-500", light: "bg-amber-50 text-amber-700", gradient: "from-amber-500 to-amber-600" },
  { bg: "bg-rose-500", light: "bg-rose-50 text-rose-700", gradient: "from-rose-500 to-rose-600" },
  { bg: "bg-cyan-500", light: "bg-cyan-50 text-cyan-700", gradient: "from-cyan-500 to-cyan-600" },
  { bg: "bg-fuchsia-500", light: "bg-fuchsia-50 text-fuchsia-700", gradient: "from-fuchsia-500 to-fuchsia-600" },
  { bg: "bg-teal-500", light: "bg-teal-50 text-teal-700", gradient: "from-teal-500 to-teal-600" },
];

function VideoPlayerModal({ video, onClose }) {
  if (!video) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        data-testid="portal-video-player"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            data-testid="portal-video-back-btn"
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Reproduciendo tutorial
          </span>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            data-testid="portal-video-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          <div className="relative w-full rounded-xl overflow-hidden bg-black shadow-lg" style={{ paddingTop: "56.25%" }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={video.platform === "vimeo" ? `https://player.vimeo.com/video/${video.youtube_video_id}?autoplay=1` : `https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={video.title}
            />
          </div>
          <div className="mt-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-800">{video.title}</h2>
              <button
                onClick={(e) => shareVideo(video, e)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold transition-colors"
                data-testid="portal-video-share-btn"
              >
                <Share2 className="w-3.5 h-3.5" />
                Compartir
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {video.category_name && (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                  {video.category_name}
                </span>
              )}
              {video.subcategory_name && (
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
                  {video.subcategory_name}
                </span>
              )}
              {video.duration && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  {video.duration}
                </span>
              )}
            </div>
            {video.description && (
              <p className="text-sm text-slate-600 mt-4 leading-relaxed">{video.description}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AcademiaContent({ token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [categories, setCategories] = useState([]);
  const [videos, setVideos] = useState([]);
  const [stats, setStats] = useState({ total_videos: 0, total_categories: 0 });
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [playerVideo, setPlayerVideo] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [catsRes, statsRes] = await Promise.all([
        axios.get(`${API}/academia/portal/categories`, { headers }),
        axios.get(`${API}/academia/portal/stats`, { headers }),
      ]);
      setCategories(catsRes.data);
      setStats(statsRes.data);
      if (catsRes.data.length > 0 && !selectedCat) setSelectedCat(catsRes.data[0]);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadVideos = useCallback(async () => {
    setLoadingVideos(true);
    const params = {};
    if (searchActive && searchText) {
      params.search = searchText;
    } else {
      if (selectedCat) params.category_id = selectedCat.id;
      if (selectedSub) params.subcategory_id = selectedSub.id;
    }
    try {
      const res = await axios.get(`${API}/academia/portal/videos`, { headers, params });
      setVideos(res.data);
    } catch {
    } finally {
      setLoadingVideos(false);
    }
  }, [selectedCat, selectedSub, searchActive, searchText]);

  useEffect(() => {
    loadVideos();
  }, [selectedCat, selectedSub, searchActive, searchText]);

  const handleSelectCat = (cat) => {
    setSelectedCat(cat);
    setSelectedSub(null);
    setSearchActive(false);
    setSearchText("");
  };

  const handleSelectSub = (sub) => {
    if (selectedSub?.id === sub.id) {
      setSelectedSub(null);
    } else {
      setSelectedSub(sub);
    }
  };

  const handleSearch = (val) => {
    setSearchText(val);
    if (val.trim()) {
      setSearchActive(true);
    } else {
      setSearchActive(false);
    }
  };

  const clearSearch = () => {
    setSearchText("");
    setSearchActive(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div data-testid="academia-portal-page">
      {/* Hero Banner — Navy oscuro con acentos dorados (marca EduNet) */}
      <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8 mb-5 shadow-lg" style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #1a2744 100%)" }}>
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#FBBF24] rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FBBF24] rounded-full translate-y-1/2 -translate-x-1/4" />
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#FBBF24]/15 rounded-2xl flex items-center justify-center border border-[#FBBF24]/25">
              <GraduationCap className="w-7 h-7 text-[#FBBF24]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight" data-testid="academia-hero-title">
                Academia EduNet
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Video tutoriales para dominar la plataforma
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 bg-white/5 rounded-xl px-4 py-2.5 border border-[#FBBF24]/20">
              <Video className="w-4 h-4 text-[#FBBF24]" />
              <div>
                <p className="text-xl font-bold text-[#FBBF24] leading-none" data-testid="academia-stat-videos">{stats.total_videos}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Videos</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 bg-white/5 rounded-xl px-4 py-2.5 border border-[#FBBF24]/20">
              <FolderOpen className="w-4 h-4 text-[#FBBF24]" />
              <div>
                <p className="text-xl font-bold text-[#FBBF24] leading-none" data-testid="academia-stat-categories">{stats.total_categories}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Categorias</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar — Separada del banner, fondo blanco */}
      <div className="relative mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchText}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar tutoriales por titulo, descripcion o categoria..."
          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FBBF24]/30 focus:border-[#FBBF24]/50 transition-all shadow-sm"
          data-testid="portal-search"
        />
        {searchText && (
          <button
            onClick={clearSearch}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            data-testid="portal-search-clear"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Video className="w-9 h-9 text-slate-300" />
          </div>
          <p className="text-base text-slate-500 font-semibold">Sin videos disponibles</p>
          <p className="text-sm text-slate-400 mt-1">Aun no hay tutoriales publicados</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Left: Categories Panel (desktop) */}
          <div className="w-[280px] flex-shrink-0 hidden lg:block">
            <div
              className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden sticky top-24 shadow-sm"
              data-testid="portal-categories-panel"
            >
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-slate-500" />
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Categorias</p>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {stats.total_categories} categorias &middot; {stats.total_videos} videos
                </p>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {categories.map((cat, idx) => {
                  const isActive = !searchActive && selectedCat?.id === cat.id;
                  const hasSubs = cat.subcategories?.length > 0;
                  const color = CAT_COLORS[idx % CAT_COLORS.length];
                  return (
                    <div key={cat.id}>
                      <button
                        onClick={() => handleSelectCat(cat)}
                        className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-all duration-150 ${
                          isActive
                            ? "bg-emerald-50 border-l-[3px] border-l-emerald-500"
                            : "hover:bg-slate-50/80 border-l-[3px] border-l-transparent"
                        }`}
                        data-testid={`portal-cat-${cat.id}`}
                      >
                        <div
                          className={`w-8 h-8 ${color.bg} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span
                          className={`text-sm flex-1 truncate ${
                            isActive ? "font-bold text-emerald-800" : "font-medium text-slate-700"
                          }`}
                        >
                          {cat.name}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                            isActive
                              ? "bg-emerald-200/60 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {cat.video_count}
                        </span>
                        {hasSubs && (
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                              isActive ? "rotate-180" : ""
                            }`}
                          />
                        )}
                      </button>
                      {isActive && hasSubs && (
                        <div className="bg-emerald-50/30 border-b border-slate-100">
                          {cat.subcategories.map((sub) => {
                            const subActive = selectedSub?.id === sub.id;
                            return (
                              <button
                                key={sub.id}
                                onClick={() => handleSelectSub(sub)}
                                className={`w-full text-left pl-[52px] pr-4 py-2.5 flex items-center gap-2 text-[12px] transition-all duration-150 ${
                                  subActive
                                    ? "bg-emerald-100/70 text-emerald-800 font-bold"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                }`}
                                data-testid={`portal-sub-${sub.id}`}
                              >
                                <div className={`w-1.5 h-1.5 rounded-full ${subActive ? "bg-emerald-500" : "bg-slate-300"}`} />
                                <span className="flex-1">{sub.name}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{sub.video_count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Videos Grid */}
          <div className="flex-1 min-w-0">
            {/* Section header */}
            <div className="mb-5">
              {searchActive ? (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Search className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800">
                      Resultados: &ldquo;<span className="text-emerald-600">{searchText}</span>&rdquo;
                    </p>
                    <p className="text-xs text-slate-400">
                      {videos.length} video{videos.length !== 1 ? "s" : ""} encontrado{videos.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              ) : selectedCat ? (
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 ${
                      CAT_COLORS[categories.indexOf(selectedCat) % CAT_COLORS.length].bg
                    } rounded-lg flex items-center justify-center shadow-sm`}
                  >
                    <FolderOpen className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-slate-800">{selectedCat.name}</span>
                      {selectedSub && (
                        <>
                          <ChevronDown className="w-3 h-3 text-slate-400 -rotate-90" />
                          <span className="text-sm font-semibold text-emerald-600">{selectedSub.name}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {videos.length} video{videos.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Mobile category select */}
            <div className="lg:hidden mb-4">
              <select
                value={selectedCat?.id || ""}
                onChange={(e) => {
                  const c = categories.find((x) => x.id === e.target.value);
                  if (c) handleSelectCat(c);
                }}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300"
                data-testid="portal-mobile-cat-select"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.video_count})
                  </option>
                ))}
              </select>
            </div>

            {loadingVideos ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Video className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-sm text-slate-500 font-semibold">
                  {searchActive ? "Sin resultados" : "Sin videos en esta seccion"}
                </p>
                <p className="text-xs text-slate-400 mt-1.5">
                  {searchActive
                    ? `No se encontraron tutoriales para "${searchText}"`
                    : "Esta categoria aun no tiene tutoriales publicados"}
                </p>
              </div>
            ) : (
              <div
                className="grid gap-5"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }}
                data-testid="portal-videos-grid"
              >
                {videos.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setPlayerVideo(v)}
                    className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden cursor-pointer group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm"
                    data-testid={`portal-video-${v.id}`}
                  >
                    <div className="relative overflow-hidden">
                      <img
                        src={v.thumbnail_url}
                        alt={v.title}
                        className="w-full aspect-video object-cover bg-slate-100 group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      {/* Hover overlay with play button */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="w-14 h-14 bg-white/95 rounded-full flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-transform duration-300">
                          <Play className="w-6 h-6 text-emerald-700 ml-0.5" />
                        </div>
                      </div>
                      {/* Duration badge */}
                      {v.duration && (
                        <span className="absolute bottom-2.5 right-2.5 bg-black/80 text-white text-[10px] font-mono px-2 py-1 rounded-md backdrop-blur-sm">
                          {v.duration}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-bold text-slate-800 line-clamp-2 group-hover:text-emerald-700 transition-colors duration-200 leading-snug">
                        {v.title}
                      </h3>
                      {v.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                          {v.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          {v.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {v.duration}
                            </span>
                          )}
                          {v.category_name && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-medium">
                              {v.category_name}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => shareVideo(v, e)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Compartir video"
                          data-testid={`portal-video-share-${v.id}`}
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <VideoPlayerModal video={playerVideo} onClose={() => setPlayerVideo(null)} />
    </div>
  );
}

export default function AcademiaPortalPage({ user, token, subdomain, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    axios.get(`${API}/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setSettings(res.data))
      .catch(() => {});
  }, [token]);

  // ChatPal widget - CSS visibility approach (bulletproof for SPA)
  useEffect(() => {
    // Add class to body to make ChatPal visible via CSS
    document.body.classList.add("chatpal-active");

    // Load script only once globally (it persists, CSS controls visibility)
    const SCRIPT_ID = "chatpal-script";
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://chatterpal.me/build/js/chatpal.js?8.3";
      script.integrity = "sha384-+YIWcPZjPZYuhrEm13vJJg76TIO/g7y5B14VE35zhQdrojfD9dPemo7q6vnH44FR";
      script.crossOrigin = "anonymous";
      script.setAttribute("data-cfasync", "false");
      script.onload = () => {
        if (window.ChatPal) {
          new window.ChatPal({
            embedId: "rtg8Y2d7NE7C",
            remoteBaseUrl: "https://chatterpal.me/",
            version: "8.3"
          });
        }
      };
      document.body.appendChild(script);
    }

    return () => {
      document.body.classList.remove("chatpal-active");
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]" data-testid="academia-portal-container">
      <Sidebar
        active="academia"
        onNavigate={() => {}}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLogout={onLogout}
        schoolName={settings?.system_name}
        subdomain={subdomain}
        token={token}
        user={user}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={onLogout}
          logoUrl={settings?.logo_url}
          schoolName={settings?.system_name}
          subdomain={subdomain}
          token={token}
        />

        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 pb-20 lg:pb-8 overflow-y-auto custom-scroll">
          <AcademiaContent token={token} />
        </main>
      </div>
    </div>
  );
}
