import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Video, FolderOpen, Search, X, Loader2, Play, Clock,
  ChevronDown, ArrowLeft, GraduationCap
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CAT_COLORS = [
  "bg-emerald-500", "bg-blue-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-teal-500",
];

function VideoPlayerModal({ video, onClose }) {
  if (!video) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col" data-testid="portal-video-player">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 flex-shrink-0">
          <button onClick={onClose} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <span className="text-sm font-medium text-slate-400">Reproduciendo tutorial</span>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingTop: "56.25%" }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={video.title}
            />
          </div>
          <div className="mt-5">
            <h2 className="text-xl font-bold text-slate-800">{video.title}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {video.category_name && (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">{video.category_name}</span>
              )}
              {video.subcategory_name && (
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">{video.subcategory_name}</span>
              )}
              {video.duration && (
                <span className="flex items-center gap-1 text-xs text-slate-400"><Clock className="w-3 h-3" />{video.duration}</span>
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

export default function AcademiaPortalPage({ token }) {
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
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, []);

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
    } catch {} finally { setLoadingVideos(false); }
  }, [selectedCat, selectedSub, searchActive, searchText]);

  useEffect(() => { loadVideos(); }, [selectedCat, selectedSub, searchActive, searchText]);

  const handleSelectCat = (cat) => {
    setSelectedCat(cat);
    setSelectedSub(null);
    setSearchActive(false);
    setSearchText("");
  };

  const handleSelectSub = (sub) => {
    if (selectedSub?.id === sub.id) {
      setSelectedSub(null); // deselect
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

  return (
    <div className="space-y-5" data-testid="academia-portal-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Academia</h1>
            <p className="text-xs text-slate-400">Tutoriales de la plataforma</p>
          </div>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={searchText} onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar tutoriales por titulo o categoria..."
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300"
            data-testid="portal-search" />
          {searchText && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
      ) : categories.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Video className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm text-slate-500 font-medium">Sin videos disponibles</p>
          <p className="text-xs text-slate-400 mt-1">Aun no hay tutoriales publicados</p>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* Left: Categories Panel (desktop) */}
          <div className="w-[272px] flex-shrink-0 hidden lg:block">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden sticky top-24" data-testid="portal-categories-panel">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Categorias</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{stats.total_categories} categorias · {stats.total_videos} videos</p>
              </div>
              <div className="max-h-[65vh] overflow-y-auto">
                {categories.map((cat, idx) => {
                  const isActive = !searchActive && selectedCat?.id === cat.id;
                  const hasSubs = cat.subcategories?.length > 0;
                  return (
                    <div key={cat.id}>
                      <button onClick={() => handleSelectCat(cat)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-all ${
                          isActive ? "bg-emerald-50" : "hover:bg-slate-50"
                        }`} data-testid={`portal-cat-${cat.id}`}>
                        <div className={`w-[30px] h-[30px] ${CAT_COLORS[idx % CAT_COLORS.length]} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <FolderOpen className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className={`text-sm flex-1 truncate ${isActive ? "font-semibold text-emerald-800" : "font-medium text-slate-700"}`}>{cat.name}</span>
                        <span className="text-[11px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">{cat.video_count}</span>
                        {hasSubs && (
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isActive ? "rotate-180" : ""}`} />
                        )}
                      </button>
                      {/* Subcategories */}
                      {isActive && hasSubs && (
                        <div className="border-b border-slate-100">
                          {cat.subcategories.map(sub => {
                            const subActive = selectedSub?.id === sub.id;
                            return (
                              <button key={sub.id} onClick={() => handleSelectSub(sub)}
                                className={`w-full text-left pl-14 pr-4 py-2 flex items-center gap-2 text-[12px] transition-colors ${
                                  subActive ? "bg-emerald-100/60 text-emerald-700 font-semibold" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                }`} data-testid={`portal-sub-${sub.id}`}>
                                <span className="flex-1">{sub.name}</span>
                                <span className="text-[10px] text-slate-400">{sub.video_count}</span>
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

          {/* Mobile category selector */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-4 py-2 overflow-x-auto flex gap-2" style={{ display: "none" }}>
            {/* Will be shown via media query if needed */}
          </div>

          {/* Right: Videos Grid */}
          <div className="flex-1 min-w-0">
            {/* Panel header */}
            <div className="mb-4">
              {searchActive ? (
                <div>
                  <p className="text-lg font-bold text-slate-800">
                    Resultados: "<span className="text-emerald-600">{searchText}</span>"
                  </p>
                  <p className="text-xs text-slate-400">{videos.length} video{videos.length !== 1 ? "s" : ""}</p>
                </div>
              ) : selectedCat ? (
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 ${CAT_COLORS[categories.indexOf(selectedCat) % CAT_COLORS.length]} rounded-lg flex items-center justify-center`}>
                    <FolderOpen className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-sm text-slate-400">
                      <span className="font-bold text-lg text-slate-800">{selectedCat.name}</span>
                      {selectedSub && (
                        <><span className="mx-1">›</span><span className="font-semibold text-emerald-600">{selectedSub.name}</span></>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{videos.length} video{videos.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Mobile category select */}
            <div className="lg:hidden mb-4">
              <select value={selectedCat?.id || ""} onChange={e => { const c = categories.find(x => x.id === e.target.value); if (c) handleSelectCat(c); }}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium" data-testid="portal-mobile-cat-select">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.video_count})</option>)}
              </select>
            </div>

            {loadingVideos ? (
              <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
            ) : videos.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Video className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-500 font-medium">
                  {searchActive ? "Sin resultados" : "Sin videos en esta seccion"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {searchActive ? `No se encontraron tutoriales para "${searchText}"` : "Esta categoria aun no tiene tutoriales publicados"}
                </p>
              </div>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(265px, 1fr))" }} data-testid="portal-videos-grid">
                {videos.map(v => (
                  <div key={v.id} onClick={() => setPlayerVideo(v)}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden cursor-pointer group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                    data-testid={`portal-video-${v.id}`}>
                    <div className="relative overflow-hidden">
                      <img src={v.thumbnail_url} alt={v.title}
                        className="w-full aspect-video object-cover bg-slate-100 group-hover:scale-[1.04] transition-transform duration-300" loading="lazy" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                          <Play className="w-5 h-5 text-slate-800 ml-0.5" />
                        </div>
                      </div>
                      {v.duration && (
                        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">{v.duration}</span>
                      )}
                    </div>
                    <div className="p-3.5">
                      <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 group-hover:text-emerald-700 transition-colors">{v.title}</h3>
                      {v.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">{v.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2.5 text-[11px] text-slate-400">
                        {v.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{v.duration}</span>}
                        {v.category_name && <span className="flex items-center gap-1"><FolderOpen className="w-3 h-3" />{v.category_name}</span>}
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
