import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Clock, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, 
  XCircle, Loader2, Send, AlertCircle, Timer, Trophy, Target,
  Zap, Shield, BookOpen, Wifi, Eye, MonitorX, RefreshCw, 
  FileText, Play, Info
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// ─── PRE-EXAM RULES SCREEN ───
function ExamRulesScreen({ examTitle, subjectName, onStart, loading }) {
  const [accepted, setAccepted] = useState(false);

  const rules = [
    {
      icon: MonitorX,
      title: 'No salgas del examen',
      description: 'Si cierras o abandonas la pantalla del examen antes de finalizarlo, el sistema lo registrará como examen finalizado automáticamente, aunque no hayas respondido todas las preguntas.',
      color: 'text-red-600 bg-red-50 border-red-200'
    },
    {
      icon: Eye,
      title: 'Permanece en la pantalla',
      description: 'Si cambias de pestaña, minimizas la ventana o abandonas la pantalla del examen, el sistema registrará ese movimiento. Tu profesor podrá ver estos registros.',
      color: 'text-amber-600 bg-amber-50 border-amber-200'
    },
    {
      icon: Wifi,
      title: 'Buena conexión a internet',
      description: 'Asegúrate de tener una conexión estable antes de comenzar. Tus respuestas se guardan automáticamente, pero necesitas internet para que funcione correctamente.',
      color: 'text-blue-600 bg-blue-50 border-blue-200'
    },
    {
      icon: RefreshCw,
      title: 'No recargues la página',
      description: 'No cierres el navegador ni recargues la página durante el examen. Si lo haces, podrías perder tiempo valioso o tener problemas para continuar.',
      color: 'text-purple-600 bg-purple-50 border-purple-200'
    },
    {
      icon: FileText,
      title: 'Lee bien cada pregunta',
      description: 'Tómate tu tiempo para leer cada pregunta con cuidado antes de responder. Puedes navegar entre preguntas y cambiar tus respuestas antes de enviar el examen.',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fc] py-6 px-4 flex items-start justify-center" data-testid="exam-rules-screen">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-6 text-center">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Antes de comenzar</h1>
          <p className="text-white/80 text-sm">{examTitle || 'Examen'} &mdash; {subjectName || ''}</p>
        </div>

        {/* Rules */}
        <div className="p-5 space-y-2.5">
          <p className="text-slate-600 text-xs mb-3">
            Lee con atención las siguientes reglas. Estos controles existen para garantizar 
            la transparencia y seriedad del proceso de evaluación.
          </p>
          {rules.map((rule, idx) => (
            <div key={idx} className={`flex gap-3 p-3 rounded-xl border ${rule.color}`} data-testid={`exam-rule-${idx}`}>
              <div className="flex-shrink-0 mt-0.5">
                <rule.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">{rule.title}</h3>
                <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">{rule.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2 border-t border-slate-100">
          <label className="flex items-start gap-3 cursor-pointer mb-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
            <input 
              type="checkbox" 
              checked={accepted} 
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              data-testid="accept-rules-checkbox"
            />
            <span className="text-sm text-slate-700">
              He leído y entiendo las reglas del examen. Me comprometo a mantenerme 
              en la pantalla del examen hasta finalizarlo.
            </span>
          </label>
          <button
            onClick={onStart}
            disabled={!accepted || loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 text-base"
            data-testid="start-exam-button"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Preparando examen...</>
            ) : (
              <><Play className="w-5 h-5" /> Comenzar Examen</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───
export default function ExamAttemptPage() {
  const { subdomain, examId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  
  const [phase, setPhase] = useState('rules'); // 'rules' | 'loading' | 'exam' | 'error' | 'result'
  const [error, setError] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [examData, setExamData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [tabWarning, setTabWarning] = useState(null);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const timerRef = useRef(null);
  const autoSubmitTriggered = useRef(false);

  // Fetch exam metadata on mount (for rules screen)
  useEffect(() => {
    const fetchExamInfo = async () => {
      try {
        const res = await axios.get(`${API}/api/exams/${examId}/info`, { headers });
        setExamData({ title: res.data.title, subjectName: res.data.subject_name, subjectColor: res.data.subject_color });
      } catch {
        // Fallback: we'll get data on start
      }
    };
    fetchExamInfo();
  }, [examId]);
  
  const startExam = useCallback(async () => {
    try {
      setStartLoading(true);
      setPhase('loading');
      const startRes = await axios.post(`${API}/api/exams/${examId}/start`, {}, { headers });
      const { attempt_id, remaining_seconds } = startRes.data;
      setAttemptId(attempt_id);
      setRemainingSeconds(remaining_seconds);
      const questionsRes = await axios.get(`${API}/api/exams/${examId}/questions-for-student`, { headers });
      setExamData({ title: questionsRes.data.exam_title, subjectName: questionsRes.data.subject_name, subjectColor: questionsRes.data.subject_color });
      setQuestions(questionsRes.data.questions);
      setAnswers(questionsRes.data.saved_answers || {});
      setPhase('exam');
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo iniciar el examen');
      setPhase('error');
    } finally {
      setStartLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    if (remainingSeconds <= 0 || submitted) return;
    timerRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); if (!autoSubmitTriggered.current) { autoSubmitTriggered.current = true; handleSubmit(true); } return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [remainingSeconds > 0, submitted]);

  useEffect(() => {
    if (!attemptId) return;
    const handleVisibility = () => { if (document.hidden) setTabWarning('Has cambiado de pestaña. Esto queda registrado en el sistema.'); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [attemptId]);

  const formatTime = (secs) => { const m = Math.floor(secs / 60); const s = secs % 60; return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  
  const getTimerColor = () => {
    if (remainingSeconds <= 60) return { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', label: 'text-red-500', ring: 'ring-red-200', icon: 'text-red-500', pulse: true };
    if (remainingSeconds <= 300) return { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', label: 'text-amber-500', ring: 'ring-amber-200', icon: 'text-amber-500', pulse: true };
    return { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-900', label: 'text-slate-400', ring: 'ring-slate-100', icon: 'text-indigo-500', pulse: false };
  };

  const handleAnswerSelect = async (questionId, optionId, textAnswer = null) => {
    const newAnswers = { ...answers, [questionId]: optionId ? { selected_option_id: optionId } : { text_answer: textAnswer } };
    setAnswers(newAnswers);
    try {
      setSavingAnswer(true);
      await axios.post(`${API}/api/exam-attempts/${attemptId}/save-answer`, { question_id: questionId, ...(optionId ? { selected_option_id: optionId } : { text_answer: textAnswer }) }, { headers });
    } catch (err) { console.error('Error saving:', err); } finally { setSavingAnswer(false); }
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (submitting) return;
    setShowConfirmSubmit(false);
    try {
      setSubmitting(true);
      const res = await axios.post(`${API}/api/exam-attempts/${attemptId}/submit`, { auto_submitted: autoSubmit }, { headers });
      setResult(res.data);
      setSubmitted(true);
      setPhase('result');
      clearInterval(timerRef.current);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al enviar el examen');
    } finally { setSubmitting(false); }
  };

  const viewResults = () => navigate(`/${subdomain}/exam/${examId}/result/${attemptId}`);
  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).filter(qId => answers[qId]?.selected_option_id || answers[qId]?.text_answer).length;
  const timerStyle = getTimerColor();

  // ─── RULES SCREEN ───
  if (phase === 'rules') {
    return (
      <ExamRulesScreen 
        examTitle={examData?.title}
        subjectName={examData?.subjectName}
        onStart={startExam}
        loading={startLoading}
      />
    );
  }

  // ─── LOADING ───
  if (phase === 'loading') return (
    <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto" />
        <p className="text-slate-800 text-lg mt-4 font-semibold">Preparando tu examen...</p>
        <p className="text-slate-500 text-sm mt-1">Por favor espera un momento</p>
      </div>
    </div>
  );

  // ─── ERROR ───
  if (phase === 'error') return (
    <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center border border-slate-200">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-3">No disponible</h2>
        <p className="text-slate-500 mb-6">{error}</p>
        <button onClick={() => navigate(-1)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors">Volver</button>
      </div>
    </div>
  );

  // ─── RESULT ───
  if (phase === 'result' && result) return (
    <div className="min-h-screen bg-[#f8f9fc] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className={`px-8 py-10 text-center ${result.passed ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gradient-to-br from-slate-700 to-slate-800'}`}>
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
            {result.passed ? <Trophy className="w-10 h-10 text-yellow-300" /> : <Target className="w-10 h-10 text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{result.passed ? 'Felicitaciones!' : 'Sigue practicando'}</h1>
          <p className="text-white/80 text-sm">{examData?.title}</p>
        </div>
        <div className="p-8">
          <div className="text-center mb-6">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Tu nota</p>
            <div className="text-7xl font-black text-indigo-600 leading-none" data-testid="exam-nota">{result.max_score > 0 ? Math.round((result.score / result.max_score) * 20) : 0}</div>
            <p className="text-slate-400 text-base mt-2">{result.percentage.toFixed(0)}% &middot; {result.score} / {result.max_score} puntos</p>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-200">
              <div className="text-2xl font-bold text-emerald-600">{result.correct_count}</div>
              <div className="text-xs text-emerald-600 mt-1">Correctas</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center border border-red-200">
              <div className="text-2xl font-bold text-red-600">{result.incorrect_count}</div>
              <div className="text-xs text-red-600 mt-1">Incorrectas</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
              <div className="text-2xl font-bold text-slate-600">{result.unanswered_count}</div>
              <div className="text-xs text-slate-600 mt-1">Sin responder</div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate(`/${subdomain}/student/courses`)} className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors border border-slate-200">Volver</button>
            <button onClick={viewResults} className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">Ver detalle</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── MAIN EXAM VIEW ───
  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      {/* Tab warning */}
      {tabWarning && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 mx-4 border border-slate-200">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center"><Shield className="w-7 h-7 text-amber-600" /></div>
              <div><h3 className="text-lg font-bold text-slate-800">Advertencia</h3><p className="text-amber-600 text-sm">Sistema de seguridad activado</p></div>
            </div>
            <p className="text-slate-600 mb-6">{tabWarning}</p>
            <button onClick={() => setTabWarning(null)} className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors" data-testid="tab-warning-dismiss">Entendido</button>
          </div>
        </div>
      )}

      {/* Confirm submit */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 mx-4 border border-slate-200">
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4"><Send className="w-8 h-8 text-indigo-600" /></div>
              <h3 className="text-xl font-bold text-slate-800">Enviar examen?</h3>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-200">
              <div className="flex items-center justify-between text-slate-700 mb-2">
                <span>Respondidas:</span><span className="font-bold text-emerald-600">{answeredCount} / {questions.length}</span>
              </div>
              {answeredCount < questions.length && (
                <p className="text-amber-600 text-sm flex items-center gap-2 mt-2"><AlertCircle className="w-4 h-4" />{questions.length - answeredCount} pregunta(s) sin responder</p>
              )}
            </div>
            <p className="text-slate-500 text-sm text-center mb-5">Una vez enviado, no podras modificar tus respuestas.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmSubmit(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 border border-slate-200" data-testid="cancel-submit-btn">Cancelar</button>
              <button onClick={() => handleSubmit(false)} disabled={submitting} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20" data-testid="confirm-submit-btn">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800" data-testid="exam-title">{examData?.title}</h1>
                <p className="text-indigo-600 text-sm font-medium">{examData?.subjectName}</p>
              </div>
            </div>
            {/* Modern Timer - Bigger & Bolder */}
            <div className={`flex items-center gap-4 px-6 py-3 rounded-2xl border-2 ${timerStyle.bg} ${timerStyle.border} ${timerStyle.pulse ? 'animate-pulse' : ''} shadow-sm ring-4 ${timerStyle.ring}`} data-testid="exam-timer">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${timerStyle.bg}`}>
                <Timer className={`w-7 h-7 ${timerStyle.icon}`} />
              </div>
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-widest ${timerStyle.label}`}>Tiempo restante</p>
                <p className={`text-4xl font-black tracking-tight font-mono leading-none ${timerStyle.text}`} data-testid="timer-value">
                  {formatTime(remainingSeconds)}
                </p>
              </div>
            </div>
          </div>
          {/* Progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-slate-500">Progreso: <span className="text-emerald-600 font-semibold">{answeredCount}/{questions.length}</span></span>
              <span className="text-slate-500">Pregunta <span className="text-indigo-600 font-semibold">{currentIndex + 1}</span> de {questions.length}</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 rounded-full" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto w-full px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Card */}
          <div className="lg:col-span-3">
            {currentQuestion && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                {/* Q header */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-sm">{currentIndex + 1}</span></div>
                      <span className="text-white/90 font-medium text-sm">Pregunta {currentIndex + 1} de {questions.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-lg">
                      <Zap className="w-3.5 h-3.5 text-yellow-300" />
                      <span className="text-white font-bold text-sm">{currentQuestion.points || 1} pt{(currentQuestion.points || 1) > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
                {/* Q content */}
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-slate-800 mb-6 leading-relaxed">{currentQuestion.question_text}</h2>
                  {currentQuestion.image_url && (
                    <div className="mb-6 flex justify-center"><img src={currentQuestion.image_url} alt="Pregunta" className="max-h-64 rounded-xl shadow-md border border-slate-200" /></div>
                  )}
                  {/* Multiple choice */}
                  {currentQuestion.question_type === 'multiple_choice' && (
                    <div className="space-y-3">
                      {currentQuestion.options?.map((option, idx) => {
                        const isSelected = answers[currentQuestion.id]?.selected_option_id === option.id;
                        return (
                          <button key={option.id} onClick={() => handleAnswerSelect(currentQuestion.id, option.id)}
                            data-testid={`option-${idx}`}
                            className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 ${
                              isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                            }`}>
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm transition-all ${
                              isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>{isSelected ? <CheckCircle className="w-4 h-4" /> : String.fromCharCode(65 + idx)}</div>
                            <div className="flex-1 pt-1">
                              <span className={`font-medium ${isSelected ? 'text-indigo-800' : 'text-slate-700'}`}>{option.text}</span>
                              {option.image_url && <img src={option.image_url} alt={`Opción ${idx + 1}`} className="mt-3 max-h-36 rounded-lg" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* True/False */}
                  {currentQuestion.question_type === 'true_false' && (
                    <div className="grid grid-cols-2 gap-4">
                      {['true', 'false'].map((value) => {
                        const isSelected = answers[currentQuestion.id]?.selected_option_id === value;
                        return (
                          <button key={value} onClick={() => handleAnswerSelect(currentQuestion.id, value)}
                            data-testid={`tf-option-${value}`}
                            className={`p-6 rounded-xl border-2 text-center transition-all ${
                              isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                            }`}>
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 ${isSelected ? 'bg-indigo-600' : 'bg-slate-100'}`}>
                              {value === 'true' ? <CheckCircle className={`w-7 h-7 ${isSelected ? 'text-white' : 'text-emerald-500'}`} /> : <XCircle className={`w-7 h-7 ${isSelected ? 'text-white' : 'text-red-500'}`} />}
                            </div>
                            <span className={`font-bold text-lg ${isSelected ? 'text-indigo-800' : 'text-slate-700'}`}>{value === 'true' ? 'Verdadero' : 'Falso'}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* Open/Fill */}
                  {(currentQuestion.question_type === 'fill_blanks' || currentQuestion.question_type === 'open') && (
                    <textarea value={answers[currentQuestion.id]?.text_answer || ''} onChange={(e) => handleAnswerSelect(currentQuestion.id, null, e.target.value)}
                      placeholder="Escribe tu respuesta aquí..." rows={5}
                      data-testid="open-answer-textarea"
                      className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none resize-none text-slate-800 placeholder:text-slate-400" />
                  )}
                  {savingAnswer && <div className="mt-4 flex items-center gap-2 text-indigo-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Guardando...</div>}
                </div>
                {/* Navigation */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <button onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0}
                    data-testid="prev-question-btn"
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 rounded-xl font-medium hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-slate-200">
                    <ChevronLeft className="w-5 h-5" /> Anterior
                  </button>
                  {currentIndex < questions.length - 1 ? (
                    <button onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                      data-testid="next-question-btn"
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">
                      Siguiente <ChevronRight className="w-5 h-5" />
                    </button>
                  ) : (
                    <button onClick={() => setShowConfirmSubmit(true)} disabled={submitting}
                      data-testid="finish-exam-btn"
                      className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-colors disabled:opacity-50">
                      <Send className="w-5 h-5" /> Finalizar Examen
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Navigator */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky top-32 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
                <BookOpen className="w-4 h-4 text-indigo-500" /> Navegador
              </h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isAnswered = answers[q.id]?.selected_option_id || answers[q.id]?.text_answer;
                  const isCurrent = idx === currentIndex;
                  return (
                    <button key={q.id} onClick={() => setCurrentIndex(idx)}
                      data-testid={`nav-question-${idx}`}
                      className={`aspect-square rounded-lg font-bold text-xs transition-all ${
                        isCurrent ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 ring-offset-1' : isAnswered ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'
                      }`}>
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-slate-500"><span className="w-3 h-3 bg-emerald-100 rounded border border-emerald-300" /> Respondida</div>
                <div className="flex items-center gap-2 text-slate-500"><span className="w-3 h-3 bg-slate-50 rounded border border-slate-200" /> Sin responder</div>
                <div className="flex items-center gap-2 text-slate-500"><span className="w-3 h-3 bg-indigo-600 rounded" /> Actual</div>
              </div>
              <button onClick={() => setShowConfirmSubmit(true)} disabled={submitting}
                data-testid="sidebar-finish-btn"
                className="w-full mt-5 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                <Send className="w-4 h-4" /> Finalizar
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
