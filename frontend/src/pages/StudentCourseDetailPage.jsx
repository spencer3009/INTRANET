import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import MessageCenter from "../components/MessageCenter";
import {
  BookOpen, ArrowLeft, Clock, Calendar, User,
  LayoutDashboard, FileText, FolderOpen, FlaskConical, 
  MessageCircle, Bell, Trophy, Download,
  Loader2, AlertCircle, File as FileIcon, 
  ChevronRight, CheckCircle, Lock, Play,
  Eye, ExternalLink
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

// Tabs for students (read-only)
const STUDENT_TABS = [
  { id: "tablero", label: "Tablero", icon: LayoutDashboard },
  { id: "tareas", label: "Tareas", icon: FileText },
  { id: "material", label: "Material", icon: FolderOpen },
  { id: "examenes", label: "Exámenes", icon: FlaskConical },
  { id: "foro", label: "Foro", icon: MessageCircle },
];

// Empty State Component
function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">{title}</h3>
      <p className="text-slate-500 max-w-md mx-auto">{description}</p>
    </div>
  );
}

// Course Header
function CourseHeader({ subject, teacher, onBack }) {
  const baseColor = subject?.color || "#06b6d4";
  
  return (
    <div 
      className="relative rounded-2xl overflow-hidden shadow-lg"
      style={{ background: `linear-gradient(135deg, ${baseColor}DD 0%, ${baseColor}99 100%)` }}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
      
      <div className="relative z-10 p-6 lg:p-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-all border border-white/30"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-white">{subject?.name || "Curso"}</h1>
            {teacher && (
              <div className="flex items-center gap-2 mt-2">
                <User className="w-4 h-4 text-white/70" />
                <span className="text-white/90 text-sm">{teacher.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tabs Component
function CourseTabs({ activeTab, onTabChange }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2">
      <div className="flex items-center gap-1 overflow-x-auto">
        {STUDENT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                isActive
                  ? "bg-cyan-500 text-white shadow-md"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Dashboard/Tablero Content - 3 Column Layout
function DashboardContent({ subject, teacher, posts, students, tasks, materials, reminders, onViewPost }) {
  const baseColor = subject?.color || "#06b6d4";
  
  // Get upcoming tasks (next 7 days)
  const upcomingTasks = tasks
    .filter(t => new Date(t.due_date) > new Date())
    .slice(0, 3);
  
  // Get recent materials
  const recentMaterials = materials.slice(0, 3);
  
  // Get recent activity (all posts combined)
  const recentActivity = [...posts, ...tasks.slice(0, 2), ...materials.slice(0, 2)]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column - Course Image & Activity */}
      <div className="lg:col-span-3 space-y-4">
        {/* Course Image Card */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {subject?.image_url ? (
            <img 
              src={subject.image_url} 
              alt={subject.name}
              className="w-full h-40 object-cover"
            />
          ) : (
            <div 
              className="w-full h-40 flex items-center justify-center"
              style={{ backgroundColor: baseColor }}
            >
              <BookOpen className="w-16 h-16 text-white/50" />
            </div>
          )}
          <div className="p-4">
            <h3 className="font-semibold text-slate-800 text-sm">{subject?.name}</h3>
            <p className="text-xs text-slate-500 mt-1">{subject?.description || "Sin descripción"}</p>
          </div>
        </div>

        {/* Activity Summary */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-slate-400" />
            Actividad del Curso
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Tareas</span>
              <span className="font-semibold text-slate-800">{tasks.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Materiales</span>
              <span className="font-semibold text-slate-800">{materials.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Publicaciones</span>
              <span className="font-semibold text-slate-800">{posts.length}</span>
            </div>
          </div>
        </div>

        {/* Recent Materials */}
        {recentMaterials.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-indigo-500" />
              Material Reciente
            </h3>
            <div className="space-y-2">
              {recentMaterials.map((mat) => (
                <div key={mat.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                  <FileIcon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 truncate">{mat.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Center Column - Posts/Feed */}
      <div className="lg:col-span-6 space-y-4">
        {/* No input field for students - read only */}
        
        {/* Recent Activity Feed */}
        {recentActivity.length > 0 ? (
          <div className="space-y-4">
            {recentActivity.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    item.type === 'task' ? 'bg-amber-100' : 
                    item.type === 'material' ? 'bg-indigo-100' : 'bg-cyan-100'
                  }`}>
                    {item.type === 'task' ? (
                      <FileText className="w-5 h-5 text-amber-600" />
                    ) : item.type === 'material' ? (
                      <FolderOpen className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <Bell className="w-5 h-5 text-cyan-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.type === 'task' ? 'bg-amber-100 text-amber-700' : 
                        item.type === 'material' ? 'bg-indigo-100 text-indigo-700' : 'bg-cyan-100 text-cyan-700'
                      }`}>
                        {item.type === 'task' ? 'Tarea' : item.type === 'material' ? 'Material' : 'Anuncio'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-800">{item.title}</h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{item.content || item.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(item.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                      </span>
                      {item.due_date && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Clock className="w-3.5 h-3.5" />
                          Entrega: {new Date(item.due_date).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Attachments */}
                {item.attachments?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                    {item.attachments.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        <FileIcon className="w-4 h-4" />
                        {file.name}
                        <Download className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LayoutDashboard className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin actividad reciente</h3>
            <p className="text-slate-500">El profesor aún no ha publicado contenido en este curso.</p>
          </div>
        )}
      </div>

      {/* Right Column - Teacher, Students, Reminders */}
      <div className="lg:col-span-3 space-y-4">
        {/* Teacher Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            Profesor del Curso
          </h3>
          <div className="flex items-center gap-3">
            {teacher?.photo_url ? (
              <img 
                src={teacher.photo_url} 
                alt={teacher.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white font-semibold">
                {teacher?.name?.charAt(0) || "P"}
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-800">{teacher?.name || "Sin asignar"}</p>
              <p className="text-xs text-slate-500">Docente</p>
            </div>
          </div>
        </div>

        {/* Students Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            Compañeros de Clase
          </h3>
          {students.length > 0 ? (
            <>
              <div className="flex -space-x-2 mb-2">
                {students.slice(0, 5).map((student, idx) => (
                  <div
                    key={student.id || idx}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 border-2 border-white flex items-center justify-center text-white text-xs font-semibold"
                    title={student.name}
                  >
                    {student.name?.charAt(0) || "?"}
                  </div>
                ))}
                {students.length > 5 && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-slate-600 text-xs font-semibold">
                    +{students.length - 5}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500">{students.length} estudiante{students.length !== 1 ? 's' : ''}</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Sin información de compañeros</p>
          )}
        </div>

        {/* Upcoming Tasks */}
        {upcomingTasks.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Próximas Entregas
            </h3>
            <div className="space-y-2">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(task.due_date).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reminders */}
        {reminders.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-red-500" />
              Recordatorios
            </h3>
            <div className="space-y-2">
              {reminders.map((reminder, idx) => (
                <div key={idx} className="p-2 bg-red-50 rounded-lg border border-red-100">
                  <p className="text-sm text-slate-800">{reminder.title || reminder.message}</p>
                  {reminder.date && (
                    <p className="text-xs text-red-600 mt-1">{new Date(reminder.date).toLocaleDateString("es-PE")}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Tasks Content (Read-only for students)
function TasksContent({ tasks, studentId, onSubmitTask }) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Sin tareas asignadas"
        description="El profesor aún no ha asignado tareas para este curso."
      />
    );
  }

  const getTaskStatus = (task) => {
    const submission = task.submissions?.find(s => s.student_id === studentId);
    if (submission) {
      if (submission.grade !== null && submission.grade !== undefined) {
        return { status: "graded", label: "Calificada", color: "bg-emerald-100 text-emerald-700", grade: submission.grade };
      }
      return { status: "submitted", label: "Entregada", color: "bg-blue-100 text-blue-700" };
    }
    const now = new Date();
    const dueDate = new Date(task.due_date);
    if (dueDate < now) {
      return { status: "late", label: "Vencida", color: "bg-red-100 text-red-700" };
    }
    return { status: "pending", label: "Pendiente", color: "bg-amber-100 text-amber-700" };
  };

  return (
    <div className="space-y-4">
      {tasks.map((task) => {
        const taskStatus = getTaskStatus(task);
        
        return (
          <div key={task.id} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-slate-800">{task.title}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${taskStatus.color}`}>
                    {taskStatus.label}
                    {taskStatus.grade !== undefined && ` - ${taskStatus.grade}/${task.max_grade || 20}`}
                  </span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{task.description || task.content}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Fecha límite: {new Date(task.due_date).toLocaleDateString("es-PE")}
                  </span>
                  {task.max_grade && (
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" />
                      Puntaje máximo: {task.max_grade}
                    </span>
                  )}
                </div>
              </div>
              
              {taskStatus.status === "pending" && (
                <button
                  onClick={() => onSubmitTask(task)}
                  className="px-4 py-2 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Entregar
                </button>
              )}
            </div>
            
            {/* Attachments */}
            {task.attachments?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-2">Archivos adjuntos:</p>
                <div className="flex flex-wrap gap-2">
                  {task.attachments.map((file, idx) => (
                    <a
                      key={idx}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      <FileIcon className="w-4 h-4" />
                      {file.name}
                      <Download className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Material Content (Read-only)
function MaterialContent({ materials }) {
  if (materials.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Sin material de estudio"
        description="El profesor aún no ha compartido material de estudio."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {materials.map((material) => (
        <div key={material.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <FolderOpen className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-800 truncate">{material.title}</h3>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{material.description || material.content}</p>
              <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(material.created_at).toLocaleDateString("es-PE")}
              </div>
            </div>
          </div>
          
          {/* Files */}
          {material.attachments?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="space-y-2">
                {material.attachments.map((file, idx) => (
                  <a
                    key={idx}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group"
                  >
                    <FileIcon className="w-5 h-5 text-slate-400" />
                    <span className="flex-1 text-sm text-slate-700 truncate">{file.name}</span>
                    <Download className="w-4 h-4 text-slate-400 group-hover:text-cyan-500" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Exams Content (Read-only)
function ExamsContent({ exams, studentId }) {
  if (exams.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="Sin exámenes"
        description="El profesor aún no ha programado exámenes para este curso."
      />
    );
  }

  const getExamStatus = (exam) => {
    const attempt = exam.attempts?.find(a => a.student_id === studentId);
    if (attempt) {
      return { status: "completed", label: "Completado", color: "bg-emerald-100 text-emerald-700", score: attempt.score };
    }
    const now = new Date();
    const startDate = new Date(exam.start_date);
    const endDate = new Date(exam.end_date);
    if (now < startDate) {
      return { status: "upcoming", label: "Próximamente", color: "bg-slate-100 text-slate-700" };
    }
    if (now > endDate) {
      return { status: "closed", label: "Cerrado", color: "bg-red-100 text-red-700" };
    }
    return { status: "available", label: "Disponible", color: "bg-cyan-100 text-cyan-700" };
  };

  return (
    <div className="space-y-4">
      {exams.map((exam) => {
        const examStatus = getExamStatus(exam);
        
        return (
          <div key={exam.id} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-slate-800">{exam.title}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${examStatus.color}`}>
                    {examStatus.label}
                    {examStatus.score !== undefined && ` - ${examStatus.score}%`}
                  </span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{exam.description}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {exam.duration_minutes} minutos
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(exam.start_date).toLocaleDateString("es-PE")} - {new Date(exam.end_date).toLocaleDateString("es-PE")}
                  </span>
                </div>
              </div>
              
              {examStatus.status === "available" && (
                <button className="px-4 py-2 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 transition-colors flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Iniciar
                </button>
              )}
              {examStatus.status === "upcoming" && (
                <div className="px-4 py-2 bg-slate-100 text-slate-500 text-sm font-medium rounded-lg flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Bloqueado
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Forum Content (Read-only)
function ForumContent({ posts }) {
  if (posts.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Sin discusiones"
        description="Aún no hay discusiones en el foro de este curso."
      />
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div key={post.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-800">{post.title}</h3>
              <p className="text-sm text-slate-600 mt-1 line-clamp-2">{post.content}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                <span>{post.author_name}</span>
                <span>{new Date(post.created_at).toLocaleDateString("es-PE")}</span>
                {post.comments_count !== undefined && (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" />
                    {post.comments_count} respuestas
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Main Component
export default function StudentCourseDetailPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { subdomain, courseId } = useParams();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [subject, setSubject] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [activeTab, setActiveTab] = useState("tablero");
  
  // Content states
  const [posts, setPosts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [exams, setExams] = useState([]);
  const [forumPosts, setForumPosts] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadData();
  }, [token, courseId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load settings and subject info
      const [settingsRes, coursesRes] = await Promise.all([
        axios.get(`${API}/api/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/api/student/courses`, { headers })
      ]);
      
      if (settingsRes.data) {
        setSettings(settingsRes.data);
      }
      
      // Find the specific course
      const course = coursesRes.data.courses?.find(c => c.id === courseId);
      if (course) {
        setSubject(course);
        setTeacher(course.teacher);
      }
      
      // Load course content
      await loadContent();
      
    } catch (err) {
      console.error("Error loading course data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadContent = async () => {
    try {
      // Load all posts for this course
      const postsRes = await axios.get(`${API}/api/courses/${courseId}/posts`, { headers });
      const allPosts = postsRes.data || [];
      
      // Separate by type
      setPosts(allPosts.filter(p => p.type === "post" || p.type === "announcement"));
      setTasks(allPosts.filter(p => p.type === "task"));
      setMaterials(allPosts.filter(p => p.type === "material"));
      setForumPosts(allPosts.filter(p => p.type === "forum"));
      
      // Load exams
      const examsRes = await axios.get(`${API}/api/exams?subject_id=${courseId}`, { headers }).catch(() => ({ data: [] }));
      setExams(examsRes.data || []);
      
    } catch (err) {
      console.error("Error loading content:", err);
    }
  };

  const schoolName = settings?.system_name || user?.school_name || "Portal Alumno";
  const logoUrl = settings?.logo_url;

  const handleBack = () => {
    const basePath = subdomain ? `/school/${subdomain}` : "";
    navigate(`${basePath}/student/courses`);
  };

  const handleSubmitTask = (task) => {
    // TODO: Implement task submission modal
    console.log("Submit task:", task);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "tablero":
        return <DashboardContent posts={posts} onViewPost={() => {}} />;
      case "tareas":
        return <TasksContent tasks={tasks} studentId={user?.id} onSubmitTask={handleSubmitTask} />;
      case "material":
        return <MaterialContent materials={materials} />;
      case "examenes":
        return <ExamsContent exams={exams} studentId={user?.id} />;
      case "foro":
        return <ForumContent posts={forumPosts} />;
      default:
        return <DashboardContent posts={posts} onViewPost={() => {}} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Student Sidebar */}
      <StudentSidebar
        active="cursos"
        onNavigate={() => {}}
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        onLogout={onLogout}
        schoolName={schoolName}
        subdomain={subdomain || user?.subdomain}
        user={user}
      />

      {/* Mobile overlay */}
      {sidebarExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarExpanded(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <StudentHeader
          user={user}
          onMenuClick={() => setSidebarExpanded(!sidebarExpanded)}
          onLogout={onLogout}
          logoUrl={logoUrl}
          schoolName={schoolName}
          subdomain={subdomain || user?.subdomain}
          token={token}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Course Header */}
              <CourseHeader 
                subject={subject} 
                teacher={teacher}
                onBack={handleBack}
              />
              
              {/* Tabs */}
              <div className="mt-6">
                <CourseTabs activeTab={activeTab} onTabChange={setActiveTab} />
              </div>
              
              {/* Tab Content */}
              <div className="mt-6">
                {renderContent()}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Message Center */}
      <MessageCenter token={token} user={user} />
    </div>
  );
}
