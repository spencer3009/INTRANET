import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, GraduationCap, User, FileText, Heart,
  Check, Loader2, AlertTriangle, Info
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParentEnrollmentForm({ user, token }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const headers = { Authorization: `Bearer ${token}` };

  const [levels, setLevels] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState("");
  const [academicEditable, setAcademicEditable] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [ageWarning, setAgeWarning] = useState("");

  const [form, setForm] = useState({
    name: "", last_name: "", dni: "", birthday: "", gender: "",
    phone: "", address: "", photo_url: "",
    nivel_id: "", grado_id: "", seccion_id: "", turno_id: "",
    condiciones_medicas: "", alergias: "",
    doctor_nombre: "", doctor_telefono: "",
    persona_autorizada: "", persona_autorizada_telefono: "",
    notas: "",
  });

  // Load enrollment config + academic data
  useEffect(() => {
    (async () => {
      try {
        const [configRes, levelsRes, turnosRes] = await Promise.all([
          axios.get(`${API}/api/school/enrollment-config`, { headers }),
          axios.get(`${API}/api/academic/levels`, { headers }),
          axios.get(`${API}/api/academic/turnos`, { headers }).catch(() => ({ data: [] })),
        ]);
        setAcademicEditable(configRes.data?.academic_info_editable || false);
        setLevels(levelsRes.data || []);
        setTurnos(turnosRes.data || []);
      } catch {}
      setConfigLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!form.nivel_id) { setGrades([]); setSections([]); return; }
    (async () => {
      try {
        const res = await axios.get(`${API}/api/academic/levels/${form.nivel_id}/grades`, { headers });
        setGrades(res.data || []);
        setSections([]);
        setForm(p => ({ ...p, grado_id: "", seccion_id: "" }));
      } catch { setGrades([]); }
    })();
  }, [form.nivel_id]);

  useEffect(() => {
    if (!form.grado_id) { setSections([]); return; }
    (async () => {
      try {
        const res = await axios.get(`${API}/api/academic/grades/${form.grado_id}/sections`, { headers });
        setSections(res.data || []);
        setForm(p => ({ ...p, seccion_id: "" }));
      } catch { setSections([]); }
    })();
  }, [form.grado_id]);

  // Age vs grade validation
  useEffect(() => {
    setAgeWarning("");
    if (!form.birthday || !form.grado_id || !academicEditable) return;
    const birthDate = new Date(form.birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

    const gradeName = grades.find(g => g.id === form.grado_id)?.nombre?.toLowerCase() || "";
    const nivelName = levels.find(l => l.id === form.nivel_id)?.nombre?.toLowerCase() || "";

    let expectedMin = 0, expectedMax = 99;
    if (nivelName.includes("inicial")) {
      if (gradeName.includes("3")) { expectedMin = 3; expectedMax = 4; }
      else if (gradeName.includes("4")) { expectedMin = 4; expectedMax = 5; }
      else if (gradeName.includes("5")) { expectedMin = 5; expectedMax = 6; }
    } else if (nivelName.includes("primaria")) {
      expectedMin = 6; expectedMax = 12;
    } else if (nivelName.includes("secundaria")) {
      expectedMin = 12; expectedMax = 17;
    }

    if (age < expectedMin || age > expectedMax) {
      setAgeWarning(`La edad del alumno (${age} anios) no corresponde al grado seleccionado. El colegio verificara esta informacion.`);
    }
  }, [form.birthday, form.grado_id, form.nivel_id, grades, levels, academicEditable]);

  const goBack = () => {
    const base = subdomain ? `/${subdomain}/parent` : "/parent";
    navigate(base);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) { setError("El nombre es obligatorio"); return; }
    if (!form.dni.trim()) { setError("El DNI es obligatorio"); return; }

    setSaving(true);
    try {
      await axios.post(`${API}/api/enrollment/self-register`, form, { headers });
      setShowSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al enviar la solicitud");
    } finally { setSaving(false); }
  };

  const updateField = (field, value) => setForm(p => ({ ...p, [field]: value }));

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 max-w-md w-full text-center" data-testid="enrollment-success-modal">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Check className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-3">Solicitud enviada correctamente</h2>
          <p className="text-slate-500 text-sm mb-6">
            El colegio revisara los datos y te notificaremos cuando sea aprobada. El proceso puede tardar unos dias habiles.
          </p>
          <button onClick={goBack} data-testid="enrollment-success-accept"
            className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors">
            Aceptar
          </button>
        </div>
      </div>
    );
  }

  const inputCls = "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all";
  const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";
  const selectCls = inputCls;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={goBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" data-testid="enrollment-back-btn">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-base font-bold text-slate-800">Registrar a mi hijo</h1>
          <p className="text-xs text-slate-500">Completa los datos para solicitar la matricula</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2" data-testid="enrollment-error">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Personal Info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-500" /> Datos Personales
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nombres *</label>
              <input type="text" value={form.name} onChange={e => updateField("name", e.target.value)}
                className={inputCls} placeholder="Nombres del alumno" required data-testid="enrollment-name" />
            </div>
            <div>
              <label className={labelCls}>Apellidos</label>
              <input type="text" value={form.last_name} onChange={e => updateField("last_name", e.target.value)}
                className={inputCls} placeholder="Apellidos del alumno" data-testid="enrollment-lastname" />
            </div>
            <div>
              <label className={labelCls}>DNI *</label>
              <input type="text" value={form.dni} onChange={e => updateField("dni", e.target.value)}
                className={inputCls} placeholder="DNI del alumno" required maxLength={20} data-testid="enrollment-dni" />
            </div>
            <div>
              <label className={labelCls}>Fecha de nacimiento</label>
              <input type="date" value={form.birthday} onChange={e => updateField("birthday", e.target.value)}
                className={inputCls} data-testid="enrollment-birthday" />
            </div>
            <div>
              <label className={labelCls}>Genero</label>
              <select value={form.gender} onChange={e => updateField("gender", e.target.value)} className={selectCls} data-testid="enrollment-gender">
                <option value="">Seleccionar</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Telefono</label>
              <input type="tel" value={form.phone} onChange={e => updateField("phone", e.target.value)}
                className={inputCls} placeholder="Telefono de contacto" data-testid="enrollment-phone" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Direccion</label>
              <input type="text" value={form.address} onChange={e => updateField("address", e.target.value)}
                className={inputCls} placeholder="Direccion del domicilio" data-testid="enrollment-address" />
            </div>
          </div>
        </div>

        {/* Academic Info — Conditional */}
        {academicEditable && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-500" /> Informacion Academica
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nivel</label>
              <select value={form.nivel_id} onChange={e => updateField("nivel_id", e.target.value)} className={selectCls} data-testid="enrollment-nivel">
                <option value="">Seleccionar nivel</option>
                {levels.map(l => <option key={l.id} value={l.id}>{l.nombre || l.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Grado</label>
              <select value={form.grado_id} onChange={e => updateField("grado_id", e.target.value)} className={selectCls} disabled={!form.nivel_id} data-testid="enrollment-grado">
                <option value="">Seleccionar grado</option>
                {grades.map(g => <option key={g.id} value={g.id}>{g.nombre || g.name}</option>)}
              </select>
              {ageWarning && (
                <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">{ageWarning}</p>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Seccion</label>
              <select value={form.seccion_id} onChange={e => updateField("seccion_id", e.target.value)} className={selectCls} disabled={!form.grado_id} data-testid="enrollment-seccion">
                <option value="">Seleccionar seccion</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.nombre || s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Turno</label>
              <select value={form.turno_id} onChange={e => updateField("turno_id", e.target.value)} className={selectCls} data-testid="enrollment-turno">
                <option value="">Seleccionar turno</option>
                {turnos.map(t => <option key={t.id} value={t.id}>{t.nombre || t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 bg-blue-50 rounded-lg px-3 py-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-600">Esta informacion es referencial. El colegio confirmara o ajustara el grado y seccion al aprobar la matricula.</p>
          </div>
        </div>
        )}

        {/* Complementary Info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500" /> Informacion Complementaria
            <span className="text-xs font-normal text-slate-400">(Opcional)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Condiciones medicas</label>
              <textarea value={form.condiciones_medicas} onChange={e => updateField("condiciones_medicas", e.target.value)}
                className={`${inputCls} min-h-[60px]`} placeholder="Condiciones medicas relevantes" rows={2} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Alergias</label>
              <textarea value={form.alergias} onChange={e => updateField("alergias", e.target.value)}
                className={`${inputCls} min-h-[60px]`} placeholder="Alergias conocidas" rows={2} />
            </div>
            <div>
              <label className={labelCls}>Doctor de cabecera</label>
              <input type="text" value={form.doctor_nombre} onChange={e => updateField("doctor_nombre", e.target.value)}
                className={inputCls} placeholder="Nombre del doctor" />
            </div>
            <div>
              <label className={labelCls}>Telefono del doctor</label>
              <input type="tel" value={form.doctor_telefono} onChange={e => updateField("doctor_telefono", e.target.value)}
                className={inputCls} placeholder="Telefono" />
            </div>
            <div>
              <label className={labelCls}>Persona autorizada para recoger</label>
              <input type="text" value={form.persona_autorizada} onChange={e => updateField("persona_autorizada", e.target.value)}
                className={inputCls} placeholder="Nombre completo" />
            </div>
            <div>
              <label className={labelCls}>Telefono persona autorizada</label>
              <input type="tel" value={form.persona_autorizada_telefono} onChange={e => updateField("persona_autorizada_telefono", e.target.value)}
                className={inputCls} placeholder="Telefono" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notas adicionales</label>
              <textarea value={form.notas} onChange={e => updateField("notas", e.target.value)}
                className={`${inputCls} min-h-[60px]`} placeholder="Cualquier informacion adicional relevante" rows={2} />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button type="submit" disabled={saving} data-testid="enrollment-submit"
          className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
          {saving ? "Enviando solicitud..." : "Enviar solicitud de matricula"}
        </button>
      </form>
    </div>
  );
}
