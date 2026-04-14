import { useState, useEffect } from "react";
import axios from "axios";
import { Shield, Search, X, Plus, Loader2, UserCog } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const ROLE_LABELS = {
  auxiliar_alimentacion: "Aux. Alimentacion",
  auxiliar_movilidad: "Aux. Movilidad",
  auxiliar_asistencia: "Aux. Asistencia",
};
const ROLE_COLORS = {
  auxiliar_alimentacion: "bg-orange-100 text-orange-700 border-orange-200",
  auxiliar_movilidad: "bg-purple-100 text-purple-700 border-purple-200",
  auxiliar_asistencia: "bg-blue-100 text-blue-700 border-blue-200",
};
const PRIMARY_ROLE_LABELS = {
  teacher: "Profesor", admin: "Administrador", coordinator: "Coordinador",
  psicologo: "Psicologo", auxiliar: "Auxiliar", director: "Director",
};

export default function AdditionalRolesManager({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [modalUser, setModalUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (roleFilter) params.role_filter = roleFilter;
      if (search) params.search = search;
      const res = await axios.get(`${API}/api/role-assignment/eligible-users`, { headers, params });
      setUsers(res.data.users || []);
    } catch (err) {
      console.error("Error loading users:", err);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, [roleFilter]);

  const filteredUsers = search
    ? users.filter(u => `${u.name} ${u.last_name} ${u.dni || ""}`.toLowerCase().includes(search.toLowerCase()))
    : users;

  const uniqueRoles = [...new Set(users.map(u => u.role))].sort();

  const openModal = (user) => {
    setModalUser(user);
    setSelectedRoles([...(user.additional_roles || [])]);
  };

  const handleSave = async () => {
    if (!modalUser) return;
    setSaving(true);
    try {
      const current = modalUser.additional_roles || [];
      const toAdd = selectedRoles.filter(r => !current.includes(r));
      const toRemove = current.filter(r => !selectedRoles.includes(r));
      for (const r of toAdd) {
        await axios.post(`${API}/api/users/${modalUser.id}/additional-roles`, { role: r }, { headers });
      }
      for (const r of toRemove) {
        await axios.delete(`${API}/api/users/${modalUser.id}/additional-roles/${r}`, { headers });
      }
      await loadUsers();
      setModalUser(null);
    } catch (err) {
      alert("Error al guardar roles: " + (err.response?.data?.detail || err.message));
    } finally { setSaving(false); }
  };

  const handleRevoke = async (userId, role) => {
    if (!confirm(`Revocar el rol ${ROLE_LABELS[role]} de este usuario? Perdera acceso al portal correspondiente.`)) return;
    try {
      await axios.delete(`${API}/api/users/${userId}/additional-roles/${role}`, { headers });
      await loadUsers();
    } catch (err) {
      alert("Error al revocar: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div data-testid="additional-roles-manager">
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" placeholder="Buscar por nombre o DNI..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:outline-none"
            data-testid="roles-search"
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-200 focus:outline-none"
          data-testid="roles-role-filter">
          <option value="">Todos los roles</option>
          {uniqueRoles.map(r => <option key={r} value={r}>{PRIMARY_ROLE_LABELS[r] || r}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400">No se encontraron usuarios elegibles</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Usuario</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Rol principal</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-slate-500">Roles auxiliares</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-slate-500">Accion</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      {u.photo_url ? (
                        <img src={u.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                          {(u.name || "?")[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-800 text-xs">{u.name} {u.last_name}</p>
                        {u.dni && <p className="text-[10px] text-slate-400">DNI: {u.dni}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                      {PRIMARY_ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex flex-wrap gap-1">
                      {(u.additional_roles || []).length === 0 && (
                        <span className="text-[10px] text-slate-300 italic">Sin roles auxiliares</span>
                      )}
                      {(u.additional_roles || []).map(r => (
                        <span key={r} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${ROLE_COLORS[r] || "bg-slate-100 text-slate-600"}`}>
                          {ROLE_LABELS[r] || r}
                          <button onClick={() => handleRevoke(u.id, r)} className="hover:text-red-600 transition-colors" title="Revocar">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <button onClick={() => openModal(u)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                      data-testid={`assign-btn-${u.id}`}>
                      <Plus className="w-3 h-3" /> Asignar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assignment modal */}
      {modalUser && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[300]" onClick={() => setModalUser(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 z-[310] w-full max-w-sm" data-testid="assign-modal">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Asignar roles auxiliares</h3>
            <p className="text-sm text-slate-500 mb-4">{modalUser.name} {modalUser.last_name} ({PRIMARY_ROLE_LABELS[modalUser.role] || modalUser.role})</p>
            <div className="space-y-2 mb-5">
              {Object.entries(ROLE_LABELS).map(([roleId, label]) => (
                <label key={roleId} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(roleId)}
                    onChange={e => {
                      if (e.target.checked) setSelectedRoles([...selectedRoles, roleId]);
                      else setSelectedRoles(selectedRoles.filter(r => r !== roleId));
                    }}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{label}</p>
                    <p className="text-[10px] text-slate-400">{roleId === "auxiliar_alimentacion" ? "Portal de Alimentacion" : roleId === "auxiliar_movilidad" ? "Portal de Movilidad" : "Portal de Asistencia"}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalUser(null)} className="flex-1 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
