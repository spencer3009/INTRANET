import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  X, Search, Users, GraduationCap, MessageSquare, Send,
  AlertTriangle, ChevronRight, Loader2, Mail, BellDot,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AVATAR_PALETTE = [
  "bg-gradient-to-br from-indigo-400 to-violet-500",
  "bg-gradient-to-br from-sky-400 to-blue-500",
  "bg-gradient-to-br from-emerald-400 to-teal-500",
  "bg-gradient-to-br from-amber-400 to-orange-500",
  "bg-gradient-to-br from-rose-400 to-pink-500",
  "bg-gradient-to-br from-fuchsia-400 to-purple-500",
];

function tutorInitials(name) {
  if (!name) return "??";
  return name.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function avatarBgFor(name) {
  const initials = tutorInitials(name);
  const hash = (initials.charCodeAt(0) || 0) + (initials.charCodeAt(1) || 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export default function MyTutorsDirectoryModal({ open, headers, onClose, onWriteToTutor }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ tutors: [], warnings: [], summary: {} });
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const r = await axios.get(`${API}/teacher/my-tutors`, { headers });
        if (alive) setData(r.data || { tutors: [], warnings: [], summary: {} });
      } catch (err) {
        toast.error(err.response?.data?.detail || "No se pudo cargar el directorio de tutores");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, headers]);

  const filteredTutors = useMemo(() => {
    if (!search.trim()) return data.tutors;
    const q = search.toLowerCase();
    return data.tutors.filter(t =>
      (t.tutor.name || "").toLowerCase().includes(q) ||
      (t.tutor.email || "").toLowerCase().includes(q) ||
      t.sections.some(s =>
        (s.section_name || "").toLowerCase().includes(q) ||
        (s.grade_name || "").toLowerCase().includes(q) ||
        (s.nivel_name || "").toLowerCase().includes(q)
      )
    );
  }, [data.tutors, search]);

  const filteredWarnings = useMemo(() => {
    if (!search.trim()) return data.warnings;
    const q = search.toLowerCase();
    return data.warnings.filter(w =>
      (w.section_label || "").toLowerCase().includes(q) ||
      (w.section_name || "").toLowerCase().includes(q) ||
      (w.grade_name || "").toLowerCase().includes(q) ||
      (w.nivel_name || "").toLowerCase().includes(q)
    );
  }, [data.warnings, search]);

  if (!open) return null;

  const total = data.summary?.sections_total || 0;
  const withTutor = data.summary?.sections_with_tutor || 0;

  return (
    <div
      className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[280] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
      data-testid="my-tutors-modal"
    >
      <div
        className="bg-white rounded-2xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-gradient-to-r from-indigo-50/80 via-white to-white z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Users className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-gray-900">Mis Tutores</h2>
              <p className="text-xs text-gray-500">
                {loading
                  ? "Cargando..."
                  : `${data.summary?.tutors_count || 0} tutor${data.summary?.tutors_count === 1 ? "" : "es"} · ${withTutor}/${total} salones con tutor asignado`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            data-testid="my-tutors-close"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </header>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar tutor, sección, grado o nivel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-all"
              data-testid="my-tutors-search"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-7 h-7 text-gray-300 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Cargando tutores...</p>
            </div>
          ) : (
            <>
              {filteredTutors.length === 0 && filteredWarnings.length === 0 && (
                <div className="py-16 text-center" data-testid="my-tutors-empty">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <Users className="w-7 h-7 text-indigo-500" strokeWidth={1.6} />
                  </div>
                  <p className="text-base font-semibold text-gray-900 mb-1">
                    {search ? "No hay resultados" : "No tienes tutores a quienes escribir"}
                  </p>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    {search
                      ? "Ajusta tu búsqueda para encontrar el tutor o sección que buscas."
                      : "Las secciones donde enseñas no tienen tutor asignado o eres tú quien lo es."}
                  </p>
                </div>
              )}

              {/* Tarjetas de tutores */}
              {filteredTutors.map(t => (
                <TutorCard key={t.tutor.id} entry={t} onWrite={onWriteToTutor} />
              ))}

              {/* Secciones sin tutor */}
              {filteredWarnings.length > 0 && (
                <div className="pt-4 border-t border-gray-100 mt-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700 mb-2 inline-flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Secciones sin tutor asignado ({filteredWarnings.length})
                  </p>
                  <div className="space-y-2">
                    {filteredWarnings.map(w => (
                      <div
                        key={w.section_id}
                        className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3"
                        data-testid={`no-tutor-${w.section_id}`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-4 h-4 text-amber-700" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-amber-950">{w.section_label}</p>
                          <p className="text-xs text-amber-800/80">
                            Sin tutor asignado — solicita al administrador del colegio que asigne uno antes de poder enviar mensajes.
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-500 flex items-center gap-2">
          <Mail className="w-3.5 h-3.5" />
          Mensajes privados — solo tú y el tutor del salón pueden verlos.
        </footer>
      </div>
    </div>
  );
}

function TutorCard({ entry, onWrite }) {
  const { tutor, sections, totals } = entry;
  const hasPending = (totals?.pending_replies || 0) > 0;
  const initials = tutorInitials(tutor.name);
  const avatarBg = avatarBgFor(tutor.name);

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${hasPending ? "border-indigo-300 ring-2 ring-indigo-100" : "border-gray-200"} bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-indigo-200`}
      data-testid={`tutor-card-${tutor.id}`}
    >
      <div className="p-4 sm:p-5 flex items-start gap-4">
        {/* Avatar grande */}
        {tutor.photo_url ? (
          <img
            src={tutor.photo_url}
            alt={tutor.name}
            className="w-14 h-14 rounded-full object-cover flex-shrink-0 ring-2 ring-white shadow-sm"
          />
        ) : (
          <div className={`w-14 h-14 rounded-full ${avatarBg} flex items-center justify-center text-white font-semibold text-base flex-shrink-0 ring-2 ring-white shadow-sm`}>
            {initials}
          </div>
        )}

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold tracking-tight text-gray-900 truncate">{tutor.name}</h3>
            {hasPending && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse" data-testid={`pending-badge-${tutor.id}`}>
                <BellDot className="w-3 h-3" /> {totals.pending_replies} respuesta{totals.pending_replies === 1 ? "" : "s"} nueva{totals.pending_replies === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {tutor.email && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{tutor.email}</p>
          )}

          {/* Mini-stats */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-gray-600">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              <strong className="text-gray-900 font-semibold">{sections.length}</strong> {sections.length === 1 ? "sección" : "secciones"}
            </span>
            <span className="inline-flex items-center gap-1 text-gray-600">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
              {totals.messages_sent === 0
                ? <span>Aún no le has escrito</span>
                : <span><strong className="text-gray-900 font-semibold">{totals.messages_sent}</strong> mensaje{totals.messages_sent === 1 ? "" : "s"} enviado{totals.messages_sent === 1 ? "" : "s"}</span>
              }
            </span>
          </div>
        </div>
      </div>

      {/* Secciones — una fila por sección */}
      <div className="bg-gray-50/60 border-t border-gray-100 divide-y divide-gray-100">
        {sections.map(s => (
          <div key={s.section_id} className="flex items-center gap-3 px-4 sm:px-5 py-3" data-testid={`section-row-${s.section_id}`}>
            <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-4 h-4 text-indigo-500" strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {[s.nivel_name, s.grade_name, s.section_name].filter(Boolean).join(" · ")}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                <span>{s.students_count} alumno{s.students_count === 1 ? "" : "s"}</span>
                {s.messages_sent > 0 && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span>{s.messages_sent} mensaje{s.messages_sent === 1 ? "" : "s"}</span>
                  </>
                )}
                {s.pending_replies > 0 && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-rose-600 font-semibold inline-flex items-center gap-1">
                      <BellDot className="w-3 h-3" /> {s.pending_replies} respuesta{s.pending_replies === 1 ? "" : "s"} nueva{s.pending_replies === 1 ? "" : "s"}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => onWrite({ tutor, section: s })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 active:scale-[0.97] transition-all flex-shrink-0"
              data-testid={`write-tutor-${tutor.id}-${s.section_id}`}
            >
              <Send className="w-3.5 h-3.5" /> Escribir
              <ChevronRight className="w-3.5 h-3.5 -ml-0.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
