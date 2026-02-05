import { Clock, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { studentInfo, scheduleData } from "@/data/studentData";

const getSubjectColor = (subject) => {
  const colors = {
    "Matemática": "bg-blue-100 text-blue-700 border-blue-200",
    "Comunicación": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Inglés": "bg-purple-100 text-purple-700 border-purple-200",
    "CC.SS.": "bg-orange-100 text-orange-700 border-orange-200",
    "Ed. Física": "bg-red-100 text-red-700 border-red-200",
    "Arte": "bg-pink-100 text-pink-700 border-pink-200",
    "Ciencia": "bg-cyan-100 text-cyan-700 border-cyan-200",
    "DPCC": "bg-amber-100 text-amber-700 border-amber-200",
    "Religión": "bg-indigo-100 text-indigo-700 border-indigo-200",
    "EPT": "bg-lime-100 text-lime-700 border-lime-200",
    "Tutoría": "bg-slate-100 text-slate-700 border-slate-200",
    "RECREO": "bg-yellow-100 text-yellow-700 border-yellow-300"
  };
  return colors[subject] || "bg-slate-100 text-slate-700 border-slate-200";
};

export default function Horarios() {
  const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
  const dayKeys = ["lunes", "martes", "miercoles", "jueves", "viernes"];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="horarios-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">
            Horario de Clases
          </h1>
          <p className="text-slate-500 mt-1">
            {studentInfo.grado} Grado - Sección {studentInfo.seccion}
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2 px-4 py-2">
          <Clock className="w-4 h-4" />
          Turno Mañana
        </Badge>
      </div>

      {/* Schedule Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-elevated">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Horario</p>
              <p className="font-semibold text-slate-800">7:30 AM - 12:30 PM</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <MapPin className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Aula</p>
              <p className="font-semibold text-slate-800">Aula 5-A • Pabellón B</p>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Recreo</p>
              <p className="font-semibold text-slate-800">9:45 AM - 10:15 AM</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Table */}
      <Card className="card-elevated overflow-hidden" data-testid="schedule-table-card">
        <CardHeader className="bg-slate-50 border-b border-slate-200">
          <CardTitle className="font-heading text-lg font-semibold">
            Horario Semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="schedule-table" data-testid="schedule-table">
              <thead>
                <tr>
                  <th className="w-28">HORA</th>
                  {days.map(day => (
                    <th key={day}>{day.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scheduleData.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td className="font-mono text-sm font-semibold text-slate-600 bg-slate-50">
                      {row.hora}
                    </td>
                    {dayKeys.map((dayKey, colIndex) => {
                      const subject = row[dayKey];
                      const isBreak = subject === "RECREO";
                      return (
                        <td 
                          key={colIndex}
                          className={`${isBreak ? 'bg-yellow-50' : ''}`}
                        >
                          <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-semibold border ${getSubjectColor(subject)}`}>
                            {subject}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Subject Legend */}
      <Card className="card-elevated" data-testid="subject-legend">
        <CardHeader>
          <CardTitle className="font-heading text-base font-semibold">
            Áreas Curriculares
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { code: "Matemática", name: "Matemática" },
              { code: "Comunicación", name: "Comunicación" },
              { code: "Inglés", name: "Inglés" },
              { code: "CC.SS.", name: "Ciencias Sociales" },
              { code: "Ed. Física", name: "Educación Física" },
              { code: "Arte", name: "Arte y Cultura" },
              { code: "Ciencia", name: "Ciencia y Tecnología" },
              { code: "DPCC", name: "Des. Personal y Cívica" },
              { code: "Religión", name: "Educación Religiosa" },
              { code: "EPT", name: "Educación para el Trabajo" },
              { code: "Tutoría", name: "Tutoría y Orientación" },
            ].map((subject) => (
              <div key={subject.code} className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold border ${getSubjectColor(subject.code)}`}>
                  {subject.code}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
