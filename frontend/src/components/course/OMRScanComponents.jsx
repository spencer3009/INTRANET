import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  Camera, Upload, ArrowLeft, Search, Check, X, AlertCircle,
  Loader2, RefreshCw, ChevronDown, ChevronUp, BookOpen,
  ExternalLink, ChevronRight
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
      setStudents(res.data);
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
      if (onScanComplete) onScanComplete();
    } catch (err) {
      if (err.response?.status === 409) {
        const data = err.response.data;
        if (window.confirm(`${selectedStudent.full_name} ya tiene resultado. ¿Reemplazar?`)) {
          try {
            const putRes = await axios.put(
              `${API}/exams/${exam.id}/omr-scan/${data.existing_scan_id}`,
              formData,
              { headers: { ...headers, "Content-Type": "multipart/form-data" }, timeout: 30000 }
            );
            setResult(putRes.data);
            setStep(3);
            if (onScanComplete) onScanComplete();
          } catch (putErr) {
            setError(putErr.response?.data?.detail || "Error al reemplazar resultado");
          }
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

  const scanAnother = () => {
    setStep(1);
    setSelectedStudent(null);
    setImageData(null);
    setResult(null);
    setError("");
    loadStudents();
  };

  const selectStudent = (st) => {
    if (st.has_scan && !window.confirm(`${st.full_name} ya tiene resultado (${st.scan_score}/${st.scan_total}). ¿Reemplazar?`)) return;
    setSelectedStudent(st);
    setStep(2);
  };

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase())
  );

  if (step === 1) {
    return (
      <div className="space-y-4" data-testid="omr-scan-step1">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h3 className="text-lg font-bold text-gray-800">Seleccionar alumno</h3>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar alumno..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            data-testid="omr-scan-search" />
        </div>
        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {filtered.map((st, idx) => (
              <button key={st.id} onClick={() => selectStudent(st)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left group"
                data-testid={`student-row-${idx}`}>
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-semibold text-gray-500 group-hover:bg-purple-100 group-hover:text-purple-600">{idx + 1}</span>
                  <span className="font-medium text-gray-700">{st.full_name}</span>
                </div>
                {st.has_scan ? (
                  <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-medium">{st.scan_score}/{st.scan_total}</span>
                ) : (
                  <span className="text-xs text-gray-400">Sin escanear</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-center text-gray-400 py-4">No se encontraron alumnos</p>}
          </div>
        )}
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-4" data-testid="omr-scan-step2">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => { stopCamera(); setImageData(null); setStep(1); }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Capturar hoja</h3>
            <p className="text-sm text-gray-500">{selectedStudent?.full_name}</p>
          </div>
        </div>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}
        {!imageData ? (
          <div className="space-y-4">
            {cameraActive ? (
              <div className="relative rounded-2xl overflow-hidden bg-black">
                <video ref={videoRef} autoPlay playsInline className="w-full" />
                <button onClick={capturePhoto}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-gray-300 shadow-lg hover:scale-105 transition-transform"
                  data-testid="capture-btn" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={startCamera}
                  className="flex flex-col items-center gap-3 p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl hover:border-purple-400 hover:bg-purple-50 transition-all"
                  data-testid="open-camera-btn">
                  <Camera className="w-10 h-10 text-gray-400" />
                  <span className="text-sm font-medium text-gray-600">Tomar foto</span>
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl hover:border-purple-400 hover:bg-purple-50 transition-all"
                  data-testid="upload-image-btn">
                  <Upload className="w-10 h-10 text-gray-400" />
                  <span className="text-sm font-medium text-gray-600">Subir imagen</span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-gray-200">
              <img src={imageData} alt="Preview" className="w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setImageData(null); setError(""); }}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                data-testid="retake-btn">Volver a tomar</button>
              <button onClick={processImage} disabled={processing}
                className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
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
    return (
      <div className="space-y-4" data-testid="omr-scan-step3">
        <h3 className="text-lg font-bold text-gray-800">Resultado</h3>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
          <p className="text-sm opacity-70 mb-1">{selectedStudent?.full_name}</p>
          <div className="flex items-end gap-4">
            <span className="text-5xl font-black">{result.score}/{result.total}</span>
            <div className="pb-1">
              <p className="text-2xl font-bold text-emerald-400">{grade}/20</p>
              <p className="text-sm opacity-60">{result.percentage}%</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs opacity-60">Confianza:</span>
            <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${confColors[confLevel]}`} style={{ width: `${Math.min(result.confidence * 100, 100)}%` }} />
            </div>
            <span className="text-xs font-mono">{(result.confidence * 100).toFixed(0)}%</span>
          </div>
          {result.warnings?.length > 0 && (
            <p className="mt-2 text-xs text-amber-300 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{result.warnings[0]}</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h4 className="text-sm font-semibold text-gray-600 mb-3">Detalle por pregunta</h4>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {result.details?.map((d) => {
              const colors = { correct: "bg-emerald-100 text-emerald-700 border-emerald-200", incorrect: "bg-red-100 text-red-700 border-red-200", blank: "bg-gray-100 text-gray-400 border-gray-200", multiple: "bg-amber-100 text-amber-700 border-amber-200" };
              return (
                <div key={d.question} className={`flex flex-col items-center p-1.5 rounded-lg border text-xs ${colors[d.status]}`}
                  title={`P${d.question}: ${d.detected || "-"} (Correcta: ${d.correct})`}>
                  <span className="font-bold">{d.question}</span>
                  <span className="font-mono">{d.detected || "-"}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={scanAnother} className="px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2" data-testid="scan-another-btn">
            <Camera className="w-4 h-4" /> Escanear otro
          </button>
          <button onClick={onClose} className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors" data-testid="close-scan-btn">
            Cerrar
          </button>
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
  const useTwoCols = details.length > 20;
  const scanDate = data.created_at ? new Date(data.created_at).toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

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

      {/* Answer Grid */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h4 className="text-sm font-semibold text-gray-600 mb-3">Detalle por pregunta</h4>
        <div className={useTwoCols ? "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1" : "space-y-1"}>
          {details.map((d) => {
            const statusStyles = {
              correct: "bg-emerald-50 border-emerald-200",
              incorrect: "bg-red-50 border-red-200",
              blank: "bg-gray-50 border-gray-200",
              multiple: "bg-amber-50 border-amber-200",
            };
            const statusIcons = {
              correct: <Check className="w-3.5 h-3.5 text-emerald-600" />,
              incorrect: <X className="w-3.5 h-3.5 text-red-600" />,
              blank: <span className="w-3.5 h-3.5 text-gray-400 text-center text-xs">-</span>,
              multiple: <AlertCircle className="w-3.5 h-3.5 text-amber-600" />,
            };
            return (
              <div key={d.question} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${statusStyles[d.status]}`}>
                <span className="w-7 text-gray-500 font-mono text-xs text-right">{d.question}.</span>
                <span className="w-5">{statusIcons[d.status]}</span>
                <span className="font-semibold w-6 text-center">{d.detected || "-"}</span>
                {d.status === "incorrect" && (
                  <span className="text-xs text-gray-400 ml-1">(era {d.correct})</span>
                )}
                {d.status === "multiple" && (
                  <span className="text-xs text-amber-600 ml-1">Multiple</span>
                )}
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
      </div>

      {/* Scanned Sheet Image */}
      {data.image_url && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h4 className="text-sm font-semibold text-gray-600 mb-3">Hoja escaneada</h4>
          <a href={data.image_url} target="_blank" rel="noopener noreferrer"
            className="block rounded-xl overflow-hidden border border-gray-200 hover:shadow-md transition-shadow cursor-pointer relative group">
            <img src={data.image_url} alt="Hoja escaneada" className="w-full max-h-[400px] object-contain bg-gray-50" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4" /> Ver completa
              </span>
            </div>
          </a>
        </div>
      )}
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
    const colNames = { EM: "Examen Mensual", EB: "Examen Bimestral", P1: "Practica 1", P2: "Practica 2", P3: "Practica 3" };
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
            <p className="text-xs text-emerald-600">Mas alta</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{lowest}</p>
            <p className="text-xs text-red-600">Mas baja</p>
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
