import { Crown, Shield, User } from "lucide-react";

// Default avatar component with initials
function DefaultAvatar({ name, size = "w-20 h-20", textSize = "text-2xl" }) {
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };
  
  return (
    <div className={`${size} rounded-full bg-gradient-to-br from-[#001f4b] to-[#003366] flex items-center justify-center text-white font-bold ${textSize} border-3 border-white shadow-md`}>
      {getInitials(name)}
    </div>
  );
}

// Get display role in Spanish
function getRoleDisplay(role, isOwner, isSuperAdmin) {
  if (isOwner) return "PROPIETARIO";
  if (isSuperAdmin) return "SUPER ADMIN";
  const roles = {
    director: "DIRECTOR",
    admin: "ADMINISTRADOR",
    teacher: "PROFESOR",
    student: "ALUMNO",
    parent: "PADRE"
  };
  return roles[role]?.toUpperCase() || role?.toUpperCase() || "USUARIO";
}

// Get role badge colors
function getRoleBadgeColors(role, isOwner, isSuperAdmin) {
  if (isOwner) return "bg-amber-100 text-amber-700 border-amber-200";
  if (isSuperAdmin) return "bg-purple-100 text-purple-700 border-purple-200";
  const colors = {
    director: "bg-indigo-100 text-indigo-700 border-indigo-200",
    admin: "bg-blue-100 text-blue-700 border-blue-200",
    teacher: "bg-emerald-100 text-emerald-700 border-emerald-200",
    student: "bg-cyan-100 text-cyan-700 border-cyan-200",
    parent: "bg-orange-100 text-orange-700 border-orange-200"
  };
  return colors[role] || "bg-slate-100 text-slate-600 border-slate-200";
}

export default function ProfileCard({ user }) {
  const userPhoto = user?.photo_url;
  const userName = user?.name || "Usuario";
  const userEmail = user?.email || "";
  const roleDisplay = getRoleDisplay(user?.role, user?.is_owner, user?.is_super_admin);
  const badgeColors = getRoleBadgeColors(user?.role, user?.is_owner, user?.is_super_admin);
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center" data-testid="profile-card">
      <div className="relative w-20 h-20 mx-auto mb-3">
        {userPhoto ? (
          <>
            <img
              src={userPhoto}
              alt={userName}
              className="w-full h-full object-cover rounded-full border-3 border-white shadow-md"
              onError={(e) => { 
                e.target.style.display = 'none';
                e.target.nextSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden">
              <DefaultAvatar name={userName} />
            </div>
          </>
        ) : (
          <DefaultAvatar name={userName} />
        )}
        <div className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full" title="En línea" />
      </div>

      {/* Role Badge */}
      <div className="mb-2 flex justify-center">
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${badgeColors}`}>
          {user?.is_owner && <Crown className="w-3 h-3" />}
          {user?.is_super_admin && !user?.is_owner && <Shield className="w-3 h-3" />}
          {roleDisplay}
        </span>
      </div>
      
      <h4 className="text-lg font-bold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
        {userName}
      </h4>
      <p className="text-xs text-slate-500 mt-1">{userEmail}</p>
      {user?.username && (
        <p className="text-[10px] text-slate-400 mt-0.5">@{user.username}</p>
      )}

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
