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

// Datos de calificaciones por área
export const gradesData = [
  {
    area: "MATEMÁTICA",
    criterios: [
      { nombre: "Resuelve problemas de cantidad", bim1: 15, bim2: 16, bim3: 17, bim4: 16 },
      { nombre: "Resuelve problemas de regularidad, equivalencia y cambio", bim1: 14, bim2: 15, bim3: 16, bim4: 15 },
      { nombre: "Resuelve problemas de forma, movimiento y localización", bim1: 16, bim2: 17, bim3: 16, bim4: 17 },
      { nombre: "Resuelve problemas de gestión de datos e incertidumbre", bim1: 15, bim2: 14, bim3: 15, bim4: 16 }
    ]
  },
  {
    area: "COMUNICACIÓN",
    criterios: [
      { nombre: "Se comunica oralmente en su lengua materna", bim1: 16, bim2: 17, bim3: 17, bim4: 18 },
      { nombre: "Lee diversos tipos de textos escritos", bim1: 15, bim2: 16, bim3: 17, bim4: 17 },
      { nombre: "Escribe diversos tipos de textos", bim1: 14, bim2: 15, bim3: 16, bim4: 16 }
    ]
  },
  {
    area: "INGLÉS",
    criterios: [
      { nombre: "Se comunica oralmente en inglés", bim1: 14, bim2: 15, bim3: 15, bim4: 16 },
      { nombre: "Lee diversos tipos de textos en inglés", bim1: 15, bim2: 15, bim3: 16, bim4: 16 },
      { nombre: "Escribe diversos tipos de textos en inglés", bim1: 13, bim2: 14, bim3: 15, bim4: 15 }
    ]
  },
  {
    area: "ARTE Y CULTURA",
    criterios: [
      { nombre: "Aprecia de manera crítica manifestaciones artístico-culturales", bim1: 17, bim2: 17, bim3: 18, bim4: 18 },
      { nombre: "Crea proyectos desde los lenguajes artísticos", bim1: 16, bim2: 17, bim3: 17, bim4: 18 }
    ]
  },
  {
    area: "CIENCIAS SOCIALES",
    criterios: [
      { nombre: "Construye interpretaciones históricas", bim1: 15, bim2: 16, bim3: 16, bim4: 17 },
      { nombre: "Gestiona responsablemente el espacio y el ambiente", bim1: 16, bim2: 16, bim3: 17, bim4: 17 },
      { nombre: "Gestiona responsablemente los recursos económicos", bim1: 14, bim2: 15, bim3: 16, bim4: 16 }
    ]
  },
  {
    area: "DESARROLLO PERSONAL, CIUDADANÍA Y CÍVICA",
    criterios: [
      { nombre: "Construye su identidad", bim1: 17, bim2: 17, bim3: 18, bim4: 18 },
      { nombre: "Convive y participa democráticamente", bim1: 16, bim2: 17, bim3: 17, bim4: 18 }
    ]
  },
  {
    area: "EDUCACIÓN FÍSICA",
    criterios: [
      { nombre: "Se desenvuelve de manera autónoma a través de su motricidad", bim1: 18, bim2: 18, bim3: 19, bim4: 19 },
      { nombre: "Asume una vida saludable", bim1: 17, bim2: 18, bim3: 18, bim4: 18 },
      { nombre: "Interactúa a través de sus habilidades sociomotrices", bim1: 17, bim2: 17, bim3: 18, bim4: 18 }
    ]
  },
  {
    area: "EDUCACIÓN RELIGIOSA",
    criterios: [
      { nombre: "Construye su identidad como persona humana", bim1: 16, bim2: 16, bim3: 17, bim4: 17 },
      { nombre: "Asume la experiencia del encuentro personal y comunitario con Dios", bim1: 15, bim2: 16, bim3: 16, bim4: 17 }
    ]
  },
  {
    area: "CIENCIA Y TECNOLOGÍA",
    criterios: [
      { nombre: "Indaga mediante métodos científicos", bim1: 15, bim2: 16, bim3: 16, bim4: 17 },
      { nombre: "Explica el mundo físico basándose en conocimientos científicos", bim1: 14, bim2: 15, bim3: 16, bim4: 16 },
      { nombre: "Diseña y construye soluciones tecnológicas", bim1: 16, bim2: 16, bim3: 17, bim4: 17 }
    ]
  },
  {
    area: "EDUCACIÓN PARA EL TRABAJO",
    criterios: [
      { nombre: "Gestiona proyectos de emprendimiento económico o social", bim1: 15, bim2: 16, bim3: 17, bim4: 17 }
    ]
  }
];

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
  porcentaje: 95.6,
  mensual: [
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
  ]
};

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
