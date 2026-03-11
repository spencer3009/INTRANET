import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, Download, Trophy, ArrowUpDown, FileSpreadsheet } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

function getGradeColor(val) {
  if (val === null || val === undefined) return "";
  if (val < 10) return "bg-red-100 text-red-700";
  if (val <= 13) return "bg-yellow-50 text-yellow-700";
  return "bg-green-50 text-green-700";
}

function getFinalColor(val) {
  if (val === null || val === undefined) return "text-gray-400";
  if (val < 10) return "bg-red-500 text-white font-bold";
  if (val <= 13) return "bg-yellow-400 text-yellow-900 font-bold";
  return "bg-green-500 text-white font-bold";
}

function getRankBadge(rank) {
  if (!rank) return null;
  if (rank === 1) return "bg-yellow-400 text-yellow-900";
  if (rank === 2) return "bg-gray-300 text-gray-700";
  if (rank === 3) return "bg-amber-600 text-white";
  return "bg-gray-100 text-gray-600";
}

export default function ConsolidatedGradesPage({ user, token }) {
  const [sections, setSections] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [grades, setGrades] = useState([]);
  const [levels, setLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState("name"); // 'name' | 'average' | 'rank'
  const [sortDir, setSortDir] = useState("asc");
  const headers = { Authorization: `Bearer ${token}` };

  // Load academic structure
  useEffect(() => {
    const loadStructure = async () => {
      try {
        const [levelsRes, gradesRes, sectionsRes, periodsRes] = await Promise.all([
          axios.get(`${API}/api/academic/levels`, { headers }),
          axios.get(`${API}/api/academic/grades`, { headers }),
          axios.get(`${API}/api/academic/sections`, { headers }),
          axios.get(`${API}/api/academic/periods`, { headers }),
        ]);
        setLevels(levelsRes.data || []);
        setGrades(gradesRes.data || []);
        setSections(sectionsRes.data || []);
        setPeriods(periodsRes.data || []);

        if (periodsRes.data?.length > 0) {
          const active = periodsRes.data.find(p => p.activo) || periodsRes.data[0];
          setSelectedPeriod(active.id);
        }
      } catch (err) {
        console.error("Error loading structure:", err);
      }
    };
    loadStructure();
  }, []);

  const filteredGrades = selectedLevel ? grades.filter(g => g.nivel_id === selectedLevel) : [];
  const filteredSections = selectedGrade ? sections.filter(s => s.grado_id === selectedGrade) : [];

  // Load consolidated when section + period selected
  useEffect(() => {
    if (!selectedSection || !selectedPeriod) return;
    const loadConsolidated = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${API}/api/grades/consolidated/${selectedSection}/${selectedPeriod}`,
          { headers }
        );
        setData(res.data);
      } catch (err) {
        console.error("Error loading consolidated:", err);
      } finally {
        setLoading(false);
      }
    };
    loadConsolidated();
  }, [selectedSection, selectedPeriod]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir(field === "average" || field === "rank" ? "asc" : "asc");
    }
  };

  const sortedStudents = data?.students ? [...data.students].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") cmp = a.student_name.localeCompare(b.student_name);
    else if (sortBy === "average") cmp = (a.average || 0) - (b.average || 0);
    else if (sortBy === "rank") cmp = (a.rank || 999) - (b.rank || 999);
    return sortDir === "desc" ? -cmp : cmp;
  }) : [];

  const handleExportExcel = async () => {
    try {
      const res = await axios.get(
        `${API}/api/grades/consolidated/${selectedSection}/${selectedPeriod}/export/excel`,
        { headers, responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `consolidado_${data?.grade_name}_${data?.section_name}_${data?.period_name}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error al exportar");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="consolidated-grades">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Consolidado de Notas</h1>
              <p className="text-sm text-gray-500 mt-1">Vista consolidada de todas las asignaturas del aula</p>
            </div>
            {data && (
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                data-testid="export-excel-btn"
              >
                <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nivel</label>
              <select
                value={selectedLevel}
                onChange={e => { setSelectedLevel(e.target.value); setSelectedGrade(""); setSelectedSection(""); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white min-w-[160px]"
                data-testid="level-selector"
              >
                <option value="">Seleccionar nivel</option>
                {levels.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Grado</label>
              <select
                value={selectedGrade}
                onChange={e => { setSelectedGrade(e.target.value); setSelectedSection(""); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white min-w-[160px]"
                data-testid="grade-selector"
              >
                <option value="">Seleccionar grado</option>
                {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Seccion</label>
              <select
                value={selectedSection}
                onChange={e => setSelectedSection(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white min-w-[120px]"
                data-testid="section-selector"
              >
                <option value="">Seleccionar</option>
                {filteredSections.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Periodo</label>
              <select
                value={selectedPeriod}
                onChange={e => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white min-w-[160px]"
                data-testid="period-selector"
              >
                {periods.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="ml-3 text-gray-500">Cargando consolidado...</span>
          </div>
        ) : !data ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-16 text-center">
            <Trophy className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-lg text-gray-400">Selecciona un nivel, grado y seccion para ver el consolidado</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Info bar */}
            <div className="flex items-center justify-between px-6 py-3 bg-slate-800 text-white">
              <span className="font-semibold">{data.grade_name} "{data.section_name}" - {data.period_name}</span>
              <span className="text-sm text-slate-300">{data.students?.length || 0} alumnos | {data.subjects?.length || 0} asignaturas</span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" data-testid="consolidated-table">
                <thead>
                  <tr className="bg-slate-700 text-white">
                    <th className="sticky left-0 z-20 bg-slate-700 px-3 py-3 text-center text-xs font-semibold w-12 border-r border-slate-600 cursor-pointer" onClick={() => handleSort("rank")}>
                      <div className="flex items-center justify-center gap-1">
                        # {sortBy === "rank" && <ArrowUpDown className="w-3 h-3" />}
                      </div>
                    </th>
                    <th className="sticky left-12 z-20 bg-slate-700 px-4 py-3 text-left text-xs font-semibold min-w-[220px] border-r border-slate-600 cursor-pointer" onClick={() => handleSort("name")}>
                      <div className="flex items-center gap-1">
                        Apellidos y Nombres {sortBy === "name" && <ArrowUpDown className="w-3 h-3" />}
                      </div>
                    </th>
                    {data.subjects?.map(s => (
                      <th key={s.id} className="px-2 py-3 text-center text-xs font-semibold min-w-[100px] border-r border-slate-600">
                        <div className="truncate" title={s.name}>{s.name}</div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center text-xs font-bold min-w-[80px] bg-slate-900 cursor-pointer" onClick={() => handleSort("average")}>
                      <div className="flex items-center justify-center gap-1">
                        PROM. {sortBy === "average" && <ArrowUpDown className="w-3 h-3" />}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-bold min-w-[60px] bg-slate-900">
                      PUESTO
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((student, idx) => (
                    <tr key={student.student_id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-indigo-50/50 transition-colors`}>
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-2 text-center text-sm text-gray-500 border-r border-gray-200 font-medium">
                        {student.number}
                      </td>
                      <td className="sticky left-12 z-10 bg-inherit px-4 py-2 text-sm text-gray-900 font-medium border-r border-gray-200 whitespace-nowrap">
                        {student.student_name}
                      </td>
                      {data.subjects?.map(s => {
                        const grade = student.grades[s.id];
                        return (
                          <td key={s.id} className={`px-2 py-2 text-center text-sm font-medium border-r border-gray-200 ${getGradeColor(grade)}`}>
                            {grade !== null && grade !== undefined ? grade : "-"}
                          </td>
                        );
                      })}
                      <td className={`px-2 py-2 text-center text-sm rounded-sm ${getFinalColor(student.average)}`}>
                        {student.average ?? "-"}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {student.rank ? (
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${getRankBadge(student.rank)}`}>
                            {student.rank}
                          </span>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
                  {sortedStudents.length === 0 && (
                    <tr>
                      <td colSpan={100} className="px-4 py-12 text-center text-gray-400">
                        No hay datos disponibles para este periodo
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Color legend */}
            <div className="flex items-center justify-end gap-4 px-6 py-3 border-t border-gray-200 bg-gray-50">
              <span className="flex items-center gap-1.5 text-xs">
                <span className="w-3 h-3 rounded bg-red-400" /> 0-9
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                <span className="w-3 h-3 rounded bg-yellow-400" /> 10-13
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                <span className="w-3 h-3 rounded bg-green-400" /> 14-20
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
