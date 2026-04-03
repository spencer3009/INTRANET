import { useState, useEffect, useCallback } from 'react';
import { Save, Trash2, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AnswerKeyEditor({ examId, numQuestions, optionsPerQuestion, initialAnswerKey, token, onSave }) {
  const [answers, setAnswers] = useState(() =>
    initialAnswerKey && initialAnswerKey.length === numQuestions
      ? [...initialAnswerKey]
      : Array(numQuestions).fill(null)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialAnswerKey && initialAnswerKey.length === numQuestions) {
      setAnswers([...initialAnswerKey]);
    } else {
      setAnswers(Array(numQuestions).fill(null));
    }
  }, [initialAnswerKey, numQuestions]);

  const letters = Array.from({ length: optionsPerQuestion }, (_, i) => String.fromCharCode(65 + i));
  const answered = answers.filter(a => a !== null).length;

  const toggle = useCallback((qIndex, letter) => {
    setAnswers(prev => {
      const next = [...prev];
      next[qIndex] = next[qIndex] === letter ? null : letter;
      return next;
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/exams/${examId}`, { answer_key: answers }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Clave de respuestas guardada');
      onSave?.(answers);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setAnswers(Array(numQuestions).fill(null));
  };

  // Layout columns
  let cols = 1;
  if (numQuestions > 50) cols = 3;
  else if (numQuestions > 25) cols = 2;

  const questionsPerCol = Math.ceil(numQuestions / cols);
  const columns = [];
  for (let c = 0; c < cols; c++) {
    const start = c * questionsPerCol;
    const end = Math.min(start + questionsPerCol, numQuestions);
    columns.push({ start, end });
  }

  const pct = numQuestions > 0 ? Math.round((answered / numQuestions) * 100) : 0;

  return (
    <div className="space-y-5" data-testid="answer-key-editor">
      {/* Progress */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">
            {answered} de {numQuestions} respuestas configuradas
          </span>
          <span className="text-xs font-bold text-emerald-600">{pct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Bubble Grid */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {columns.map((col, ci) => (
          <div key={ci} className="bg-white border border-gray-200 rounded-xl p-3 space-y-1">
            {Array.from({ length: col.end - col.start }, (_, i) => {
              const qIdx = col.start + i;
              return (
                <div key={qIdx} className="flex items-center gap-2 py-0.5">
                  <span className="w-8 text-right text-xs font-bold text-gray-500 shrink-0">
                    {qIdx + 1}.
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    {letters.map(letter => {
                      const selected = answers[qIdx] === letter;
                      return (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => toggle(qIdx, letter)}
                          data-testid={`bubble-${qIdx + 1}-${letter}`}
                          className={`
                            w-9 h-9 rounded-full text-xs font-bold transition-all duration-150
                            flex items-center justify-center shrink-0 select-none
                            ${selected
                              ? 'bg-emerald-600 text-white shadow-md scale-110'
                              : 'bg-white border-2 border-gray-300 text-gray-500 hover:border-emerald-400 hover:text-emerald-600'
                            }
                          `}
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <button
          onClick={handleClear}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          data-testid="answer-key-clear-btn"
        >
          <Trash2 className="w-4 h-4" />
          Limpiar todo
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          data-testid="answer-key-save-btn"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Guardar clave
        </button>
      </div>

      {answered === numQuestions && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
          <CheckCircle className="w-5 h-5 shrink-0" />
          Clave completa. Todas las preguntas tienen respuesta asignada.
        </div>
      )}
    </div>
  );
}
