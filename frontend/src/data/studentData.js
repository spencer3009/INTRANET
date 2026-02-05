// Datos estáticos del estudiante
export const studentInfo = {
  igel: "001234567",
  ie: "I.E. San Martín de Porres",
  nivel: "Secundaria",
  grado: "QUINTO",
  seccion: "ÚNICA",
  codigo: "2024-5A-001",
  apellidos: "García López",
  nombres: "Juan Carlos",
  foto: "https://socioscreativos.com/wp-content/uploads/2026/02/nino.png",
  anio: "2024"
};

// Datos de calificaciones simplificados
export const gradesData = [
  { area: "MATEMÁTICA", b1: 15, b2: 16, b3: 16, b4: 16 },
  { area: "COMUNICACIÓN", b1: 15, b2: 16, b3: 17, b4: 17 },
  { area: "INGLÉS", b1: 14, b2: 15, b3: 15, b4: 16 },
  { area: "ARTE Y CULTURA", b1: 17, b2: 17, b3: 18, b4: 18 },
  { area: "CIENCIAS SOCIALES", b1: 15, b2: 16, b3: 16, b4: 17 },
  { area: "DESARROLLO PERSONAL, CIUDADANÍA Y CÍVICA", b1: 17, b2: 17, b3: 18, b4: 18 },
  { area: "EDUCACIÓN FÍSICA", b1: 18, b2: 18, b3: 18, b4: 19 },
  { area: "EDUCACIÓN RELIGIOSA", b1: 16, b2: 16, b3: 17, b4: 17 },
  { area: "CIENCIA Y TECNOLOGÍA", b1: 15, b2: 16, b3: 16, b4: 17 },
  { area: "EDUCACIÓN PARA EL TRABAJO", b1: 15, b2: 16, b3: 17, b4: 17 }
];

// Criterios de evaluación por área
export const criteriosData = {
  "MATEMÁTICA": [
    "Resuelve problemas de cantidad",
    "Resuelve problemas de regularidad, equivalencia y cambio",
    "Resuelve problemas de forma, movimiento y localización",
    "Resuelve problemas de gestión de datos e incertidumbre"
  ],
  "COMUNICACIÓN": [
    "Se comunica oralmente en su lengua materna",
    "Lee diversos tipos de textos escritos",
    "Escribe diversos tipos de textos"
  ],
  "INGLÉS": [
    "Se comunica oralmente en inglés",
    "Lee diversos tipos de textos en inglés",
    "Escribe diversos tipos de textos en inglés"
  ],
  "ARTE Y CULTURA": [
    "Aprecia de manera crítica manifestaciones artístico-culturales",
    "Crea proyectos desde los lenguajes artísticos"
  ],
  "CIENCIAS SOCIALES": [
    "Construye interpretaciones históricas",
    "Gestiona responsablemente el espacio y el ambiente",
    "Gestiona responsablemente los recursos económicos"
  ],
  "DESARROLLO PERSONAL, CIUDADANÍA Y CÍVICA": [
    "Construye su identidad",
    "Convive y participa democráticamente"
  ],
  "EDUCACIÓN FÍSICA": [
    "Se desenvuelve de manera autónoma a través de su motricidad",
    "Asume una vida saludable",
    "Interactúa a través de sus habilidades sociomotrices"
  ],
  "EDUCACIÓN RELIGIOSA": [
    "Construye su identidad como persona humana",
    "Asume la experiencia del encuentro personal y comunitario con Dios"
  ],
  "CIENCIA Y TECNOLOGÍA": [
    "Indaga mediante métodos científicos",
    "Explica el mundo físico basándose en conocimientos científicos",
    "Diseña y construye soluciones tecnológicas"
  ],
  "EDUCACIÓN PARA EL TRABAJO": [
    "Gestiona proyectos de emprendimiento económico o social"
  ]
};

// Datos de comportamiento
export const behaviorData = {
  bim1: "A",
  bim2: "A",
  bim3: "AD",
  bim4: "AD"
};

// Horario escolar
export const scheduleData = [
  { hora: "7:30 - 8:15", lunes: "Matemática", martes: "Comunicación", miercoles: "Inglés", jueves: "CC.SS.", viernes: "Ed. Física" },
  { hora: "8:15 - 9:00", lunes: "Matemática", martes: "Comunicación", miercoles: "Inglés", jueves: "CC.SS.", viernes: "Ed. Física" },
  { hora: "9:00 - 9:45", lunes: "Comunicación", martes: "Matemática", miercoles: "Arte", jueves: "Ciencia", viernes: "DPCC" },
  { hora: "9:45 - 10:15", lunes: "RECREO", martes: "RECREO", miercoles: "RECREO", jueves: "RECREO", viernes: "RECREO" },
  { hora: "10:15 - 11:00", lunes: "Inglés", martes: "Ciencia", miercoles: "Matemática", jueves: "Comunicación", viernes: "Religión" },
  { hora: "11:00 - 11:45", lunes: "CC.SS.", martes: "Arte", miercoles: "DPCC", jueves: "Matemática", viernes: "EPT" },
  { hora: "11:45 - 12:30", lunes: "Ciencia", martes: "Ed. Física", miercoles: "Comunicación", jueves: "Tutoría", viernes: "EPT" }
];

// Datos de asistencia
export const attendanceData = {
  totalDias: 180,
  asistencias: 172,
  faltas: 5,
  tardanzas: 3,
  justificadas: 2,
  porcentaje: 95.6
};

export const attendanceMensual = [
  { mes: "Marzo", asistencias: 20, faltas: 0, tardanzas: 0 },
  { mes: "Abril", asistencias: 18, faltas: 1, tardanzas: 1 },
  { mes: "Mayo", asistencias: 20, faltas: 0, tardanzas: 0 },
  { mes: "Junio", asistencias: 19, faltas: 1, tardanzas: 0 },
  { mes: "Julio", asistencias: 14, faltas: 0, tardanzas: 1 },
  { mes: "Agosto", asistencias: 20, faltas: 1, tardanzas: 0 },
  { mes: "Septiembre", asistencias: 19, faltas: 1, tardanzas: 0 },
  { mes: "Octubre", asistencias: 21, faltas: 0, tardanzas: 1 },
  { mes: "Noviembre", asistencias: 21, faltas: 1, tardanzas: 0 },
  { mes: "Diciembre", asistencias: 0, faltas: 0, tardanzas: 0 }
];

// Comunicados
export const comunicadosData = [
  {
    id: 1,
    titulo: "Reunión de Padres de Familia",
    fecha: "2024-11-15",
    contenido: "Se convoca a todos los padres de familia del 5to grado a la reunión informativa sobre el cierre del año escolar. Lugar: Auditorio Principal. Hora: 6:00 PM.",
    tipo: "importante",
    leido: false
  },
  {
    id: 2,
    titulo: "Simulacro de Sismo",
    fecha: "2024-11-10",
    contenido: "El próximo viernes 15 de noviembre se realizará el simulacro nacional de sismo. Los estudiantes deben seguir las indicaciones del personal docente.",
    tipo: "alerta",
    leido: true
  },
  {
    id: 3,
    titulo: "Entrega de Libretas - 3er Bimestre",
    fecha: "2024-11-05",
    contenido: "Se hace de conocimiento que las libretas del tercer bimestre estarán disponibles a partir del día lunes 18 de noviembre en la oficina de secretaría.",
    tipo: "info",
    leido: true
  },
  {
    id: 4,
    titulo: "Clausura del Año Escolar",
    fecha: "2024-11-01",
    contenido: "La ceremonia de clausura del año escolar 2024 se realizará el día 20 de diciembre a las 10:00 AM. Se requiere la asistencia obligatoria de todos los estudiantes.",
    tipo: "importante",
    leido: false
  },
  {
    id: 5,
    titulo: "Actualización de Datos",
    fecha: "2024-10-28",
    contenido: "Se solicita a los padres de familia actualizar los datos de contacto y emergencia en la oficina de secretaría antes del 30 de noviembre.",
    tipo: "info",
    leido: true
  }
];

// Eventos del calendario
export const calendarEvents = [
  { fecha: "2024-11-15", evento: "Reunión de Padres", tipo: "reunion" },
  { fecha: "2024-11-18", evento: "Entrega de Libretas", tipo: "academico" },
  { fecha: "2024-11-22", evento: "Examen de Matemática", tipo: "examen" },
  { fecha: "2024-11-25", evento: "Día del Logro", tipo: "evento" },
  { fecha: "2024-12-06", evento: "Exámenes Finales", tipo: "examen" },
  { fecha: "2024-12-13", evento: "Último día de clases", tipo: "academico" },
  { fecha: "2024-12-20", evento: "Clausura del Año Escolar", tipo: "evento" }
];

// Función helper para calcular promedio
export const calcularPromedio = (notas) => {
  if (!notas || notas.length === 0) return 0;
  const suma = notas.reduce((acc, nota) => acc + nota, 0);
  return Math.round(suma / notas.length);
};

// Función helper para obtener clase de nota
export const getGradeClass = (nota) => {
  if (nota >= 18) return "grade-excellent";
  if (nota >= 14) return "grade-good";
  if (nota >= 11) return "grade-regular";
  return "grade-fail";
};
