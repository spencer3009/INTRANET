import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import MobileBottomNav from "../components/MobileBottomNav";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  Trophy, Loader2, BookOpen, TrendingUp, ChevronDown, ChevronUp,
  User, Star, BarChart3, Target, Award
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

function getGradeColor(score, maxScore = 20) {
  const pct = (score / maxScore) * 100;
  if (pct >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (pct >= 60) return "text-blue-600 bg-blue-50 border-blue-200";
  if (pct >= 40) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}

export default function ParentGradesPage({ user, token, onLogout }) {
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [expandedCourse, setExpandedCourse] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const loadGradesForChild = async (childId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/parent/grades?student_id=${childId}`, { headers });
      setGrades(res.data.grades || []);
    } catch (err) {
      console.error("Error loading grades:", err);
      setGrades([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [profileRes, settingsRes] = await Promise.all([
          axios.get(`${API}/api/parent/me`, { headers }),
          axios.get(`${API}/api/settings/public/${subdomain}`, { headers }).catch(() => ({ data: null }))
        ]);
        if (settingsRes.data) setSettings(settingsRes.data);
        const childrenList = profileRes.data.children || [];
        setChildren(childrenList);
        if (childrenList.length > 0) {
          const savedId = localStorage.getItem('selected_child_id');
          const child = childrenList.find(c => c.id === savedId) || childrenList[0];
          setSelectedChild(child);
          localStorage.setItem('selected_child_id', child.id);
          await loadGradesForChild(child.id);
        } else { setLoading(false); }
      } catch (err) { console.error("Error:", err); setLoading(false); }
    };
    init();
  }, [token]);

  const handleChildChange = async (newChild) => {
    if (!newChild || newChild.id === selectedChild?.id) return;
    setSelectedChild(newChild);
    localStorage.setItem('selected_child_id', newChild.id);
    await loadGradesForChild(newChild.id);
  };

  const schoolName = settings?.system_name || user?.school_name || "Portal Padres";
  const logoUrl = settings?.logo_url;

  // Group grades by course/subject
  const groupedGrades = useMemo(() => {
    const groups = {};
    grades.forEach(g => {
      const key = g.subject_name || g.course_name || "Sin curso";
      if (!groups[key]) groups[key] = { name: key, color: g.color || "#3B82F6", grades: [], teacher: g.teacher_name };
      groups[key].grades.push(g);
    });
    return Object.values(groups).map(group => {
      const validGrades = group.grades.filter(g => g.score != null);
      const avg = validGrades.length > 0
        ? validGrades.reduce((sum, g) => sum + g.score, 0) / validGrades.length
        : null;
      return { ...group, average: avg, count: group.grades.length };
    });
  }, [grades]);

  const generalAverage = useMemo(() => {
    const avgs = groupedGrades.filter(g => g.average != null).map(g => g.average);
    return avgs.length > 0 ? (avgs.reduce((s, a) => s + a, 0) / avgs.length).toFixed(1) : null;
  }, [groupedGrades]);

  return (
    <div className="min-h-screen bg-slate-50 flex" data-testid="parent-grades-page">
      <ParentSidebar active="calificaciones" onNavigate={() => {}} expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} schoolName={schoolName} subdomain={subdomain} user={user} children={children} selectedChild={selectedChild} onSelectChild={handleChildChange} />

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader user={user} onMenuClick={() => setSidebarExpanded(!sidebarExpanded)} onLogout={onLogout} logoUrl={logoUrl} schoolName={schoolName} subdomain={subdomain || user?.subdomain} token={token} roleLabel="Padre/Apoderado" profilePath="/parent/profile" />

        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: "Manrope, sans-serif" }}>
                Calificaciones de {selectedChild?.name || ""}
              </h1>
              <p className="text-sm text-slate-500">{grades.length} evaluaciones registradas</p>
            </div>
          </div>

          {/* Summary Cards */}
          {!loading && grades.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3"><BarChart3 className="w-5 h-5 text-white" /></div>
                <p className="text-3xl font-extrabold">{generalAverage || "—"}</p>
                <p className="text-xs text-indigo-200 mt-1">Promedio General</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-3"><Award className="w-5 h-5 text-amber-600" /></div>
                <p className="text-3xl font-bold text-slate-800">{grades.length}</p>
                <p className="text-xs text-slate-500 mt-1">Evaluaciones</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3"><Target className="w-5 h-5 text-emerald-600" /></div>
                <p className="text-3xl font-bold text-slate-800">{groupedGrades.length}</p>
                <p className="text-xs text-slate-500 mt-1">Materias</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center mb-3"><Star className="w-5 h-5 text-cyan-600" /></div>
                <p className="text-3xl font-bold text-slate-800">
                  {grades.filter(g => g.score != null && g.score >= (g.max_score || 20) * 0.6).length}
                </p>
                <p className="text-xs text-slate-500 mt-1">Aprobados</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-10 h-10 text-amber-500 animate-spin" /></div>
          ) : grades.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-amber-50 rounded-full flex items-center justify-center">
                <Trophy className="w-10 h-10 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin calificaciones</h3>
              <p className="text-slate-500 max-w-md mx-auto">Aun no se han registrado calificaciones.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedGrades.map((group) => (
                <div key={group.name} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setExpandedCourse(expandedCourse === group.name ? null : group.name)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                    data-testid={`parent-grade-group-${group.name}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: group.color }}>
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <h3 className="font-bold text-slate-800">{group.name}</h3>
                      {group.teacher && <p className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3" />{group.teacher}</p>}
                    </div>
                    {group.average != null && (
                      <div className={`px-3 py-1.5 rounded-xl text-sm font-bold border ${getGradeColor(group.average)}`}>
                        {group.average.toFixed(1)}
                      </div>
                    )}
                    <span className="text-sm text-slate-400">{group.count} eval.</span>
                    {expandedCourse === group.name ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </button>
                  {expandedCourse === group.name && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
                      {group.grades.map((grade, idx) => (
                        <div key={idx} className="px-4 py-3 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800">{grade.evaluation_name || grade.title || "Evaluacion"}</p>
                            {grade.comments && <p className="text-xs text-slate-500 mt-0.5">{grade.comments}</p>}
                            {grade.created_at && <p className="text-xs text-slate-400 mt-0.5">{new Date(grade.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })}</p>}
                          </div>
                          {grade.score != null && (
                            <div className={`px-3 py-1.5 rounded-xl text-lg font-bold border ${getGradeColor(grade.score, grade.max_score || 20)}`}>
                              {grade.score}<span className="text-xs font-normal opacity-70">/{grade.max_score || 20}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
      <MessageCenter token={token} user={user} />
      <MobileBottomNav role="parent" />
    </div>
  );
}
