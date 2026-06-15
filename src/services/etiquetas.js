// src/services/etiquetas.js

import api from '../api'; // apiClient é importado como 'api' aqui

/**
 * Busca todos os modelos de etiqueta disponíveis.
 * @returns {Promise<AxiosResponse<any>>}
 */
export const fetchEtiquetaTemplates = () => {
  // CORREÇÃO AQUI
  return api.get('/api/templates/');
};

/**
 * Envia os dados para a API para gerar o HTML das etiquetas.
 * @param {object} payload - Os dados para a geração.
 * @param {number} payload.template_id - O ID do modelo de etiqueta escolhido.
 * @param {number} payload.posicao_inicial - A posição de início da impressão.
 * @param {Array<object>} payload.contatos - A lista de contatos com os dados personalizados.
 * @returns {Promise<AxiosResponse<any>>}
 */
export const gerarEtiquetas = (payload) => {
  // CORREÇÃO AQUI
  return api.post('/api/gerar/', payload, {
    // É crucial definir o responseType como 'text' para receber HTML
    responseType: 'text',
  });
};

/**
 * Importa CSV para atualizar dados de etiqueta por ID.
 * Campos esperados no CSV: id, dados de etiqueta (ou dados_etiqueta)
 */
export const importarDadosEtiquetaCSV = (formData, dryRun = false) => {
  if (dryRun) {
    formData.append('dry_run', 'true');
  }
  return api.post('/api/importar-dados-etiqueta-csv/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};