import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Clock, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, 
  XCircle, Loader2, Send, AlertCircle, Timer, Trophy, Target,
  Zap, Shield, BookOpen
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ExamAttemptPage() {
  const { subdomain, examId } = useParams();
  const navigate = useNavigate();
  
  // Auth
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  
  // State
  const [loading, setLoading] = useState(true);
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
  
  const timerRef = useRef(null);
  const autoSubmitTriggered = useRef(false);
  
  // Start exam attempt
  const startExam = useCallback(async () => {
    try {
      setLoading(true);
      
      // Start attempt
      const startRes = await axios.post(`${API}/api/exams/${examId}/start`, {}, { headers });
      const { attempt_id, remaining_seconds } = startRes.data;
      
      setAttemptId(attempt_id);
      setRemainingSeconds(remaining_seconds);
      
      // Get questions
      const questionsRes = await axios.get(`${API}/api/exams/${examId}/questions-for-student`, { headers });
      setExamData({
        title: questionsRes.data.exam_title,
        subjectName: questionsRes.data.subject_name,
        subjectColor: questionsRes.data.subject_color
      });
      setQuestions(questionsRes.data.questions);
      setAnswers(questionsRes.data.saved_answers || {});
      
    } catch (err) {
      console.error('Error starting exam:', err);
      const detail = err.response?.data?.detail || 'Error al iniciar el examen';
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, [examId, headers]);
  
  // Initialize
  useEffect(() => {
    if (!token) {
      navigate(`/school/${subdomain}/login`);
      return;
    }
    startExam();
  }, []);
  
  // Timer countdown
  useEffect(() => {
    if (remainingSeconds <= 0 || submitted) return;
    
    timerRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!autoSubmitTriggered.current) {
            autoSubmitTriggered.current = true;
            handleSubmit(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timerRef.current);
  }, [remainingSeconds, submitted]);
  
  // Tab visibility change detection (anti-cheat)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden && attemptId && !submitted) {
        try {
          const res = await axios.post(`${API}/api/exam-attempts/${attemptId}/report-tab-change`, {}, { headers });
          setTabWarning(res.data.warning);
          
          if (res.data.force_submit) {
            handleSubmit(true);
          } else {
            setTimeout(() => setTabWarning(null), 5000);
          }
        } catch (err) {
          console.error('Error reporting tab change:', err);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [attemptId, submitted]);
  
  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Get time color based on remaining time
  const getTimeColor = () => {
    if (remainingSeconds <= 60) return 'from-red-600 to-red-700'; // Last minute - red
    if (remainingSeconds <= 300) return 'from-orange-500 to-red-500'; // Last 5 minutes - orange/red
    return 'from-emerald-500 to-teal-500'; // Normal - green
  };
  
  // Save answer
  const saveAnswer = async (questionId, optionId, textAnswer) => {
    if (!attemptId) return;
    
    setSavingAnswer(true);
    try {
      await axios.post(`${API}/api/exam-attempts/${attemptId}/save-answer`, {
        question_id: questionId,
        selected_option_id: optionId || null,
        text_answer: textAnswer || null
      }, { headers });
    } catch (err) {
      console.error('Error saving answer:', err);
    } finally {
      setSavingAnswer(false);
    }
  };
  
  // Handle answer selection
  const handleAnswerSelect = (questionId, optionId, textAnswer = null) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        selected_option_id: optionId,
        text_answer: textAnswer
      }
    }));
    saveAnswer(questionId, optionId, textAnswer);
  };
  
  // Submit exam
  const handleSubmit = async (isAutoSubmit = false) => {
    if (submitting || submitted) return;
    
    setSubmitting(true);
    setShowConfirmSubmit(false);
    
    try {
      const res = await axios.post(`${API}/api/exam-attempts/${attemptId}/submit`, {}, { headers });
      setResult(res.data);
      setSubmitted(true);
      clearInterval(timerRef.current);
    } catch (err) {
      console.error('Error submitting exam:', err);
      setError(err.response?.data?.detail || 'Error al enviar el examen');
    } finally {
      setSubmitting(false);
    }
  };
  
  // View full results
  const viewResults = () => {
    navigate(`/school/${subdomain}/exam/${examId}/result/${attemptId}`);
  };
  
  // Current question
  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).filter(qId => 
    answers[qId]?.selected_option_id || answers[qId]?.text_answer
  ).length;
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-purple-500/30 rounded-full"></div>
            <div className="absolute inset-0 w-24 h-24 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-white text-xl mt-6 font-medium">Preparando tu examen...</p>
          <p className="text-purple-300 text-sm mt-2">Por favor espera un momento</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error && !submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl max-w-md w-full p-8 text-center border border-white/20">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">No disponible</h2>
          <p className="text-white/70 mb-6">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-8 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-indigo-600 transition-all shadow-lg shadow-purple-500/25"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }
  
  // Result state (after submission)
  if (submitted && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-white/20">
          {/* Animated background */}
          <div className={`relative px-8 py-10 overflow-hidden ${result.passed ? 'bg-gradient-to-br from-emerald-600/50 to-teal-600/50' : 'bg-gradient-to-br from-red-600/50 to-rose-600/50'}`}>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzLTItMi00LTItNC0yLTQtMi0yIDItMiA0IDIgNCAyIDQgMiA0IDQgMiA0IDIgNC0yIDItMiAyLTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30"></div>
            <div className="relative text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
                {result.passed ? (
                  <Trophy className="w-12 h-12 text-yellow-300" />
                ) : (
                  <Target className="w-12 h-12 text-white" />
                )}
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {result.passed ? '¡Felicitaciones!' : 'Sigue practicando'}
              </h1>
              <p className="text-white/80">{examData?.title}</p>
            </div>
          </div>
          
          {/* Score */}
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="text-7xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                {result.percentage.toFixed(0)}%
              </div>
              <p className="text-white/60">
                {result.score} / {result.max_score} puntos
              </p>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-emerald-500/20 rounded-2xl p-4 text-center border border-emerald-500/30">
                <div className="text-3xl font-bold text-emerald-400">{result.correct_count}</div>
                <div className="text-xs text-emerald-300 mt-1">Correctas</div>
              </div>
              <div className="bg-red-500/20 rounded-2xl p-4 text-center border border-red-500/30">
                <div className="text-3xl font-bold text-red-400">{result.incorrect_count}</div>
                <div className="text-xs text-red-300 mt-1">Incorrectas</div>
              </div>
              <div className="bg-slate-500/20 rounded-2xl p-4 text-center border border-slate-500/30">
                <div className="text-3xl font-bold text-slate-400">{result.unanswered_count}</div>
                <div className="text-xs text-slate-300 mt-1">Sin responder</div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/school/${subdomain}/student/courses`)}
                className="flex-1 px-6 py-4 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all border border-white/20"
              >
                Volver a cursos
              </button>
              <button
                onClick={viewResults}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-indigo-600 transition-all shadow-lg shadow-purple-500/25"
              >
                Ver detalle
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Main exam view - PREMIUM DESIGN
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900">
      {/* Tab warning overlay */}
      {tabWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 backdrop-blur-xl rounded-3xl shadow-2xl max-w-md w-full p-8 mx-4 border border-amber-500/30">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">¡Advertencia!</h3>
                <p className="text-amber-300 text-sm">Sistema de seguridad activado</p>
              </div>
            </div>
            <p className="text-white/80 mb-6">{tabWarning}</p>
            <button
              onClick={() => setTabWarning(null)}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:from-amber-600 hover:to-orange-600 transition-all"
            >
              Entendido, continuaré aquí
            </button>
          </div>
        </div>
      )}
      
      {/* Confirm submit modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="bg-gradient-to-br from-purple-500/20 to-indigo-500/20 backdrop-blur-xl rounded-3xl shadow-2xl max-w-md w-full p-8 mx-4 border border-purple-500/30">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="w-10 h-10 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-white">¿Enviar examen?</h3>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between text-white mb-2">
                <span>Respondidas:</span>
                <span className="font-bold text-emerald-400">{answeredCount} / {questions.length}</span>
              </div>
              {answeredCount < questions.length && (
                <p className="text-amber-400 text-sm flex items-center gap-2 mt-2">
                  <AlertCircle className="w-4 h-4" />
                  {questions.length - answeredCount} pregunta(s) sin responder
                </p>
              )}
            </div>
            <p className="text-white/60 text-sm text-center mb-6">
              Una vez enviado, no podrás modificar tus respuestas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 py-4 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 border border-white/20"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Premium Fixed Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Exam info */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{examData?.title}</h1>
                <p className="text-purple-300 text-sm">{examData?.subjectName}</p>
              </div>
            </div>
            
            {/* PREMIUM TIMER */}
            <div className={`relative bg-gradient-to-r ${getTimeColor()} rounded-2xl p-1 shadow-2xl ${remainingSeconds <= 300 ? 'animate-pulse' : ''}`}>
              <div className="bg-slate-900 rounded-xl px-6 py-3 flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getTimeColor()} flex items-center justify-center`}>
                  <Timer className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Tiempo restante</p>
                  <p className={`text-3xl font-black font-mono tracking-tight ${remainingSeconds <= 300 ? 'text-red-400' : 'text-white'}`}>
                    {formatTime(remainingSeconds)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/60">Progreso: <span className="text-emerald-400 font-semibold">{answeredCount} / {questions.length}</span> respondidas</span>
              <span className="text-white/60">Pregunta <span className="text-purple-400 font-semibold">{currentIndex + 1}</span> de {questions.length}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 transition-all duration-500 rounded-full"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="max-w-6xl mx-auto w-full px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Card - Main */}
          <div className="lg:col-span-3">
            {currentQuestion && (
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                {/* Question header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        <span className="text-white font-bold">{currentIndex + 1}</span>
                      </div>
                      <span className="text-white/80 font-medium">
                        Pregunta {currentIndex + 1} de {questions.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-xl">
                      <Zap className="w-4 h-4 text-yellow-300" />
                      <span className="text-white font-bold">{currentQuestion.points || 1} punto{(currentQuestion.points || 1) > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
                
                {/* Question content */}
                <div className="p-8">
                  {/* Question text */}
                  <h2 className="text-2xl font-semibold text-white mb-8 leading-relaxed">
                    {currentQuestion.question_text}
                  </h2>
                  
                  {/* Question image */}
                  {currentQuestion.image_url && (
                    <div className="mb-8 flex justify-center">
                      <img 
                        src={currentQuestion.image_url} 
                        alt="Pregunta"
                        className="max-h-72 rounded-2xl shadow-2xl border border-white/10"
                      />
                    </div>
                  )}
                  
                  {/* Options - Multiple Choice */}
                  {currentQuestion.question_type === 'multiple_choice' && (
                    <div className="space-y-4">
                      {currentQuestion.options?.map((option, idx) => {
                        const isSelected = answers[currentQuestion.id]?.selected_option_id === option.id;
                        return (
                          <button
                            key={option.id}
                            onClick={() => handleAnswerSelect(currentQuestion.id, option.id)}
                            className={`w-full p-5 rounded-2xl border-2 text-left transition-all flex items-start gap-4 group ${
                              isSelected 
                                ? 'border-purple-500 bg-purple-500/20' 
                                : 'border-white/10 hover:border-purple-500/50 hover:bg-white/5'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold transition-all ${
                              isSelected 
                                ? 'bg-purple-500 text-white' 
                                : 'bg-white/10 text-white/60 group-hover:bg-purple-500/30 group-hover:text-white'
                            }`}>
                              {isSelected ? <CheckCircle className="w-5 h-5" /> : String.fromCharCode(65 + idx)}
                            </div>
                            <div className="flex-1 pt-1">
                              <span className={`text-lg font-medium ${isSelected ? 'text-white' : 'text-white/80'}`}>
                                {option.text}
                              </span>
                              {option.image_url && (
                                <img 
                                  src={option.image_url} 
                                  alt={`Opción ${idx + 1}`}
                                  className="mt-4 max-h-40 rounded-xl"
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Options - True/False */}
                  {currentQuestion.question_type === 'true_false' && (
                    <div className="grid grid-cols-2 gap-4">
                      {['true', 'false'].map((value) => {
                        const isSelected = answers[currentQuestion.id]?.selected_option_id === value;
                        return (
                          <button
                            key={value}
                            onClick={() => handleAnswerSelect(currentQuestion.id, value)}
                            className={`p-8 rounded-2xl border-2 text-center transition-all ${
                              isSelected 
                                ? 'border-purple-500 bg-purple-500/20' 
                                : 'border-white/10 hover:border-purple-500/50 hover:bg-white/5'
                            }`}
                          >
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                              isSelected 
                                ? 'bg-purple-500' 
                                : 'bg-white/10'
                            }`}>
                              {value === 'true' ? (
                                <CheckCircle className={`w-8 h-8 ${isSelected ? 'text-white' : 'text-emerald-400'}`} />
                              ) : (
                                <XCircle className={`w-8 h-8 ${isSelected ? 'text-white' : 'text-red-400'}`} />
                              )}
                            </div>
                            <span className={`font-bold text-xl ${isSelected ? 'text-white' : 'text-white/80'}`}>
                              {value === 'true' ? 'Verdadero' : 'Falso'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Input - Fill blanks / Open */}
                  {(currentQuestion.question_type === 'fill_blanks' || currentQuestion.question_type === 'open') && (
                    <div>
                      <textarea
                        value={answers[currentQuestion.id]?.text_answer || ''}
                        onChange={(e) => handleAnswerSelect(currentQuestion.id, null, e.target.value)}
                        placeholder="Escribe tu respuesta aquí..."
                        rows={5}
                        className="w-full p-5 bg-white/5 border-2 border-white/10 rounded-2xl focus:border-purple-500 focus:outline-none resize-none text-white text-lg placeholder:text-white/40"
                      />
                    </div>
                  )}
                  
                  {/* Saving indicator */}
                  {savingAnswer && (
                    <div className="mt-6 flex items-center gap-2 text-purple-400 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando respuesta automáticamente...
                    </div>
                  )}
                </div>
                
                {/* Navigation */}
                <div className="px-8 py-6 bg-white/5 border-t border-white/10 flex items-center justify-between">
                  <button
                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-white/10"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Anterior
                  </button>
                  
                  {currentIndex < questions.length - 1 ? (
                    <button
                      onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-indigo-600 transition-all shadow-lg shadow-purple-500/25"
                    >
                      Siguiente
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowConfirmSubmit(true)}
                      disabled={submitting}
                      className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                    >
                      <Send className="w-5 h-5" />
                      Finalizar Examen
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Sidebar - Question navigator */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 sticky top-32">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-400" />
                Navegador
              </h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isAnswered = answers[q.id]?.selected_option_id || answers[q.id]?.text_answer;
                  const isCurrent = idx === currentIndex;
                  
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`aspect-square rounded-xl font-bold text-sm transition-all ${
                        isCurrent 
                          ? 'bg-gradient-to-br from-purple-500 to-indigo-500 text-white ring-2 ring-purple-400 ring-offset-2 ring-offset-slate-900' 
                          : isAnswered 
                            ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50' 
                            : 'bg-white/10 text-white/60 hover:bg-white/20 border border-white/10'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
              
              {/* Legend */}
              <div className="mt-6 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-white/60">
                  <span className="w-4 h-4 bg-emerald-500/30 rounded border border-emerald-500/50"></span>
                  Respondida
                </div>
                <div className="flex items-center gap-2 text-white/60">
                  <span className="w-4 h-4 bg-white/10 rounded border border-white/10"></span>
                  Sin responder
                </div>
                <div className="flex items-center gap-2 text-white/60">
                  <span className="w-4 h-4 bg-gradient-to-br from-purple-500 to-indigo-500 rounded"></span>
                  Actual
                </div>
              </div>
              
              {/* Submit button */}
              <button
                onClick={() => setShowConfirmSubmit(true)}
                disabled={submitting}
                className="w-full mt-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                Finalizar
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
