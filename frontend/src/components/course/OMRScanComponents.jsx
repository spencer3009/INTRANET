import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Camera, Upload, ArrowLeft, Search, Check, X, AlertCircle,
  Loader2, RefreshCw, ChevronDown, ChevronUp, BookOpen,
  ChevronRight, ArrowRight
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

function OMRScanFlow({ exam, token, onClose, onScanComplete }) {
  const [step, setStep] = useState(1);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [replaceConfirm, setReplaceConfirm] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadStudents();
    return () => stopCamera();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/exams/${exam.id}/omr-students`, { headers });
      // Sort: unscanned first, then alphabetically
      const sorted = res.data.sort((a, b) => {
        if (a.has_scan !== b.has_scan) return a.has_scan ? 1 : -1;
        return a.full_name.localeCompare(b.full_name);
      });
      setStudents(sorted);
    } catch (err) {
      setError("Error al cargar alumnos");
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      setError("No se pudo acceder a la camara. Verifique los permisos.");
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setImageData(dataUrl);
    stopCamera();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImageData(ev.target.result);
    reader.readAsDataURL(file);
  };

  const dataURLtoBlob = (dataurl) => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };

  const processImage = async () => {
    if (!imageData || !selectedStudent) return;
    setProcessing(true);
    setError("");

    const blob = dataURLtoBlob(imageData);
    const formData = new FormData();
    formData.append("image", blob, "omr_scan.jpg");
    formData.append("student_id", selectedStudent.id);

    try {
      const res = await axios.post(`${API}/exams/${exam.id}/omr-scan`, formData, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
        timeout: 30000,
      });
      setResult(res.data);
      setStep(3);
      toast.success(`Escaneado: ${selectedStudent.full_name}`);
      if (onScanComplete) onScanComplete();
    } catch (err) {
      if (err.response?.status === 409) {
        const data = err.response.data;
        // Auto-replace since user already confirmed
        try {
          const putRes = await axios.put(
            `${API}/exams/${exam.id}/omr-scan/${data.existing_scan_id}`,
            formData,
            { headers: { ...headers, "Content-Type": "multipart/form-data" }, timeout: 30000 }
          );
          setResult(putRes.data);
          setStep(3);
          toast.success(`Resultado reemplazado: ${selectedStudent.full_name}`);
          if (onScanComplete) onScanComplete();
        } catch (putErr) {
          setError(putErr.response?.data?.detail || "Error al reemplazar resultado");
        }
      } else if (err.response?.status === 422) {
        setError(err.response.data.detail);
      } else {
        setError(err.response?.data?.detail || "Error al procesar la imagen");
      }
    } finally {
      setProcessing(false);
    }
  };

  const goToNextStudent = async () => {
    await loadStudents();
    setImageData(null);
    setResult(null);
    setError("");
    setReplaceConfirm(null);
    // Find next unscanned student
    // We need fresh data, so re-fetch
    try {
      const res = await axios.get(`${API}/exams/${exam.id}/omr-students`, { headers });
      const sorted = res.data.sort((a, b) => {
        if (a.has_scan !== b.has_scan) return a.has_scan ? 1 : -1;
        return a.full_name.localeCompare(b.full_name);
      });
      setStudents(sorted);
      const nextUnscanned = sorted.find(s => !s.has_scan);
      if (nextUnscanned) {
        setSelectedStudent(nextUnscanned);
        setStep(2);
      } else {
        setSelectedStudent(null);
        setStep(1);
      }
    } catch {
      setStep(1);
      setSelectedStudent(null);
    }
  };

  const scanAnother = () => {
    setStep(1);
    setSelectedStudent(null);
    setImageData(null);
    setResult(null);
    setError("");
    setReplaceConfirm(null);
    loadStudents();
  };

  const selectStudent = (st) => {
    if (st.has_scan) {
      setReplaceConfirm(st);
      return;
    }
    setReplaceConfirm(null);
    setSelectedStudent(st);
    setStep(2);
  };

  const confirmReplace = () => {
    if (replaceConfirm) {
      setSelectedStudent(replaceConfirm);
      setReplaceConfirm(null);
      setStep(2);
    }
  };

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const scannedCount = students.filter(s => s.has_scan).length;
  const totalCount = students.length;
  const progressPct = totalCount > 0 ? Math.round((scannedCount / totalCount) * 100) : 0;

  // Progress bar header (shared across all steps)
  const ProgressHeader = () => (
    <div className="mb-3">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
        <span className="font-semibold text-gray-700 truncate">{exam.title}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-medium">{scannedCount} / {totalCount} escaneados</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" data-testid="close-scan-x">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );

  if (step === 1) {
    return (
      <div className="space-y-3" data-testid="omr-scan-step1">
        <ProgressHeader />
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h3 className="text-base font-bold text-gray-800">Seleccionar alumno</h3>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar alumno..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            data-testid="omr-scan-search" />
        </div>

        {/* Replace confirm inline */}
        {replaceConfirm && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm" data-testid="replace-confirm">
            <p className="text-amber-800 font-medium mb-2">{replaceConfirm.full_name} ya tiene resultado ({replaceConfirm.scan_score}/{replaceConfirm.scan_total}). ¿Reemplazar?</p>
            <div className="flex gap-2">
              <button onClick={confirmReplace} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700">Sí, reemplazar</button>
              <button onClick={() => setReplaceConfirm(null)} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50">Cancelar</button>
            </div>
          </div>
        )}

        {scannedCount === totalCount && totalCount > 0 && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> Todos los alumnos han sido escaneados
          </div>
        )}

        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
        ) : (
          <div className="space-y-0.5 max-h-[50vh] overflow-y-auto">
            {filtered.map((st, idx) => (
              <button key={st.id} onClick={() => selectStudent(st)}
                className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left group min-h-[48px]"
                data-testid={`student-row-${idx}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                    st.has_scan ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500 group-hover:bg-emerald-50 group-hover:text-emerald-600'
                  }`}>{st.has_scan ? <Check className="w-3.5 h-3.5" /> : idx + 1}</span>
                  <span className="font-medium text-gray-700 text-sm truncate">{st.full_name}</span>
                </div>
                {st.has_scan ? (
                  <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg font-medium flex-shrink-0 ml-2">{st.scan_score}/{st.scan_total}</span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 ml-2" />
                )}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-center text-gray-400 py-4 text-sm">No se encontraron alumnos</p>}
          </div>
        )}
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-3" data-testid="omr-scan-step2">
        <ProgressHeader />
        <div className="flex items-center gap-3">
          <button onClick={() => { stopCamera(); setImageData(null); setStep(1); setReplaceConfirm(null); }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-800 truncate">Capturar hoja</h3>
            <p className="text-xs text-gray-500 truncate">{selectedStudent?.full_name}</p>
          </div>
        </div>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}
        {!imageData ? (
          <div className="space-y-3">
            {cameraActive ? (
              <div className="relative rounded-2xl overflow-hidden bg-black">
                <video ref={videoRef} autoPlay playsInline className="w-full" />
                <button onClick={capturePhoto}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-gray-300 shadow-lg hover:scale-105 transition-transform active:scale-95"
                  data-testid="capture-btn" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={startCamera}
                  className="flex flex-col items-center gap-2 p-5 sm:p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl hover:border-emerald-400 hover:bg-emerald-50 transition-all min-h-[100px]"
                  data-testid="open-camera-btn">
                  <Camera className="w-8 h-8 text-gray-400" />
                  <span className="text-xs sm:text-sm font-medium text-gray-600">Tomar foto</span>
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 p-5 sm:p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl hover:border-emerald-400 hover:bg-emerald-50 transition-all min-h-[100px]"
                  data-testid="upload-image-btn">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <span className="text-xs sm:text-sm font-medium text-gray-600">Subir imagen</span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden border border-gray-200">
              <img src={imageData} alt="Preview" className="w-full max-h-[50vh] object-contain bg-gray-50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setImageData(null); setError(""); }}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm min-h-[48px]"
                data-testid="retake-btn">Volver a tomar</button>
              <button onClick={processImage} disabled={processing}
                className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-sm min-h-[48px]"
                data-testid="process-btn">
                {processing ? <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</> : "Procesar"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 3 && result) {
    const grade = result.grade_vigesimal;
    const confLevel = result.confidence > 0.3 ? "high" : result.confidence > 0.15 ? "medium" : "low";
    const confColors = { high: "bg-emerald-500", medium: "bg-amber-500", low: "bg-red-500" };
    const correctCount = result.details?.filter(d => d.status === "correct").length || 0;
    const incorrectCount = result.details?.filter(d => d.status === "incorrect").length || 0;
    const blankCount = result.details?.filter(d => d.status === "blank").length || 0;
    const hasNextUnscanned = students.some(s => !s.has_scan && s.id !== selectedStudent?.id);

    return (
      <div className="space-y-3" data-testid="omr-scan-step3">
        <ProgressHeader />
        <h3 className="text-base font-bold text-gray-800">Resultado</h3>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
          <p className="text-sm opacity-70 mb-1">{selectedStudent?.full_name}</p>
          <div className="flex items-end gap-4">
            <span className="text-4xl font-black">{result.score}/{result.total}</span>
            <div className="pb-0.5">
              <p className="text-xl font-bold text-emerald-400">{grade}/20</p>
              <p className="text-xs opacity-60">{result.percentage}%</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs opacity-60">Confianza:</span>
            <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${confColors[confLevel]}`} style={{ width: `${Math.min(result.confidence * 100, 100)}%` }} />
            </div>
            <span className="text-xs font-mono">{(result.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
        {/* Compact answer grid - highlight errors only */}
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="flex flex-wrap gap-1.5 text-xs text-gray-500 mb-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{correctCount} correctas</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{incorrectCount} incorrectas</span>
            {blankCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" />{blankCount} en blanco</span>}
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {result.details?.map((d) => {
              const colors = { correct: "bg-emerald-50 text-emerald-600 border-emerald-200", incorrect: "bg-red-50 text-red-600 border-red-200", blank: "bg-gray-50 text-gray-400 border-gray-200", multiple: "bg-amber-50 text-amber-600 border-amber-200" };
              return (
                <div key={d.question} className={`flex flex-col items-center p-1 rounded-lg border text-[10px] ${colors[d.status]}`}
                  title={`P${d.question}: ${d.detected || "-"} (Correcta: ${d.correct})`}>
                  <span className="font-bold">{d.question}</span>
                  <span className="font-mono">{d.detected || "-"}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Action buttons */}
        <div className="space-y-2">
          <button onClick={goToNextStudent}
            className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm min-h-[52px]"
            data-testid="next-student-btn">
            {hasNextUnscanned ? (
              <><ArrowRight className="w-4 h-4" /> Siguiente alumno</>
            ) : (
              <><Check className="w-4 h-4" /> Todos escaneados - Volver a lista</>
            )}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={scanAnother} className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5">
              <Camera className="w-3.5 h-3.5" /> Otro alumno
            </button>
            <button onClick={onClose} className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-medium hover:bg-gray-200 transition-colors" data-testid="close-scan-btn">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}


// ── Student Detail View ──
function StudentScanDetail({ examId, studentId, token, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/exams/${examId}/omr-scan/${studentId}`, { headers });
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Error al cargar detalle");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [examId, studentId]);

  if (loading) return <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>;
  if (error) return <div className="p-4 bg-red-50 rounded-xl text-red-600 text-sm">{error}</div>;
  if (!data) return null;

  const confLevel = data.confidence > 0.3 ? "high" : data.confidence > 0.15 ? "medium" : "low";
  const confColors = { high: "bg-emerald-100 text-emerald-700", medium: "bg-amber-100 text-amber-700", low: "bg-red-100 text-red-700" };
  const confLabels = { high: "Alta", medium: "Media", low: "Baja" };
  const details = data.details || [];
  const correct = details.filter(d => d.status === "correct").length;
  const incorrect = details.filter(d => d.status === "incorrect").length;
  const blank = details.filter(d => d.status === "blank").length;
  const multiple = details.filter(d => d.status === "multiple").length;
  const scanDate = data.created_at ? new Date(data.created_at).toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const numOptions = data.options_per_question || 5;
  const optionLetters = Array.from({ length: numOptions }, (_, i) => String.fromCharCode(65 + i));
  const numQ = details.length;
  const gridCols = numQ <= 25 ? 1 : numQ <= 50 ? 2 : 3;

  return (
    <div className="space-y-4" data-testid="student-scan-detail">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors" data-testid="back-to-results">
        <ArrowLeft className="w-4 h-4" /> Volver a resultados
      </button>

      {/* Score Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
        <p className="text-sm opacity-70 mb-2">{data.student_name}</p>
        <div className="flex items-end gap-4 flex-wrap">
          <span className="text-5xl font-black">{data.score}/{data.total}</span>
          <div className="pb-1">
            <p className="text-2xl font-bold text-emerald-400">{data.grade_vigesimal}/20</p>
            <p className="text-sm opacity-60">{data.percentage}%</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <span className={`text-xs px-2 py-1 rounded-lg font-medium ${confColors[confLevel]}`}>
            Confianza: {confLabels[confLevel]}
          </span>
          {scanDate && <span className="text-xs opacity-50">{scanDate}</span>}
          {data.registered_to_gradebook && (
            <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg font-medium">Registrado</span>
          )}
        </div>
      </div>

      {/* Bubble Answer Grid */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h4 className="text-sm font-semibold text-gray-600 mb-3">Respuestas del alumno</h4>
        <div className={gridCols > 1 ? `grid grid-cols-1 sm:grid-cols-${gridCols} gap-x-6 gap-y-0` : ""}>
          {details.map((d) => {
            const detected = d.detected;
            const correctAns = d.correct;
            const isMultiple = d.status === "multiple";
            const isBlank = d.status === "blank";
            const markedLetters = isMultiple && typeof detected === "string" ? detected.split(",").map(s => s.trim()) : (detected ? [detected] : []);

            return (
              <div key={d.question} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                <span className="w-6 text-xs text-gray-400 font-mono text-right flex-shrink-0">{d.question}.</span>
                <div className="flex items-center gap-1">
                  {optionLetters.map((letter) => {
                    const isMarked = markedLetters.includes(letter);
                    const isCorrectOption = letter === correctAns;
                    let bg = "bg-white border-gray-200";
                    let textColor = "text-gray-300";

                    if (isMarked && d.status === "correct") {
                      bg = "bg-emerald-500 border-emerald-500";
                      textColor = "text-white";
                    } else if (isMarked && d.status === "incorrect") {
                      bg = "bg-red-500 border-red-500";
                      textColor = "text-white";
                    } else if (isMarked && isMultiple) {
                      bg = "bg-amber-400 border-amber-400";
                      textColor = "text-white";
                    } else if (!isMarked && isCorrectOption && (d.status === "incorrect" || isBlank || isMultiple)) {
                      bg = "bg-white border-emerald-400 border-dashed";
                      textColor = "text-emerald-600";
                    }

                    return (
                      <span
                        key={letter}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${bg} ${textColor}`}
                        title={isMarked ? `Marcada: ${letter}` : isCorrectOption ? `Correcta: ${letter}` : letter}
                      >
                        {letter}
                      </span>
                    );
                  })}
                </div>
                <span className="flex-shrink-0 w-4">
                  {d.status === "correct" && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  {d.status === "incorrect" && <X className="w-3.5 h-3.5 text-red-600" />}
                  {d.status === "blank" && <span className="text-gray-300 text-xs">-</span>}
                  {d.status === "multiple" && <AlertCircle className="w-3.5 h-3.5 text-amber-600" />}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500 border-t border-gray-100 pt-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{correct} correcta{correct !== 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{incorrect} incorrecta{incorrect !== 1 ? "s" : ""}</span>
          {blank > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400" />{blank} en blanco</span>}
          {multiple > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{multiple} multiple{multiple !== 1 ? "s" : ""}</span>}
        </div>
        {/* Legend */}
        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-emerald-500 inline-flex items-center justify-center text-white text-[8px] font-bold">A</span> Marcada correcta</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-red-500 border-2 border-red-500 inline-flex items-center justify-center text-white text-[8px] font-bold">B</span> Marcada incorrecta</span>
          <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-white border-2 border-dashed border-emerald-400 inline-flex items-center justify-center text-emerald-600 text-[8px] font-bold">C</span> Correcta (no marcada)</span>
        </div>
      </div>
    </div>
  );
}


function OMRResultsCard({ exam, token, onRegisterComplete }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { loadResults(); }, [exam.id]);

  const loadResults = async () => {
    try {
      const res = await axios.get(`${API}/exams/${exam.id}/omr-results`, { headers });
      setResults(res.data);
    } catch (err) {
      console.error("Error loading results:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!exam.register_column) {
      alert("Configure el destino en el Registro Auxiliar primero (EM, EB, P1, P2, P3)");
      return;
    }
    const colNames = { EM: "Examen Mensual", EB: "Examen Bimestral", P1: "Práctica 1", P2: "Práctica 2", P3: "Práctica 3" };
    if (!window.confirm(`¿Registrar ${results.length} notas en ${colNames[exam.register_column] || exam.register_column}?`)) return;

    setRegistering(true);
    try {
      const res = await axios.post(`${API}/exams/${exam.id}/omr-register-grades`, {}, { headers });
      alert(res.data.message);
      loadResults();
      if (onRegisterComplete) onRegisterComplete();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al registrar notas");
    } finally {
      setRegistering(false);
    }
  };

  if (loading) return null;
  if (results.length === 0) return null;

  // If viewing student detail
  if (selectedStudentId) {
    return (
      <div data-testid="omr-results-card">
        <StudentScanDetail
          examId={exam.id}
          studentId={selectedStudentId}
          token={token}
          onBack={() => setSelectedStudentId(null)}
        />
      </div>
    );
  }

  const avg = (results.reduce((s, r) => s + r.grade_vigesimal, 0) / results.length).toFixed(1);
  const highest = Math.max(...results.map(r => r.grade_vigesimal));
  const lowest = Math.min(...results.map(r => r.grade_vigesimal));
  const allRegistered = results.every(r => r.registered_to_gradebook);

  return (
    <div data-testid="omr-results-card">
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-gray-800">{avg}</p>
            <p className="text-xs text-gray-500">Promedio</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700">{highest}</p>
            <p className="text-xs text-emerald-600">Más alta</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{lowest}</p>
            <p className="text-xs text-red-600">Más baja</p>
          </div>
        </div>

        {/* Register Button */}
        <button onClick={handleRegister} disabled={registering || allRegistered || !exam.register_column}
          className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          data-testid="register-grades-btn"
          title={!exam.register_column ? "Configure el destino en el Registro Auxiliar primero" : ""}>
          {registering ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
          {allRegistered ? "Notas ya registradas" : "Registrar notas en Registro Auxiliar"}
        </button>
        {!exam.register_column && (
          <p className="text-xs text-amber-600 text-center">Configure el destino (EM, EB, P1, P2, P3) al editar el examen</p>
        )}

        {/* Toggle Table */}
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          {expanded ? <><ChevronUp className="w-4 h-4" /> Ocultar detalle</> : <><ChevronDown className="w-4 h-4" /> Ver detalle por alumno</>}
        </button>

        {expanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">#</th>
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Alumno</th>
                  <th className="text-center py-2 px-2 text-gray-500 font-medium">Nota</th>
                  <th className="text-center py-2 px-2 text-gray-500 font-medium">%</th>
                  <th className="text-center py-2 px-2 text-gray-500 font-medium">Registro</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.scan_id}
                    onClick={() => setSelectedStudentId(r.student_id)}
                    className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
                    data-testid={`result-row-${i}`}>
                    <td className="py-2.5 px-2 text-gray-400">{i + 1}</td>
                    <td className="py-2.5 px-2 font-medium text-gray-700">{r.student_name}</td>
                    <td className="py-2.5 px-2 text-center font-bold">{r.grade_vigesimal}/20</td>
                    <td className="py-2.5 px-2 text-center text-gray-500">{r.percentage}%</td>
                    <td className="py-2.5 px-2 text-center">
                      {r.registered_to_gradebook ? (
                        <span className="text-emerald-600 text-xs font-medium">Registrado</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Pendiente</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2"><ChevronRight className="w-4 h-4 text-gray-300" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export { OMRScanFlow, OMRResultsCard };
