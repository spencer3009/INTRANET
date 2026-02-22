import { GraduationCap } from "lucide-react";

export default function TeacherFooter({ settings, schoolName }) {
  return (
    <footer className="mt-10 bg-[#001f4b] rounded-xl p-8 text-white" data-testid="teacher-footer">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            {settings?.logo_url ? (
              <img
                src={settings.logo_url}
                alt="Logo"
                className="h-10 w-auto object-contain"
              />
            ) : (
              <div className="h-10 w-10 bg-[#e1b82c] rounded-lg flex items-center justify-center">
                <span className="text-[#001f4b] font-bold text-lg">
                  {schoolName?.charAt(0) || "E"}
                </span>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold tracking-widest text-white/60 uppercase">Intranet</p>
              <p className="text-sm font-extrabold tracking-wide" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {schoolName || "Mi Colegio"}
              </p>
            </div>
          </div>
          <p className="text-xs text-white/50 leading-relaxed max-w-xs">
            Sistema de gestión educativa integral. Potenciado por EduNet.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#e1b82c] mb-3">Contacto</h4>
          <div className="space-y-2 text-xs text-white/60">
            {settings?.system_email && <p>{settings.system_email}</p>}
            {settings?.whatsapp && <p>WhatsApp: {settings.whatsapp}</p>}
            {settings?.website_url && (
              <a href={settings.website_url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors block">
                {settings.website_url}
              </a>
            )}
            {!settings?.system_email && !settings?.whatsapp && !settings?.website_url && (
              <p className="text-white/40 italic">Sin información de contacto</p>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#e1b82c] mb-3">Enlaces</h4>
          <div className="space-y-2 text-xs text-white/60">
            <p className="hover:text-white cursor-pointer transition-colors">Portal de Padres</p>
            <p className="hover:text-white cursor-pointer transition-colors">Reglamento Interno</p>
            <p className="hover:text-white cursor-pointer transition-colors">Política de Privacidad</p>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-[11px] text-white/40">{schoolName || "Mi Colegio"} &copy; {new Date().getFullYear()} — Todos los derechos reservados</p>
        <p className="text-[11px] text-white/40">Powered by EduNet</p>
      </div>
    </footer>
  );
}
