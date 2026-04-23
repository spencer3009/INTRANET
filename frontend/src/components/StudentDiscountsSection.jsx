import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import { User, Search, Plus, X, Zap, Hand, Tag, Loader2, AlertTriangle, Users, ChevronDown } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (v) => `S/ ${(v || 0).toFixed(2)}`;

export default function StudentDiscountsSection({ token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [discountData, setDiscountData] = useState(null);
  const [pensionData, setPensionData] = useState(null);
  const [siblingsData, setSiblingsData] = useState(null);
  const [discountTypes, setDiscountTypes] = useState([]);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Search state
  const [searchText, setSearchText] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const loadBaseData = async () => {
      try {
        const [usersRes, gradesRes, sectionsRes, dtRes] = await Promise.all([
          axios.get(`${API}/users`, { headers }),
          axios.get(`${API}/academic/grades`, { headers }),
          axios.get(`${API}/academic/sections`, { headers }),
          axios.get(`${API}/accounting/discount-types`, { headers }),
        ]);
        setStudents(usersRes.data.filter(u => u.role === "student"));
        setGrades(gradesRes.data.filter(g => g.activo));
        setSections(sectionsRes.data.filter(s => s.activo));
        setDiscountTypes(dtRes.data || []);
      } catch { }
    };
    loadBaseData();
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredSections = filterGrade ? sections.filter(s => s.grado_id === filterGrade) : [];

  const filteredStudents = students.filter(s => {
    if (filterGrade && s.grado_id !== filterGrade) return false;
    if (filterSection && s.seccion_id !== filterSection) return false;
    if (searchText) {
      const full = `${s.name || ""} ${s.last_name || ""}`.toLowerCase();
      if (!full.includes(searchText.toLowerCase())) return false;
    }
    return true;
  });

  const loadStudentData = async (student) => {
    setSelectedStudent(student);
    setLoadingStudent(true);
    setDropdownOpen(false);
    setSearchText("");
    try {
      const [discRes, pensRes, sibRes] = await Promise.all([
        axios.get(`${API}/accounting/students/${student.id}/discounts`, { headers }),
        axios.get(`${API}/accounting/students/${student.id}/pension`, { headers }),
        axios.get(`${API}/accounting/students/${student.id}/siblings`, { headers }),
      ]);
      setDiscountData(discRes.data);
      setPensionData(pensRes.data);
      setSiblingsData(sibRes.data);
    } catch (err) {
      toast.error("Error al cargar datos del alumno");
    } finally {
      setLoadingStudent(false);
    }
  };

  const handleAssignDiscount = async (discountTypeId) => {
    if (!selectedStudent) return;
    setAssigning(true);
    try {
      await axios.post(`${API}/accounting/students/${selectedStudent.id}/discounts`, { discount_type_id: discountTypeId }, { headers });
      toast.success("Descuento asignado");
      await loadStudentData(selectedStudent);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al asignar descuento");
    } finally { setAssigning(false); }
  };

  const handleRemoveDiscount = async (discountId) => {
    if (!selectedStudent) return;
    try {
      await axios.delete(`${API}/accounting/students/${selectedStudent.id}/discounts/${discountId}`, { headers });
      toast.success("Descuento removido");
      await loadStudentData(selectedStudent);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al remover descuento");
    }
  };

  const getGradeName = (gId) => { const g = grades.find(gr => gr.id === gId); return g ? `${g.nivel_nombre} - ${g.nombre}` : ""; };
  const getSectionName = (sId) => { const s = sections.find(sec => sec.id === sId); return s ? s.nombre : ""; };
  const initials = (s) => `${(s.name || "")[0] || ""}${(s.last_name || "")[0] || ""}`.toUpperCase();

  // Available manual discounts not yet assigned
  const assignedTypeIds = (discountData?.discounts || []).map(d => d.discount_type_id);
  const availableManual = discountTypes.filter(dt =>
    dt.application_mode === "manual" && dt.is_active && !assignedTypeIds.includes(dt.id)
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm" data-testid="student-discounts-section">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center gap-2.5">
        <Users className="w-5 h-5 text-teal-500" />
        <h3 className="text-sm font-bold text-slate-700">Descuentos por Alumno</h3>
      </div>

      <div className="p-6">
        {/* Student Search */}
        <div ref={ref} className="relative mb-6" data-testid="student-discount-search">
          <label className="block text-sm font-semibold text-slate-600 mb-2">Buscar alumno</label>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <select value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterSection(""); }}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-200"
              data-testid="sd-filter-grade">
              <option value="">Todos los grados</option>
              {grades.map(g => <option key={g.id} value={g.id}>{g.nivel_nombre} - {g.nombre}</option>)}
            </select>
            <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} disabled={!filterGrade}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:opacity-50"
              data-testid="sd-filter-section">
              <option value="">Todas las secciones</option>
              {filteredSections.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                placeholder="Nombre del alumno..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-200"
                data-testid="sd-search-input"
              />
            </div>
          </div>

          {dropdownOpen && (filterGrade || searchText) && (
            <div className="absolute z-40 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto" data-testid="sd-student-dropdown">
              {filteredStudents.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">No se encontraron alumnos</p>
              ) : filteredStudents.slice(0, 20).map(s => (
                <div key={s.id} onClick={() => loadStudentData(s)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    selectedStudent?.id === s.id ? "bg-teal-50" : "hover:bg-slate-50"
                  }`} data-testid={`sd-student-${s.id}`}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {initials(s)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.name} {s.last_name}</p>
                    <p className="text-xs text-slate-400 truncate">{getGradeName(s.grado_id)} {getSectionName(s.seccion_id)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Student Card */}
        {selectedStudent && (
          <div className="space-y-4 animate-in fade-in">
            {/* Student Info Card */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold">
                  {initials(selectedStudent)}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{selectedStudent.name} {selectedStudent.last_name}</p>
                  <p className="text-xs text-slate-500">{getGradeName(selectedStudent.grado_id)} {getSectionName(selectedStudent.seccion_id)}</p>
                </div>
              </div>
              <button onClick={() => { setSelectedStudent(null); setDiscountData(null); setPensionData(null); setSiblingsData(null); }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingStudent ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
            ) : (
              <>
                {/* Parent Warning */}
                {siblingsData && !siblingsData.has_parent_linked && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl" data-testid="no-parent-warning">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                    <p className="text-xs text-amber-700 font-medium">
                      Este alumno no tiene apoderado vinculado. No se pueden evaluar descuentos automaticos por hermanos.
                    </p>
                  </div>
                )}

                {/* Automatic Discounts */}
                {discountData?.discounts?.filter(d => d.application_mode === "automatic" || d.origin === "automatic").length > 0 && (
                  <div data-testid="automatic-discounts-list">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descuentos Automaticos</h4>
                    <div className="space-y-2">
                      {discountData.discounts.filter(d => d.application_mode === "automatic" || d.origin === "automatic").map(d => (
                        <div key={d.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl" data-testid={`auto-discount-${d.id}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Zap className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{d.type_name}</p>
                              <p className="text-xs text-blue-600">
                                {d.discount_type === "percentage" ? `${d.custom_value ?? d.default_value}%` : `S/ ${(d.custom_value ?? d.default_value).toFixed(2)}`}
                                {siblingsData?.siblings?.length > 0 && d.automatic_rule === "has_active_siblings" && (
                                  <span className="ml-2 text-blue-500">
                                    — Tiene {siblingsData.active_siblings_count} hermano(s) activo(s): {siblingsData.siblings.map(s => `${s.name} ${s.last_name}`).join(", ")}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase">Automatico</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual Discounts */}
                <div data-testid="manual-discounts-list">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descuentos Manuales</h4>
                    {availableManual.length > 0 && (
                      <ManualDiscountDropdown options={availableManual} onAssign={handleAssignDiscount} assigning={assigning} />
                    )}
                  </div>
                  <div className="space-y-2">
                    {discountData?.discounts?.filter(d => d.origin === "manual").length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 text-center">No tiene descuentos manuales asignados</p>
                    ) : (
                      discountData.discounts.filter(d => d.origin === "manual").map(d => (
                        <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl" data-testid={`manual-discount-${d.id}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                              <Hand className="w-4 h-4 text-slate-500" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{d.type_name}</p>
                              <p className="text-xs text-slate-500">
                                {d.discount_type === "percentage" ? `${d.custom_value ?? d.default_value}%` : `S/ ${(d.custom_value ?? d.default_value).toFixed(2)}`}
                              </p>
                            </div>
                          </div>
                          <button onClick={() => handleRemoveDiscount(d.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            data-testid={`remove-discount-${d.id}`}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Pension Calculation */}
                {pensionData && (
                  <div className="mt-4 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl" data-testid="pension-calculation">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Calculo de Pension</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Pension base</span>
                        <span className="font-semibold text-slate-800">{formatCurrency(pensionData.base_pension)}</span>
                      </div>
                      {pensionData.discounts?.map((d, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-slate-500 flex items-center gap-1.5">
                            {d.origin === "automatic" ? <Zap className="w-3 h-3 text-blue-500" /> : <Hand className="w-3 h-3 text-slate-400" />}
                            {d.name} ({d.type === "percentage" ? `${d.value}%` : formatCurrency(d.value)})
                          </span>
                          <span className="font-semibold text-rose-500">- {formatCurrency(d.amount)}</span>
                        </div>
                      ))}
                      {pensionData.total_discount > 0 && (
                        <div className="flex justify-between text-sm pt-2 border-t border-emerald-200">
                          <span className="text-slate-600 font-medium">Total descuentos</span>
                          <span className="font-bold text-rose-500">- {formatCurrency(pensionData.total_discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base pt-2 border-t-2 border-emerald-300">
                        <span className="font-bold text-slate-800">Pension final</span>
                        <span className="font-bold text-emerald-600 text-lg" data-testid="final-pension-amount">
                          {formatCurrency(pensionData.final_pension)}
                        </span>
                      </div>
                      {pensionData.early_payment_discount > 0 && (
                        <div className="flex justify-between text-xs pt-1 text-slate-400">
                          <span>Con pronto pago</span>
                          <span>{formatCurrency(pensionData.final_with_early_payment)}</span>
                        </div>
                      )}
                      {pensionData.is_override && (
                        <p className="text-xs text-amber-600 mt-1 font-medium">
                          * Este alumno tiene un monto fijo manual (override)
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!selectedStudent && (
          <div className="text-center py-8">
            <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Busca un alumno por grado/sección o nombre para ver y gestionar sus descuentos</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ManualDiscountDropdown({ options, onAssign, assigning }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} disabled={assigning}
        className="px-3 py-1.5 text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors flex items-center gap-1 disabled:opacity-50"
        data-testid="assign-manual-discount-btn">
        {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        Asignar descuento
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 min-w-[220px]" data-testid="manual-discount-dropdown">
          {options.map(dt => (
            <button key={dt.id}
              onClick={() => { onAssign(dt.id); setOpen(false); }}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
              data-testid={`assign-option-${dt.id}`}>
              <p className="text-sm font-semibold text-slate-800">{dt.name}</p>
              <p className="text-xs text-slate-400">
                {dt.discount_type === "percentage" ? `${dt.value}%` : `S/ ${dt.value.toFixed(2)}`}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
