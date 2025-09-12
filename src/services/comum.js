// Arquivo: src/services/comum.js
import apiClient from '../api';

export const getContas = () => {
  return apiClient.get('/api/contas/');
};