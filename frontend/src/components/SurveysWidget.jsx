import { ClipboardList, Clock, Users, ChevronRight, CheckCircle2 } from "lucide-react";

const MOCK_SURVEYS = [
  {
    id: "s1",
    title: "Satisfacción con el servicio educativo 2026",
    description: "Encuesta anual para evaluar la calidad del servicio.",
    is_active: true,
    due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
    responses_count: 42,
    total_target: 120,
    answered: false,
  },
  {
    id: "s2",
    title: "Preferencia de talleres extracurriculares",
    description: "Selecciona los talleres de tu interés para el próximo bimestre.",
    is_active: true,
    due_date: new Date(Date.now() + 3 * 86400000).toISOString(),
    responses_count: 78,
    total_target: 120,
    answered: false,
  },
  {
    id: "s3",
    title: "Evaluación docente - Bimestre I",
    description: "Evalúa el desempeño de tus profesores.",
    is_active: false,
    due_date: new Date(Date.now() - 5 * 86400000).toISOString(),
    responses_count: 115,
    total_target: 120,
    answered: true,
  },
];

function daysRemaining(dateStr) {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0) return "Finalizada";
  if (diff === 0) return "Vence hoy";
  if (diff === 1) return "Vence mañana";
  return `${diff} días restantes`;
}

function progressPercent(responses, total) {
  if (!total) return 0;
  return Math.min(Math.round((responses / total) * 100), 100);
}

export default function SurveysWidget({ surveys = [] }) {
  const items = surveys.length > 0 ? surveys.slice(0, 3) : MOCK_SURVEYS;
  const isMock = surveys.length === 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-full flex flex-col" data-testid="surveys-widget">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="font-semibold text-slate-800 text-sm">Encuestas</h3>
        </div>
        <div className="flex items-center gap-2">
          {isMock && (
            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">DEMO</span>
          )}
          {items.filter(s => s.is_active && !s.answered).length > 0 && (
            <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full" data-testid="surveys-active-count">
              {items.filter(s => s.is_active && !s.answered).length} activa{items.filter(s => s.is_active && !s.answered).length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 divide-y divide-slate-100">
        {items.map((survey) => {
          const pct = progressPercent(survey.responses_count, survey.total_target);
          const isExpired = new Date(survey.due_date) < new Date();
          const daysLeft = daysRemaining(survey.due_date);
          const isUrgent = !isExpired && Math.ceil((new Date(survey.due_date).getTime() - Date.now()) / 86400000) <= 2;

          return (
            <div
              key={survey.id}
              className="px-5 py-3.5 hover:bg-slate-50 transition-colors group"
              data-testid={`survey-item-${survey.id}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm font-medium text-slate-700 line-clamp-1 group-hover:text-slate-900 flex-1">{survey.title}</p>
                {survey.answered ? (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> Respondida
                  </span>
                ) : isExpired ? (
                  <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">Cerrada</span>
                ) : (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${isUrgent ? "text-red-600 bg-red-50" : "text-amber-600 bg-amber-50"}`}>
                    {daysLeft}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${survey.answered || isExpired ? "bg-slate-300" : "bg-emerald-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-400 flex items-center gap-1 flex-shrink-0">
                  <Users className="w-3 h-3" />
                  {survey.responses_count}/{survey.total_target}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
        <button className="text-xs font-medium text-emerald-600 hover:text-emerald-800 transition-colors flex items-center gap-1" data-testid="surveys-view-all">
          Ver todas las encuestas <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
