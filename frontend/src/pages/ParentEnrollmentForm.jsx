import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, GraduationCap, User, FileText, Heart,
  Check, Loader2, AlertTriangle, Info, ChevronDown, Building2
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ParentEnrollmentForm({ user, token }) {
  const navigate = useNavigate();
  const { subdomain } = useParams();
  const headers = { Authorization: `Bearer ${token}` };

  const [levels, setLevels] = useState([]);
  const [allGrades, setAllGrades] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState("");
  const [academicEditable, setAcademicEditable] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [ageWarning, setAgeWarning] = useState("");
  const [showProcedencia, setShowProcedencia] = useState(true);

  const [form, setForm] = useState({
    name: "", last_name: "", dni: "", birthday: "", gender: "",
    phone: "", address: "", photo_url: "",
    nivel_id: "", grado_id: "", seccion_id: "", turno_id: "",
    colegio_anterior: "", codigo_modular: "", ultimo_grado_cursado: "", ano_lectivo_anterior: "",
    condiciones_medicas: "", alergias: "",
    doctor_nombre: "", doctor_telefono: "",
    persona_autorizada: "", persona_autorizada_telefono: "",
    notas: "",
  });

  // Load enrollment config + all academic data at once
  useEffect(() => {
    (async () => {
      try {
        const [configRes, levelsRes, gradesRes, sectionsRes, shiftsRes] = await Promise.all([
          axios.get(`${API}/api/school/enrollment-config`, { headers }),
          axios.get(`${API}/api/academic/levels`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/api/academic/grades`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/api/academic/sections`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/api/academic/shifts`, { headers }).catch(() => ({ data: [] })),
        ]);
        setAcademicEditable(configRes.data?.academic_info_editable || false);
        setLevels(levelsRes.data || []);
        setAllGrades(gradesRes.data || []);
        setAllSections(sectionsRes.data || []);
        setTurnos(shiftsRes.data || []);
      } catch {}
      setConfigLoading(false);
    })();
  }, []);

  // Filter grades by selected nivel
  const filteredGrades = form.nivel_id
    ? allGrades.filter(g => g.nivel_id === form.nivel_id && g.activo !== false)
    : [];

  // Filter sections by selected grado
  const filteredSections = form.grado_id
    ? allSections.filter(s => s.grado_id === form.grado_id && s.activo !== false)
    : [];

  // Reset dependent fields on parent change
  const updateField = (field, value) => {
    setForm(p => {
      const updated = { ...p, [field]: value };
      if (field === "nivel_id") { updated.grado_id = ""; updated.seccion_id = ""; }
      if (field === "grado_id") { updated.seccion_id = ""; }
      return updated;
    });
  };

  // Age vs grade validation
  useEffect(() => {
    setAgeWarning("");
    if (!form.birthday || !form.grado_id || !academicEditable) return;
    const birthDate = new Date(form.birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

    const gradeName = filteredGrades.find(g => g.id === form.grado_id)?.nombre?.toLowerCase() || "";
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
      setAgeWarning(`La edad del alumno (${age} años) no corresponde al grado seleccionado. El colegio verificará esta información.`);
    }
  }, [form.birthday, form.grado_id, form.nivel_id, filteredGrades, levels, academicEditable]);

  const goBack = () => {
    const base = subdomain ? `/${subdomain}/parent` : "/parent";
    navigate(base);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) { setError("El nombre es obligatorio"); return; }
    if (!form.last_name.trim()) { setError("Los apellidos son obligatorios"); return; }
    if (!form.dni.trim() || form.dni.length !== 8) { setError("El DNI debe tener exactamente 8 dígitos"); return; }
    if (!form.birthday) { setError("La fecha de nacimiento es obligatoria"); return; }
    if (!form.gender) { setError("El género es obligatorio"); return; }
    if (!form.phone.trim()) { setError("El teléfono es obligatorio"); return; }
    if (!form.address.trim()) { setError("La dirección es obligatoria"); return; }
    if (academicEditable) {
      if (!form.nivel_id) { setError("El nivel es obligatorio"); return; }
      if (!form.grado_id) { setError("El grado es obligatorio"); return; }
      if (!form.seccion_id) { setError("La sección es obligatoria"); return; }
      if (!form.turno_id) { setError("El turno es obligatorio"); return; }
    }

    setSaving(true);
    try {
      await axios.post(`${API}/api/enrollment/self-register`, form, { headers });
      setShowSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al enviar la solicitud");
    } finally { setSaving(false); }
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 max-w-md w-full text-center" data-testid="enrollment-success-modal">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Check className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-3">Solicitud enviada correctamente</h2>
          <p className="text-slate-500 text-sm mb-6">
            El colegio revisará los datos y te notificaremos cuando sea aprobada. El proceso puede tardar unos días hábiles.
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
          <p className="text-xs text-slate-500">Completa los datos para solicitar la matrícula</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center gap-2" data-testid="enrollment-error">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Datos Personales */}
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
              <label className={labelCls}>Apellidos *</label>
              <input type="text" value={form.last_name} onChange={e => updateField("last_name", e.target.value)}
                className={inputCls} placeholder="Apellidos del alumno" required data-testid="enrollment-lastname" />
            </div>
            <div>
              <label className={labelCls}>DNI *</label>
              <input type="text" value={form.dni}
                onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 8); updateField("dni", v); }}
                className={inputCls} placeholder="8 dígitos" required maxLength={8} inputMode="numeric" pattern="[0-9]{8}" data-testid="enrollment-dni" />
              {form.dni && form.dni.length > 0 && form.dni.length < 8 && (
                <p className="text-xs text-amber-600 mt-1">El DNI debe tener 8 dígitos ({form.dni.length}/8)</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Fecha de nacimiento *</label>
              <input type="date" value={form.birthday} onChange={e => updateField("birthday", e.target.value)}
                className={inputCls} required data-testid="enrollment-birthday" />
            </div>
            <div>
              <label className={labelCls}>Género *</label>
              <select value={form.gender} onChange={e => updateField("gender", e.target.value)} className={selectCls} required data-testid="enrollment-gender">
                <option value="">Seleccionar</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Teléfono *</label>
              <input type="tel" value={form.phone} onChange={e => updateField("phone", e.target.value)}
                className={inputCls} placeholder="Teléfono de contacto" required data-testid="enrollment-phone" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Dirección *</label>
              <input type="text" value={form.address} onChange={e => updateField("address", e.target.value)}
                className={inputCls} placeholder="Dirección del domicilio" required data-testid="enrollment-address" />
            </div>
          </div>
        </div>

        {/* Información Académica — Condicional */}
        {academicEditable && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-500" /> Información Académica
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nivel *</label>
              <select value={form.nivel_id} onChange={e => updateField("nivel_id", e.target.value)} className={selectCls} required data-testid="enrollment-nivel">
                <option value="">Seleccionar nivel</option>
                {levels.map(l => <option key={l.id} value={l.id}>{l.nombre || l.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Grado *</label>
              <select value={form.grado_id} onChange={e => updateField("grado_id", e.target.value)} className={selectCls} disabled={!form.nivel_id} required data-testid="enrollment-grado">
                <option value="">Seleccionar grado</option>
                {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.nombre || g.name}</option>)}
              </select>
              {ageWarning && (
                <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">{ageWarning}</p>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Sección *</label>
              <select value={form.seccion_id} onChange={e => updateField("seccion_id", e.target.value)} className={selectCls} disabled={!form.grado_id} required data-testid="enrollment-seccion">
                <option value="">Seleccionar sección</option>
                {filteredSections.map(s => <option key={s.id} value={s.id}>{s.nombre || s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Turno *</label>
              <select value={form.turno_id} onChange={e => updateField("turno_id", e.target.value)} className={selectCls} required data-testid="enrollment-turno">
                <option value="">Seleccionar turno</option>
                {turnos.map(t => <option key={t.id} value={t.id}>{t.nombre || t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 bg-blue-50 rounded-lg px-3 py-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-600">Esta información es referencial. El colegio confirmará o ajustará el grado y sección al aprobar la matrícula.</p>
          </div>
        </div>
        )}

        {/* Procedencia Académica — Collapsible */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowProcedencia(!showProcedencia)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            data-testid="enrollment-procedencia-toggle"
          >
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" /> Procedencia Académica
              <span className="text-xs font-normal text-slate-400">(Opcional)</span>
            </h3>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showProcedencia ? "rotate-180" : ""}`} />
          </button>
          {showProcedencia && (
            <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Colegio anterior</label>
                <input type="text" value={form.colegio_anterior} onChange={e => updateField("colegio_anterior", e.target.value)}
                  className={inputCls} placeholder="Nombre del colegio de procedencia" data-testid="enrollment-colegio-anterior" />
              </div>
              <div>
                <label className={labelCls}>Código modular</label>
                <input type="text" value={form.codigo_modular}
                  onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 7); updateField("codigo_modular", v); }}
                  className={inputCls} placeholder="7 dígitos" maxLength={7} inputMode="numeric" data-testid="enrollment-codigo-modular" />
                {form.codigo_modular && form.codigo_modular.length > 0 && form.codigo_modular.length < 7 && (
                  <p className="text-xs text-amber-600 mt-1">El código modular tiene 7 dígitos ({form.codigo_modular.length}/7)</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Último grado cursado</label>
                <input type="text" value={form.ultimo_grado_cursado} onChange={e => updateField("ultimo_grado_cursado", e.target.value)}
                  className={inputCls} placeholder="Ej: 3ro Primaria" data-testid="enrollment-ultimo-grado" />
              </div>
              <div>
                <label className={labelCls}>Año lectivo anterior</label>
                <input type="text" value={form.ano_lectivo_anterior}
                  onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); updateField("ano_lectivo_anterior", v); }}
                  className={inputCls} placeholder="Ej: 2025" maxLength={4} inputMode="numeric" data-testid="enrollment-ano-lectivo" />
              </div>
            </div>
          )}
        </div>

        {/* Informacion Complementaria */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500" /> Información Complementaria
            <span className="text-xs font-normal text-slate-400">(Opcional)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Condiciones médicas</label>
              <textarea value={form.condiciones_medicas} onChange={e => updateField("condiciones_medicas", e.target.value)}
                className={`${inputCls} min-h-[60px]`} placeholder="Condiciones médicas relevantes" rows={2} />
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
              <label className={labelCls}>Teléfono del doctor</label>
              <input type="tel" value={form.doctor_telefono} onChange={e => updateField("doctor_telefono", e.target.value)}
                className={inputCls} placeholder="Teléfono" />
            </div>
            <div>
              <label className={labelCls}>Persona autorizada para recoger</label>
              <input type="text" value={form.persona_autorizada} onChange={e => updateField("persona_autorizada", e.target.value)}
                className={inputCls} placeholder="Nombre completo" />
            </div>
            <div>
              <label className={labelCls}>Teléfono persona autorizada</label>
              <input type="tel" value={form.persona_autorizada_telefono} onChange={e => updateField("persona_autorizada_telefono", e.target.value)}
                className={inputCls} placeholder="Teléfono" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notas adicionales</label>
              <textarea value={form.notas} onChange={e => updateField("notas", e.target.value)}
                className={`${inputCls} min-h-[60px]`} placeholder="Cualquier información adicional relevante" rows={2} />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button type="submit" disabled={saving} data-testid="enrollment-submit"
          className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
          {saving ? "Enviando solicitud..." : "Enviar solicitud de matrícula"}
        </button>
      </form>
    </div>
  );
}
