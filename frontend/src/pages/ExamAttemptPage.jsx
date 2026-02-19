import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Clock, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, 
  XCircle, Loader2, Send, AlertCircle, Eye, EyeOff
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
          // Auto-submit when time runs out
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
            // Show warning for 5 seconds
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
      const res = await axios.post(`${API}/exam-attempts/${attemptId}/submit`, {}, { headers });
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Cargando examen...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error && !submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">No disponible</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
          {/* Header */}
          <div className={`px-8 py-6 ${result.passed ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-500 to-rose-500'}`}>
            <div className="flex items-center justify-center gap-3 mb-2">
              {result.passed ? (
                <CheckCircle className="w-10 h-10 text-white" />
              ) : (
                <XCircle className="w-10 h-10 text-white" />
              )}
              <h1 className="text-2xl font-bold text-white">
                {result.passed ? '¡Aprobado!' : 'No aprobado'}
              </h1>
            </div>
            <p className="text-white/80 text-center">{examData?.title}</p>
          </div>
          
          {/* Score */}
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="text-6xl font-bold text-slate-800 mb-2">
                {result.percentage.toFixed(1)}%
              </div>
              <p className="text-slate-500">
                {result.score} / {result.max_score} puntos
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Mínimo para aprobar: {result.min_percentage}%
              </p>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">{result.correct_count}</div>
                <div className="text-sm text-emerald-600">Correctas</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{result.incorrect_count}</div>
                <div className="text-sm text-red-600">Incorrectas</div>
              </div>
              <div className="bg-slate-100 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-slate-600">{result.unanswered_count}</div>
                <div className="text-sm text-slate-600">Sin responder</div>
              </div>
            </div>
            
            {/* Time used */}
            <div className="bg-slate-50 rounded-xl p-4 mb-6 flex items-center justify-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <span className="text-slate-600">
                Tiempo usado: {Math.floor(result.time_used_seconds / 60)}:{(result.time_used_seconds % 60).toString().padStart(2, '0')}
              </span>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => navigate(`/school/${subdomain}/student/courses`)}
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Volver a cursos
              </button>
              <button
                onClick={viewResults}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
              >
                Ver detalle
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Main exam view
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Tab warning overlay */}
      {tabWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">¡Advertencia!</h3>
            </div>
            <p className="text-slate-600 mb-4">{tabWarning}</p>
            <button
              onClick={() => setTabWarning(null)}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
      
      {/* Confirm submit modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <Send className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">¿Enviar examen?</h3>
            </div>
            <p className="text-slate-600 mb-2">
              Has respondido <span className="font-bold">{answeredCount}</span> de <span className="font-bold">{questions.length}</span> preguntas.
            </p>
            {answeredCount < questions.length && (
              <p className="text-amber-600 text-sm mb-4">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Tienes {questions.length - answeredCount} pregunta(s) sin responder.
              </p>
            )}
            <p className="text-slate-500 text-sm mb-6">
              Una vez enviado, no podrás modificar tus respuestas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Fixed Header */}
      <header className="sticky top-0 z-40 bg-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Exam title */}
            <div>
              <h1 className="text-xl font-bold text-slate-800">{examData?.title}</h1>
              <p className="text-sm text-slate-500">{examData?.subjectName}</p>
            </div>
            
            {/* Timer */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold ${
              remainingSeconds <= 300 
                ? 'bg-red-100 text-red-600 animate-pulse' 
                : 'bg-indigo-100 text-indigo-600'
            }`}>
              <Clock className="w-5 h-5" />
              {formatTime(remainingSeconds)}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm text-slate-500 mb-1">
              <span>Progreso: {answeredCount} / {questions.length} respondidas</span>
              <span>Pregunta {currentIndex + 1} de {questions.length}</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {currentQuestion && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Question header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <span className="text-white/80 text-sm font-medium">
                  Pregunta {currentIndex + 1} de {questions.length}
                </span>
                <span className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  {currentQuestion.points || 1} punto{(currentQuestion.points || 1) > 1 ? 's' : ''}
                </span>
              </div>
            </div>
            
            {/* Question content */}
            <div className="p-6">
              {/* Question text */}
              <h2 className="text-xl font-semibold text-slate-800 mb-6">
                {currentQuestion.question_text}
              </h2>
              
              {/* Question image */}
              {currentQuestion.image_url && (
                <div className="mb-6">
                  <img 
                    src={currentQuestion.image_url} 
                    alt="Pregunta"
                    className="max-h-60 rounded-xl shadow-md mx-auto"
                  />
                </div>
              )}
              
              {/* Options - Multiple Choice */}
              {currentQuestion.question_type === 'multiple_choice' && (
                <div className="space-y-3">
                  {currentQuestion.options?.map((option, idx) => {
                    const isSelected = answers[currentQuestion.id]?.selected_option_id === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => handleAnswerSelect(currentQuestion.id, option.id)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4 ${
                          isSelected 
                            ? 'border-indigo-500 bg-indigo-50' 
                            : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected 
                            ? 'border-indigo-500 bg-indigo-500 text-white' 
                            : 'border-slate-300'
                        }`}>
                          {isSelected ? <CheckCircle className="w-5 h-5" /> : String.fromCharCode(65 + idx)}
                        </div>
                        <div className="flex-1">
                          <span className={`font-medium ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {option.text}
                          </span>
                          {option.image_url && (
                            <img 
                              src={option.image_url} 
                              alt={`Opción ${idx + 1}`}
                              className="mt-3 max-h-40 rounded-lg"
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
                <div className="flex gap-4">
                  {['true', 'false'].map((value) => {
                    const isSelected = answers[currentQuestion.id]?.selected_option_id === value;
                    return (
                      <button
                        key={value}
                        onClick={() => handleAnswerSelect(currentQuestion.id, value)}
                        className={`flex-1 p-6 rounded-xl border-2 text-center transition-all ${
                          isSelected 
                            ? 'border-indigo-500 bg-indigo-50' 
                            : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center mx-auto mb-3 ${
                          isSelected 
                            ? 'border-indigo-500 bg-indigo-500 text-white' 
                            : 'border-slate-300'
                        }`}>
                          {value === 'true' ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                        </div>
                        <span className={`font-semibold text-lg ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
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
                    rows={4}
                    className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none resize-none text-slate-700"
                  />
                </div>
              )}
              
              {/* Saving indicator */}
              {savingAnswer && (
                <div className="mt-4 flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando respuesta...
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Anterior
          </button>
          
          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              Siguiente
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => setShowConfirmSubmit(true)}
              disabled={submitting}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
              Finalizar Examen
            </button>
          )}
        </div>
        
        {/* Question navigator */}
        <div className="mt-8 bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Navegador de preguntas</h3>
          <div className="flex flex-wrap gap-2">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id]?.selected_option_id || answers[q.id]?.text_answer;
              const isCurrent = idx === currentIndex;
              
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${
                    isCurrent 
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' 
                      : isAnswered 
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 bg-emerald-100 rounded"></span>
              Respondida
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 bg-slate-100 rounded"></span>
              Sin responder
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 bg-indigo-600 rounded"></span>
              Actual
            </span>
          </div>
        </div>
        
        {/* Submit button (always visible) */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setShowConfirmSubmit(true)}
            disabled={submitting}
            className="px-10 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold text-lg hover:from-emerald-600 hover:to-teal-600 shadow-xl shadow-emerald-500/30 transition-all disabled:opacity-50"
          >
            <Send className="w-6 h-6 inline mr-2" />
            Finalizar y Enviar Examen
          </button>
        </div>
      </main>
    </div>
  );
}
