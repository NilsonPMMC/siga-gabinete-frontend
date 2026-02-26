/**
 * Serviço para API de Atendimentos
 */
import apiClient from '@/api';

/**
 * Busca semântica de atendimentos via IA (vetorial)
 * @param {string} query - Texto de busca
 * @param {Object} filtros - Filtros opcionais: { conta_id }
 * @returns {Promise<Array>} Lista de atendimentos com score_match e snippet
 */
export const buscarComInteligencia = async (query, filtros = {}) => {
  const params = { q: query };
  if (filtros.conta_id) params.conta_id = filtros.conta_id;
  const response = await apiClient.get('/api/atendimentos/busca-ia/', { params });
  return response.data;
};
