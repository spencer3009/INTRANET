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
      navigate(`/${subdomain}/login`);
      return;
    }
    fetchResult();
  }, []);
  
  const fetchResult = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/exam-attempts/${attemptId}/result`, { headers });
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
              onClick={() => navigate(`/${subdomain}/student/courses`)}
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
        
        {/* Questions Review — minimal, anti-cheat (no question text / no correct answers) */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-indigo-500" />
              <h3 className="text-xl font-bold text-slate-800">Detalle por pregunta</h3>
            </div>
            <button
              onClick={() => setShowAnswers(!showAnswers)}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 transition-colors"
            >
              {showAnswers ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          {showAnswers && (
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4">
                Aquí ves en qué preguntas acertaste o fallaste. Para revisar las respuestas correctas, consulta con tu profesor.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {result?.questions?.map((question, idx) => (
                  <div
                    key={question.id}
                    data-testid={`result-question-${idx + 1}`}
                    className={`rounded-xl border-2 p-3 flex flex-col items-center gap-1 ${
                      question.is_correct ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-300'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      question.is_correct ? 'bg-emerald-500' : 'bg-red-500'
                    }`}>
                      {question.is_correct ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <XCircle className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-600">
                      Pregunta {question.number ?? idx + 1}
                    </span>
                    <span className={`text-[11px] font-medium ${question.is_correct ? 'text-emerald-600' : 'text-red-600'}`}>
                      {question.is_correct ? 'Correcta' : 'Incorrecta'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Back button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => navigate(`/${subdomain}/student/courses`)}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-500/30 transition-all"
          >
            Volver a mis cursos
          </button>
        </div>
      </main>
    </div>
  );
}
