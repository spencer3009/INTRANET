import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/App";
import PsicologiaLayout from "@/components/PsicologiaLayout";
import {
  Search, User, Filter, ChevronDown, ChevronRight,
  GraduationCap, BookOpen, Phone, Mail
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PsicologiaEstudiantesPage({ user, token, onLogout }) {
  const navigate = useNavigate();
  const { getSchoolPath } = useTenant();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const limit = 20;

  const headers = { Authorization: `Bearer ${token}` };

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.append("search", search);
      if (gradeFilter) params.append("grade", gradeFilter);
      if (sectionFilter) params.append("section", sectionFilter);
      const res = await fetch(`${API}/v1/psychology/students?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, gradeFilter, sectionFilter]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const totalPages = Math.ceil(total / limit);

  return (
    <PsicologiaLayout user={user} token={token} onLogout={onLogout} activeSection="estudiantes">
      <div data-testid="psicologia-estudiantes">
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
        <h1 className="text-lg font-bold text-slate-800">Listado de Estudiantes</h1>
        <p className="text-xs text-slate-500">{total} estudiantes registrados</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o apellido..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
              data-testid="search-students"
            />
          </div>
          <select
            value={gradeFilter}
            onChange={(e) => { setGradeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            data-testid="filter-grade"
          >
            <option value="">Todos los grados</option>
            {["1ro", "2do", "3ro", "4to", "5to", "6to"].map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <select
            value={sectionFilter}
            onChange={(e) => { setSectionFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            data-testid="filter-section"
          >
            <option value="">Todas las secciones</option>
            {["A", "B", "C", "D"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Student List */}
        <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-slate-200 rounded"></div>
                    <div className="h-3 w-24 bg-slate-100 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center">
              <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No se encontraron estudiantes</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {students.map((student) => (
                <button
                  key={student.id}
                  onClick={() => navigate(getSchoolPath(`/psicologia/fichas/${student.id}`))}
                  className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-violet-50/50 transition-colors text-left"
                  data-testid={`student-row-${student.id}`}
                >
                  <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-slate-100">
                    {student.photo_url ? (
                      <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-violet-100">
                        <User className="w-5 h-5 text-violet-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {student.name} {student.last_name}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      {student.grade && (
                        <span className="flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" />
                          {student.grade} {student.section || ""}
                        </span>
                      )}
                      {student.email && (
                        <span className="flex items-center gap-1 hidden sm:flex">
                          <Mail className="w-3 h-3" />
                          {student.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {student.has_record && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-violet-100 text-violet-700 rounded-full">
                        Ficha activa
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Mostrando {(page - 1) * limit + 1}-{Math.min(page * limit, total)} de {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="prev-page"
              >
                Anterior
              </button>
              <span className="text-sm text-slate-600">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="next-page"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </PsicologiaLayout>
  );
}
