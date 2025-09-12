import apiClient from '../api';

/**
 * Busca a lista de ofícios da API, com suporte para filtros.
 * @param {object} params - Parâmetros de filtro (ex: { data_inicio: 'YYYY-MM-DD', assunto: '...' }).
 * @returns {Promise} A promessa da resposta da API com a lista de ofícios.
 */
export const getOficios = (params) => {
  return apiClient.get('/api/oficios/', { params });
};

/**
 * Busca os detalhes de um ofício específico pelo ID.
 * @param {number} id - O ID do ofício.
 * @returns {Promise} A promessa da resposta da API com os dados do ofício.
 */
export const getOficio = (id) => {
  return apiClient.get(`/api/oficios/${id}/`);
};

/**
 * Cria um novo ofício.
 * @param {object} oficioData - Os dados do ofício a ser criado.
 * @returns {Promise} A promessa da resposta da API com o ofício criado.
 */
export const createOficio = (oficioData) => {
  return apiClient.post('/api/oficios/', oficioData);
};

/**
 * Atualiza um ofício existente.
 * @param {number} id - O ID do ofício a ser atualizado.
 * @param {object} oficioData - Os novos dados do ofício.
 * @returns {Promise} A promessa da resposta da API com o ofício atualizado.
 */
export const updateOficio = (id, oficioData) => {
  return apiClient.put(`/api/oficios/${id}/`, oficioData);
};

/**
 * Deleta um ofício.
 * @param {number} id - O ID do ofício a ser deletado.
 * @returns {Promise} A promessa da resposta da API.
 */
export const deleteOficio = (id) => {
  return apiClient.delete(`/api/oficios/${id}/`);
};

/**
 * Gera e baixa o relatório em PDF de um ofício específico.
 * @param {number} id - O ID do ofício.
 * @returns {Promise} A promessa com o arquivo PDF em formato blob.
 */
export const gerarPdfOficio = (id) => {
  return apiClient.get(`/api/oficios/${id}/pdf/`, { 
    responseType: 'blob' // Essencial para o navegador tratar a resposta como um arquivo
  });
};

/**
 * Envia diretrizes para a IA para gerar ou aprimorar o corpo de um ofício.
 * @param {string} diretrizes - As instruções do usuário.
 * @param {string} texto_existente - (Opcional) O texto atual para ser aprimorado.
 * @returns {Promise} A promessa com o texto gerado pela IA.
 */
export const gerarTextoComIA = (diretrizes, texto_existente = '') => {
  return apiClient.post('/api/oficios/gerar-texto-ia/', { diretrizes, texto_existente });
};