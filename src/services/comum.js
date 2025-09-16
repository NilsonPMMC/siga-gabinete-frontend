// Arquivo: src/services/comum.js
import apiClient from '../api';

export const getContas = () => {
  return apiClient.get('/api/contas/');
};

// ADICIONE ESTA NOVA FUNÇÃO AO ARQUIVO
/**
 * Busca a lista paginada de munícipes (contatos).
 * @param {object} params - Parâmetros de busca e paginação. Ex: { search: 'texto' }
 * @returns {Promise<AxiosResponse<any>>}
 */
export const getMunicipesPaginado = (params) => {
  return apiClient.get('/api/municipes/', { params });
};