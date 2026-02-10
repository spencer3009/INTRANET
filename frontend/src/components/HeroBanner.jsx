export default function HeroBanner({ user, schoolName }) {
  const displayName = schoolName || user?.name || "tu Colegio";
  
  return (
    <div className="hero-banner" data-testid="hero-banner">
      <img
        src="https://socioscreativos.com/wp-content/uploads/2026/02/000372773w.jpg"
        alt={`Estudiantes de ${displayName}`}
        className="w-full h-full object-cover absolute inset-0"
        onError={(e) => { e.target.src = 'https://via.placeholder.com/900x300?text=Intranet+Escolar'; }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#001f4b]/80 via-[#001f4b]/50 to-transparent" />
      <div className="relative z-10 flex items-center h-full min-h-[240px] px-8 md:px-12">
        <div className="max-w-lg">
          <div className="inline-flex items-center gap-2 bg-[#e1b82c]/20 backdrop-blur-sm border border-[#e1b82c]/30 px-4 py-1.5 rounded-full mb-4">
            <span className="w-2 h-2 rounded-full bg-[#e1b82c]" />
            <span className="text-[#e1b82c] text-xs font-semibold uppercase tracking-wider">
              Portal Activo
            </span>
          </div>
          <h2
            className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-3"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Bienvenidos a la Intranet
          </h2>
          <p className="text-blue-100 text-sm md:text-base leading-relaxed max-w-md">
            Gestiona recursos, revisa calificaciones y mantente conectado con toda la comunidad académica de {displayName}.
          </p>
        </div>
      </div>
    </div>
  );
}
