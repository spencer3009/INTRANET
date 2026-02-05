import { useState } from "react";
import { Bell, AlertTriangle, Info, CheckCircle, Mail, MailOpen, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { comunicadosData } from "@/data/studentData";
import { toast } from "sonner";

const getTipoIcon = (tipo) => {
  switch (tipo) {
    case "importante":
      return <AlertTriangle className="w-5 h-5 text-red-600" />;
    case "alerta":
      return <Bell className="w-5 h-5 text-orange-600" />;
    default:
      return <Info className="w-5 h-5 text-blue-600" />;
  }
};

const getTipoBadge = (tipo) => {
  switch (tipo) {
    case "importante":
      return <Badge className="bg-red-100 text-red-700 border-red-200">Importante</Badge>;
    case "alerta":
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Alerta</Badge>;
    default:
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Informativo</Badge>;
  }
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-PE', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
};

export default function Comunicados() {
  const [comunicados, setComunicados] = useState(comunicadosData);
  const [selectedComunicado, setSelectedComunicado] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const noLeidos = comunicados.filter(c => !c.leido).length;

  const marcarComoLeido = (id) => {
    setComunicados(prev => 
      prev.map(c => c.id === id ? { ...c, leido: true } : c)
    );
    toast.success("Comunicado marcado como leído");
  };

  const marcarTodosLeidos = () => {
    setComunicados(prev => prev.map(c => ({ ...c, leido: true })));
    toast.success("Todos los comunicados marcados como leídos");
  };

  const abrirComunicado = (comunicado) => {
    setSelectedComunicado(comunicado);
    setDialogOpen(true);
    if (!comunicado.leido) {
      marcarComoLeido(comunicado.id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="comunicados-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">
            Comunicados
          </h1>
          <p className="text-slate-500 mt-1">
            {noLeidos > 0 ? `Tienes ${noLeidos} comunicado${noLeidos > 1 ? 's' : ''} sin leer` : 'Todos los comunicados han sido leídos'}
          </p>
        </div>
        {noLeidos > 0 && (
          <Button 
            variant="outline" 
            onClick={marcarTodosLeidos}
            className="flex items-center gap-2"
            data-testid="mark-all-read-btn"
          >
            <CheckCircle className="w-4 h-4" />
            Marcar todos como leídos
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="stat-card border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="stat-label">Total</p>
              <p className="text-2xl font-bold text-slate-800">{comunicados.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card border-l-4 border-l-orange-500">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Bell className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="stat-label">Sin Leer</p>
              <p className="text-2xl font-bold text-slate-800">{noLeidos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card border-l-4 border-l-emerald-500">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <MailOpen className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="stat-label">Leídos</p>
              <p className="text-2xl font-bold text-slate-800">{comunicados.length - noLeidos}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comunicados List */}
      <Card className="card-elevated" data-testid="comunicados-list">
        <CardHeader>
          <CardTitle className="font-heading text-lg font-semibold">
            Bandeja de Comunicados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {comunicados.map((comunicado) => (
              <div 
                key={comunicado.id}
                className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 ${!comunicado.leido ? 'bg-blue-50/50' : ''}`}
                onClick={() => abrirComunicado(comunicado)}
                data-testid={`comunicado-${comunicado.id}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    comunicado.tipo === 'importante' ? 'bg-red-100' :
                    comunicado.tipo === 'alerta' ? 'bg-orange-100' : 'bg-blue-100'
                  }`}>
                    {getTipoIcon(comunicado.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`font-semibold text-slate-800 ${!comunicado.leido ? 'font-bold' : ''}`}>
                        {comunicado.titulo}
                      </h3>
                      {!comunicado.leido && (
                        <Badge className="bg-blue-600 text-xs">Nuevo</Badge>
                      )}
                      {getTipoBadge(comunicado.tipo)}
                    </div>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                      {comunicado.contenido}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      {formatDate(comunicado.fecha)}
                    </div>
                  </div>
                  {!comunicado.leido && (
                    <div className="w-3 h-3 bg-blue-600 rounded-full" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="comunicado-dialog">
          {selectedComunicado && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  {getTipoBadge(selectedComunicado.tipo)}
                </div>
                <DialogTitle className="font-heading text-xl">
                  {selectedComunicado.titulo}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4" />
                  {formatDate(selectedComunicado.fecha)}
                </DialogDescription>
              </DialogHeader>
              <Separator />
              <div className="py-4">
                <p className="text-slate-700 leading-relaxed">
                  {selectedComunicado.contenido}
                </p>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setDialogOpen(false)}>
                  Cerrar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
