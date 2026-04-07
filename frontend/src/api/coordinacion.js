import axios from "axios";
const API = process.env.REACT_APP_BACKEND_URL + "/api/coordinacion";

const authHeaders = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const coordinacionApi = {
  // Enums
  getEnums: (token) => axios.get(`${API}/enums`, authHeaders(token)).then(r => r.data),

  // Dashboard
  getDashboard: (token) => axios.get(`${API}/dashboard`, authHeaders(token)).then(r => r.data),

  // Incidencias
  listIncidencias: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return axios.get(`${API}/incidencias?${qs}`, authHeaders(token)).then(r => r.data);
  },
  getIncidencia: (token, id) => axios.get(`${API}/incidencias/${id}`, authHeaders(token)).then(r => r.data),
  createIncidencia: (token, data) => axios.post(`${API}/incidencias`, data, authHeaders(token)).then(r => r.data),
  updateIncidencia: (token, id, data) => axios.patch(`${API}/incidencias/${id}`, data, authHeaders(token)).then(r => r.data),
  deleteIncidencia: (token, id) => axios.delete(`${API}/incidencias/${id}`, authHeaders(token)).then(r => r.data),

  // Seguimientos
  listSeguimientos: (token, incidenciaId) =>
    axios.get(`${API}/incidencias/${incidenciaId}/seguimientos`, authHeaders(token)).then(r => r.data),
  createSeguimiento: (token, incidenciaId, data) =>
    axios.post(`${API}/incidencias/${incidenciaId}/seguimientos`, data, authHeaders(token)).then(r => r.data),

  // Derivaciones
  listDerivaciones: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return axios.get(`${API}/derivaciones?${qs}`, authHeaders(token)).then(r => r.data);
  },
  getDerivacion: (token, id) => axios.get(`${API}/derivaciones/${id}`, authHeaders(token)).then(r => r.data),
  createDerivacion: (token, data) => axios.post(`${API}/derivaciones`, data, authHeaders(token)).then(r => r.data),
  updateDerivacion: (token, id, data) => axios.patch(`${API}/derivaciones/${id}`, data, authHeaders(token)).then(r => r.data),
  getDerivacionNotifications: (token) => axios.get(`${API}/derivaciones/notifications`, authHeaders(token)).then(r => r.data),
  getStaffByArea: (token, area) => axios.get(`${API}/staff/${area}`, authHeaders(token)).then(r => r.data),

  // Reuniones
  listReuniones: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return axios.get(`${API}/reuniones?${qs}`, authHeaders(token)).then(r => r.data);
  },
  getReunion: (token, id) => axios.get(`${API}/reuniones/${id}`, authHeaders(token)).then(r => r.data),
  createReunion: (token, data) => axios.post(`${API}/reuniones`, data, authHeaders(token)).then(r => r.data),
  updateReunion: (token, id, data) => axios.patch(`${API}/reuniones/${id}`, data, authHeaders(token)).then(r => r.data),
  getStudentParents: (token, studentId) => axios.get(`${API}/parents/${studentId}`, authHeaders(token)).then(r => r.data),

  // Ficha estudiante
  getStudentFicha: (token, studentId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return axios.get(`${API}/estudiante/${studentId}/ficha?${qs}`, authHeaders(token)).then(r => r.data);
  },

  // Agenda
  getAgenda: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return axios.get(`${API}/agenda?${qs}`, authHeaders(token)).then(r => r.data);
  },

  // Parent endpoints
  parentGetStudents: (token) => axios.get(`${API}/parent/students`, authHeaders(token)).then(r => r.data),
  parentGetIncidencias: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return axios.get(`${API}/parent/incidencias?${qs}`, authHeaders(token)).then(r => r.data);
  },
  parentGetReuniones: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return axios.get(`${API}/parent/reuniones?${qs}`, authHeaders(token)).then(r => r.data);
  },
  parentConfirmReunion: (token, reunionId) => axios.post(`${API}/parent/reuniones/${reunionId}/confirm`, {}, authHeaders(token)).then(r => r.data),

  // Student endpoints
  studentGetCompromisos: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return axios.get(`${API}/student/compromisos?${qs}`, authHeaders(token)).then(r => r.data);
  },
};
