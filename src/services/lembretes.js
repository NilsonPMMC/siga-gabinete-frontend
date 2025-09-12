// Arquivo: src/services/lembretes.js
import apiClient from '../api';

export const getLembretes = (params) => {
  return apiClient.get('/api/lembretes/', { params });
};

export const createLembrete = (lembreteData) => {
  return apiClient.post('/api/lembretes/', lembreteData);
};

export const getLembreteById = (id) => {
  return apiClient.get(`/api/lembretes/${id}/`);
};

export const updateLembrete = (id, lembreteData) => {
  return apiClient.put(`/api/lembretes/${id}/`, lembreteData);
};

export const deleteLembrete = (id) => {
  return apiClient.delete(`/api/lembretes/${id}/`);
};

/**
 * Gera o relatório de lembretes em PDF.
 * @param {object} params - Parâmetros de filtro (data_inicio, data_fim).
 * @returns {Promise} A promessa com o arquivo PDF em formato blob.
 */
export const gerarPdfLembretes = (params) => {
  return apiClient.get('/api/relatorios/lembretes/pdf/', { 
    params,
    responseType: 'blob' // MUITO IMPORTANTE: para o navegador tratar como um arquivo
  });
};