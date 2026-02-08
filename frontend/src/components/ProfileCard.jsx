export default function ProfileCard({ user }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center" data-testid="profile-card">
      <div className="relative w-20 h-20 mx-auto mb-3">
        <img
          src={user?.avatar || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200"}
          alt={user?.name || "Usuario"}
          className="w-full h-full object-cover rounded-full border-3 border-white shadow-md"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/80?text=U'; }}
        />
        <div className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full" />
      </div>

      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
        {user?.role || "Administrador"}
      </p>
      <h4 className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
        {user?.name || "Admin"}
      </h4>
      <p className="text-xs text-slate-500 mt-1">{user?.email || ""}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>12</p>
          <p className="text-[11px] text-slate-500">Cursos</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>456</p>
          <p className="text-[11px] text-slate-500">Alumnos</p>
        </div>
      </div>
    </div>
  );
}
