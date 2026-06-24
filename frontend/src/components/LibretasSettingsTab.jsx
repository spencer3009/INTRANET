import { useState, useEffect } from "react";
import axios from "axios";
import {
  Loader2, CheckCircle2, AlertCircle, FileText, CloudOff, Cloud, Hash, Type, Layers, EyeOff,
  Printer, Maximize2, RotateCw, Rows, Eye, Trophy, GraduationCap, Users, Plus, Trash2, Award, Stamp, Upload, PenLine,
} from "lucide-react";
import { Link } from "react-router-dom";
import ConductaExtendidaEditor from "./ConductaExtendidaEditor";
import LibretaPaletteEditor from "./LibretaPaletteEditor";
import InstitutionalStamp from "./InstitutionalStamp";
import SignatureLayoutEditor from "./SignatureLayoutEditor";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PRINT_DEFAULTS = {
  font_scale: "normal",
  orientation: "portrait",
  paper_size: "a4",
  row_density: "comfortable",
  table_style: "thin",
  fit_one_page: false,
};

const HEADER_DEFAULTS = {
  line1: "INSTITUCIÓN EDUCATIVA PRIVADA",
  school_name_override: "",
  line3: "Informe de Progreso del Estudiante - {year}",
  bimestre_label: "{roman} BIMESTRE",
  show_initials_box: true,
  line1_bold: false,
  school_name_bold: true,
  line3_bold: true,
  nivel_bold: true,
  bimestre_bold: true,
  line1_size: 1.0,
  school_name_size: 1.0,
  line3_size: 1.0,
  nivel_size: 1.0,
  bimestre_size: 1.0,
  logo_scale: 1.0,
};

const SIZE_OPTIONS = [
  { v: 0.8, label: "S" },
  { v: 1.0, label: "M" },
  { v: 1.2, label: "L" },
  { v: 1.4, label: "XL" },
  { v: 1.6, label: "2XL" },
  { v: 1.8, label: "3XL" },
];

const LOGO_OPTIONS = [
  { v: 0.8, label: "Pequeño" },
  { v: 1.0, label: "Normal" },
  { v: 1.2, label: "Grande" },
  { v: 1.4, label: "XL" },
  { v: 1.6, label: "2XL" },
  { v: 1.8, label: "3XL" },
  { v: 2.0, label: "Gigante" },
];

const COLOR_ZONES = [
  { key: "header_banner",   label: "Encabezado",        emoji: "🎨", hint: "Fondo del banner superior con el logo, nombre y bimestre." },
  { key: "header_logo",     label: "Logo del colegio",  emoji: "🎓", hint: "Fondo detrás del logo (círculo)." },
  { key: "initials_box",    label: "Cuadro lateral",    emoji: "👤", hint: "El cuadro de iniciales/foto del alumno." },
  { key: "table_headers",   label: "Headers de tabla",  emoji: "📊", hint: "Fila con ÁREAS · ASIGNATURAS · BIMESTRES · Promedio Final." },
  { key: "area_rows",       label: "Filas de Área",     emoji: "🏷️", hint: "Celdas con el nombre del área (Matemáticas, Comunicación...)." },
  { key: "subject_rows",    label: "Filas de Asignatura", emoji: "📝", hint: "Filas de las asignaturas (Aritmética, Geometría...)." },
  { key: "promedio_rows",   label: "Filas de Promedio", emoji: "⭐", hint: "Filas con el promedio del área." },
  { key: "asistencia_table",label: "Asistencia",        emoji: "📅", hint: "Tabla de Asistencias y Tardanzas." },
  { key: "conducta_table",  label: "Conducta",          emoji: "🎯", hint: "Tabla de Evaluación Conductual." },
  { key: "tutor_comments",  label: "Comentarios Tutor", emoji: "💬", hint: "Tabla de Comentarios del Tutor." },
];

// Premium presets — 8 carefully picked colors that look good on a school
// document. Empty string = use the built-in default.
const COLOR_PRESETS = [
  { hex: "",         label: "Default" },
  { hex: "#ffffff",  label: "Blanco" },
  { hex: "#dbeafe",  label: "Azul claro" },
  { hex: "#d1fae5",  label: "Verde menta" },
  { hex: "#fce7f3",  label: "Rosa pastel" },
  { hex: "#fef3c7",  label: "Amarillo suave" },
  { hex: "#e5e7eb",  label: "Gris claro" },
  { hex: "#1e3a8a",  label: "Azul oscuro" },
  { hex: "#6d28d9",  label: "Púrpura" },
];

const COLOR_PALETTE_DEFAULTS = Object.fromEntries(COLOR_ZONES.map((z) => [z.key, ""]));

/**
 * Settings tab — choose between auto-generated report cards (from the
 * Consolidado) or PDF uploads (one per student/bimester, stored in Drive).
 * Owner / director only (the parent SettingsPage already filters tab access).
 */
export default function LibretasSettingsTab({ token }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState("generated");
  const [gradeFormat, setGradeFormat] = useState("numeric");
  const [hideConducta, setHideConducta] = useState(false);
  const [hideTutorComments, setHideTutorComments] = useState(false);
  const [hideAsistencia, setHideAsistencia] = useState(false);
  const [hideSituacionFinal, setHideSituacionFinal] = useState(false);
  const [tutorCommentsPeriods, setTutorCommentsPeriods] = useState([]);
  const [gradeScaleMode, setGradeScaleMode] = useState("default");
  const [gradeScale, setGradeScale] = useState([]);
  const [defaultGradeScale, setDefaultGradeScale] = useState([]);
  const [directorName, setDirectorName] = useState("");
  const [stampMode, setStampMode] = useState("generated");
  const [stampConfig, setStampConfig] = useState({ texto_superior: "", texto_inferior: "", ruc: "", direccion: "", cargo: "DIRECTOR" });
  const [directorSignature, setDirectorSignature] = useState("");
  const [stampImage, setStampImage] = useState("");
  const [uploadingImg, setUploadingImg] = useState("");
  const [signatureLayout, setSignatureLayout] = useState({ signature: { x: 65, y: 90, w: 120 }, stamp: { x: 165, y: 95, w: 80 } });
  const [signatureBlockOffset, setSignatureBlockOffset] = useState(30);
  const [driveConnected, setDriveConnected] = useState(false);
  const [printFormat, setPrintFormat] = useState(PRINT_DEFAULTS);
  const [headerTpl, setHeaderTpl] = useState(HEADER_DEFAULTS);
  const [headerDefaults, setHeaderDefaults] = useState(HEADER_DEFAULTS);
  const [palette, setPalette] = useState(COLOR_PALETTE_DEFAULTS);
  const [cellBold, setCellBold] = useState({});
  const [cellSize, setCellSize] = useState({});
  const [allBold, setAllBold] = useState(false);
  const [showGradesStudent, setShowGradesStudent] = useState(true);
  const [showGradesParent, setShowGradesParent] = useState(true);
  const [showLibretaStudent, setShowLibretaStudent] = useState(true);
  const [showLibretaParent, setShowLibretaParent] = useState(true);
  const [showLibretaColumnTutoria, setShowLibretaColumnTutoria] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const load = async () => {
      try {
        const r = await axios.get(`${API}/report-cards/settings`, { headers });
        setSource(r.data?.report_card_source || "generated");
        setGradeFormat(r.data?.libreta_grade_format || "numeric");
        setHideConducta(Boolean(r.data?.hide_conducta_in_libreta));
        setHideTutorComments(Boolean(r.data?.hide_tutor_comments_in_libreta));
        setHideAsistencia(Boolean(r.data?.hide_asistencia_in_libreta));
        setHideSituacionFinal(Boolean(r.data?.hide_situacion_final_in_libreta));
        setTutorCommentsPeriods(Array.isArray(r.data?.tutor_comments_periods) ? r.data.tutor_comments_periods.map(Number) : []);
        setGradeScaleMode(r.data?.grade_scale_mode === "custom" ? "custom" : "default");
        setGradeScale(Array.isArray(r.data?.grade_scale) ? r.data.grade_scale.map(x => ({ letter: String(x.letter || ""), min: Number(x.min), max: Number(x.max) })) : []);
        setDefaultGradeScale(Array.isArray(r.data?.default_grade_scale) ? r.data.default_grade_scale : []);
        setDirectorName(r.data?.director_name || "");
        setStampMode(r.data?.stamp_mode === "image" ? "image" : "generated");
        setStampConfig({
          texto_superior: r.data?.stamp_config?.texto_superior || "",
          texto_inferior: r.data?.stamp_config?.texto_inferior || "",
          ruc: r.data?.stamp_config?.ruc || "",
          direccion: r.data?.stamp_config?.direccion || "",
          cargo: r.data?.stamp_config?.cargo || "DIRECTOR",
        });
        setDirectorSignature(r.data?.director_signature || "");
        setStampImage(r.data?.stamp_image || "");
        if (r.data?.signature_layout) setSignatureLayout(r.data.signature_layout);
        setSignatureBlockOffset(Number.isFinite(Number(r.data?.signature_block_offset)) ? Number(r.data.signature_block_offset) : 30);
        setPrintFormat({ ...PRINT_DEFAULTS, ...(r.data?.print_format || {}) });
        setHeaderTpl({ ...HEADER_DEFAULTS, ...(r.data?.header_template || {}) });
        if (r.data?.header_template_defaults) {
          setHeaderDefaults({ ...HEADER_DEFAULTS, ...r.data.header_template_defaults });
        }
        setPalette({ ...COLOR_PALETTE_DEFAULTS, ...(r.data?.color_palette || {}) });
        setCellBold(r.data?.cell_bold || {});
        setCellSize(r.data?.cell_size || {});
        setAllBold(Boolean(r.data?.all_bold));
        setShowGradesStudent(r.data?.show_grades_student !== false);
        setShowGradesParent(r.data?.show_grades_parent !== false);
        setShowLibretaStudent(r.data?.show_libreta_student !== false);
        setShowLibretaParent(r.data?.show_libreta_parent !== false);
        setShowLibretaColumnTutoria(r.data?.show_libreta_column_in_tutoria !== false);
        setDriveConnected(Boolean(r.data?.google_drive_connected));
      } catch (e) {
        setError(e?.response?.data?.detail || "Error al cargar la configuración");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleChange = async (newSource) => {
    if (newSource === source) return;
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { report_card_source: newSource }, { headers });
      setSource(newSource);
      setSuccess(newSource === "pdf_upload"
        ? "Modo cambiado a Cargar PDF. Ya puedes subir libretas desde el Consolidado."
        : "Modo cambiado a Generar desde Consolidado.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al actualizar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleFormatChange = async (newFormat) => {
    if (newFormat === gradeFormat) return;
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { libreta_grade_format: newFormat }, { headers });
      setGradeFormat(newFormat);
      setSuccess("Formato de notas actualizado.");
      setTimeout(() => setSuccess(""), 3500);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al actualizar el formato");
    } finally {
      setSaving(false);
    }
  };

  // Generic toggle saver — used for hide_conducta / hide_tutor_comments.
  const handleVisibilityToggle = async (field, newValue, setter, label) => {
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { [field]: newValue }, { headers });
      setter(newValue);
      setSuccess(`${label} ${newValue ? "ocultado" : "visible"} en la libreta.`);
      setTimeout(() => setSuccess(""), 3500);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al actualizar la visibilidad");
    } finally {
      setSaving(false);
    }
  };

  // Toggle "mostrar" (semántica directa, no es de ocultar) para la columna LIBRETA
  // en el portal del profesor (Mis Tutorías → Conducta & Comentarios).
  const handleShowLibretaColumnTutoria = async (newValue) => {
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { show_libreta_column_in_tutoria: newValue }, { headers });
      setShowLibretaColumnTutoria(newValue);
      setSuccess(`Columna "LIBRETA" en el portal del profesor ${newValue ? "activada" : "desactivada"}.`);
      setTimeout(() => setSuccess(""), 3500);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al actualizar la visibilidad");
    } finally {
      setSaving(false);
    }
  };

  // Saver for the per-bimestre tutor-comment selection (list of "orden" ints).
  const saveTutorCommentsPeriods = async (periods) => {
    const prev = tutorCommentsPeriods;
    setTutorCommentsPeriods(periods);  // optimistic
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { tutor_comments_periods: periods }, { headers });
      setSuccess(periods.length === 0 ? "Se mostrarán todos los comentarios." : `Comentarios visibles: bimestre(s) ${periods.join(", ")}.`);
      setTimeout(() => setSuccess(""), 3500);
    } catch (e) {
      setTutorCommentsPeriods(prev);  // rollback
      setError(e?.response?.data?.detail || "Error al actualizar los comentarios visibles");
    } finally {
      setSaving(false);
    }
  };

  const toggleCommentBimestre = (orden) => {
    const set = new Set(tutorCommentsPeriods);
    if (set.has(orden)) set.delete(orden); else set.add(orden);
    saveTutorCommentsPeriods(Array.from(set).sort((a, b) => a - b));
  };

  // ── Firma y sello de Dirección ───────────────────────────────────────
  const saveDirectorName = async (name) => {
    setSaving(true); setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { director_name: name }, { headers });
      setSuccess("Nombre del director guardado.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al guardar el nombre del director");
    } finally { setSaving(false); }
  };

  const saveStampMode = async (mode) => {
    const prev = stampMode;
    setStampMode(mode);
    setSaving(true); setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { stamp_mode: mode }, { headers });
      setSuccess(mode === "generated" ? "Sello: modo Generado con textos." : "Sello: modo Imagen subida.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setStampMode(prev);
      setError(e?.response?.data?.detail || "Error al cambiar el modo del sello");
    } finally { setSaving(false); }
  };

  const saveStampConfig = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { stamp_config: stampConfig }, { headers });
      setSuccess("Textos del sello guardados.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al guardar el sello");
    } finally { setSaving(false); }
  };

  // Sube firma o sello (kind: 'signature' | 'stamp') y lo convierte a WebP.
  const uploadDirectorImage = async (kind, fileObj) => {
    if (!fileObj) return;
    if (!fileObj.type.startsWith("image/")) { setError("El archivo debe ser una imagen (PNG, JPG)."); return; }
    setUploadingImg(kind); setError(""); setSuccess("");
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("file", fileObj);
      const res = await axios.post(`${API}/report-cards/director-image`, fd, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      if (kind === "signature") setDirectorSignature(res.data.url); else setStampImage(res.data.url);
      setSuccess(kind === "signature" ? "Firma del director cargada." : "Sello cargado.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al procesar la imagen");
    } finally { setUploadingImg(""); }
  };

  const clearDirectorImage = async (kind) => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const body = kind === "signature" ? { director_signature: "" } : { stamp_image: "" };
      await axios.put(`${API}/report-cards/settings`, body, { headers });
      if (kind === "signature") setDirectorSignature(""); else setStampImage("");
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al quitar la imagen");
    } finally { setSaving(false); }
  };

  const saveSignatureLayout = async (next) => {
    setSignatureLayout(next);  // optimistic
    try {
      await axios.put(`${API}/report-cards/settings`, { signature_layout: next }, { headers });
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al guardar la posición");
    }
  };

  // Guarda la posición vertical del bloque de firmas (0–100). Se llama al
  // soltar el slider (onMouseUp / onTouchEnd) para no spamear la API.
  const saveSignatureBlockOffset = async (value) => {
    const v = Math.max(0, Math.min(100, Math.round(Number(value))));
    try {
      await axios.put(`${API}/report-cards/settings`, { signature_block_offset: v }, { headers });
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al guardar la posición de las firmas");
    }
  };

  // Valida que la escala cubra 0–20 de forma continua, sin huecos ni solapes.
  const validateScale = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return "Agrega al menos un nivel.";
    const parsed = [];
    for (const r of rows) {
      if (!String(r.letter || "").trim()) return "Cada nivel necesita una letra/nombre.";
      const lo = Number(r.min); const hi = Number(r.max);
      if (!Number.isInteger(lo) || !Number.isInteger(hi)) return "Los rangos deben ser números enteros.";
      if (lo < 0 || hi > 20) return "Los rangos deben estar entre 0 y 20.";
      if (lo > hi) return `En "${r.letter}", "Desde" no puede ser mayor que "Hasta".`;
      parsed.push({ ...r, min: lo, max: hi });
    }
    parsed.sort((a, b) => a.min - b.min);
    if (parsed[0].min !== 0) return "El rango más bajo debe empezar en 0.";
    if (parsed[parsed.length - 1].max !== 20) return "El rango más alto debe terminar en 20.";
    for (let i = 1; i < parsed.length; i++) {
      if (parsed[i].min !== parsed[i - 1].max + 1) return "Los rangos deben ser continuos, sin huecos ni solapamientos.";
    }
    return null;
  };
  const scaleError = gradeScaleMode === "custom" ? validateScale(gradeScale) : null;

  const setGradeScaleModeAndSave = async (mode) => {
    const prev = gradeScaleMode;
    setGradeScaleMode(mode);  // optimistic
    // Al pasar a personalizada, si no hay filas, parte de la MINEDU como base.
    let scaleToSend;
    if (mode === "custom" && (!gradeScale || gradeScale.length === 0)) {
      scaleToSend = defaultGradeScale.map(x => ({ ...x }));
      setGradeScale(scaleToSend);
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      const body = { grade_scale_mode: mode };
      if (mode === "custom" && scaleToSend) body.grade_scale = scaleToSend;
      await axios.put(`${API}/report-cards/settings`, body, { headers });
      setSuccess(mode === "custom" ? "Escala personalizada activada." : "Usando la escala por defecto (MINEDU).");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setGradeScaleMode(prev);  // rollback
      setError(e?.response?.data?.detail || "Error al cambiar el modo de escala");
    } finally { setSaving(false); }
  };

  const updateScaleRow = (idx, field, value) => {
    setGradeScale(prev => prev.map((r, i) => i === idx ? { ...r, [field]: field === "letter" ? value : (value === "" ? "" : Number(value)) } : r));
  };
  const addScaleRow = () => setGradeScale(prev => [...prev, { letter: "", min: 0, max: 0 }]);
  const removeScaleRow = (idx) => setGradeScale(prev => prev.filter((_, i) => i !== idx));
  const restoreMineduScale = () => setGradeScale(defaultGradeScale.map(x => ({ ...x })));

  const saveGradeScale = async () => {
    const err = validateScale(gradeScale);
    if (err) { setError(err); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, {
        grade_scale_mode: "custom",
        grade_scale: gradeScale.map(r => ({ letter: String(r.letter).trim(), min: Number(r.min), max: Number(r.max) })),
      }, { headers });
      setSuccess("Escala de calificación guardada.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al guardar la escala");
    } finally { setSaving(false); }
  };
  const setPrintField = async (field, value) => {
    if (printFormat[field] === value) return;
    const prev = printFormat;
    const next = { ...printFormat, [field]: value };
    setPrintFormat(next);
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { print_format: { [field]: value } }, { headers });
      setSuccess("Formato de impresión actualizado.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setPrintFormat(prev);
      setError(e?.response?.data?.detail || "Error al actualizar el formato");
    } finally {
      setSaving(false);
    }
  };

  // Save the editable header template (all fields go in a single PUT).
  // IMPORTANT: we merge `next` over the CURRENT state, NOT over HEADER_DEFAULTS,
  // otherwise saving e.g. school_name_override would silently reset every
  // previously-changed bold flag back to its default.
  const saveHeaderTemplate = async (next) => {
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { header_template: next }, { headers });
      setHeaderTpl((prev) => ({ ...prev, ...next }));
      setSuccess("Plantilla del encabezado actualizada.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al actualizar la plantilla");
    } finally {
      setSaving(false);
    }
  };

  const restoreHeaderField = async (field) => {
    await saveHeaderTemplate({ [field]: headerDefaults[field] });
  };

  const restoreHeaderAll = async () => {
    await saveHeaderTemplate(headerDefaults);
  };

  // Save a single palette zone color (or empty = reset to default).
  const setZoneColor = async (zone, hex) => {
    const next = { ...palette, [zone]: hex || "" };
    setPalette(next);  // optimistic
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { color_palette: { [zone]: hex || "" } }, { headers });
      setSuccess(hex ? "Color aplicado." : "Color restaurado al default.");
      setTimeout(() => setSuccess(""), 2000);
    } catch (e) {
      setPalette(palette);  // rollback
      setError(e?.response?.data?.detail || "Error al aplicar color");
    } finally {
      setSaving(false);
    }
  };

  const restoreAllColors = async () => {
    const empty = Object.fromEntries(COLOR_ZONES.map((z) => [z.key, ""]));
    setPalette(empty);
    setSaving(true);
    try {
      await axios.put(`${API}/report-cards/settings`, { color_palette: empty }, { headers });
      setSuccess("Todos los colores restaurados.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al restaurar colores");
    } finally {
      setSaving(false);
    }
  };

  // Per-cell bold toggle. `value` is the new explicit boolean (true=bold,
  // false=force-normal even when "Todo en negrita" is on).
  const setCellBoldValue = async (cellId, value) => {
    const next = { ...cellBold, [cellId]: value };
    setCellBold(next);  // optimistic
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { cell_bold: { [cellId]: value } }, { headers });
      setSuccess(value ? "Celda en negrita." : "Negrita quitada.");
      setTimeout(() => setSuccess(""), 1800);
    } catch (e) {
      setCellBold(cellBold);  // rollback
      setError(e?.response?.data?.detail || "Error al aplicar negrita");
    } finally {
      setSaving(false);
    }
  };

  // Per-cell font size (px 10..20) or null to reset to auto.
  const setCellSizeValue = async (cellId, size) => {
    const next = { ...cellSize };
    if (size == null) delete next[cellId]; else next[cellId] = size;
    setCellSize(next);  // optimistic
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { cell_size: { [cellId]: size } }, { headers });
      setSuccess(size == null ? "Tamaño restaurado." : `Tamaño ${size}px aplicado.`);
      setTimeout(() => setSuccess(""), 1800);
    } catch (e) {
      setCellSize(cellSize);  // rollback
      setError(e?.response?.data?.detail || "Error al aplicar tamaño");
    } finally {
      setSaving(false);
    }
  };

  // Global "Todo en negrita" toggle.
  const toggleAllBold = async (value) => {
    setAllBold(value);  // optimistic
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { all_bold: value }, { headers });
      setSuccess(value ? "Toda la libreta en negrita." : "Negrita global desactivada.");
      setTimeout(() => setSuccess(""), 2200);
    } catch (e) {
      setAllBold(!value);  // rollback
      setError(e?.response?.data?.detail || "Error al actualizar negrita global");
    } finally {
      setSaving(false);
    }
  };

  // Show/hide the "Calificaciones" / "Mi Libreta" access in the portals.
  const toggleShowGrades = async (field, value, setter, label, what = "Calificaciones") => {
    setter(value);  // optimistic
    setSaving(true);
    setError(""); setSuccess("");
    try {
      await axios.put(`${API}/report-cards/settings`, { [field]: value }, { headers });
      setSuccess(`${what} ${value ? "visible" : "oculto"} para ${label}.`);
      setTimeout(() => setSuccess(""), 2500);
    } catch (e) {
      setter(!value);  // rollback
      setError(e?.response?.data?.detail || "Error al actualizar el acceso");
    } finally {
      setSaving(false);
    }
  };

  // Opens a preview tab — picks the first student in the school's directory
  // so the owner can see exactly how the format renders with real data.
  const openPreview = async () => {
    try {
      const r = await axios.get(`${API}/users?role=student&limit=1`, { headers });
      const items = Array.isArray(r.data) ? r.data : (r.data?.users || r.data?.items || []);
      const first = items.find((u) => (u.role || u.user_type) === "student") || items[0];
      if (!first?.id) {
        setError("No hay alumnos para vista previa. Crea uno primero.");
        setTimeout(() => setError(""), 4000);
        return;
      }
      window.open(`/libreta/${first.id}`, "_blank", "noopener,noreferrer");
    } catch {
      setError("No se pudo abrir la vista previa.");
      setTimeout(() => setError(""), 4000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500" data-testid="libretas-settings-loading">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl" data-testid="libretas-settings-tab">
      <header>
        <h2 className="text-xl font-bold text-slate-900">Libretas de Notas</h2>
        <p className="text-sm text-slate-600 mt-1">Decide cómo se entregan las libretas a los padres y alumnos.</p>
      </header>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm flex items-center gap-2" data-testid="libretas-settings-error">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm flex items-center gap-2" data-testid="libretas-settings-success">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {success}
        </div>
      )}

      {/* Drive connection status */}
      <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${driveConnected ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`} data-testid="libretas-drive-status">
        <div className="flex items-center gap-3">
          {driveConnected ? (
            <Cloud className="w-5 h-5 text-emerald-700" />
          ) : (
            <CloudOff className="w-5 h-5 text-amber-700" />
          )}
          <div>
            <p className={`text-sm font-semibold ${driveConnected ? "text-emerald-900" : "text-amber-900"}`}>
              Google Drive: {driveConnected ? "Conectado" : "Desconectado"}
            </p>
            <p className={`text-xs ${driveConnected ? "text-emerald-700" : "text-amber-700"}`}>
              {driveConnected
                ? "Las libretas PDF se almacenarán en Drive."
                : "Conecta Drive para poder subir libretas en PDF."}
            </p>
          </div>
        </div>
        {!driveConnected && (
          <Link to="/settings?tab=general" className="text-xs font-semibold text-amber-900 underline whitespace-nowrap">
            Ir a Conexión Drive
          </Link>
        )}
      </div>

      {/* Switch — radio cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleChange("generated")}
          disabled={saving}
          className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 ${source === "generated" ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200" : "border-slate-200 hover:border-slate-300 bg-white"}`}
          data-testid="libretas-source-generated-card"
        >
          <div className="flex items-start justify-between mb-2">
            <FileText className={`w-6 h-6 ${source === "generated" ? "text-violet-700" : "text-slate-400"}`} />
            {source === "generated" && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">Activo</span>
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-900">Generar desde Consolidado</h3>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            El sistema arma la libreta automáticamente con las notas del Consolidado. Comportamiento actual.
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleChange("pdf_upload")}
          disabled={saving}
          className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 ${source === "pdf_upload" ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200" : "border-slate-200 hover:border-slate-300 bg-white"}`}
          data-testid="libretas-source-pdf-card"
        >
          <div className="flex items-start justify-between mb-2">
            <Cloud className={`w-6 h-6 ${source === "pdf_upload" ? "text-violet-700" : "text-slate-400"}`} />
            {source === "pdf_upload" && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">Activo</span>
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-900">Cargar PDF a Drive</h3>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            El admin sube un PDF por alumno y bimestre. Se almacena en Google Drive del colegio y el padre lo descarga desde el portal.
          </p>
        </button>
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-sm text-slate-500" data-testid="libretas-saving">
          <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
        </div>
      )}

      {/* Formato de notas — aplica SOLO a la libreta generada (no al
          Consolidado ni al Registro Auxiliar). */}
      <section className="pt-2" data-testid="libreta-format-section">
        <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">Formato de notas en la libreta</h3>
            <p className="text-xs text-slate-500">Decide cómo se muestran las notas en la libreta generada. Escala MINEDU: AD (18–20), A (14–17), B (11–13), C (0–10).</p>
          </div>
          {source !== "generated" && (
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
              Aplica solo en modo "Generar desde Consolidado"
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => handleFormatChange("numeric")}
            disabled={saving}
            className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 ${gradeFormat === "numeric" ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200" : "border-slate-200 hover:border-slate-300 bg-white"}`}
            data-testid="libreta-format-numeric"
          >
            <div className="flex items-start justify-between mb-2">
              <Hash className={`w-5 h-5 ${gradeFormat === "numeric" ? "text-violet-700" : "text-slate-400"}`} />
              {gradeFormat === "numeric" && <span className="text-[10px] uppercase tracking-wider font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">Activo</span>}
            </div>
            <h4 className="text-sm font-bold text-slate-900">Numérico</h4>
            <p className="text-xs text-slate-600 mt-1">Solo números (18, 16, 11, …).</p>
          </button>
          <button
            type="button"
            onClick={() => handleFormatChange("letters")}
            disabled={saving}
            className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 ${gradeFormat === "letters" ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200" : "border-slate-200 hover:border-slate-300 bg-white"}`}
            data-testid="libreta-format-letters"
          >
            <div className="flex items-start justify-between mb-2">
              <Type className={`w-5 h-5 ${gradeFormat === "letters" ? "text-violet-700" : "text-slate-400"}`} />
              {gradeFormat === "letters" && <span className="text-[10px] uppercase tracking-wider font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">Activo</span>}
            </div>
            <h4 className="text-sm font-bold text-slate-900">Letras</h4>
            <p className="text-xs text-slate-600 mt-1">Solo nivel de logro (AD, A, B, C).</p>
          </button>
          <button
            type="button"
            onClick={() => handleFormatChange("mixed")}
            disabled={saving}
            className={`text-left rounded-xl border-2 p-4 transition-all disabled:opacity-50 ${gradeFormat === "mixed" ? "border-violet-600 bg-violet-50 ring-2 ring-violet-200" : "border-slate-200 hover:border-slate-300 bg-white"}`}
            data-testid="libreta-format-mixed"
          >
            <div className="flex items-start justify-between mb-2">
              <Layers className={`w-5 h-5 ${gradeFormat === "mixed" ? "text-violet-700" : "text-slate-400"}`} />
              {gradeFormat === "mixed" && <span className="text-[10px] uppercase tracking-wider font-bold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">Activo</span>}
            </div>
            <h4 className="text-sm font-bold text-slate-900">Mixto</h4>
            <p className="text-xs text-slate-600 mt-1">Número y nivel de logro juntos por bimestre.</p>
          </button>
        </div>
      </section>

      {/* ── Visibilidad de secciones en la libreta ────────────────────── */}
      <section className="space-y-3 pt-4 border-t border-slate-200" data-testid="libreta-visibility-section">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-violet-600" />
            Secciones visibles en la libreta
          </h3>
          <p className="text-xs text-slate-500 mt-1">Si tu colegio no usa alguna de estas secciones, ocúltala. Los datos quedan guardados — al volver a activar el toggle reaparecen.</p>
        </div>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
          <input
            type="checkbox"
            checked={showLibretaColumnTutoria}
            disabled={saving}
            onChange={(e) => handleShowLibretaColumnTutoria(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-violet-600"
            data-testid="tutoria-show-libreta-column-toggle"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">Mostrar columna "LIBRETA" en el portal del profesor</div>
            <p className="text-xs text-slate-500 mt-0.5">Controla si los tutores ven la columna <b>LIBRETA</b> (con el botón <b>Ver</b>) en <b>Mis Tutorías → Conducta &amp; Comentarios</b>. Actívalo para permitir el acceso rápido a la libreta del alumno; desactívalo si tu colegio no quiere mostrar esa opción. <b>Por defecto está activado.</b></p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
          <input
            type="checkbox"
            checked={hideConducta}
            disabled={saving}
            onChange={(e) => handleVisibilityToggle("hide_conducta_in_libreta", e.target.checked, setHideConducta, "Nota de conducta")}
            className="w-4 h-4 mt-0.5 accent-violet-600"
            data-testid="libreta-hide-conducta-toggle"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">Ocultar nota de conducta</div>
            <p className="text-xs text-slate-500 mt-0.5">No se mostrará la fila <b>CONDUCTA</b> (ni la tabla extendida si la tienes activa). Útil para colegios que no califican conducta en la libreta.</p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
          <input
            type="checkbox"
            checked={hideTutorComments}
            disabled={saving}
            onChange={(e) => handleVisibilityToggle("hide_tutor_comments_in_libreta", e.target.checked, setHideTutorComments, "Comentarios del tutor")}
            className="w-4 h-4 mt-0.5 accent-violet-600"
            data-testid="libreta-hide-comments-toggle"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">Ocultar comentarios del tutor</div>
            <p className="text-xs text-slate-500 mt-0.5">No se mostrará la tabla <b>COMENTARIOS DEL TUTOR (A)</b> al final de la libreta. El tutor seguirá pudiendo escribirlos desde su portal — solo no se imprimen.</p>
          </div>
        </label>

        {/* Selección de qué bimestres de comentarios se muestran */}
        {!hideTutorComments && (
          <div className="ml-3 pl-4 border-l-2 border-violet-100 space-y-3" data-testid="tutor-comments-periods-control">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={tutorCommentsPeriods.length === 0}
                disabled={saving}
                onChange={(e) => saveTutorCommentsPeriods(e.target.checked ? [] : [1])}
                className="w-4 h-4 mt-0.5 accent-violet-600"
                data-testid="tutor-comments-show-all-toggle"
              />
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800">Mostrar todos los comentarios</div>
                <p className="text-xs text-slate-500 mt-0.5">Se muestran los comentarios de todos los bimestres. Desactívalo para elegir cuáles bimestres mostrar.</p>
              </div>
            </label>

            {tutorCommentsPeriods.length > 0 && (
              <div className="pl-7">
                <p className="text-xs font-semibold text-slate-600 mb-2">Mostrar solo estos bimestres:</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4].map((b) => {
                    const active = tutorCommentsPeriods.includes(b);
                    const romano = { 1: "I", 2: "II", 3: "III", 4: "IV" }[b];
                    return (
                      <button
                        key={b}
                        type="button"
                        disabled={saving}
                        onClick={() => toggleCommentBimestre(b)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-colors disabled:opacity-50 ${
                          active
                            ? "border-violet-600 bg-violet-100 text-violet-800"
                            : "border-slate-300 bg-white text-slate-500 hover:border-violet-400 hover:bg-violet-50"
                        }`}
                        data-testid={`tutor-comments-bim-${b}`}
                      >
                        {b}° Bimestre ({romano})
                      </button>
                    );
                  })}
                </div>
                {tutorCommentsPeriods.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">Selecciona al menos un bimestre o vuelve a activar "Mostrar todos".</p>
                )}
              </div>
            )}
          </div>
        )}

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
          <input
            type="checkbox"
            checked={hideAsistencia}
            disabled={saving}
            onChange={(e) => handleVisibilityToggle("hide_asistencia_in_libreta", e.target.checked, setHideAsistencia, "Asistencia")}
            className="w-4 h-4 mt-0.5 accent-violet-600"
            data-testid="libreta-hide-asistencia-toggle"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">Ocultar asistencia</div>
            <p className="text-xs text-slate-500 mt-0.5">No se mostrará la tabla de <b>ASISTENCIA</b> (Presente / Tardanza / Falta / Justificada) en la libreta. El registro de asistencia diario se sigue tomando — solo no se imprime en la libreta.</p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
          <input
            type="checkbox"
            checked={hideSituacionFinal}
            disabled={saving}
            onChange={(e) => handleVisibilityToggle("hide_situacion_final_in_libreta", e.target.checked, setHideSituacionFinal, "Situación final")}
            className="w-4 h-4 mt-0.5 accent-violet-600"
            data-testid="libreta-hide-situacion-final-toggle"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">Ocultar cuadro de Situación Final</div>
            <p className="text-xs text-slate-500 mt-0.5">No se mostrará el cuadro <b>SITUACIÓN FINAL</b> (PROMOVIDO / REQ. RECUPERACIÓN / REPITE) ni los cursos para recuperar. Útil para niveles donde no aplica.</p>
          </div>
        </label>
      </section>

      {/* ── Escala de calificación (número → letra) ─────────────────────── */}
      <section className="space-y-3 pt-4 border-t border-slate-200" data-testid="grade-scale-section">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-violet-600" />
            Escala de calificación
          </h3>
          <p className="text-xs text-slate-500 mt-1">Define cómo se convierte la <b>nota numérica</b> (0–20) en <b>letra / nivel de logro</b>. Se aplica cuando el formato de la libreta es "Letras" o "Mixto".</p>
        </div>

        {/* Selector de modo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setGradeScaleModeAndSave("default")}
            disabled={saving}
            className={`text-left p-3 rounded-xl border-2 transition-colors disabled:opacity-50 ${gradeScaleMode === "default" ? "border-violet-600 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-300"}`}
            data-testid="grade-scale-mode-default"
          >
            <div className="text-sm font-semibold text-slate-800">Escala por defecto (MINEDU)</div>
            <p className="text-xs text-slate-500 mt-0.5">AD: 18–20 · A: 14–17 · B: 11–13 · C: 0–10</p>
          </button>
          <button
            type="button"
            onClick={() => setGradeScaleModeAndSave("custom")}
            disabled={saving}
            className={`text-left p-3 rounded-xl border-2 transition-colors disabled:opacity-50 ${gradeScaleMode === "custom" ? "border-violet-600 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-300"}`}
            data-testid="grade-scale-mode-custom"
          >
            <div className="text-sm font-semibold text-slate-800">Escala personalizada</div>
            <p className="text-xs text-slate-500 mt-0.5">Define tus propias letras y rangos para tu colegio.</p>
          </button>
        </div>

        {/* Editor de escala personalizada */}
        {gradeScaleMode === "custom" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3" data-testid="grade-scale-editor">
            <div className="grid grid-cols-[1fr_80px_80px_36px] gap-2 items-center text-[11px] font-bold text-slate-500 uppercase tracking-wide px-1">
              <span>Letra / Nivel</span>
              <span className="text-center">Desde</span>
              <span className="text-center">Hasta</span>
              <span></span>
            </div>
            {gradeScale.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_80px_36px] gap-2 items-center" data-testid={`grade-scale-row-${idx}`}>
                <input
                  type="text"
                  value={row.letter}
                  disabled={saving}
                  onChange={(e) => updateScaleRow(idx, "letter", e.target.value)}
                  placeholder="Ej. AD"
                  className="h-9 px-2 text-sm font-semibold text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-violet-500"
                  data-testid={`grade-scale-letter-${idx}`}
                />
                <input
                  type="number" min="0" max="20"
                  value={row.min}
                  disabled={saving}
                  onChange={(e) => updateScaleRow(idx, "min", e.target.value)}
                  className="h-9 px-2 text-sm text-center text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-violet-500"
                  data-testid={`grade-scale-min-${idx}`}
                />
                <input
                  type="number" min="0" max="20"
                  value={row.max}
                  disabled={saving}
                  onChange={(e) => updateScaleRow(idx, "max", e.target.value)}
                  className="h-9 px-2 text-sm text-center text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-violet-500"
                  data-testid={`grade-scale-max-${idx}`}
                />
                <button
                  type="button"
                  onClick={() => removeScaleRow(idx)}
                  disabled={saving || gradeScale.length <= 1}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  title="Eliminar nivel"
                  data-testid={`grade-scale-remove-${idx}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button type="button" onClick={addScaleRow} disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors disabled:opacity-50"
                data-testid="grade-scale-add-row">
                <Plus className="w-3.5 h-3.5" /> Agregar nivel
              </button>
              <button type="button" onClick={restoreMineduScale} disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors disabled:opacity-50"
                data-testid="grade-scale-restore">
                <RotateCw className="w-3.5 h-3.5" /> Restaurar escala MINEDU
              </button>
            </div>

            {scaleError ? (
              <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2" data-testid="grade-scale-error">{scaleError}</p>
            ) : (
              <p className="text-xs text-emerald-600">La escala cubre correctamente 0–20.</p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveGradeScale}
                disabled={saving || !!scaleError}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
                data-testid="grade-scale-save"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Guardar escala
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Firma y sello de Dirección ──────────────────────────────────── */}
      <section className="space-y-4 pt-4 border-t border-slate-200" data-testid="director-signature-section">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Stamp className="w-4 h-4 text-violet-600" />
            Firma y sello de Dirección
          </h3>
          <p className="text-xs text-slate-500 mt-1">Aparecen en la página de firmas de la libreta, en el recuadro <b>DIRECTOR (A)</b>: la firma sobre la línea, el nombre debajo y el sello al costado derecho.</p>
        </div>

        {/* Nombre del director */}
        <div>
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <PenLine className="w-4 h-4 text-slate-400" /> Nombre del director(a)
          </label>
          <input
            type="text"
            value={directorName}
            disabled={saving}
            onChange={(e) => setDirectorName(e.target.value)}
            onBlur={(e) => saveDirectorName(e.target.value)}
            placeholder="Ej. Lic. Ricardo Palma Soriano"
            className="w-full h-10 px-3 text-sm text-slate-800 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-violet-500"
            data-testid="director-name-input"
          />
          <p className="text-xs text-slate-400 mt-1">Se mostrará debajo de la línea de firma del director.</p>
        </div>

        {/* Firma del director (imagen) */}
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Firma del director(a)</label>
          <div className="flex items-center gap-4">
            <div className="w-40 h-20 rounded-xl border border-dashed border-slate-300 bg-[length:16px_16px] flex items-center justify-center overflow-hidden"
              style={{ backgroundImage: "linear-gradient(45deg,#f1f5f9 25%,transparent 25%,transparent 75%,#f1f5f9 75%,#f1f5f9),linear-gradient(45deg,#f1f5f9 25%,#fff 25%,#fff 75%,#f1f5f9 75%,#f1f5f9)", backgroundPosition: "0 0,8px 8px" }}>
              {directorSignature ? (
                <img src={directorSignature} alt="Firma" className="max-w-full max-h-full object-contain" data-testid="director-signature-preview" />
              ) : (
                <span className="text-xs text-slate-400">Sin firma</span>
              )}
            </div>
            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg cursor-pointer transition-colors">
                {uploadingImg === "signature" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploadingImg === "signature" ? "Procesando…" : "Subir firma"}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingImg === "signature"}
                  onChange={(e) => { uploadDirectorImage("signature", e.target.files?.[0]); e.target.value = ""; }}
                  data-testid="director-signature-upload" />
              </label>
              {directorSignature && (
                <button type="button" onClick={() => clearDirectorImage("signature")} disabled={saving}
                  className="block text-xs text-rose-600 hover:underline" data-testid="director-signature-clear">Quitar firma</button>
              )}
              <p className="text-[11px] text-slate-400 max-w-[180px]">PNG/JPG con fondo blanco. Se vuelve transparente automáticamente.</p>
            </div>
          </div>
        </div>

        {/* Sello institucional */}
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Sello institucional</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <button type="button" onClick={() => saveStampMode("generated")} disabled={saving}
              className={`text-left p-3 rounded-xl border-2 transition-colors disabled:opacity-50 ${stampMode === "generated" ? "border-violet-600 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-300"}`}
              data-testid="stamp-mode-generated">
              <div className="text-sm font-semibold text-slate-800">Generar con textos</div>
              <p className="text-xs text-slate-500 mt-0.5">Crea el sello circular y ve la vista previa en vivo.</p>
            </button>
            <button type="button" onClick={() => saveStampMode("image")} disabled={saving}
              className={`text-left p-3 rounded-xl border-2 transition-colors disabled:opacity-50 ${stampMode === "image" ? "border-violet-600 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-300"}`}
              data-testid="stamp-mode-image">
              <div className="text-sm font-semibold text-slate-800">Subir imagen</div>
              <p className="text-xs text-slate-500 mt-0.5">Usa una imagen del sello ya diseñado.</p>
            </button>
          </div>

          {stampMode === "generated" ? (
            <div className="flex flex-col md:flex-row gap-5 items-start rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid="stamp-generator">
              {/* Inputs */}
              <div className="flex-1 space-y-2.5 w-full">
                {[
                  ["texto_superior", "Texto superior", "I.E RICARDO PALMA SORIANO"],
                  ["texto_inferior", "Texto inferior", "COLEGIO PARTICULAR"],
                  ["ruc", "RUC", "20602896057"],
                  ["direccion", "Dirección", "CALLE INTISUYO 283 SAN MIGUEL"],
                  ["cargo", "Cargo central", "DIRECTOR"],
                ].map(([key, label, ph]) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-slate-600">{label}</label>
                    <input
                      type="text"
                      value={stampConfig[key]}
                      disabled={saving}
                      onChange={(e) => setStampConfig({ ...stampConfig, [key]: e.target.value })}
                      placeholder={ph}
                      className="w-full h-9 px-2.5 text-sm text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-violet-500"
                      data-testid={`stamp-input-${key}`}
                    />
                  </div>
                ))}
                <button type="button" onClick={saveStampConfig} disabled={saving}
                  className="mt-1 px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
                  data-testid="stamp-save">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Guardar sello
                </button>
              </div>
              {/* Vista previa */}
              <div className="flex flex-col items-center gap-2 shrink-0 mx-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Vista previa</span>
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <InstitutionalStamp config={stampConfig} size={200} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="w-28 h-28 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden">
                {stampImage ? (
                  <img src={stampImage} alt="Sello" className="max-w-full max-h-full object-contain" data-testid="stamp-image-preview" />
                ) : (
                  <span className="text-xs text-slate-400 text-center px-2">Sin sello</span>
                )}
              </div>
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg cursor-pointer transition-colors">
                  {uploadingImg === "stamp" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploadingImg === "stamp" ? "Procesando…" : "Subir sello"}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingImg === "stamp"}
                    onChange={(e) => { uploadDirectorImage("stamp", e.target.files?.[0]); e.target.value = ""; }}
                    data-testid="stamp-image-upload" />
                </label>
                {stampImage && (
                  <button type="button" onClick={() => clearDirectorImage("stamp")} disabled={saving}
                    className="block text-xs text-rose-600 hover:underline" data-testid="stamp-image-clear">Quitar sello</button>
                )}
                <p className="text-[11px] text-slate-400 max-w-[180px]">PNG/JPG con fondo blanco. Se vuelve transparente automáticamente.</p>
              </div>
            </div>
          )}
        </div>

        {/* Vista previa de la zona de firmas (arrastrar y soltar) */}
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4" data-testid="signature-layout-preview">
          <div className="flex items-center gap-2 mb-1">
            <Maximize2 className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-semibold text-slate-800">Vista previa de la zona de firmas</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">Así se verá el recuadro del DIRECTOR(A) en la libreta. <b>Arrastra</b> la firma y el sello para ubicarlos donde prefieras.</p>
          <SignatureLayoutEditor
            layout={signatureLayout}
            onChange={saveSignatureLayout}
            directorName={directorName}
            directorSignature={directorSignature}
            stampMode={stampMode}
            stampImage={stampImage}
            stampConfig={stampConfig}
          />
        </div>

        {/* Posición vertical del bloque de firmas en la hoja */}
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4" data-testid="signature-block-offset-control">
          <div className="flex items-center gap-2 mb-1">
            <Maximize2 className="w-4 h-4 text-violet-600 rotate-90" />
            <span className="text-sm font-semibold text-slate-800">Altura de la zona de firmas en la hoja</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">Mueve la barra para subir o bajar el bloque de firmas (Tutor y Director, con su sello) dentro de la página. <b>0%</b> lo pega arriba, <b>100%</b> al fondo. La vista previa de la derecha se actualiza al instante.</p>

          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Slider */}
            <div className="flex-1 w-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Distancia desde arriba</span>
                <span className="text-xs font-bold text-violet-700 tabular-nums" data-testid="signature-block-offset-value">{Math.round(signatureBlockOffset)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={signatureBlockOffset}
                onChange={(e) => setSignatureBlockOffset(Number(e.target.value))}
                onMouseUp={(e) => saveSignatureBlockOffset(e.target.value)}
                onTouchEnd={(e) => saveSignatureBlockOffset(e.target.value)}
                onKeyUp={(e) => saveSignatureBlockOffset(e.target.value)}
                className="w-full accent-violet-600 cursor-pointer"
                data-testid="signature-block-offset-slider"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Arriba</span>
                <span>Centro</span>
                <span>Abajo</span>
              </div>
              <div className="flex gap-2 mt-3">
                {[
                  { label: "Arriba", v: 5 },
                  { label: "Centro", v: 45 },
                  { label: "Abajo", v: 90 },
                ].map((p) => (
                  <button
                    key={p.v}
                    type="button"
                    onClick={() => { setSignatureBlockOffset(p.v); saveSignatureBlockOffset(p.v); }}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-violet-100 hover:border-violet-300 text-slate-600"
                    data-testid={`signature-offset-preset-${p.v}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vista previa rápida (mini-hoja) */}
            <div className="shrink-0">
              <p className="text-[10px] text-slate-400 text-center mb-1">Vista previa (hoja de firmas)</p>
              <div
                className="relative bg-white border border-slate-300 rounded shadow-sm mx-auto overflow-hidden"
                style={{ width: 132, height: 187 }}
                data-testid="signature-block-offset-preview"
              >
                {/* Encabezado simulado de la página 2 */}
                <div className="absolute top-0 left-0 right-0 flex justify-between px-1.5 pt-1 text-[5px] text-slate-400">
                  <span>Apellidos Nombres</span>
                  <span>Página 2</span>
                </div>
                {/* Bloque de firmas posicionado por el offset */}
                <div
                  className="absolute left-0 right-0 flex justify-around px-2"
                  style={{ top: `${10 + (signatureBlockOffset / 100) * 70}%` }}
                  data-testid="signature-block-offset-preview-block"
                >
                  {["Tutor (A)", "Director (A)"].map((rol) => (
                    <div key={rol} className="flex flex-col items-center" style={{ width: 50 }}>
                      <div className="w-full border-t border-slate-700" />
                      <span className="text-[5px] text-slate-500 mt-0.5">Nombre</span>
                      <span className="text-[6px] font-bold text-slate-700 leading-tight">{rol}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Acceso a "Calificaciones" en los portales ──────────────────── */}
      <section className="space-y-3 pt-4 border-t border-slate-200" data-testid="libreta-grades-access-section">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-violet-600" />
            Acceso a Calificaciones y Libreta en los portales
          </h3>
          <p className="text-xs text-slate-500 mt-1">Controla si los botones <b>Calificaciones</b> (menú) y <b>Mi Libreta</b> (dashboard) aparecen en el portal de alumnos y/o de padres. Si desactivas un interruptor, esa opción desaparece para ese portal.</p>
        </div>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
          <input
            type="checkbox"
            checked={showGradesStudent}
            disabled={saving}
            onChange={(e) => toggleShowGrades("show_grades_student", e.target.checked, setShowGradesStudent, "alumnos")}
            className="w-4 h-4 mt-0.5 accent-violet-600"
            data-testid="show-grades-student-toggle"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-slate-500" /> Mostrar Calificaciones a Alumnos
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Si está activo, los alumnos verán el botón <b>Calificaciones</b> en su menú. Desactívalo para ocultarlo.</p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
          <input
            type="checkbox"
            checked={showGradesParent}
            disabled={saving}
            onChange={(e) => toggleShowGrades("show_grades_parent", e.target.checked, setShowGradesParent, "padres")}
            className="w-4 h-4 mt-0.5 accent-violet-600"
            data-testid="show-grades-parent-toggle"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-500" /> Mostrar Calificaciones a Padres de Familia
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Si está activo, los padres verán el botón <b>Calificaciones</b> en su menú. Desactívalo para ocultarlo.</p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
          <input
            type="checkbox"
            checked={showLibretaStudent}
            disabled={saving}
            onChange={(e) => toggleShowGrades("show_libreta_student", e.target.checked, setShowLibretaStudent, "alumnos", "Mi Libreta")}
            className="w-4 h-4 mt-0.5 accent-violet-600"
            data-testid="show-libreta-student-toggle"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-slate-500" /> Mostrar "Mi Libreta" a Alumnos
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Si está activo, los alumnos verán la tarjeta <b>Mi Libreta del Estudiante</b> en su dashboard. Desactívalo para ocultar el acceso a la libreta.</p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
          <input
            type="checkbox"
            checked={showLibretaParent}
            disabled={saving}
            onChange={(e) => toggleShowGrades("show_libreta_parent", e.target.checked, setShowLibretaParent, "padres", "Libreta")}
            className="w-4 h-4 mt-0.5 accent-violet-600"
            data-testid="show-libreta-parent-toggle"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-500" /> Mostrar Libreta del hijo/a a Padres de Familia
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Si está activo, los padres verán la tarjeta <b>Libreta</b> de su hijo/a en su dashboard. Desactívalo para ocultar el acceso a la libreta.</p>
          </div>
        </label>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          Plantilla del encabezado — textos editables del header
          (INSTITUCIÓN EDUCATIVA PRIVADA, Informe de Progreso, etc.)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-4 pt-4 border-t border-slate-200" data-testid="libreta-header-template-section">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Plantilla del encabezado</h3>
              <p className="text-xs text-slate-500">Personaliza los textos del encabezado de la libreta. Puedes usar variables como <code className="bg-slate-100 px-1 rounded">{"{year}"}</code>, <code className="bg-slate-100 px-1 rounded">{"{roman}"}</code>, <code className="bg-slate-100 px-1 rounded">{"{grado}"}</code> y <code className="bg-slate-100 px-1 rounded">{"{seccion}"}</code>.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={restoreHeaderAll}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors disabled:opacity-50"
            data-testid="header-restore-all"
          >
            Restaurar todo al default
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Plantilla por defecto */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="header-template-default">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Plantilla por defecto</div>
            <div className="space-y-2 text-xs text-slate-600">
              <HeaderRow label="Línea superior" value={headerDefaults.line1} muted />
              <HeaderRow label="Nombre del colegio" value="(nombre real del colegio)" muted />
              <HeaderRow label="Subtítulo" value={headerDefaults.line3} muted />
              <HeaderRow label="Etiqueta de bimestre" value={headerDefaults.bimestre_label} muted />
              <HeaderRow label="Cuadro lateral (foto/iniciales)" value={headerDefaults.show_initials_box ? "Visible" : "Oculto"} muted />
              <HeaderRow label="Negritas por defecto" value="Nombre · Subtítulo · Grado · Bimestre" muted />
            </div>
          </div>

          {/* Plantilla en uso */}
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50/50 p-3" data-testid="header-template-current">
            <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Plantilla en uso</div>
            <div className="space-y-2">
              <HeaderEditableField
                label="Línea superior"
                field="line1"
                value={headerTpl.line1}
                defaultValue={headerDefaults.line1}
                onSave={(v) => saveHeaderTemplate({ line1: v })}
                onRestore={() => restoreHeaderField("line1")}
                hint="Aparece en la parte más alta del encabezado."
                saving={saving}
                boldField="line1_bold"
                boldValue={!!headerTpl.line1_bold}
                onToggleBold={(b) => saveHeaderTemplate({ line1_bold: b })}
                sizeField="line1_size"
                sizeValue={headerTpl.line1_size}
                onChangeSize={(s) => saveHeaderTemplate({ line1_size: s })}
              />
              <HeaderEditableField
                label="Nombre del colegio"
                field="school_name_override"
                value={headerTpl.school_name_override}
                defaultValue={headerDefaults.school_name_override}
                onSave={(v) => saveHeaderTemplate({ school_name_override: v })}
                onRestore={() => restoreHeaderField("school_name_override")}
                hint="Déjalo vacío para usar el nombre legal del colegio. Escribe aquí para sobreescribirlo (ej: 'COLEGIO EL ROBLE — 2026')."
                saving={saving}
                boldField="school_name_bold"
                boldValue={headerTpl.school_name_bold !== false}
                onToggleBold={(b) => saveHeaderTemplate({ school_name_bold: b })}
                sizeField="school_name_size"
                sizeValue={headerTpl.school_name_size}
                onChangeSize={(s) => saveHeaderTemplate({ school_name_size: s })}
              />
              <HeaderEditableField
                label="Subtítulo"
                field="line3"
                value={headerTpl.line3}
                defaultValue={headerDefaults.line3}
                onSave={(v) => saveHeaderTemplate({ line3: v })}
                onRestore={() => restoreHeaderField("line3")}
                hint="Variables: {year} = año actual."
                saving={saving}
                boldField="line3_bold"
                boldValue={headerTpl.line3_bold !== false}
                onToggleBold={(b) => saveHeaderTemplate({ line3_bold: b })}
                sizeField="line3_size"
                sizeValue={headerTpl.line3_size}
                onChangeSize={(s) => saveHeaderTemplate({ line3_size: s })}
              />
              <HeaderEditableField
                label="Etiqueta de bimestre"
                field="bimestre_label"
                value={headerTpl.bimestre_label}
                defaultValue={headerDefaults.bimestre_label}
                onSave={(v) => saveHeaderTemplate({ bimestre_label: v })}
                onRestore={() => restoreHeaderField("bimestre_label")}
                hint="Variables: {roman} = número romano (I, II, III, IV)."
                saving={saving}
                boldField="bimestre_bold"
                boldValue={headerTpl.bimestre_bold !== false}
                onToggleBold={(b) => saveHeaderTemplate({ bimestre_bold: b })}
                sizeField="bimestre_size"
                sizeValue={headerTpl.bimestre_size}
                onChangeSize={(s) => saveHeaderTemplate({ bimestre_size: s })}
              />
              {/* Logo size */}
              <div className="p-2 rounded-lg border border-slate-200 bg-white" data-testid="header-logo-scale-row">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-700">Tamaño del logo</span>
                  <select
                    value={Number(headerTpl.logo_scale) || 1.0}
                    disabled={saving}
                    onChange={(e) => saveHeaderTemplate({ logo_scale: parseFloat(e.target.value) })}
                    className="px-2 py-1 text-sm font-semibold text-slate-700 border-2 border-slate-300 rounded bg-white hover:border-amber-400 focus:outline-none focus:border-amber-500 disabled:opacity-50 cursor-pointer"
                    data-testid="header-logo-scale-select"
                  >
                    {LOGO_OPTIONS.map((opt) => (
                      <option key={opt.v} value={opt.v}>{opt.label} ({opt.v}×)</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-amber-300 transition-colors">
                <input
                  type="checkbox"
                  checked={headerTpl.nivel_bold !== false}
                  disabled={saving}
                  onChange={(e) => saveHeaderTemplate({ nivel_bold: e.target.checked })}
                  className="w-4 h-4 accent-amber-600"
                  data-testid="header-nivel-bold-toggle"
                />
                <span className="text-sm text-slate-700">Grado / sección en <b>negrita</b></span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-amber-300 transition-colors">
                <input
                  type="checkbox"
                  checked={headerTpl.show_initials_box !== false}
                  disabled={saving}
                  onChange={(e) => saveHeaderTemplate({ show_initials_box: e.target.checked })}
                  className="w-4 h-4 accent-amber-600"
                  data-testid="header-show-initials-toggle"
                />
                <span className="text-sm text-slate-700">Mostrar cuadro lateral (foto o iniciales del alumno)</span>
              </label>
            </div>
          </div>
        </div>

        {/* ── Vista previa en vivo (estilo Canva) ── */}
        <HeaderLivePreview tpl={headerTpl} />
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          Paleta de colores — editor visual estilo Canva. Click directo
          sobre la zona de la libreta-muestra para pintarla.
          ═══════════════════════════════════════════════════════════════ */}
      <LibretaPaletteEditor
        palette={palette}
        cellBold={cellBold}
        cellSize={cellSize}
        allBold={allBold}
        onChangeColor={setZoneColor}
        onChangeBold={setCellBoldValue}
        onChangeSize={setCellSizeValue}
        onToggleAllBold={toggleAllBold}
        onResetAll={restoreAllColors}
        saving={saving}
      />

      {/* ═══════════════════════════════════════════════════════════════
          Formato de impresión premium — controles para que la libreta
          se vea bien al imprimir / exportar (resuelve el caso de letras
          muy pequeñas o tablas que se cortan en el papel).
          ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-4 pt-4 border-t border-slate-200" data-testid="libreta-print-format-section">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-100 text-violet-700">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Formato de impresión</h3>
              <p className="text-xs text-slate-500">Ajusta cómo se ve la libreta al imprimirla o exportarla a PDF. Ideal si los padres reportan que las letras son muy pequeñas o que la tabla se corta.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openPreview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors"
            data-testid="libreta-print-format-preview"
          >
            <Eye className="w-4 h-4" /> Vista previa
          </button>
        </div>

        {/* Font size */}
        <PrintFormatGroup
          icon={<Type className="w-4 h-4" />}
          label="Tamaño de letra"
          hint="Más grande = más fácil de leer, pero ocupa más espacio."
          field="font_scale"
          value={printFormat.font_scale}
          onChange={setPrintField}
          options={[
            { v: "small",  label: "Pequeña",      sub: "0.85×", example: "ABc" },
            { v: "normal", label: "Normal",       sub: "1.0×",  example: "ABc" },
            { v: "large",  label: "Grande",       sub: "1.15×", example: "ABc" },
            { v: "xlarge", label: "Extra grande", sub: "1.3×",  example: "ABc" },
          ]}
          saving={saving}
        />

        {/* Orientation */}
        <PrintFormatGroup
          icon={<RotateCw className="w-4 h-4" />}
          label="Orientación del papel"
          hint="Mantén Vertical si imprimes en hojas A4 normales. Solo usa Horizontal si tu colegio imprime en hojas apaisadas o tiene muchísimas asignaturas."
          field="orientation"
          value={printFormat.orientation}
          onChange={setPrintField}
          options={[
            { v: "portrait",  label: "Vertical",   sub: "Default" },
            { v: "landscape", label: "Horizontal", sub: "Apaisado" },
          ]}
          saving={saving}
        />

        {/* Paper size */}
        <PrintFormatGroup
          icon={<Maximize2 className="w-4 h-4" />}
          label="Tamaño de papel"
          hint="El tamaño físico de la hoja en que se va a imprimir."
          field="paper_size"
          value={printFormat.paper_size}
          onChange={setPrintField}
          options={[
            { v: "a4",     label: "A4",     sub: "21 × 29.7 cm" },
            { v: "letter", label: "Carta",  sub: "21.6 × 27.9 cm" },
            { v: "legal",  label: "Oficio", sub: "21.6 × 35.6 cm" },
          ]}
          saving={saving}
        />

        {/* Row density */}
        <PrintFormatGroup
          icon={<Rows className="w-4 h-4" />}
          label="Densidad de filas"
          hint="Filas más altas son más fáciles de leer; las compactas ahorran páginas."
          field="row_density"
          value={printFormat.row_density}
          onChange={setPrintField}
          options={[
            { v: "compact",      label: "Compacto",  sub: "Mínimo espacio" },
            { v: "comfortable",  label: "Cómodo",    sub: "Balance" },
            { v: "spacious",     label: "Espacioso", sub: "Filas altas" },
          ]}
          saving={saving}
        />

        {/* Table style */}
        <PrintFormatGroup
          icon={<Layers className="w-4 h-4" />}
          label="Estilo de tabla"
          hint="Cómo se ven las líneas y los fondos de la tabla principal."
          field="table_style"
          value={printFormat.table_style}
          onChange={setPrintField}
          options={[
            { v: "thin",  label: "Líneas finas",    sub: "Clásico" },
            { v: "bold",  label: "Líneas marcadas", sub: "Mejor contraste" },
            { v: "zebra", label: "Cebra",           sub: "Filas alternadas" },
          ]}
          saving={saving}
        />

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors" data-testid="libreta-fit-one-page-label">
          <input
            type="checkbox"
            checked={!!printFormat.fit_one_page}
            disabled={saving}
            onChange={(e) => setPrintField("fit_one_page", e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-violet-600"
            data-testid="libreta-fit-one-page-toggle"
          />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">Ajustar a una sola hoja</div>
            <p className="text-xs text-slate-500 mt-0.5">Las firmas (Tutor / Director) se colocan compactas <b>justo debajo de las notas</b>, en lugar de generar una segunda hoja casi vacía. Recomendado para ahorrar papel. Si lo desactivas, vuelve al formato de 2 páginas.</p>
          </div>
        </label>

        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-900">
          <b>💡 Tip:</b> el default (Vertical · A4 · Normal · Cómodo) está optimizado para impresión estándar. Si los padres reportan letras muy pequeñas, sube el <b>Tamaño de letra</b> a "Grande". Solo cambia a Horizontal si tu colegio imprime en hojas apaisadas.
        </div>
      </section>

      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 leading-relaxed">
        <p className="font-semibold text-slate-800 mb-1">¿Cómo funciona "Cargar PDF"?</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Activa el modo "Cargar PDF a Drive" arriba.</li>
          <li>Ve al Consolidado de Notas y haz clic en <strong>Cargar libretas</strong>.</li>
          <li>Filtra por nivel, grado, sección y bimestre, y sube un PDF por alumno (máx. 10 MB).</li>
          <li>Los padres y alumnos verán la libreta disponible en su portal.</li>
        </ol>
      </div>

      {/* Conducta Extendida — editor de plantilla */}
      <div className="pt-4 border-t border-slate-200">
        <ConductaExtendidaEditor token={token} />
      </div>
    </div>
  );
}

/**
 * Live preview of the libreta header — renders exactly like the real
 * encabezado in LibretaCard.jsx, but with mock data, inside a "paper-style"
 * card (drop shadow, soft borders, rotated subtle background). Updates
 * instantly as the user types in the template fields above. Canva-inspired:
 * the goal is that the owner SEES what the parents will see, not just text
 * fields.
 */
function HeaderLivePreview({ tpl }) {
  const NOW = new Date();
  const mockYear = NOW.getFullYear();
  const interpolate = (str) =>
    String(str || "").replace(/\{(\w+)\}/g, (_, k) => {
      const vars = { year: mockYear, roman: "I", bimestre: "I", grado: "2DO GRADO A PRIMARIA", seccion: "A" };
      return vars[k] != null ? vars[k] : "";
    });

  const line1 = interpolate(tpl.line1 || "INSTITUCIÓN EDUCATIVA PRIVADA");
  const schoolName = (tpl.school_name_override && String(tpl.school_name_override).trim())
    ? String(tpl.school_name_override).trim().toUpperCase()
    : "COLEGIO DE EJEMPLO";
  const line3 = interpolate(tpl.line3 || "Informe de Progreso del Estudiante - {year}");
  const bimestre = interpolate(tpl.bimestre_label || "{roman} BIMESTRE");
  const showInitials = tpl.show_initials_box !== false;
  const fw = (on) => (on ? 700 : 400);
  const sz = (mul, base) => Math.round(base * (Number(mul) || 1));
  const logoScale = Number(tpl.logo_scale) || 1;

  return (
    <div data-testid="header-live-preview">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-violet-700 uppercase tracking-wide flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" />
          Vista previa en vivo
        </div>
        <div className="text-[10px] text-slate-400 italic">Se actualiza mientras editas →</div>
      </div>
      {/* Canva-like paper card */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #fef3c7 100%)",
          padding: "20px",
          boxShadow: "0 20px 50px -20px rgba(124, 58, 237, 0.25), 0 8px 20px -10px rgba(0, 0, 0, 0.1)",
        }}
      >
        {/* Subtle grid background, very faint */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Mock paper sheet */}
        <div
          className="relative bg-white rounded-md mx-auto"
          style={{
            width: "100%",
            maxWidth: "640px",
            boxShadow: "0 6px 16px -6px rgba(0, 0, 0, 0.18), 0 2px 4px -2px rgba(0,0,0,0.06)",
            padding: "20px 28px",
            fontFamily: "Arial, Helvetica, sans-serif",
            color: "#000",
          }}
        >
          {/* HEADER — same structure as LibretaCard's real header */}
          <div className="flex items-center gap-3" style={{ minHeight: "90px" }}>
            {/* Logo placeholder */}
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-full font-bold text-sm"
              style={{ width: `${60 * logoScale}px`, height: `${60 * logoScale}px`, border: "2px solid #1a3a52", color: "#1a3a52", fontSize: `${14 * Math.sqrt(logoScale)}px` }}
            >
              C
            </div>
            {/* Center text block */}
            <div className="flex-1 text-center">
              <div style={{ fontSize: `${sz(tpl.line1_size, 10)}px`, letterSpacing: "0.5px", color: "#111", fontWeight: fw(tpl.line1_bold) }}>{line1}</div>
              <div style={{ fontSize: `${sz(tpl.school_name_size, 18)}px`, fontWeight: fw(tpl.school_name_bold !== false), fontFamily: "Times, serif", color: "#0f172a", margin: "2px 0" }}>
                {schoolName}
              </div>
              <div style={{ fontSize: `${sz(tpl.line3_size, 12)}px`, color: "#1d4ed8", fontWeight: fw(tpl.line3_bold !== false) }}>{line3}</div>
              <div style={{ fontSize: `${sz(tpl.nivel_size, 10)}px`, fontWeight: fw(tpl.nivel_bold !== false), marginTop: "4px" }}>2DO GRADO A PRIMARIA</div>
              <div style={{ fontSize: `${sz(tpl.bimestre_size, 11)}px`, fontWeight: fw(tpl.bimestre_bold !== false), marginTop: "2px" }}>{bimestre}</div>
            </div>
            {/* Initials box (toggle) */}
            {showInitials && (
              <div
                className="flex-shrink-0 flex items-center justify-center text-white font-bold rounded"
                style={{ width: "52px", height: "70px", background: "#94a3b8", fontSize: "16px" }}
                data-testid="preview-initials-box"
              >
                AB
              </div>
            )}
          </div>

          {/* Mock student row to give context (greyed out — out of editing scope) */}
          <div className="mt-3 pt-2 border-t border-slate-200" style={{ opacity: 0.5 }}>
            <div className="grid grid-cols-4 gap-2 text-[9px] uppercase text-slate-500">
              <span>Código</span><span>Apellidos y Nombres</span><span>Salón</span><span className="text-right">N° Ord</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold text-slate-700 mt-1">
              <span className="border border-slate-300 rounded-full px-2 py-0.5 text-center">STU-000774</span>
              <span className="border border-slate-300 rounded-full px-2 py-0.5 text-center">ALVA BLAS, Barbara</span>
              <span className="border border-slate-300 rounded-full px-2 py-0.5 text-center">2DO GRADO A PRIMARIA</span>
              <span className="border border-slate-300 rounded-full px-2 py-0.5 text-center">1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Read-only display of a single template field (used in the "default" column).
 */
function HeaderRow({ label, value, muted }) {
  return (
    <div>
      <div className={`text-[10px] font-semibold uppercase tracking-wide ${muted ? "text-slate-400" : "text-slate-600"}`}>{label}</div>
      <div className={`text-xs ${muted ? "text-slate-500 italic" : "text-slate-800"} bg-white border border-slate-200 rounded px-2 py-1 mt-0.5`}>
        {value || <span className="opacity-50">(vacío)</span>}
      </div>
    </div>
  );
}

/**
 * Editable single-line input for a header field, with restore-to-default button.
 * Saves onBlur (or on Enter) to avoid spamming the API on each keystroke.
 */
function HeaderEditableField({ label, field, value, defaultValue, onSave, onRestore, hint, saving, boldField, boldValue, onToggleBold, sizeField, sizeValue, onChangeSize }) {
  const [local, setLocal] = useState(value || "");
  useEffect(() => { setLocal(value || ""); }, [value]);
  const dirty = local !== (value || "");
  const isDefault = (value || "") === (defaultValue || "");

  const commit = () => {
    if (!dirty) return;
    onSave(local);
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">{label}</div>
        {!isDefault && (
          <button
            type="button"
            onClick={onRestore}
            disabled={saving}
            className="text-[10px] text-slate-500 hover:text-slate-700 underline disabled:opacity-50"
            data-testid={`header-restore-${field}`}
          >
            restaurar default
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={local}
          disabled={saving}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); e.target.blur(); } }}
          className="flex-1 min-w-0 text-sm px-2 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200 disabled:opacity-50"
          style={boldValue ? { fontWeight: 700 } : undefined}
          data-testid={`header-input-${field}`}
        />
        {boldField && (
          <button
            type="button"
            onClick={() => onToggleBold(!boldValue)}
            disabled={saving}
            title={boldValue ? "Quitar negrita" : "Poner en negrita"}
            className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded border-2 font-bold text-sm transition-all ${
              boldValue
                ? "border-amber-600 bg-amber-100 text-amber-900"
                : "border-slate-300 bg-white text-slate-500 hover:border-amber-400 hover:bg-amber-50"
            } disabled:opacity-50`}
            data-testid={`header-bold-${field}`}
          >
            B
          </button>
        )}
        {sizeField && (
          <select
            value={Number(sizeValue) || 1.0}
            disabled={saving}
            onChange={(e) => onChangeSize(parseFloat(e.target.value))}
            title="Tamaño del texto"
            className="flex-shrink-0 h-9 px-1.5 text-xs font-semibold text-slate-700 border-2 border-slate-300 rounded bg-white hover:border-amber-400 focus:outline-none focus:border-amber-500 disabled:opacity-50 cursor-pointer"
            data-testid={`header-size-${field}`}
          >
            {SIZE_OPTIONS.map((opt) => (
              <option key={opt.v} value={opt.v}>{opt.label}</option>
            ))}
          </select>
        )}
      </div>
      {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

/**
 * Visual card-style selector for a single print-format field. Each option is
 * a "chip card" that highlights when selected. Big enough to feel premium,
 * with a description and an optional "Recomendado" badge.
 */
function PrintFormatGroup({ icon, label, hint, field, value, onChange, options, saving }) {
  return (
    <div className="space-y-2" data-testid={`print-format-${field}`}>
      <div className="flex items-center gap-2">
        <span className="text-slate-500">{icon}</span>
        <span className="text-sm font-semibold text-slate-800">{label}</span>
      </div>
      {hint && <p className="text-xs text-slate-500 -mt-1 ml-6">{hint}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ml-6">
        {options.map((opt) => {
          const selected = value === opt.v;
          return (
            <button
              key={opt.v}
              type="button"
              disabled={saving}
              onClick={() => onChange(field, opt.v)}
              className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                selected
                  ? "border-violet-600 bg-violet-50 ring-2 ring-violet-100"
                  : "border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/30"
              } ${saving ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
              data-testid={`print-format-${field}-${opt.v}`}
            >
              {opt.recommended && (
                <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                  ★
                </span>
              )}
              <div className="text-sm font-semibold text-slate-800">{opt.label}</div>
              {opt.sub && <div className="text-[11px] text-slate-500 mt-0.5">{opt.sub}</div>}
              {opt.example && (
                <div className="text-slate-700 mt-1.5" style={{
                  fontSize: opt.v === "small" ? "0.7em" : opt.v === "large" ? "1.15em" : opt.v === "xlarge" ? "1.4em" : "0.9em",
                  fontWeight: 600,
                }}>{opt.example}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}


/**
 * Compute black/white text color that contrasts with the given hex bg.
 * (Kept for HeaderLivePreview internal use.)
 */
function autoContrast(hex) {
  if (!hex || typeof hex !== "string") return "#000";
  const m = hex.trim().replace(/^#/, "");
  let r, g, b;
  if (m.length === 3) {
    r = parseInt(m[0] + m[0], 16);
    g = parseInt(m[1] + m[1], 16);
    b = parseInt(m[2] + m[2], 16);
  } else if (m.length === 6) {
    r = parseInt(m.slice(0, 2), 16);
    g = parseInt(m.slice(2, 4), 16);
    b = parseInt(m.slice(4, 6), 16);
  } else {
    return "#000";
  }
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#000" : "#fff";
}
// eslint-disable-next-line no-unused-vars
const _autoContrast_kept_for_potential_inline_use = autoContrast;

