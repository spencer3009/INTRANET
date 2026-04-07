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
};
