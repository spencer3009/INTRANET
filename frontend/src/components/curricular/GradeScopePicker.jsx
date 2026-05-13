// GradeScopePicker — selector reutilizable de grados con atajos rápidos y
// checkboxes individuales agrupados por nivel.
//
// Props:
//   - token: JWT
//   - value: Set<grade_id>
//   - onChange: (Set<grade_id>) => void
//   - compact: boolean (default false) — modo denso (sin sección de atajos visibles)
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function GradeScopePicker({ token, value, onChange, compact = false }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [shortcuts, setShortcuts] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [activeShortcut, setActiveShortcut] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/curricular-areas/grade-shortcuts`, { headers });
        setShortcuts(r.data?.shortcuts || []);
        setGrades(r.data?.grades || []);
      } catch {
        // silencioso — el caller mostrará vacío
      } finally {
        setLoaded(true);
      }
    })();
    // eslint-disable-next-line
  }, []);

  // Detecta si el `value` actual matchea un atajo conocido
  useEffect(() => {
    if (!loaded) return;
    const sortedVal = Array.from(value).sort().join(",");
    const match = shortcuts.find(s => [...s.grade_ids].sort().join(",") === sortedVal);
    setActiveShortcut(match ? match.key : null);
  }, [value, shortcuts, loaded]);

  const applyShortcut = (sc) => {
    onChange(new Set(sc.grade_ids));
  };

  const toggleGrade = (gid) => {
    const next = new Set(value);
    if (next.has(gid)) next.delete(gid);
    else next.add(gid);
    onChange(next);
  };

  const gradesByLevel = useMemo(() => {
    const out = new Map();
    for (const g of grades) {
      const k = g.level_id;
      if (!out.has(k)) out.set(k, { level_name: g.level_name, level_order: g.level_order, items: [] });
      out.get(k).items.push(g);
    }
    return Array.from(out.values()).sort((a, b) => a.level_order - b.level_order);
  }, [grades]);

  if (!loaded) {
    return <div className="py-4 text-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="space-y-2.5" data-testid="grade-scope-picker">
      {!compact && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Atajos rápidos</p>
          <div className="flex flex-wrap gap-1.5">
            {shortcuts.map(sc => (
              <button
                key={sc.key}
                type="button"
                onClick={() => applyShortcut(sc)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${activeShortcut === sc.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"}`}
                data-testid={`scope-shortcut-${sc.key}`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
          Selección individual ({value.size} de {grades.length})
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50/40">
          {gradesByLevel.map(lvl => (
            <div key={lvl.level_name}>
              <p className="font-semibold text-[10px] uppercase tracking-wide text-slate-600 mb-1">{lvl.level_name}</p>
              <div className="space-y-0.5">
                {lvl.items.map(g => (
                  <label key={g.id} className="flex items-center gap-1.5 text-sm py-0.5 cursor-pointer hover:bg-white rounded px-1">
                    <input
                      type="checkbox"
                      checked={value.has(g.id)}
                      onChange={() => toggleGrade(g.id)}
                      data-testid={`scope-grade-checkbox-${g.id}`}
                    />
                    <span>{g.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
