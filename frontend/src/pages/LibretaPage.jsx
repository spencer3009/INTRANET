import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ChevronLeft, Printer, AlertTriangle, Loader2 } from "lucide-react";
import LibretaCard from "@/components/libreta/LibretaCard";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
      if (code === 401 || code === 403) {
        toast.error("No tienes permisos para ver esta libreta");
        setTimeout(() => navigate("/dashboard"), 1500);
        return;
      }
      if (code === 404) setError("Libreta no encontrada");
      else setError("Error al cargar la libreta");
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8" data-testid="libreta-loading">
        <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-500">Cargando libreta…</p>
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
          <option value="">Vista por defecto (modo {data?.metadata?.libreta_mode || "acumulada"})</option>
          {(data?.all_periods || []).map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <Link to={`/libreta/${student_id}`} className="text-xs text-slate-500 hover:underline">Limpiar filtro</Link>
        <div className="flex-1" />
        <button disabled className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-400 text-sm flex items-center gap-1 cursor-not-allowed" title="Disponible en Turno F2" data-testid="libreta-print-btn">
          <Printer className="w-4 h-4" /> Imprimir / PDF
        </button>
      </div>

      {isSnapshot && (
        <div className="max-w-5xl mx-auto mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 flex items-start gap-2 print:hidden" data-testid="libreta-snapshot-banner">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Libreta congelada.</strong> Corresponde al cierre del bimestre el {data?.metadata?.closed_at ? new Date(data.metadata.closed_at).toLocaleDateString() : "—"}. Es una versión histórica y no puede editarse.
          </span>
        </div>
      )}

      <LibretaCard data={data} token={token} canEdit={canEdit} onReload={() => fetchLibreta(selectedPeriodId)} />
    </div>
  );
}
