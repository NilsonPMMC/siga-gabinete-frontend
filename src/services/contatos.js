// src/services/contatos.js
import apiClient from '@/api';

export default {
  getCategorias() {
    return apiClient.get('/api/contatos/categorias/');
  },
  createCategoria(data) {
    return apiClient.post('/api/contatos/categorias/', data);
  },
  updateCategoria(id, data) {
    return apiClient.put(`/api/contatos/categorias/${id}/`, data);
  },
  deleteCategoria(id) {
    return apiClient.delete(`/api/contatos/categorias/${id}/`);
  },
  async buscarComInteligencia(query) {
    const response = await apiClient.get('/api/municipes/busca-ia/', { params: { q: query } });
    return response.data;
  }
};