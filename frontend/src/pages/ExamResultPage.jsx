import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  CheckCircle, XCircle, Clock, ArrowLeft, Award, Target, AlertCircle,
  Loader2, BookOpen, User
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ExamResultPage() {
  const { subdomain, examId, attemptId } = useParams();
  const navigate = useNavigate();
  
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showAnswers, setShowAnswers] = useState(true);
  
  useEffect(() => {
    if (!token) {
      navigate(`/school/${subdomain}/login`);
      return;
    }
    fetchResult();
  }, []);
  
  const fetchResult = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/exam-attempts/${attemptId}/result`, { headers });
      setResult(res.data);
    } catch (err) {
      console.error('Error fetching result:', err);
      setError(err.response?.data?.detail || 'Error al cargar los resultados');
    } finally {
      setLoading(false);
    }
  };
  
  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-indigo-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Cargando resultados...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Error</h2>
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
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(`/school/${subdomain}/student/courses`)}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Volver a cursos
            </button>
            <div className="text-right">
              <h1 className="font-bold text-slate-800">{result?.exam_title}</h1>
              <p className="text-sm text-slate-500">{result?.subject_name}</p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Result Summary Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-8">
          {/* Header with result */}
          <div className={`px-8 py-8 ${result?.passed ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-500 to-rose-500'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center">
                  {result?.passed ? (
                    <Award className="w-10 h-10 text-white" />
                  ) : (
                    <Target className="w-10 h-10 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">
                    {result?.passed ? '¡Felicitaciones!' : 'Sigue practicando'}
                  </h2>
                  <p className="text-white/80">
                    {result?.passed ? 'Has aprobado el examen' : 'No alcanzaste el puntaje mínimo'}
                  </p>
                </div>
              </div>
              
              {/* Big percentage */}
              <div className="text-right">
                <div className="text-6xl font-bold text-white">
                  {result?.percentage?.toFixed(1)}%
                </div>
                <p className="text-white/80 text-lg">
                  {result?.score} / {result?.max_score} pts
                </p>
              </div>
            </div>
          </div>
          
          {/* Stats grid */}
          <div className="p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-emerald-50 rounded-2xl p-5 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <div className="text-3xl font-bold text-emerald-600">{result?.correct_count}</div>
                <div className="text-sm text-emerald-600 font-medium">Correctas</div>
              </div>
              <div className="bg-red-50 rounded-2xl p-5 text-center">
                <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <div className="text-3xl font-bold text-red-600">{result?.incorrect_count}</div>
                <div className="text-sm text-red-600 font-medium">Incorrectas</div>
              </div>
              <div className="bg-slate-100 rounded-2xl p-5 text-center">
                <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <div className="text-3xl font-bold text-slate-600">{result?.unanswered_count}</div>
                <div className="text-sm text-slate-600 font-medium">Sin responder</div>
              </div>
              <div className="bg-indigo-50 rounded-2xl p-5 text-center">
                <Clock className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                <div className="text-3xl font-bold text-indigo-600">{formatTime(result?.time_used_seconds || 0)}</div>
                <div className="text-sm text-indigo-600 font-medium">Tiempo usado</div>
              </div>
            </div>
            
            {/* Additional info */}
            <div className="flex items-center justify-between text-sm text-slate-500 bg-slate-50 rounded-xl p-4">
              <span>Puntaje mínimo para aprobar: <strong>{result?.min_percentage}%</strong></span>
              {result?.tab_changes > 0 && (
                <span className="text-amber-600">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Cambios de pestaña: {result?.tab_changes}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Questions Review */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-indigo-500" />
              <h3 className="text-xl font-bold text-slate-800">Revisión de respuestas</h3>
            </div>
            <button
              onClick={() => setShowAnswers(!showAnswers)}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition-colors"
            >
              {showAnswers ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          
          {showAnswers && (
            <div className="divide-y divide-slate-100">
              {result?.questions?.map((question, idx) => (
                <div 
                  key={question.id} 
                  className={`p-6 ${question.is_correct ? 'bg-emerald-50/50' : 'bg-red-50/50'}`}
                >
                  {/* Question header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      question.is_correct ? 'bg-emerald-500' : 'bg-red-500'
                    }`}>
                      {question.is_correct ? (
                        <CheckCircle className="w-6 h-6 text-white" />
                      ) : (
                        <XCircle className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-500">
                          Pregunta {idx + 1}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          question.is_correct 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {question.points_earned} / {question.points_possible} pts
                        </span>
                      </div>
                      <p className="text-slate-800 font-medium">{question.question_text}</p>
                      
                      {/* Question image */}
                      {question.image_url && (
                        <img 
                          src={question.image_url} 
                          alt="Pregunta"
                          className="mt-3 max-h-40 rounded-lg"
                        />
                      )}
                    </div>
                  </div>
                  
                  {/* Options for multiple choice */}
                  {question.question_type === 'multiple_choice' && question.options && (
                    <div className="ml-14 space-y-2">
                      {question.options.map((option, optIdx) => {
                        const isCorrect = option.id === question.correct_option_id;
                        const isSelected = option.id === question.student_answer;
                        
                        let bgColor = 'bg-white';
                        let borderColor = 'border-slate-200';
                        let textColor = 'text-slate-700';
                        
                        if (isCorrect) {
                          bgColor = 'bg-emerald-100';
                          borderColor = 'border-emerald-400';
                          textColor = 'text-emerald-800';
                        } else if (isSelected && !isCorrect) {
                          bgColor = 'bg-red-100';
                          borderColor = 'border-red-400';
                          textColor = 'text-red-800';
                        }
                        
                        return (
                          <div 
                            key={option.id}
                            className={`p-3 rounded-lg border-2 ${bgColor} ${borderColor} flex items-center gap-3`}
                          >
                            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                              isCorrect 
                                ? 'border-emerald-500 bg-emerald-500 text-white' 
                                : isSelected 
                                  ? 'border-red-500 bg-red-500 text-white'
                                  : 'border-slate-300 text-slate-500'
                            }`}>
                              {isCorrect ? <CheckCircle className="w-4 h-4" /> : isSelected ? <XCircle className="w-4 h-4" /> : String.fromCharCode(65 + optIdx)}
                            </div>
                            <span className={`${textColor} font-medium`}>
                              {option.text}
                            </span>
                            {isSelected && (
                              <span className="ml-auto text-xs font-semibold text-slate-500">
                                Tu respuesta
                              </span>
                            )}
                            {isCorrect && (
                              <span className="ml-auto text-xs font-semibold text-emerald-600">
                                Respuesta correcta
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* True/False */}
                  {question.question_type === 'true_false' && (
                    <div className="ml-14 flex gap-3">
                      {['true', 'false'].map((value) => {
                        const isCorrect = String(question.correct_answer).toLowerCase() === value;
                        const isSelected = String(question.student_answer).toLowerCase() === value;
                        
                        let bgColor = 'bg-white';
                        let borderColor = 'border-slate-200';
                        
                        if (isCorrect) {
                          bgColor = 'bg-emerald-100';
                          borderColor = 'border-emerald-400';
                        } else if (isSelected && !isCorrect) {
                          bgColor = 'bg-red-100';
                          borderColor = 'border-red-400';
                        }
                        
                        return (
                          <div 
                            key={value}
                            className={`flex-1 p-4 rounded-lg border-2 ${bgColor} ${borderColor} text-center`}
                          >
                            <span className="font-medium">
                              {value === 'true' ? 'Verdadero' : 'Falso'}
                            </span>
                            {isSelected && <span className="block text-xs text-slate-500 mt-1">Tu respuesta</span>}
                            {isCorrect && <span className="block text-xs text-emerald-600 mt-1">Correcta</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Fill blanks / Open */}
                  {(question.question_type === 'fill_blanks' || question.question_type === 'open') && (
                    <div className="ml-14 space-y-2">
                      <div className={`p-3 rounded-lg border-2 ${
                        question.is_correct ? 'bg-emerald-100 border-emerald-400' : 'bg-red-100 border-red-400'
                      }`}>
                        <span className="text-xs text-slate-500 block mb-1">Tu respuesta:</span>
                        <span className="font-medium">{question.student_answer || '(Sin responder)'}</span>
                      </div>
                      {!question.is_correct && (
                        <div className="p-3 rounded-lg border-2 bg-emerald-100 border-emerald-400">
                          <span className="text-xs text-slate-500 block mb-1">Respuesta correcta:</span>
                          <span className="font-medium text-emerald-800">{question.correct_answer}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Back button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => navigate(`/school/${subdomain}/student/courses`)}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-500/30 transition-all"
          >
            Volver a mis cursos
          </button>
        </div>
      </main>
    </div>
  );
}
