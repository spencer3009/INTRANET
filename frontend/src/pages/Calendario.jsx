import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, BookOpen, Users, Award, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { calendarEvents } from "@/data/studentData";

const getEventIcon = (tipo) => {
  switch (tipo) {
    case "examen":
      return <BookOpen className="w-4 h-4" />;
    case "reunion":
      return <Users className="w-4 h-4" />;
    case "evento":
      return <Award className="w-4 h-4" />;
    default:
      return <GraduationCap className="w-4 h-4" />;
  }
};

const getEventColor = (tipo) => {
  switch (tipo) {
    case "examen":
      return "bg-red-100 text-red-700 border-red-200";
    case "reunion":
      return "bg-purple-100 text-purple-700 border-purple-200";
    case "evento":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default:
      return "bg-blue-100 text-blue-700 border-blue-200";
  }
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-PE', { 
    weekday: 'long',
    day: 'numeric', 
    month: 'long'
  });
};

export default function Calendario() {
  const [date, setDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  // Get events for selected date
  const getEventsForDate = (dateStr) => {
    return calendarEvents.filter(event => event.fecha === dateStr);
  };

  // Get dates with events for highlighting
  const eventDates = calendarEvents.map(event => new Date(event.fecha));

  // Get upcoming events (next 7 days)
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 30);
  
  const upcomingEvents = calendarEvents.filter(event => {
    const eventDate = new Date(event.fecha);
    return eventDate >= today && eventDate <= nextWeek;
  }).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const handleDateSelect = (newDate) => {
    if (newDate) {
      const dateStr = newDate.toISOString().split('T')[0];
      setSelectedDate(dateStr);
      setDate(newDate);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="calendario-page">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">
          Calendario Escolar
        </h1>
        <p className="text-slate-500 mt-1">Año Escolar 2024</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2 card-elevated" data-testid="calendar-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg font-semibold flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              Noviembre 2024
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              className="rounded-md border w-full"
              modifiers={{
                hasEvent: eventDates
              }}
              modifiersStyles={{
                hasEvent: {
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  fontWeight: '600'
                }
              }}
            />
            
            {/* Selected Date Events */}
            {selectedDate && getEventsForDate(selectedDate).length > 0 && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                <h4 className="font-semibold text-slate-800 mb-3">
                  Eventos del {formatDate(selectedDate)}
                </h4>
                <div className="space-y-2">
                  {getEventsForDate(selectedDate).map((event, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg border flex items-center gap-3 ${getEventColor(event.tipo)}`}
                    >
                      {getEventIcon(event.tipo)}
                      <span className="font-medium">{event.evento}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="card-elevated" data-testid="upcoming-events-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg font-semibold">
              Próximos Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event, index) => (
                  <div 
                    key={index}
                    className="p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        event.tipo === 'examen' ? 'bg-red-100' :
                        event.tipo === 'reunion' ? 'bg-purple-100' :
                        event.tipo === 'evento' ? 'bg-emerald-100' : 'bg-blue-100'
                      }`}>
                        {getEventIcon(event.tipo)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800 text-sm">
                          {event.evento}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatDate(event.fecha)}
                        </p>
                        <Badge className={`mt-2 text-xs ${getEventColor(event.tipo)}`}>
                          {event.tipo === 'examen' ? 'Examen' :
                           event.tipo === 'reunion' ? 'Reunión' :
                           event.tipo === 'evento' ? 'Evento' : 'Académico'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No hay eventos próximos</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Legend */}
      <Card className="card-elevated" data-testid="event-legend">
        <CardHeader>
          <CardTitle className="font-heading text-base font-semibold">
            Tipos de Eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-red-600" />
              </div>
              <span className="text-sm text-slate-600">Exámenes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-sm text-slate-600">Reuniones</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Award className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-sm text-slate-600">Eventos Especiales</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm text-slate-600">Académico</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
