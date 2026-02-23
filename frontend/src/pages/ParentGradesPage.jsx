import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Loader2,
  Filter,
  Star,
  Calendar,
  ChevronRight
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParentGradesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [activeSection, setActiveSection] = useState("calificaciones");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [average, setAverage] = useState(null);
  const [settings, setSettings] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState('all');

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadParentProfile();
  }, [token]);

  useEffect(() => {
    if (selectedChild) {
      loadGrades(selectedChild.id);
      localStorage.setItem('selected_child_id', selectedChild.id);
    }
  }, [selectedChild]);

  const loadParentProfile = async () => {
    try {
      const [profileRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/parent/me`, { headers }),
        axios.get(`${API}/api/settings`, { headers }).catch(() => ({ data: null }))
      ]);
      
      setChildren(profileRes.data.children || []);
      if (settingsRes.data) setSettings(settingsRes.data);
      
      const savedChildId = localStorage.getItem('selected_child_id');
      const childrenList = profileRes.data.children || [];
      
      if (childrenList.length > 0) {
        const savedChild = childrenList.find(c => c.id === savedChildId);
        setSelectedChild(savedChild || childrenList[0]);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error("Error:", err);
      setLoading(false);
    }
  };

  const loadGrades = async (studentId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/parent/grades?student_id=${studentId}`, { headers });
      setGrades(res.data.grades || []);
      setSubjects(res.data.subjects || []);
      setAverage(res.data.average);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const schoolName = settings?.system_name || "Portal Padres";
  const logoUrl = settings?.logo_url;

  // Filter grades by subject
  const filteredGrades = selectedSubject === 'all' 
    ? grades 
    : grades.filter(g => g.subject_id === selectedSubject);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <ParentSidebar
        active={activeSection}
        onNavigate={setActiveSection}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain}
        user={user}
        children={children}
        selectedChild={selectedChild}
        onSelectChild={setSelectedChild}
      />

      <div className="flex-1 flex flex-col lg:ml-16">
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain}
          token={token}
          roleLabel="Padre/Apoderado"
          profilePath="/parent/profile"
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {/* Hero Banner */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl p-6 mb-6 text-white shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  <Trophy className="w-8 h-8 inline-block mr-2 -mt-1" />
                  Calificaciones de {selectedChild?.name}
                </h1>
                <p className="text-blue-100">
                  Rendimiento académico y notas
                </p>
              </div>
              {average !== null && (
                <div className="bg-white/20 rounded-xl px-6 py-3 text-center">
                  <p className="text-3xl font-bold">{average}</p>
                  <p className="text-xs text-blue-100">Promedio General</p>
                </div>
              )}
            </div>
          </div>

          {/* Subject Cards */}
          {subjects.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              {subjects.map((subject) => (
                <button
                  key={subject.id}
                  onClick={() => setSelectedSubject(selectedSubject === subject.id ? 'all' : subject.id)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedSubject === subject.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold mx-auto mb-2"
                    style={{ backgroundColor: subject.color || '#3B82F6' }}
                  >
                    {subject.name?.charAt(0)}
                  </div>
                  <p className="text-xs font-medium text-slate-700 text-center truncate">{subject.name}</p>
                  <p className={`text-lg font-bold text-center mt-1 ${
                    subject.average !== null 
                      ? (parseFloat(subject.average) >= 11 ? 'text-emerald-600' : 'text-red-500')
                      : 'text-slate-400'
                  }`}>
                    {subject.average ?? '-'}
                  </p>
                  <p className="text-[10px] text-slate-400 text-center">{subject.grades_count || 0} notas</p>
                </button>
              ))}
            </div>
          )}

          {/* Grades List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                {selectedSubject === 'all' ? 'Todas las Calificaciones' : 'Calificaciones del Curso'}
              </h3>
              {selectedSubject !== 'all' && (
                <button
                  onClick={() => setSelectedSubject('all')}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Ver todas
                </button>
              )}
            </div>
            
            {filteredGrades.length === 0 ? (
              <div className="p-12 text-center">
                <Trophy className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500">Sin calificaciones registradas</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredGrades.map((grade) => {
                  const isGood = parseFloat(grade.grade) >= 11;
                  return (
                    <div key={grade.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                          style={{ backgroundColor: grade.subject_color || '#3B82F6' }}
                        >
                          {grade.subject_name?.charAt(0)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-slate-800">{grade.subject_name}</span>
                            {grade.evaluation_name && (
                              <span className="text-xs text-slate-400">• {grade.evaluation_name}</span>
                            )}
                          </div>
                          {grade.evaluation_type && (
                            <p className="text-xs text-slate-500">{grade.evaluation_type}</p>
                          )}
                          {grade.date && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(grade.date).toLocaleDateString('es-ES')}
                            </p>
                          )}
                        </div>
                        
                        <div className={`text-2xl font-bold ${isGood ? 'text-emerald-600' : 'text-red-500'}`}>
                          {grade.grade}
                        </div>
                        
                        <div className={`p-2 rounded-full ${isGood ? 'bg-emerald-100' : 'bg-red-100'}`}>
                          {isGood ? (
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </div>
                      
                      {grade.feedback && (
                        <div className="mt-3 ml-14 p-3 bg-blue-50 rounded-lg">
                          <p className="text-xs text-blue-600 font-medium mb-1">Comentario:</p>
                          <p className="text-sm text-blue-800">{grade.feedback}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      <MessageCenter token={token} user={user} />
    </div>
  );
}
