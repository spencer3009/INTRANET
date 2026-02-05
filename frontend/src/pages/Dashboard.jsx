import { 
  TrendingUp, 
  Award, 
  Calendar,
  BookOpen,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { studentInfo, gradesData, attendanceData, comunicadosData, calcularPromedio } from "@/data/studentData";

export default function Dashboard() {
  const promedioGeneral = () => {
    let total = 0;
    gradesData.forEach(area => {
      total += calcularPromedio([area.b1, area.b2, area.b3, area.b4]);
    });
    return Math.round(total / gradesData.length);
  };

  const promedio = promedioGeneral();
  const comunicadosNoLeidos = comunicadosData.filter(c => !c.leido).length;

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard-page">
      <div className="student-profile-card" data-testid="student-profile-card">
        <img 
          src={studentInfo.foto}
          alt="Foto del estudiante"
          className="student-photo"
          data-testid="student-photo"
        />
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-bold text-slate-900">
            ¡Hola, {studentInfo.nombres}!
          </h1>
          <p className="text-slate-600 mt-1">
            {studentInfo.apellidos}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
              {studentInfo.grado} Grado
            </Badge>
            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
              Sección {studentInfo.seccion}
            </Badge>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
              Código: {studentInfo.codigo}
            </Badge>
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end">
          <p className="text-sm text-slate-500">{studentInfo.ie}</p>
          <p className="text-sm text-slate-400">Año Escolar {studentInfo.anio}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="stat-card border-l-4 border-l-blue-500" data-testid="stat-promedio">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="stat-label">Promedio General</p>
                <p className="stat-value text-blue-600">{promedio}</p>
                <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3" />
                  +2 vs. bimestre anterior
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Award className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card border-l-4 border-l-emerald-500" data-testid="stat-asistencia">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="stat-label">Asistencia</p>
                <p className="stat-value text-emerald-600">{attendanceData.porcentaje}%</p>
                <Progress value={attendanceData.porcentaje} className="h-1.5 mt-2 w-24" />
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card border-l-4 border-l-orange-500" data-testid="stat-comunicados">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="stat-label">Comunicados</p>
                <p className="stat-value text-orange-600">{comunicadosNoLeidos}</p>
                <p className="text-xs text-slate-500 mt-1">sin leer</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card border-l-4 border-l-purple-500" data-testid="stat-areas">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="stat-label">Áreas Curriculares</p>
                <p className="stat-value text-purple-600">{gradesData.length}</p>
                <p className="text-xs text-slate-500 mt-1">activas</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 card-elevated" data-testid="recent-grades-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-heading text-lg font-semibold">
              Resumen de Calificaciones
            </CardTitle>
            <Link to="/boleta">
              <Button variant="ghost" size="sm" className="text-blue-600" data-testid="ver-boleta-btn">
                Ver Boleta
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {gradesData.slice(0, 5).map((area, index) => {
                const promedioArea = calcularPromedio([area.b1, area.b2, area.b3, area.b4]);
                return (
                  <div key={index} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{area.area}</span>
                        <span className={`text-sm font-mono font-bold ${
                          promedioArea >= 18 ? 'text-emerald-600' :
                          promedioArea >= 14 ? 'text-blue-600' :
                          promedioArea >= 11 ? 'text-orange-600' : 'text-red-600'
                        }`}>
                          {promedioArea}
                        </span>
                      </div>
                      <Progress 
                        value={(promedioArea / 20) * 100} 
                        className="h-2"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated" data-testid="upcoming-events-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-heading text-lg font-semibold">
              Próximos Eventos
            </CardTitle>
            <Link to="/calendario">
              <Button variant="ghost" size="sm" className="text-blue-600" data-testid="ver-calendario-btn">
                Ver Todo
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-800 text-sm">Reunión de Padres</p>
                  <p className="text-xs text-slate-500">15 Nov - 6:00 PM</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-800 text-sm">Examen de Matemática</p>
                  <p className="text-xs text-slate-500">22 Nov - 8:00 AM</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Award className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-800 text-sm">Día del Logro</p>
                  <p className="text-xs text-slate-500">25 Nov - 10:00 AM</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-elevated" data-testid="quick-access-card">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-semibold">
            Acceso Rápido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/boleta" data-testid="quick-boleta">
              <div className="p-4 bg-slate-50 rounded-xl text-center hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-colors cursor-pointer">
                <BookOpen className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Boleta de Notas</p>
              </div>
            </Link>
            <Link to="/horarios" data-testid="quick-horarios">
              <div className="p-4 bg-slate-50 rounded-xl text-center hover:bg-emerald-50 hover:border-emerald-200 border border-transparent transition-colors cursor-pointer">
                <Clock className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Mi Horario</p>
              </div>
            </Link>
            <Link to="/asistencia" data-testid="quick-asistencia">
              <div className="p-4 bg-slate-50 rounded-xl text-center hover:bg-orange-50 hover:border-orange-200 border border-transparent transition-colors cursor-pointer">
                <CheckCircle className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Asistencia</p>
              </div>
            </Link>
            <Link to="/comunicados" data-testid="quick-comunicados">
              <div className="p-4 bg-slate-50 rounded-xl text-center hover:bg-purple-50 hover:border-purple-200 border border-transparent transition-colors cursor-pointer">
                <AlertCircle className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Comunicados</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
