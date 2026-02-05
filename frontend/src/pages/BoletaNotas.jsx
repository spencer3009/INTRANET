import { Printer, Download, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { studentInfo, gradesData, behaviorData, calcularPromedio, getGradeClass } from "@/data/studentData";
import { toast } from "sonner";

const GradeRow = ({ criterio, areaIndex, criterioIndex }) => {
  return (
    <tr className="criteria-row">
      <td className="text-slate-600 text-xs pl-6">
        • {criterio.nombre}
      </td>
      <td className="grade-cell text-xs">{criterio.bim1}</td>
      <td className="grade-cell text-xs">{criterio.bim2}</td>
      <td className="grade-cell text-xs">{criterio.bim3}</td>
      <td className="grade-cell text-xs">{criterio.bim4}</td>
      <td className="grade-cell text-xs">
        {calcularPromedio([criterio.bim1, criterio.bim2, criterio.bim3, criterio.bim4])}
      </td>
      <td className="grade-cell text-xs">-</td>
    </tr>
  );
};

const AreaRow = ({ area, areaIndex }) => {
  const promediosBim = {
    bim1: calcularPromedio(area.criterios.map(c => c.bim1)),
    bim2: calcularPromedio(area.criterios.map(c => c.bim2)),
    bim3: calcularPromedio(area.criterios.map(c => c.bim3)),
    bim4: calcularPromedio(area.criterios.map(c => c.bim4))
  };
  const promedioFinal = calcularPromedio([
    promediosBim.bim1, promediosBim.bim2, promediosBim.bim3, promediosBim.bim4
  ]);
  const necesitaRecuperacion = promedioFinal < 11;

  return (
    <tr className="area-row">
      <td className="font-semibold text-slate-800">
        {area.area}
      </td>
      <td className="grade-cell">
        <span className={getGradeClass(promediosBim.bim1)}>
          {promediosBim.bim1}
        </span>
      </td>
      <td className="grade-cell">
        <span className={getGradeClass(promediosBim.bim2)}>
          {promediosBim.bim2}
        </span>
      </td>
      <td className="grade-cell">
        <span className={getGradeClass(promediosBim.bim3)}>
          {promediosBim.bim3}
        </span>
      </td>
      <td className="grade-cell">
        <span className={getGradeClass(promediosBim.bim4)}>
          {promediosBim.bim4}
        </span>
      </td>
      <td className="grade-cell">
        <span className={`font-bold ${getGradeClass(promedioFinal)}`}>
          {promedioFinal}
        </span>
      </td>
      <td className="grade-cell">
        {necesitaRecuperacion ? (
          <Badge variant="destructive" className="text-xs">
            REQ
          </Badge>
        ) : (
          <span className="text-slate-400">-</span>
        )}
      </td>
    </tr>
  );
};

export default function BoletaNotas() {
  const handlePrint = () => {
    window.print();
    toast.success("Imprimiendo boleta de notas...");
  };

  const handleDownload = () => {
    toast.success("Descargando boleta en PDF...");
  };

  const calcularPromedioGeneral = () => {
    let totalPromedios = 0;
    gradesData.forEach(area => {
      const promedioArea = calcularPromedio(
        area.criterios.flatMap(c => [c.bim1, c.bim2, c.bim3, c.bim4])
      );
      totalPromedios += promedioArea;
    });
    return Math.round(totalPromedios / gradesData.length);
  };

  const renderGradesRows = () => {
    const rows = [];
    gradesData.forEach((area, areaIndex) => {
      rows.push(
        <AreaRow key={`area-${areaIndex}`} area={area} areaIndex={areaIndex} />
      );
      area.criterios.forEach((criterio, criterioIndex) => {
        rows.push(
          <GradeRow 
            key={`criterio-${areaIndex}-${criterioIndex}`}
            criterio={criterio}
            areaIndex={areaIndex}
            criterioIndex={criterioIndex}
          />
        );
      });
    });
    return rows;
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="boleta-notas-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">
            Libreta de Información del Estudiante
          </h1>
          <p className="text-slate-500 mt-1">Año Escolar {studentInfo.anio}</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handlePrint}
            className="flex items-center gap-2"
            data-testid="print-btn"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
          <Button 
            onClick={handleDownload}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            data-testid="download-btn"
          >
            <Download className="w-4 h-4" />
            Descargar PDF
          </Button>
        </div>
      </div>

      <Card className="card-elevated overflow-hidden" data-testid="report-card">
        <CardHeader className="bg-slate-50 border-b border-slate-200 print:bg-white">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <img 
                src={studentInfo.foto}
                alt="Foto del estudiante"
                className="w-24 h-28 rounded-xl object-cover border-4 border-blue-500 shadow-lg"
                data-testid="student-photo-boleta"
              />
              <div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div>
                    <span className="text-slate-500">IGEL:</span>
                    <span className="ml-2 font-medium text-slate-800">{studentInfo.igel}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">I.E.:</span>
                    <span className="ml-2 font-medium text-slate-800">{studentInfo.ie}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Nivel:</span>
                    <span className="ml-2 font-medium text-slate-800">{studentInfo.nivel}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Grado:</span>
                    <span className="ml-2 font-medium text-slate-800">{studentInfo.grado}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Sección:</span>
                    <span className="ml-2 font-medium text-slate-800">{studentInfo.seccion}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Código:</span>
                    <span className="ml-2 font-medium text-slate-800">{studentInfo.codigo}</span>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="text-sm">
                  <span className="text-slate-500">Apellidos y Nombres:</span>
                  <span className="ml-2 font-semibold text-slate-900">
                    {studentInfo.apellidos}, {studentInfo.nombres}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <FileText className="w-10 h-10 text-white" />
              </div>
              <Badge className="mt-3 bg-blue-100 text-blue-700 text-lg px-4 py-1">
                {studentInfo.anio}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="report-card-table" data-testid="grades-table">
              <thead>
                <tr>
                  <th className="text-left w-1/3">ÁREA / CRITERIOS DE EVALUACIÓN</th>
                  <th className="text-center w-14">BIM 1</th>
                  <th className="text-center w-14">BIM 2</th>
                  <th className="text-center w-14">BIM 3</th>
                  <th className="text-center w-14">BIM 4</th>
                  <th className="text-center w-16">PROM. FINAL</th>
                  <th className="text-center w-16">RECUP.</th>
                </tr>
              </thead>
              <tbody>
                {renderGradesRows()}

                <tr className="area-row">
                  <td className="font-semibold text-slate-800">COMPORTAMIENTO</td>
                  <td className="grade-cell">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      {behaviorData.bim1}
                    </Badge>
                  </td>
                  <td className="grade-cell">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      {behaviorData.bim2}
                    </Badge>
                  </td>
                  <td className="grade-cell">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {behaviorData.bim3}
                    </Badge>
                  </td>
                  <td className="grade-cell">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {behaviorData.bim4}
                    </Badge>
                  </td>
                  <td className="grade-cell">
                    <Badge className="bg-blue-600">AD</Badge>
                  </td>
                  <td className="grade-cell">-</td>
                </tr>

                <tr className="average-row">
                  <td className="font-bold text-blue-800">PROMEDIO GENERAL</td>
                  <td className="grade-cell" colSpan={4}></td>
                  <td className="grade-cell">
                    <span className="text-2xl font-bold text-blue-700">
                      {calcularPromedioGeneral()}
                    </span>
                  </td>
                  <td className="grade-cell">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated no-print" data-testid="legend-card">
        <CardHeader>
          <CardTitle className="font-heading text-base font-semibold">
            Leyenda de Calificaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <span className="grade-excellent px-3 py-1">18-20</span>
              <span className="text-sm text-slate-600">Logro Destacado (AD)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="grade-good px-3 py-1">14-17</span>
              <span className="text-sm text-slate-600">Logro Esperado (A)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="grade-regular px-3 py-1">11-13</span>
              <span className="text-sm text-slate-600">En Proceso (B)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="grade-fail px-3 py-1">0-10</span>
              <span className="text-sm text-slate-600">En Inicio (C)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
