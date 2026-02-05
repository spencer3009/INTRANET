import { CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { attendanceData } from "@/data/studentData";

export default function Asistencia() {
  return (
    <div className="space-y-6 animate-fade-in" data-testid="asistencia-page">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">
          Registro de Asistencia
        </h1>
        <p className="text-slate-500 mt-1">Año Escolar 2024</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Asistencias */}
        <Card className="stat-card border-l-4 border-l-emerald-500" data-testid="stat-asistencias">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="stat-label">Asistencias</p>
                <p className="stat-value text-emerald-600">{attendanceData.asistencias}</p>
                <p className="text-xs text-slate-500 mt-1">de {attendanceData.totalDias} días</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Faltas */}
        <Card className="stat-card border-l-4 border-l-red-500" data-testid="stat-faltas">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="stat-label">Faltas</p>
                <p className="stat-value text-red-600">{attendanceData.faltas}</p>
                <p className="text-xs text-slate-500 mt-1">{attendanceData.justificadas} justificadas</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tardanzas */}
        <Card className="stat-card border-l-4 border-l-orange-500" data-testid="stat-tardanzas">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="stat-label">Tardanzas</p>
                <p className="stat-value text-orange-600">{attendanceData.tardanzas}</p>
                <p className="text-xs text-slate-500 mt-1">este año</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Porcentaje */}
        <Card className="stat-card border-l-4 border-l-blue-500" data-testid="stat-porcentaje">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="stat-label">Porcentaje</p>
                <p className="stat-value text-blue-600">{attendanceData.porcentaje}%</p>
                <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
                  <TrendingUp className="w-3 h-3" />
                  Excelente
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <Card className="card-elevated" data-testid="progress-overview">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-semibold flex items-center justify-between">
            <span>Progreso de Asistencia</span>
            <Badge className={`${
              attendanceData.porcentaje >= 95 ? 'bg-emerald-600' :
              attendanceData.porcentaje >= 85 ? 'bg-blue-600' :
              attendanceData.porcentaje >= 70 ? 'bg-orange-600' : 'bg-red-600'
            }`}>
              {attendanceData.porcentaje >= 95 ? 'Excelente' :
               attendanceData.porcentaje >= 85 ? 'Bueno' :
               attendanceData.porcentaje >= 70 ? 'Regular' : 'Necesita Mejorar'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">Asistencia Total</span>
                <span className="text-sm font-semibold text-slate-800">
                  {attendanceData.asistencias}/{attendanceData.totalDias}
                </span>
              </div>
              <Progress value={attendanceData.porcentaje} className="h-3" />
            </div>
            
            {attendanceData.porcentaje < 95 && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Recordatorio</p>
                  <p className="text-xs text-amber-700 mt-1">
                    El porcentaje mínimo de asistencia requerido es del 70%. 
                    Mantén una buena asistencia para asegurar tu evaluación.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      <Card className="card-elevated" data-testid="monthly-breakdown">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-semibold">
            Detalle Mensual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Mes</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Asistencias</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Faltas</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Tardanzas</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.mensual.map((mes, index) => {
                  const total = mes.asistencias + mes.faltas;
                  const porcentaje = total > 0 ? (mes.asistencias / total) * 100 : 0;
                  
                  return (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-800">{mes.mes}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="w-4 h-4" />
                          {mes.asistencias}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 ${mes.faltas > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          <XCircle className="w-4 h-4" />
                          {mes.faltas}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 ${mes.tardanzas > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                          <Clock className="w-4 h-4" />
                          {mes.tardanzas}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {total > 0 ? (
                          <Badge className={`${
                            porcentaje === 100 ? 'bg-emerald-600' :
                            porcentaje >= 90 ? 'bg-blue-600' :
                            porcentaje >= 80 ? 'bg-orange-600' : 'bg-red-600'
                          }`}>
                            {porcentaje === 100 ? 'Perfecto' :
                             porcentaje >= 90 ? 'Muy Bueno' :
                             porcentaje >= 80 ? 'Regular' : 'A Mejorar'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400">
                            Sin datos
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
