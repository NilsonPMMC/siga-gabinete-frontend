// Arquivo: src/services/comum.js
import apiClient from '../api';

export const getContas = () => {
  return apiClient.get('/api/contas/');
};

/**
 * Formata perfis do munícipe (múltiplos cargos/órgãos) para exibição em uma única string.
 * @param {Array<{cargo?: string, instituicao?: string}>} perfis - Lista de perfis do munícipe
 * @param {string} [cargoLegado] - Cargo legado (fallback quando não há perfis)
 * @param {string} [orgaoLegado] - Órgão legado (fallback quando não há perfis)
 * @returns {string}
 */
export function formatarPerfis(perfis, cargoLegado = '', orgaoLegado = '') {
  if (perfis && Array.isArray(perfis) && perfis.length > 0) {
    const partes = perfis
      .filter((p) => p && (p.cargo || p.instituicao))
      .map((p) => {
        const cargo = (p.cargo || '').trim();
        const inst = (p.instituicao || '').trim();
        if (cargo && inst) return `${cargo} @ ${inst}`;
        return cargo || inst;
      });
    if (partes.length) return partes.join('; ');
  }
  if (cargoLegado || orgaoLegado) {
    const c = (cargoLegado || '').trim();
    const o = (orgaoLegado || '').trim();
    if (c && o) return `${c} @ ${o}`;
    return c || o || '';
  }
  return '';
}

// ADICIONE ESTA NOVA FUNÇÃO AO ARQUIVO
/**
 * Busca a lista paginada de munícipes (contatos).
 * @param {object} params - Parâmetros de busca e paginação. Ex: { search: 'texto' }
 * @returns {Promise<AxiosResponse<any>>}
 */
export const getMunicipesPaginado = (params) => {
  return apiClient.get('/api/municipes/', { params });
};