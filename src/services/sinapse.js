/**
 * Serviço para integração com API Sinapse
 * Busca estrutura organizacional (secretarias, órgãos, etc)
 */
import apiClient from '@/api';

/**
 * Busca lista de secretarias/órgãos da API Sinapse
 * @returns {Promise<Array>} Lista de secretarias
 */
export const buscarSecretarias = async () => {
  try {
    const response = await apiClient.get('/api/sinapse/secretarias/');
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar secretarias da Sinapse:', error);
    throw error;
  }
};

/**
 * Formata secretarias para uso em dropdown
 * @param {Array} secretarias - Lista de secretarias da API
 * @returns {Array} Lista formatada para dropdown
 */
export const formatarSecretariasParaDropdown = (secretarias) => {
  return secretarias.map(sec => ({
    label: `${sec.nome}${sec.sigla ? ` (${sec.sigla})` : ''}`,
    value: sec.id,
    nome: sec.nome,
    sigla: sec.sigla || '',
    tipo: sec.tipo || 'Secretaria',
    sinapse_id: sec.id
  }));
};
