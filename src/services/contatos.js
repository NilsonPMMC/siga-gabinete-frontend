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
  exportarRelatorioCategoriasCsv(categoriaIds = []) {
    const params = new URLSearchParams();
    (categoriaIds || []).forEach((id) => params.append('categoria_id', id));
    return apiClient.get('/api/contatos/categorias/relatorio/csv/', {
      params,
      responseType: 'blob',
    });
  },
  exportarRelatorioCategoriasPdf(categoriaIds = []) {
    const params = new URLSearchParams();
    (categoriaIds || []).forEach((id) => params.append('categoria_id', id));
    return apiClient.get('/api/contatos/categorias/relatorio/pdf/', {
      params,
      responseType: 'blob',
    });
  },
  async buscarComInteligencia(query) {
    const response = await apiClient.get('/api/municipes/busca-ia/', { params: { q: query } });
    return response.data;
  },
  async solicitarEnriquecimentoIA(contatoId) {
    const response = await apiClient.post(`/api/contatos/${contatoId}/enrich/`);
    return response.data;
  },
  async aplicarEnriquecimentoIA(contatoId, enrichedData, applyFields = {}, profileOptions = {}) {
    const response = await apiClient.post(`/api/contatos/${contatoId}/enrich/apply/`, {
      enriched_data: enrichedData,
      apply_fields: applyFields,
      ...profileOptions,
    });
    return response.data;
  },
};