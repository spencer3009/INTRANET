import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import "./LibretaCard.css";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const LETRAS = ["AD", "A", "B", "C"];

const letraClass = (l) => {
  if (l === "C") return "lc-red";
  if (l === "AD") return "lc-green";
  return "";
};

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export default function LibretaCard({ data, token, canEdit, onReload }) {
  const headers = { Authorization: `Bearer ${token}` };
  const periods = data?.all_periods || [];
  const periodIds = periods.map(p => p.id);

  // Closed periods (snapshots existentes) — lockdown por bimestre
  const [closedSet, setClosedSet] = useState(new Set());
  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/libreta/closed-periods/${data.student.id}`, { headers });
        setClosedSet(new Set((r.data?.closed_periods || []).map(p => p.period_id)));
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.student.id]);

  // Local state para edición optimista
  const [conduct, setConduct] = useState(data.conducta || {});
  const [comments, setComments] = useState(data.tutor_comments || {});
  const [finalStatus, setFinalStatus] = useState(data.final_status || { situacion: null, cursos_para_recuperar: [] });

  useEffect(() => { setConduct(data.conducta || {}); setComments(data.tutor_comments || {}); setFinalStatus(data.final_status || { situacion: null, cursos_para_recuperar: [] }); }, [data]);

  const bim4Id = periods.find(p => p.orden === 4)?.id;
  const bim4Closed = bim4Id ? closedSet.has(bim4Id) : false;

  const saveConduct = async (period_id, letra) => {
    try {
      await axios.put(`${API}/conduct`, { student_id: data.student.id, period_id, letra }, { headers });
      toast.success("Conducta actualizada");
    } catch (err) {
      if (err.response?.status === 423) toast.error("Bimestre cerrado");
      else toast.error(err.response?.data?.detail || "Error al guardar");
      onReload && onReload();
    }
  };

  const saveComment = debounce(async (period_id, comment) => {
    try {
      await axios.put(`${API}/tutor-comments`, { student_id: data.student.id, period_id, comment }, { headers });
      toast.success("Comentario guardado");
    } catch (err) {
      if (err.response?.status === 423) toast.error("Bimestre cerrado");
      else toast.error(err.response?.data?.detail || "Error al guardar comentario");
    }
  }, 600);

  const saveFinalStatus = async (situacion, cursos_para_recuperar) => {
    try {
      const r = await axios.put(`${API}/final-status`, {
        student_id: data.student.id,
        year: data.year,
        situacion,
        cursos_para_recuperar,
      }, { headers });
      setFinalStatus(r.data?.final_status || { situacion, cursos_para_recuperar });
      toast.success("Situación final actualizada");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar situación final");
    }
  };

  // Iniciales para foto placeholder
  const initials = (() => {
    const parts = (data.student.apellidos_nombres || "").replace(",", "").split(" ").filter(Boolean);
    return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
  })();

  const allSubjects = [
    ...(data.areas || []).flatMap(a => a.subjects.map(s => ({ ...s, areaName: a.name }))),
    ...(data.subjects_without_area || []),
  ];

  // Subjects for "cursos a recuperar" multi-select
  const subjectsForRecovery = allSubjects.map(s => ({ id: s.id, name: s.name }));

  return (
    <div className="max-w-5xl mx-auto libreta-card bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 print:shadow-none print:border-0 print:rounded-none print:p-4" data-testid="libreta-card">
      {/* CABECERA */}
      <div className="grid grid-cols-12 gap-4 items-center mb-4 pb-4 border-b border-slate-300">
        <div className="col-span-2 flex justify-center">
          {data.school.logo_url ? (
            <img src={data.school.logo_url} alt="Logo" className="w-20 h-20 object-contain rounded-lg" />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-slate-200" />
          )}
        </div>
        <div className="col-span-8 text-center">
          <p className="text-xs text-slate-500 tracking-wider">INSTITUCIÓN EDUCATIVA PRIVADA</p>
          <h1 className="text-xl font-bold text-slate-900 my-1">{data.school.legal_name || (data.school.name || "").toUpperCase()}</h1>
          <p className="text-sm text-slate-700">INFORME DE PROGRESO DEL ESTUDIANTE — {data.year}</p>
          <p className="text-sm text-slate-700">NIVEL {(data.section?.nivel || "").toUpperCase()}</p>
          <p className="text-sm font-semibold text-slate-800">{data.period_active?.orden}° BIMESTRE</p>
        </div>
        <div className="col-span-2 flex justify-center">
          {data.student.photo_url ? (
            <img src={data.student.photo_url} alt="Foto" className="w-20 h-20 object-cover border border-slate-300 rounded" />
          ) : (
            <div className="w-20 h-20 border border-slate-300 rounded bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xl uppercase" data-testid="libreta-photo-placeholder">{initials}</div>
          )}
        </div>
      </div>

      {/* IDENTIFICACIÓN */}
      <table className="lc-table mb-4" data-testid="libreta-identif-table">
        <thead><tr><th>Código</th><th>Apellidos y Nombres</th><th>Salón</th><th>N°Ord</th></tr></thead>
        <tbody>
          <tr>
            <td>{data.student.student_code || "—"}</td>
            <td className="font-medium">{data.student.apellidos_nombres}</td>
            <td>{data.section?.display || "—"}</td>
            <td className="text-center">{data.student.n_orden ?? "—"}</td>
          </tr>
        </tbody>
      </table>

      {allSubjects.length === 0 ? (
        <div className="text-center py-10 text-slate-500 italic" data-testid="libreta-empty-grades">Aún no hay calificaciones registradas para este alumno.</div>
      ) : (
        <table className="lc-table mb-4" data-testid="libreta-grades-table">
          <thead>
            <tr>
              <th className="w-32">ÁREAS</th>
              <th>ASIGNATURAS</th>
              {periods.map(p => <th key={p.id} className="w-12">{p.orden === 1 ? "I" : p.orden === 2 ? "II" : p.orden === 3 ? "III" : "IV"}</th>)}
              <th className="w-20">Promedio</th>
            </tr>
          </thead>
          <tbody>
            {(data.areas || []).map(area => (
              <>
                {area.subjects.map((s, idx) => (
                  <tr key={s.id}>
                    {idx === 0 && (<td rowSpan={area.subjects.length + 1} className="lc-area-name text-center">{area.name}</td>)}
                    <td>{s.name}</td>
                    {periods.map(p => {
                      const cell = s.grades?.[p.id] || {};
                      return <td key={p.id} className={`text-center ${letraClass(cell.letter)}`}>{cell.letter || <span className="text-slate-300">—</span>}</td>;
                    })}
                    <td className={`text-center font-semibold ${letraClass(s.promedio_final?.letter)}`}>{s.promedio_final?.letter || "—"}</td>
                  </tr>
                ))}
                <tr className="lc-area-avg">
                  <td>Promedio área</td>
                  {periods.map(p => {
                    const av = area.promedio_area?.[p.id] || {};
                    return <td key={p.id} className={`text-center font-semibold ${letraClass(av.letter)}`}>{av.letter || "—"}</td>;
                  })}
                  <td className={`text-center font-semibold ${letraClass(area.promedio_area?.final?.letter)}`}>{area.promedio_area?.final?.letter || "—"}</td>
                </tr>
              </>
            ))}
            {(data.subjects_without_area || []).map(s => (
              <tr key={s.id}>
                <td className="lc-area-name text-center text-slate-400 italic">(sin área)</td>
                <td>{s.name}</td>
                {periods.map(p => {
                  const cell = s.grades?.[p.id] || {};
                  return <td key={p.id} className={`text-center ${letraClass(cell.letter)}`}>{cell.letter || <span className="text-slate-300">—</span>}</td>;
                })}
                <td className={`text-center font-semibold ${letraClass(s.promedio_final?.letter)}`}>{s.promedio_final?.letter || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Conducta + Estadística */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Conducta */}
        <table className="lc-table" data-testid="libreta-conducta-table">
          <thead>
            <tr><th colSpan={6}>CONDUCTA</th></tr>
            <tr><th></th>{periods.map(p => <th key={p.id} className="w-10 text-center">{p.orden === 1 ? "I" : p.orden === 2 ? "II" : p.orden === 3 ? "III" : "IV"}</th>)}<th className="w-10">N.F.</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>PROMEDIO</td>
              {periods.map(p => {
                const c = conduct[p.id];
                const closed = closedSet.has(p.id);
                if (canEdit && !closed) {
                  return (
                    <td key={p.id} className="text-center p-0">
                      <select
                        value={c?.letra || ""}
                        onChange={(e) => { const v = e.target.value || null; setConduct(prev => ({ ...prev, [p.id]: { letra: v } })); if (v) saveConduct(p.id, v); }}
                        className="w-full px-1 py-1 text-center bg-transparent focus:outline-none"
                        data-testid={`libreta-conduct-${p.orden}`}
                      >
                        <option value="">—</option>
                        {LETRAS.map(L => <option key={L} value={L}>{L}</option>)}
                      </select>
                    </td>
                  );
                }
                return <td key={p.id} className={`text-center ${letraClass(c?.letra)}`} title={closed ? "Bimestre cerrado" : ""}>{c?.letra || "—"}</td>;
              })}
              <td className="text-center font-semibold">{(() => {
                const ls = periods.map(p => conduct[p.id]?.letra).filter(Boolean);
                if (!ls.length) return "—";
                const order = { AD: 4, A: 3, B: 2, C: 1 };
                const avg = ls.reduce((s, l) => s + (order[l] || 0), 0) / ls.length;
                return avg >= 3.5 ? "AD" : avg >= 2.5 ? "A" : avg >= 1.5 ? "B" : "C";
              })()}</td>
            </tr>
          </tbody>
        </table>

        {/* Estadística */}
        <table className="lc-table" data-testid="libreta-stats-table">
          <thead>
            <tr><th colSpan={6}>ESTADÍSTICA</th></tr>
            <tr><th></th>{periods.map(p => <th key={p.id} className="w-10 text-center">{p.orden === 1 ? "I" : p.orden === 2 ? "II" : p.orden === 3 ? "III" : "IV"}</th>)}<th className="w-10">Final</th></tr>
          </thead>
          <tbody>
            {[
              ["Puntaje", "puntaje"],
              ["Promedio", "promedio"],
              ["Desaprobados", "cursos_desaprobados"],
              ["Orden de Mérito", "orden_merito"],
              ["Tercio", "tercio"],
            ].map(([label, key]) => (
              <tr key={key}>
                <td>{label}</td>
                {periods.map(p => {
                  const v = data.ranking?.[p.id]?.[key];
                  return <td key={p.id} className="text-center">{v ?? "—"}</td>;
                })}
                <td className="text-center font-semibold">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Asistencias */}
      <table className="lc-table mb-4" data-testid="libreta-attendance-table">
        <thead>
          <tr><th colSpan={6}>ASISTENCIAS Y TARDANZAS</th></tr>
          <tr><th></th>{periods.map(p => <th key={p.id} className="w-12 text-center">{p.orden === 1 ? "I" : p.orden === 2 ? "II" : p.orden === 3 ? "III" : "IV"}</th>)}<th className="w-14">Total</th></tr>
        </thead>
        <tbody>
          {[["Presente", "presente"], ["Tardanza", "tardanza"], ["Falta", "falta"], ["Justificada", "justificada"]].map(([label, key]) => {
            const total = periods.reduce((s, p) => s + (data.asistencia?.[p.id]?.[key] || 0), 0);
            return (
              <tr key={key}>
                <td>{label}</td>
                {periods.map(p => {
                  const v = data.asistencia?.[p.id]?.[key];
                  return <td key={p.id} className="text-center">{v || (v === 0 ? "—" : "—")}</td>;
                })}
                <td className="text-center font-semibold">{total || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Comentarios del Tutor */}
      <table className="lc-table mb-4" data-testid="libreta-comments-table">
        <thead><tr><th className="w-16">BIM.</th><th>COMENTARIOS DEL TUTOR</th></tr></thead>
        <tbody>
          {periods.map(p => {
            const val = comments[p.id] || "";
            const closed = closedSet.has(p.id);
            const readonly = !canEdit || closed;
            return (
              <tr key={p.id}>
                <td className="text-center font-semibold">{p.orden === 1 ? "I" : p.orden === 2 ? "II" : p.orden === 3 ? "III" : "IV"}</td>
                <td className="p-0">
                  <textarea
                    value={val}
                    placeholder={readonly ? (closed ? "(Bimestre cerrado)" : "Sin comentarios para este bimestre") : "Escribir comentario…"}
                    readOnly={readonly}
                    rows={2}
                    onChange={(e) => { setComments(prev => ({ ...prev, [p.id]: e.target.value })); saveComment(p.id, e.target.value); }}
                    className={`w-full p-2 text-sm bg-transparent ${readonly ? "text-slate-500" : ""} focus:outline-none resize-none`}
                    data-testid={`libreta-comment-${p.orden}`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Situación Final */}
      <table className="lc-table" data-testid="libreta-final-status-table">
        <thead><tr><th colSpan={3}>SITUACIÓN FINAL DEL ESTUDIANTE</th></tr></thead>
        <tbody>
          {["PROMOVIDO", "REQ_RECUPERACION", "REPITE"].map(sit => {
            const checked = finalStatus.situacion === sit;
            const disabled = !canEdit || !bim4Closed;
            return (
              <tr key={sit}>
                <td className="w-44">{sit === "REQ_RECUPERACION" ? "REQ. RECUPERACIÓN" : sit}</td>
                <td className="text-center w-12">
                  <input
                    type="radio"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => saveFinalStatus(sit, sit === "PROMOVIDO" ? [] : finalStatus.cursos_para_recuperar || [])}
                    data-testid={`libreta-final-${sit}`}
                  />
                </td>
                <td>
                  {sit === "REQ_RECUPERACION" && checked && (
                    <div className="text-xs text-slate-600">
                      {(finalStatus.cursos_para_recuperar || []).length === 0 ? (
                        <span className="italic">Selecciona los cursos a recuperar:</span>
                      ) : (
                        <span>Cursos: {(finalStatus.cursos_para_recuperar || []).map(c => c.name || c).join(", ")}</span>
                      )}
                      {canEdit && bim4Closed && (
                        <select
                          multiple
                          value={(finalStatus.cursos_para_recuperar || []).map(c => c.id || c)}
                          onChange={(e) => {
                            const ids = Array.from(e.target.selectedOptions).map(o => o.value);
                            saveFinalStatus("REQ_RECUPERACION", ids);
                          }}
                          className="mt-1 w-full border border-slate-200 rounded p-1"
                          data-testid="libreta-final-cursos-select"
                        >
                          {subjectsForRecovery.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {!bim4Closed && (
            <tr><td colSpan={3} className="text-center text-xs text-slate-500 italic py-2">Disponible al cerrar el bimestre IV.</td></tr>
          )}
        </tbody>
      </table>

      {data?.tutor && (
        <div className="mt-6 pt-4 border-t border-slate-300 text-sm text-slate-700 flex justify-between print:text-xs">
          <div><strong>Tutor de aula:</strong> {data.tutor.nombres_completos}</div>
          <div><strong>Generada:</strong> {new Date(data?.metadata?.generated_at || Date.now()).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}
