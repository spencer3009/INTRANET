import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  Camera, Upload, ArrowLeft, Search, Check, X, AlertCircle,
  Loader2, RefreshCw, ChevronDown, ChevronUp, BookOpen
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

  // ── STEP 1: Select Student ──
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
          <input
            type="text" placeholder="Buscar alumno..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            data-testid="omr-scan-search"
          />
        </div>

        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {filtered.map((st, idx) => (
              <button
                key={st.id}
                onClick={() => selectStudent(st)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left group"
                data-testid={`student-row-${idx}`}
              >
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

  // ── STEP 2: Capture Photo ──
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
                  data-testid="capture-btn"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={startCamera}
                  className="flex flex-col items-center gap-3 p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl hover:border-purple-400 hover:bg-purple-50 transition-all"
                  data-testid="open-camera-btn"
                >
                  <Camera className="w-10 h-10 text-gray-400" />
                  <span className="text-sm font-medium text-gray-600">Tomar foto</span>
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl hover:border-purple-400 hover:bg-purple-50 transition-all"
                  data-testid="upload-image-btn"
                >
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
                data-testid="retake-btn"
              >
                Volver a tomar
              </button>
              <button onClick={processImage} disabled={processing}
                className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                data-testid="process-btn"
              >
                {processing ? <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</> : "Procesar"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── STEP 3: Result ──
  if (step === 3 && result) {
    const grade = result.grade_vigesimal;
    const confLevel = result.confidence > 0.3 ? "high" : result.confidence > 0.15 ? "medium" : "low";
    const confColors = { high: "bg-emerald-500", medium: "bg-amber-500", low: "bg-red-500" };

    return (
      <div className="space-y-4" data-testid="omr-scan-step3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-gray-800">Resultado</h3>
        </div>

        {/* Score Card */}
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
              <div className={`h-full rounded-full ${confColors[confLevel]}`}
                style={{ width: `${Math.min(result.confidence * 100, 100)}%` }} />
            </div>
            <span className="text-xs font-mono">{(result.confidence * 100).toFixed(0)}%</span>
          </div>
          {result.warnings?.length > 0 && (
            <p className="mt-2 text-xs text-amber-300 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{result.warnings[0]}
            </p>
          )}
        </div>

        {/* Answer Grid */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h4 className="text-sm font-semibold text-gray-600 mb-3">Detalle por pregunta</h4>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {result.details?.map((d) => {
              const colors = {
                correct: "bg-emerald-100 text-emerald-700 border-emerald-200",
                incorrect: "bg-red-100 text-red-700 border-red-200",
                blank: "bg-gray-100 text-gray-400 border-gray-200",
                multiple: "bg-amber-100 text-amber-700 border-amber-200",
              };
              return (
                <div key={d.question}
                  className={`flex flex-col items-center p-1.5 rounded-lg border text-xs ${colors[d.status]}`}
                  title={`P${d.question}: ${d.detected || "-"} (Correcta: ${d.correct})`}
                >
                  <span className="font-bold">{d.question}</span>
                  <span className="font-mono">{d.detected || "-"}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={scanAnother}
            className="px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            data-testid="scan-another-btn"
          >
            <Camera className="w-4 h-4" /> Escanear otro
          </button>
          <button onClick={onClose}
            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            data-testid="close-scan-btn"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return null;
}


function OMRResultsCard({ exam, token, onRegisterComplete }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [expanded, setExpanded] = useState(false);
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

  const avg = results.length > 0 ? (results.reduce((s, r) => s + r.grade_vigesimal, 0) / results.length).toFixed(1) : 0;
  const highest = Math.max(...results.map(r => r.grade_vigesimal));
  const lowest = Math.min(...results.map(r => r.grade_vigesimal));
  const allRegistered = results.every(r => r.registered_to_gradebook);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" data-testid="omr-results-card">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Resultados OMR ({results.length} escaneados)
        </h3>
      </div>
      <div className="p-6 space-y-4">
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
          title={!exam.register_column ? "Configure el destino en el Registro Auxiliar primero" : ""}
        >
          {registering ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
          {allRegistered ? "Notas ya registradas" : "Registrar notas en Registro Auxiliar"}
        </button>
        {!exam.register_column && (
          <p className="text-xs text-amber-600 text-center">Configure el destino (EM, EB, P1, P2, P3) al editar el examen</p>
        )}

        {/* Toggle Table */}
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
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
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.scan_id} className="border-b border-gray-50">
                    <td className="py-2 px-2 text-gray-400">{i + 1}</td>
                    <td className="py-2 px-2 font-medium text-gray-700">{r.student_name}</td>
                    <td className="py-2 px-2 text-center font-bold">{r.grade_vigesimal}/20</td>
                    <td className="py-2 px-2 text-center text-gray-500">{r.percentage}%</td>
                    <td className="py-2 px-2 text-center">
                      {r.registered_to_gradebook ? (
                        <span className="text-emerald-600 text-xs font-medium">Registrado</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Pendiente</span>
                      )}
                    </td>
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
