import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ChevronLeft, Printer, AlertTriangle, Loader2 } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import LibretaCard from "@/components/libreta/LibretaCard";
import OfficialReportCardBanner from "@/components/OfficialReportCardBanner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Formato peruano: "12 de mayo de 2026"
const MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function formatFechaLarga(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return `${d.getDate()} de ${MESES_ES[d.getMonth()]} de ${d.getFullYear()}`;
  } catch { return "—"; }
}

export default function LibretaPage({ user, token, onLogout }) {
  const { student_id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const periodIdParam = searchParams.get("period_id") || "";
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState(periodIdParam);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchLibreta = useCallback(async (pid) => {
    setLoading(true);
    setError(null);
    try {
      const url = pid ? `${API}/libreta/${student_id}?period_id=${pid}` : `${API}/libreta/${student_id}`;
      const r = await axios.get(url, { headers });
      setData(r.data);
      if (!selectedPeriodId && r.data?.period_active?.id) {
        setSelectedPeriodId(r.data.period_active.id);
      }
    } catch (err) {
      const code = err.response?.status;
      if (code === 401) {
        toast.error("Tu sesión expiró. Inicia sesión nuevamente.");
        setTimeout(() => navigate("/login"), 1500);
        return;
      }
      if (code === 403) {
        toast.error("No tienes permisos para ver esta libreta");
        setTimeout(() => navigate("/dashboard"), 1500);
        return;
      }
      if (code === 404) setError("No se encontró la libreta solicitada");
      else setError("Ocurrió un problema al cargar la libreta. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student_id]);

  useEffect(() => { fetchLibreta(periodIdParam); /* eslint-disable-next-line */ }, [student_id, periodIdParam]);

  const handlePeriodChange = (pid) => {
    setSelectedPeriodId(pid);
    if (pid) setSearchParams({ period_id: pid });
    else setSearchParams({});
  };

  // PDF export
  const printRef = useRef(null);
  const buildDocTitle = () => {
    const stuCode = data?.student?.codigo || data?.student?.student_code || data?.student?.id?.slice(0, 8) || "alumno";
    const pname = (data?.period_requested?.nombre || data?.period_active?.nombre || "anual").replace(/\s+/g, "_");
    const year = data?.year || new Date().getFullYear();
    return `Libreta_${stuCode}_${pname}_${year}`;
  };
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: buildDocTitle(),
    pageStyle: `@page { size: A4; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8" data-testid="libreta-loading">
        <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-500">Cargando libreta del estudiante…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-8" data-testid="libreta-error">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-red-200 p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">{error}</h2>
          <button onClick={() => fetchLibreta(selectedPeriodId)} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm" data-testid="libreta-retry-btn">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isSnapshot = data?.metadata?.is_snapshot === true;
  const canEdit = !isSnapshot && (
    user?.role === "owner" || user?.role === "admin" || user?.role === "director" ||
    (user?.role === "teacher" && data?.tutor?.id === user?.id)
  );

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:bg-white print:p-0" data-testid="libreta-page">
      {/* Barra de controles superior */}
      <div className="max-w-5xl mx-auto mb-4 flex items-center gap-3 print:hidden" data-testid="libreta-controls-bar">
        <button onClick={() => navigate(-1)} className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm flex items-center gap-1" data-testid="libreta-back-btn">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <select
          value={selectedPeriodId}
          onChange={(e) => handlePeriodChange(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm"
          data-testid="libreta-period-select"
        >
          <option value="">Vista por defecto del año</option>
          {(data?.all_periods || []).map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <Link to={`/libreta/${student_id}`} className="text-xs text-slate-500 hover:underline">Limpiar filtro</Link>
        <div className="flex-1" />
        <button
          onClick={handlePrint}
          className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium flex items-center gap-1.5 transition-colors"
          title="Abrir diálogo de impresión"
          data-testid="libreta-pdf-btn"
        >
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </div>

      {/* Contenedor imprimible */}
      <div ref={printRef} className="libreta-printable">
        <OfficialReportCardBanner
          studentId={student_id}
          periodId={selectedPeriodId || data?.period_active?.id}
          token={token}
        />
        {/* Banner "Libreta cerrada" eliminado a pedido de usuarios (Feb 2026):
            la información de cierre ya se ve en el selector de bimestre y en
            otras vistas; mostrarla aquí ensuciaba la libreta y aparecía en el
            PDF exportado. */}

        <LibretaCard data={data} token={token} canEdit={canEdit} userRole={user?.role} onReload={() => fetchLibreta(selectedPeriodId)} />
      </div>
    </div>
  );
}
