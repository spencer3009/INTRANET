import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import ConfirmModal from "../components/ConfirmModal";
import { 
  Calendar, Clock, Plus, Loader2, ArrowLeft, Settings, 
  ChevronLeft, ChevronRight, GraduationCap, FileText
} from "lucide-react";

// Import refactored schedule components
import {
  SCHEDULE_TABS,
  ScheduleSettingsModal,
  BreakModal,
  ScheduleEntryModal,
  ExamCard,
  ExamFormPanel,
  ExamCalendar,
  CalendarGrid
} from "../components/schedule";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function SchedulePage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("clases");
  const [loading, setLoading] = useState(true);

  // Data
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [allSchedules, setAllSchedules] = useState([]);
  const [schoolSettings, setSchoolSettings] = useState(null);

  // Filters
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  // Settings
  const [settings, setSettings] = useState({
    start_hour: "07:00",
    end_hour: "18:00",
    time_format: "24h",
    block_duration: 45,
    view_mode: "horizontal",
    include_saturday: false,
    include_sunday: false
  });
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Class schedule modals
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [preselectedData, setPreselectedData] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);

  // Breaks state
  const [breaks, setBreaks] = useState([]);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [editBreak, setEditBreak] = useState(null);
  const [breakPreselectedTime, setBreakPreselectedTime] = useState(null);

  // Exam schedule state
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedExamDate, setSelectedExamDate] = useState(null);
  const [showExamPanel, setShowExamPanel] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [showExamDeleteConfirm, setShowExamDeleteConfirm] = useState(false);
  const [examToDelete, setExamToDelete] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  // Load school settings for logo
  useEffect(() => {
    const loadSchoolSettings = async () => {
      try {
        const res = await axios.get(`${API}/settings`, { headers });
        setSchoolSettings(res.data);
      } catch (err) {
        console.error("Error loading school settings:", err);
      }
    };
    loadSchoolSettings();
  }, [token]);

  // Load breaks
  const loadBreaks = useCallback(async () => {
    if (!selectedGrade || !selectedSection) {
      setBreaks([]);
      return;
    }
    try {
      const res = await axios.get(`${API}/schedule/breaks?grade_id=${selectedGrade}&section_id=${selectedSection}`, { headers });
      setBreaks(res.data.breaks || []);
    } catch (err) {
      console.error("Error loading breaks:", err);
    }
  }, [token, selectedGrade, selectedSection]);

  // Load exams
  const loadExams = useCallback(async () => {
    if (activeTab !== "examenes" || !selectedGrade || !selectedSection) {
      setExams([]);
      return;
    }
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
      
      const res = await axios.get(
        `${API}/exam-schedules?grade_id=${selectedGrade}&section_id=${selectedSection}&from_date=${fromDate}&to_date=${toDate}`,
        { headers }
      );
      setExams(res.data.exams || []);
    } catch (err) {
      console.error("Error loading exams:", err);
    }
  }, [activeTab, selectedGrade, selectedSection, currentMonth, token]);

  // Load subjects for exam form
  const loadSubjects = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/academic/subjects`, { headers });
      setSubjects(res.data || []);
    } catch (err) {
      console.error("Error loading subjects:", err);
    }
  }, [token]);

  useEffect(() => { loadExams(); }, [loadExams]);
  useEffect(() => { if (activeTab === "examenes") loadSubjects(); }, [activeTab, loadSubjects]);

  // Exam handlers
  const handleAddExam = () => { setEditingExam(null); setShowExamPanel(true); };
  const handleEditExam = (exam) => { setEditingExam(exam); setShowExamPanel(true); };
  const handleDeleteExam = (exam) => { setExamToDelete(exam); setShowExamDeleteConfirm(true); };
  const confirmDeleteExam = async () => {
    if (!examToDelete) return;
    try {
      await axios.delete(`${API}/exam-schedules/${examToDelete.id}`, { headers });
      loadExams();
    } catch (err) {
      console.error("Error deleting exam:", err);
    } finally {
      setShowExamDeleteConfirm(false);
      setExamToDelete(null);
    }
  };

  // Month navigation
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const examsForSelectedDate = selectedExamDate ? exams.filter(e => e.date === selectedExamDate) : [];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const currentMonthName = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [gradesRes, sectionsRes, teachersRes, settingsRes] = await Promise.all([
          axios.get(`${API}/academic/grades`, { headers }),
          axios.get(`${API}/academic/sections`, { headers }),
          axios.get(`${API}/users/teachers/active`, { headers }),
          axios.get(`${API}/schedule-settings`, { headers }).catch(() => ({ data: null }))
        ]);

        setGrades(gradesRes.data || []);
        setSections(sectionsRes.data || []);
        setTeachers(teachersRes.data || []);
        if (settingsRes.data) setSettings(settingsRes.data);
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [token]);

  useEffect(() => { loadBreaks(); }, [loadBreaks]);

  // Load schedules when filters change
  useEffect(() => {
    const loadSchedules = async () => {
      if (activeTab === "clases" && (!selectedGrade || !selectedSection)) {
        setSchedules([]);
        return;
      }
      if (activeTab === "profesores" && !selectedTeacher) {
        setSchedules([]);
        return;
      }

      try {
        let url = `${API}/schedules?tipo=${activeTab}`;
        if (activeTab === "clases") url += `&grado_id=${selectedGrade}&seccion_id=${selectedSection}`;
        else if (activeTab === "profesores") url += `&profesor_id=${selectedTeacher}`;

        const res = await axios.get(url, { headers });
        setSchedules(res.data.schedules || []);
      } catch (err) {
        console.error("Error loading schedules:", err);
      }
    };
    loadSchedules();
  }, [activeTab, selectedGrade, selectedSection, selectedTeacher, token]);

  // Load all schedules for conflict checking
  useEffect(() => {
    const loadAllSchedules = async () => {
      try {
        const res = await axios.get(`${API}/schedules?tipo=clases`, { headers });
        setAllSchedules(res.data.schedules || []);
      } catch (err) {
        console.error("Error loading all schedules:", err);
      }
    };
    loadAllSchedules();
  }, [token]);

  const filteredSections = sections.filter(s => s.grado_id === selectedGrade);

  const handleGradeChange = (gradeId) => {
    setSelectedGrade(gradeId);
    setSelectedSection("");
  };

  const handleCellClick = (day, time) => {
    setPreselectedData({
      grado_id: selectedGrade,
      seccion_id: selectedSection,
      profesor_id: selectedTeacher,
      dia: day,
      hora_inicio: time
    });
    setEditEntry(null);
    setShowEntryModal(true);
  };

  const handleEdit = (schedule) => {
    setEditEntry(schedule);
    setPreselectedData(null);
    setShowEntryModal(true);
  };

  const handleDelete = (schedule) => {
    setEntryToDelete(schedule);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    try {
      await axios.delete(`${API}/schedules/${entryToDelete.id}`, { headers });
      setSchedules(prev => prev.filter(s => s.id !== entryToDelete.id));
      setAllSchedules(prev => prev.filter(s => s.id !== entryToDelete.id));
    } catch (err) {
      console.error("Error deleting schedule:", err);
    } finally {
      setShowDeleteConfirm(false);
      setEntryToDelete(null);
    }
  };

  const handleSaveSettings = async (newSettings) => {
    setSavingSettings(true);
    try {
      await axios.post(`${API}/schedule-settings`, newSettings, { headers });
      setSettings(newSettings);
      setShowSettings(false);
    } catch (err) {
      console.error("Error saving settings:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  const refreshSchedules = async () => {
    let url = `${API}/schedules?tipo=${activeTab}`;
    if (activeTab === "clases") url += `&grado_id=${selectedGrade}&seccion_id=${selectedSection}`;
    else if (activeTab === "profesores") url += `&profesor_id=${selectedTeacher}`;

    try {
      const res = await axios.get(url, { headers });
      setSchedules(res.data.schedules || []);
      const allRes = await axios.get(`${API}/schedules?tipo=clases`, { headers });
      setAllSchedules(allRes.data.schedules || []);
    } catch (err) {
      console.error("Error refreshing schedules:", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-blue-50" data-testid="schedule-page">
      <Sidebar
        active="horarios"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        subdomain={user?.subdomain}
        token={token}
      />
      
      {sidebarExpanded && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarExpanded(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader 
          user={user} 
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={schoolSettings?.logo_url}
          schoolName={schoolSettings?.system_name || user?.name}
          subdomain={user?.subdomain}
          token={token}
        />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-xl transition-colors">
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Horario de Clases</h1>
                  <p className="text-slate-500">Gestión de horarios académicos</p>
                </div>
              </div>
              <button
                data-testid="schedule-settings-btn"
                onClick={() => setShowSettings(true)}
                className="p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-200 flex items-center gap-2 text-slate-600 hover:text-slate-800"
              >
                <Settings className="w-5 h-5" />
                <span className="hidden md:inline font-medium">Configuración</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2" data-testid="schedule-tabs">
            {SCHEDULE_TABS.map(tab => (
              <button
                key={tab.id}
                data-testid={`schedule-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                    : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6" data-testid="schedule-filters">
            <div className="flex flex-wrap items-center gap-4">
              {(activeTab === "clases" || activeTab === "examenes") && (
                <>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Grado</label>
                    <select
                      data-testid="schedule-grade-select"
                      value={selectedGrade}
                      onChange={(e) => handleGradeChange(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar grado...</option>
                      {grades.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Sección</label>
                    <select
                      data-testid="schedule-section-select"
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      disabled={!selectedGrade}
                    >
                      <option value="">Seleccionar sección...</option>
                      {filteredSections.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>
                </>
              )}

              {activeTab === "profesores" && (
                <div className="flex-1 min-w-[300px]">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Profesor</label>
                  <select
                    data-testid="schedule-teacher-select"
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar profesor...</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name} {t.last_name}</option>)}
                  </select>
                </div>
              )}

              {/* Add button - only for class schedule tab */}
              {activeTab !== "examenes" && (
                <div className="flex-shrink-0">
                  <label className="block text-xs font-medium text-transparent mb-1">.</label>
                  <button
                    data-testid="schedule-add-btn"
                    onClick={() => {
                      setPreselectedData({ grado_id: selectedGrade, seccion_id: selectedSection, profesor_id: selectedTeacher });
                      setEditEntry(null);
                      setShowEntryModal(true);
                    }}
                    disabled={(activeTab === "clases" && (!selectedGrade || !selectedSection)) || (activeTab === "profesores" && !selectedTeacher)}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-5 h-5" />
                    Agregar horario
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20" data-testid="schedule-loading">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : (activeTab === "clases" && (!selectedGrade || !selectedSection)) || (activeTab === "profesores" && !selectedTeacher) || (activeTab === "examenes" && (!selectedGrade || !selectedSection)) ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center" data-testid="schedule-empty-state">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Selecciona los filtros</h3>
              <p className="text-slate-500">
                {activeTab === "clases" ? "Elige un grado y sección para ver el horario" :
                 activeTab === "profesores" ? "Elige un profesor para ver su horario" :
                 "Elige un grado y sección para ver los exámenes programados"}
              </p>
            </div>
          ) : activeTab === "examenes" ? (
            /* EXAM CALENDAR VIEW */
            <div className="grid lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3">
                <div className="flex items-center justify-between mb-4">
                  <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <h2 className="text-lg font-bold text-slate-800">{currentMonthName}</h2>
                  <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
                
                <ExamCalendar
                  currentMonth={currentMonth}
                  exams={exams}
                  onDayClick={(dateStr) => setSelectedExamDate(dateStr)}
                  selectedDate={selectedExamDate}
                />
                
                <div className="mt-4 p-3 bg-indigo-50 rounded-lg flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-700">
                    {grades.find(g => g.id === selectedGrade)?.nombre} - Sección {filteredSections.find(s => s.id === selectedSection)?.nombre}
                  </span>
                  <span className="ml-auto text-sm text-indigo-600">{exams.length} exámenes este mes</span>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-slate-200 h-full">
                  <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-xl flex items-center justify-between">
                    <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {selectedExamDate ? new Date(selectedExamDate + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }) : "Selecciona un día"}
                    </h3>
                    {selectedExamDate && (
                      <button onClick={handleAddExam} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1">
                        <Plus className="w-4 h-4" />Agregar
                      </button>
                    )}
                  </div>
                  <div className="p-4 max-h-[500px] overflow-y-auto">
                    {!selectedExamDate ? (
                      <div className="text-center py-8 text-slate-500">
                        <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p>Haz clic en un día del calendario</p>
                      </div>
                    ) : examsForSelectedDate.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                          <FileText className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-slate-500 mb-4">No hay exámenes programados</p>
                        <button onClick={handleAddExam} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 inline-flex items-center gap-2">
                          <Plus className="w-4 h-4" />Programar examen
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {examsForSelectedDate.map(exam => (
                          <ExamCard key={exam.id} exam={exam} onEdit={handleEditExam} onDelete={handleDeleteExam} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <CalendarGrid
              schedules={schedules}
              settings={settings}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCellClick={handleCellClick}
              teachers={teachers}
              sections={sections}
              breaks={breaks}
              onAddBreak={(time) => {
                setBreakPreselectedTime(time);
                setEditBreak(null);
                setShowBreakModal(true);
              }}
              onEditBreak={(breakItem) => {
                setEditBreak(breakItem);
                setBreakPreselectedTime(null);
                setShowBreakModal(true);
              }}
              onDeleteBreak={async (breakItem) => {
                if (window.confirm(`¿Eliminar ${breakItem.label}?`)) {
                  try {
                    await axios.delete(`${API}/schedule/breaks/${breakItem.id}`, { headers });
                    setBreaks(prev => prev.filter(b => b.id !== breakItem.id));
                  } catch (err) {
                    console.error("Error deleting break:", err);
                  }
                }
              }}
            />
          )}

          {/* Stats Summary */}
          {schedules.length > 0 && activeTab !== "examenes" && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-sm text-slate-500">Total clases</p>
                <p className="text-2xl font-bold text-slate-800">{schedules.length}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-sm text-slate-500">Horas semanales</p>
                <p className="text-2xl font-bold text-blue-600">
                  {schedules.reduce((acc, s) => {
                    const [startH, startM] = s.hora_inicio.split(':').map(Number);
                    const [endH, endM] = s.hora_fin.split(':').map(Number);
                    return acc + ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
                  }, 0).toFixed(1)}h
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-sm text-slate-500">Días con clases</p>
                <p className="text-2xl font-bold text-emerald-600">{new Set(schedules.map(s => s.dia)).size}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-slate-200">
                <p className="text-sm text-slate-500">Profesores</p>
                <p className="text-2xl font-bold text-violet-600">{new Set(schedules.map(s => s.profesor_id).filter(Boolean)).size}</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <ScheduleSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={handleSaveSettings}
        loading={savingSettings}
      />

      <ScheduleEntryModal
        isOpen={showEntryModal}
        onClose={() => { setShowEntryModal(false); setEditEntry(null); setPreselectedData(null); }}
        token={token}
        entry={editEntry}
        onSuccess={refreshSchedules}
        grades={grades}
        sections={sections}
        teachers={teachers}
        type={activeTab}
        preselectedData={preselectedData}
        existingSchedules={allSchedules}
        settings={settings}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setEntryToDelete(null); }}
        onConfirm={confirmDelete}
        title="Eliminar horario"
        message={`¿Estás seguro de eliminar ${entryToDelete?.materia}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        type="danger"
      />

      <BreakModal
        isOpen={showBreakModal}
        onClose={() => { setShowBreakModal(false); setEditBreak(null); setBreakPreselectedTime(null); }}
        token={token}
        breakItem={editBreak}
        onSuccess={loadBreaks}
        preselectedTime={breakPreselectedTime}
        settings={settings}
        gradeId={selectedGrade}
        sectionId={selectedSection}
      />

      <ExamFormPanel
        isOpen={showExamPanel}
        onClose={() => { setShowExamPanel(false); setEditingExam(null); }}
        token={token}
        exam={editingExam}
        onSuccess={loadExams}
        gradeId={selectedGrade}
        sectionId={selectedSection}
        subjects={subjects}
        teachers={teachers}
        selectedDate={selectedExamDate}
      />

      {showExamPanel && <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowExamPanel(false)} />}

      <ConfirmModal
        isOpen={showExamDeleteConfirm}
        onClose={() => { setShowExamDeleteConfirm(false); setExamToDelete(null); }}
        onConfirm={confirmDeleteExam}
        title="Eliminar examen"
        message={`¿Estás seguro de eliminar "${examToDelete?.title}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        type="danger"
      />
    </div>
  );
}
