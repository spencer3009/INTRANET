import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ParentSidebar from "../components/ParentSidebar";
import StudentHeader from "../components/StudentHeader";
import MobileBottomNav from "../components/MobileBottomNav";
import {
  ArrowLeft, HeartPulse, Stethoscope, Brain, Loader2, X,
  AlertTriangle, Clock, User, FileText, ChevronRight, CheckCircle
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const INCIDENT_LABELS = {
  dolor: "Dolor", golpe: "Golpe", fiebre: "Fiebre",
  malestar_general: "Malestar General", emergencia: "Emergencia", otro: "Otro",
};
const RECORD_TYPE_LABELS = {
  conductual: "Conductual", emocional: "Emocional",
  academico_relacionado: "Académico Relacionado", otro: "Otro",
};
const STATUS_LABELS = {
  atendido: "Atendido", derivado: "Derivado", en_observacion: "En Observación",
  en_seguimiento: "En Seguimiento", caso_cerrado: "Caso Cerrado", derivado_externamente: "Derivado Externamente",
};
const ALERT_COLORS = {
  alto: "bg-red-100 text-red-700 border-red-200",
  medio: "bg-amber-100 text-amber-700 border-amber-200",
  bajo: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
const STATUS_COLORS = {
  atendido: "bg-emerald-100 text-emerald-700",
  derivado: "bg-amber-100 text-amber-700",
  en_observacion: "bg-blue-100 text-blue-700",
  en_seguimiento: "bg-blue-100 text-blue-700",
  caso_cerrado: "bg-slate-100 text-slate-600",
  derivado_externamente: "bg-purple-100 text-purple-700",
};

export default function ParentHealthPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("tópico");
  const [loading, setLoading] = useState(true);
  const [topicoRecords, setTopicoRecords] = useState([]);
  const [psicologiaRecords, setPsicologiaRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [settings, setSettings] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const init = async () => {
      try {
        const [profileRes, settingsRes] = await Promise.all([
          axios.get(`${API}/api/parent/me`, { headers }),
          axios.get(`${API}/api/settings/public/${subdomain || user?.subdomain}`, { headers }).catch(() => ({ data: null })),
        ]);
        const childrenList = profileRes.data.children || [];
        setChildren(childrenList);
        if (settingsRes.data) setSettings(settingsRes.data);

        const savedChildId = localStorage.getItem("selected_child_id");
        const child = childrenList.find((c) => c.id === savedChildId) || childrenList[0];
        if (child) {
          setSelectedChild(child);
          await loadRecords(child.id);
        }
      } catch (err) {
        console.error("Error loading parent health data:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [token]);

  const loadRecords = async (studentId) => {
    setLoading(true);
    try {
      const [topicoRes, psicoRes] = await Promise.all([
        axios.get(`${API}/api/health/parent/tópico?student_id=${studentId}`, { headers }),
        axios.get(`${API}/api/health/parent/psicologia?student_id=${studentId}`, { headers }),
      ]);
      setTopicoRecords(topicoRes.data.records || []);
      setPsicologiaRecords(psicoRes.data.records || []);
    } catch (err) {
      console.error("Error loading health records:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChildChange = async (child) => {
    if (!child || child.id === selectedChild?.id) return;
    setSelectedChild(child);
    localStorage.setItem("selected_child_id", child.id);
    await loadRecords(child.id);
  };

  const schoolName = settings?.system_name || user?.school_name || "Portal Padres";
  const logoUrl = settings?.logo_url;
  const childFullName = selectedChild ? `${selectedChild.name} ${selectedChild.last_name || ""}`.trim() : "";
  const records = activeTab === "topico" ? topicoRecords : psicologiaRecords;

  const goBack = () => {
    const base = subdomain ? `/${subdomain}` : "";
    navigate(`${base}/parent`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <ParentSidebar
        active="salud"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain || user?.subdomain}
        user={user}
        children={children}
        selectedChild={selectedChild}
        onSelectChild={handleChildChange}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
          roleLabel="Padre/Apoderado"
          profilePath="/parent/profile"
        />

        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6" data-testid="parent-health-header">
            <button onClick={goBack} className="p-2 hover:bg-slate-200 rounded-xl transition-colors" data-testid="parent-health-back-btn">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Salud y Bienestar</h1>
              <p className="text-sm text-slate-500">{childFullName}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6" data-testid="health-tabs">
            <button
              onClick={() => setActiveTab("tópico")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === "topico"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
              data-testid="tab-topico"
            >
              <Stethoscope className="w-4 h-4" />
              Tópico
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === "topico" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}>{topicoRecords.length}</span>
            </button>
            <button
              onClick={() => setActiveTab("psicologia")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === "psicologia"
                  ? "bg-purple-600 text-white shadow-md"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
              data-testid="tab-psicologia"
            >
              <Brain className="w-4 h-4" />
              Psicología
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === "psicologia" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}>{psicologiaRecords.length}</span>
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center" data-testid="no-records-msg">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {activeTab === "topico" ? (
                  <Stethoscope className="w-8 h-8 text-slate-400" />
                ) : (
                  <Brain className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <h3 className="font-semibold text-slate-700 mb-1">Sin registros</h3>
              <p className="text-sm text-slate-500">
                No hay registros de {activeTab === "topico" ? "Tópico" : "Psicología"} para {childFullName}
              </p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="records-list">
              {records.map((record) => (
                <div
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                  className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm cursor-pointer transition-all"
                  data-testid={`record-${record.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      activeTab === "topico" ? "bg-blue-100" : "bg-purple-100"
                    }`}>
                      {activeTab === "topico" ? (
                        <Stethoscope className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Brain className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800 text-sm">
                          {activeTab === "topico"
                            ? INCIDENT_LABELS[record.incident_type] || record.incident_type
                            : RECORD_TYPE_LABELS[record.record_type] || record.record_type}
                        </p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[record.status] || "bg-slate-100 text-slate-600"}`}>
                          {STATUS_LABELS[record.status] || record.status}
                        </span>
                        {activeTab === "psicologia" && record.alert_level && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ALERT_COLORS[record.alert_level]}`}>
                            {record.alert_level?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {activeTab === "topico" ? record.description : record.reason}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-2">
                      <div>
                        <p className="text-xs font-medium text-slate-600">{record.date}</p>
                        <p className="text-[10px] text-slate-400">{record.time}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" data-testid="health-detail-modal">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedRecord(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className={`px-6 py-4 flex items-center justify-between ${
              activeTab === "topico"
                ? "bg-gradient-to-r from-blue-600 to-cyan-500"
                : "bg-gradient-to-r from-purple-600 to-fuchsia-500"
            }`}>
              <div className="flex items-center gap-3">
                {activeTab === "topico" ? (
                  <Stethoscope className="w-5 h-5 text-white" />
                ) : (
                  <Brain className="w-5 h-5 text-white" />
                )}
                <h2 className="font-bold text-white">
                  Detalle de {activeTab === "topico" ? "Tópico" : "Psicología"}
                </h2>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="text-white/80 hover:text-white p-1" data-testid="close-detail-modal">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-64px)] space-y-4">
              {/* Student info */}
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{selectedRecord.student_name}</p>
                  <p className="text-xs text-slate-500">
                    {selectedRecord.grade_name} - {selectedRecord.section_name}
                  </p>
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium mb-1">Fecha</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedRecord.date}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium mb-1">Hora</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedRecord.time}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 font-medium mb-1">
                  {activeTab === "topico" ? "Tipo de Incidencia" : "Tipo de Registro"}
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {activeTab === "topico"
                    ? INCIDENT_LABELS[selectedRecord.incident_type] || selectedRecord.incident_type
                    : RECORD_TYPE_LABELS[selectedRecord.record_type] || selectedRecord.record_type}
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 font-medium mb-1">
                  {activeTab === "topico" ? "Descripción" : "Motivo"}
                </p>
                <p className="text-sm text-slate-700">
                  {activeTab === "topico" ? selectedRecord.description : selectedRecord.reason}
                </p>
              </div>

              {activeTab === "topico" && selectedRecord.action_taken && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium mb-1">Acción Tomada</p>
                  <p className="text-sm text-slate-700">{selectedRecord.action_taken}</p>
                </div>
              )}

              {activeTab === "psicologia" && selectedRecord.professional_observation && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium mb-1">Observación Profesional</p>
                  <p className="text-sm text-slate-700">{selectedRecord.professional_observation}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium mb-1">Estado</p>
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[selectedRecord.status] || "bg-slate-100 text-slate-600"}`}>
                    {STATUS_LABELS[selectedRecord.status] || selectedRecord.status}
                  </span>
                </div>
                {activeTab === "psicologia" && selectedRecord.alert_level && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 font-medium mb-1">Nivel de Alerta</p>
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${ALERT_COLORS[selectedRecord.alert_level]}`}>
                      {selectedRecord.alert_level?.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {activeTab === "psicologia" && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium mb-1">Requiere Seguimiento</p>
                  <div className="flex items-center gap-2">
                    {selectedRecord.requires_followup ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium text-amber-700">Sí</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-medium text-emerald-700">No</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 font-medium mb-1">Responsable</p>
                <p className="text-sm font-semibold text-slate-800">{selectedRecord.responsible}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <MobileBottomNav role="parent" />
    </div>
  );
}
