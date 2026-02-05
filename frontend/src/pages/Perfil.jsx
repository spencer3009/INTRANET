import { User, Mail, Phone, MapPin, Calendar, Award, BookOpen, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { studentInfo, gradesData, attendanceData, calcularPromedio } from "@/data/studentData";

export default function Perfil() {
  // Calcular estadísticas
  const promedioGeneral = () => {
    let totalNotas = 0;
    let cantidadNotas = 0;
    gradesData.forEach(area => {
      area.criterios.forEach(criterio => {
        totalNotas += calcularPromedio([criterio.bim1, criterio.bim2, criterio.bim3, criterio.bim4]);
        cantidadNotas++;
      });
    });
    return Math.round(totalNotas / cantidadNotas);
  };

  const promedio = promedioGeneral();

  return (
    <div className="space-y-6 animate-fade-in" data-testid="perfil-page">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">
          Mi Perfil
        </h1>
        <p className="text-slate-500 mt-1">Información personal y académica</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-1 card-elevated" data-testid="profile-card">
          <CardContent className="pt-6">
            <div className="text-center">
              <img 
                src={studentInfo.foto}
                alt="Foto del estudiante"
                className="w-32 h-32 rounded-2xl object-cover mx-auto border-4 border-blue-500 shadow-lg"
                data-testid="profile-photo"
              />
              <h2 className="font-heading text-xl font-bold text-slate-900 mt-4">
                {studentInfo.nombres}
              </h2>
              <p className="text-slate-600">{studentInfo.apellidos}</p>
              <div className="flex justify-center gap-2 mt-3">
                <Badge className="bg-blue-100 text-blue-700">
                  {studentInfo.grado} Grado
                </Badge>
                <Badge variant="outline">
                  Sección {studentInfo.seccion}
                </Badge>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Código de Estudiante</p>
                  <p className="font-medium text-slate-800">{studentInfo.codigo}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Institución Educativa</p>
                  <p className="font-medium text-slate-800">{studentInfo.ie}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Año Escolar</p>
                  <p className="font-medium text-slate-800">{studentInfo.anio}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Nivel</p>
                  <p className="font-medium text-slate-800">{studentInfo.nivel}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Academic Stats */}
        <Card className="lg:col-span-2 card-elevated" data-testid="academic-stats">
          <CardHeader>
            <CardTitle className="font-heading text-lg font-semibold flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              Rendimiento Académico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Promedio General */}
              <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl">
                <p className="text-4xl font-bold text-blue-700 font-mono">{promedio}</p>
                <p className="text-sm text-blue-600 mt-1">Promedio General</p>
                <Badge className={`mt-2 ${
                  promedio >= 18 ? 'bg-emerald-600' :
                  promedio >= 14 ? 'bg-blue-600' :
                  promedio >= 11 ? 'bg-orange-600' : 'bg-red-600'
                }`}>
                  {promedio >= 18 ? 'Logro Destacado' :
                   promedio >= 14 ? 'Logro Esperado' :
                   promedio >= 11 ? 'En Proceso' : 'En Inicio'}
                </Badge>
              </div>

              {/* Asistencia */}
              <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl">
                <p className="text-4xl font-bold text-emerald-700 font-mono">{attendanceData.porcentaje}%</p>
                <p className="text-sm text-emerald-600 mt-1">Asistencia</p>
                <Badge className="mt-2 bg-emerald-600">Excelente</Badge>
              </div>

              {/* Áreas */}
              <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl">
                <p className="text-4xl font-bold text-purple-700 font-mono">{gradesData.length}</p>
                <p className="text-sm text-purple-600 mt-1">Áreas Curriculares</p>
                <Badge className="mt-2 bg-purple-600">Activas</Badge>
              </div>
            </div>

            {/* Progress by Area */}
            <h4 className="font-semibold text-slate-800 mb-4">Rendimiento por Área</h4>
            <div className="space-y-4">
              {gradesData.slice(0, 6).map((area, index) => {
                const promedioArea = calcularPromedio(
                  area.criterios.flatMap(c => [c.bim1, c.bim2, c.bim3, c.bim4])
                );
                return (
                  <div key={index}>
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
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Info (Simulated) */}
        <Card className="card-elevated" data-testid="contact-info">
          <CardHeader>
            <CardTitle className="font-heading text-base font-semibold">
              Información de Contacto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Correo Electrónico</p>
                <p className="font-medium text-slate-800">juan.garcia@estudiante.edu.pe</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Phone className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Teléfono de Apoderado</p>
                <p className="font-medium text-slate-800">+51 987 654 321</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Dirección</p>
                <p className="font-medium text-slate-800">Av. Los Próceres 1234, Lima</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Academic History (Simulated) */}
        <Card className="card-elevated" data-testid="academic-history">
          <CardHeader>
            <CardTitle className="font-heading text-base font-semibold">
              Historial Académico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { year: "2024", grade: "5to Secundaria", status: "En curso", avg: promedio },
                { year: "2023", grade: "4to Secundaria", status: "Aprobado", avg: 15 },
                { year: "2022", grade: "3ro Secundaria", status: "Aprobado", avg: 14 },
                { year: "2021", grade: "2do Secundaria", status: "Aprobado", avg: 14 },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-sm font-bold text-blue-600">{item.year}</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{item.grade}</p>
                      <p className="text-xs text-slate-500">{item.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-lg text-slate-800">{item.avg}</p>
                    <p className="text-xs text-slate-500">Promedio</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
