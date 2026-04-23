import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  FileText, Save, Loader2, Hash, MapPin,
  Phone, Mail, Type, AlertCircle, CheckCircle2
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ConfiguracionBoletaTab({ token, user }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    razon_social: "",
    ruc: "",
    direccion: "",
    distrito: "",
    provincia: "",
    departamento: "",
    telefono: "",
    email: "",
    serie: "B001",
    pie_pagina: "",
  });
  const [correlativo, setCorrelativo] = useState(0);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await axios.get(`${API}/contabilidad/boleta-config`, { headers });
      const d = res.data;
      setForm({
        razon_social: d.razon_social || "",
        ruc: d.ruc || "",
        direccion: d.direccion || "",
        distrito: d.distrito || "",
        provincia: d.provincia || "",
        departamento: d.departamento || "",
        telefono: d.telefono || "",
        email: d.email || "",
        serie: d.serie || "B001",
        pie_pagina: d.pie_pagina || "",
      });
      setCorrelativo(d.correlativo_actual || 0);
      setConfigured(d.configured || false);
    } catch {
      toast.error("Error al cargar configuración de boleta");
    } finally {
      setLoading(false);
    }
  };

  const validateRuc = (ruc) => /^(10|20)\d{9}$/.test(ruc);

  const handleSave = async () => {
    if (!form.razon_social.trim()) return toast.error("La razon social es obligatoria");
    if (!form.ruc.trim()) return toast.error("El RUC es obligatorio");
    if (!validateRuc(form.ruc)) return toast.error("RUC invalido. Debe tener 11 digitos y empezar con 10 o 20");
    if (!form.direccion.trim()) return toast.error("La dirección es obligatoria");
    if (!form.distrito.trim()) return toast.error("El distrito es obligatorio");
    if (!form.provincia.trim()) return toast.error("La provincia es obligatoria");
    if (!form.departamento.trim()) return toast.error("El departamento es obligatorio");
    if (form.pie_pagina && form.pie_pagina.length > 200) return toast.error("Pie de página max 200 caracteres");

    setSaving(true);
    try {
      await axios.put(`${API}/contabilidad/boleta-config`, form, { headers });
      toast.success("Configuración de boleta guardada");
      setConfigured(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const nextBoleta = `${form.serie}-${String(correlativo + 1).padStart(8, "0")}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="boleta-config-tab">
      {/* Status Banner */}
      {!configured && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50" data-testid="boleta-config-warning">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Configuración pendiente</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Completa los datos del emisor para emitir boletas automaticamente al registrar ingresos.
            </p>
          </div>
        </div>
      )}

      {configured && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50" data-testid="boleta-config-active">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-800">Boletas activas</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Próxima boleta a emitir: <strong>{nextBoleta}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          Datos del Emisor
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Razon Social */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Razon Social *</label>
            <input
              value={form.razon_social}
              onChange={(e) => setForm(f => ({ ...f, razon_social: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
              placeholder="I.E.P. El Roble S.A.C."
              data-testid="boleta-razon-social"
            />
          </div>

          {/* RUC */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> RUC *</span>
            </label>
            <input
              value={form.ruc}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 11);
                setForm(f => ({ ...f, ruc: v }));
              }}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
              placeholder="20123456789"
              maxLength={11}
              data-testid="boleta-ruc"
            />
            {form.ruc && !validateRuc(form.ruc) && (
              <p className="text-xs text-red-500 mt-1">11 digitos, empieza con 10 o 20</p>
            )}
          </div>

          {/* Serie */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <span className="flex items-center gap-1"><Type className="w-3 h-3" /> Serie</span>
            </label>
            <input
              value={form.serie}
              onChange={(e) => {
                const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
                setForm(f => ({ ...f, serie: v }));
              }}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
              placeholder="B001"
              maxLength={4}
              data-testid="boleta-serie"
            />
          </div>

          {/* Dirección */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Dirección *</span>
            </label>
            <input
              value={form.direccion}
              onChange={(e) => setForm(f => ({ ...f, direccion: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
              placeholder="Av. Los Alamos 123"
              data-testid="boleta-direccion"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Distrito *</label>
            <input
              value={form.distrito}
              onChange={(e) => setForm(f => ({ ...f, distrito: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
              placeholder="San Isidro"
              data-testid="boleta-distrito"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Provincia *</label>
            <input
              value={form.provincia}
              onChange={(e) => setForm(f => ({ ...f, provincia: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
              placeholder="Lima"
              data-testid="boleta-provincia"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Departamento *</label>
            <input
              value={form.departamento}
              onChange={(e) => setForm(f => ({ ...f, departamento: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
              placeholder="Lima"
              data-testid="boleta-departamento"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> Teléfono</span>
            </label>
            <input
              value={form.telefono}
              onChange={(e) => setForm(f => ({ ...f, telefono: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
              placeholder="01-2345678"
              data-testid="boleta-telefono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</span>
            </label>
            <input
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none"
              placeholder="contacto@colegio.edu.pe"
              data-testid="boleta-email"
            />
          </div>

          {/* Pie de página */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Pie de Página (opcional)</label>
            <textarea
              value={form.pie_pagina}
              onChange={(e) => {
                if (e.target.value.length <= 200) setForm(f => ({ ...f, pie_pagina: e.target.value }));
              }}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none resize-none"
              placeholder="Texto opcional al pie del comprobante"
              data-testid="boleta-pie-pagina"
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{form.pie_pagina?.length || 0}/200</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50"
            data-testid="boleta-config-save-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Guardando..." : "Guardar Configuración"}
          </button>
        </div>
      </div>
    </div>
  );
}
