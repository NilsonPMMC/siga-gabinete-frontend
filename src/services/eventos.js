// src/services/eventos.js

// AJUSTE FINAL: O caminho correto para sair da pasta 'services' e encontrar 'api.js'
import apiClient from '../api'; // Usamos '../api' e o nome da variável 'apiClient'

// O resto do arquivo permanece o mesmo, apenas trocando 'api' por 'apiClient'
export default {
    // --- Eventos ---
    getEventos(params = {}) {
        return apiClient.get('/api/eventos/', { params });
    },

    getEvento(id) {
        return apiClient.get(`/api/eventos/${id}/`);
    },

    createEvento(eventoData) {
        const formData = new FormData();
        for (const key in eventoData) {
            if (eventoData[key] !== null && eventoData[key] !== undefined) {
                if (key === 'data_evento' && eventoData[key] instanceof Date) {
                    formData.append(key, eventoData[key].toISOString());
                } else if (key === 'arte_convite' && eventoData[key] instanceof File) {
                    formData.append(key, eventoData[key]);
                } else if (typeof eventoData[key] !== 'object' || eventoData[key] === null) {
                    formData.append(key, eventoData[key]);
                }
            }
        }
        return apiClient.post('/api/eventos/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    updateEvento(id, eventoData) {
        const formData = new FormData();
        for (const key in eventoData) {
            if (eventoData[key] !== null && eventoData[key] !== undefined) {
                if (key === 'data_evento' && eventoData[key] instanceof Date) {
                    formData.append(key, eventoData[key].toISOString());
                } else if (key === 'arte_convite' && eventoData[key] instanceof File) {
                    formData.append(key, eventoData[key]);
                } else if (typeof eventoData[key] !== 'object' || eventoData[key] === null) {
                    formData.append(key, eventoData[key]);
                }
            }
        }
        return apiClient.put(`/api/eventos/${id}/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    deleteEvento(id) {
        return apiClient.delete(`/api/eventos/${id}/`);
    },

    getConvidados(eventoId) {
        return apiClient.get(`/api/convidados/?evento=${eventoId}`);
    },
    
    addConvidado(payload) {
        return apiClient.post('/api/convidados/', payload);
    },
    updateConvidadoStatus(convidadoId, novoStatus) {
        return apiClient.post(`/api/convidados/${convidadoId}/update-status/`, { status: novoStatus });
    },
    deleteConvidado(convidadoId) {
        return apiClient.delete(`/api/convidados/${convidadoId}/`);
    },
    reorderConvidados(eventoId, orderedIds) {
        return apiClient.post(`/api/convidados/reorder/?evento=${eventoId}`, { ordered_ids: orderedIds });
    },
    getConvidadosPresentesReport(eventoId) {
        return apiClient.get(`/api/eventos/${eventoId}/relatorio-convidados-presentes/`, {
            responseType: 'blob',
        });
    },
    getCrachasReport(eventoId, convidadoIds) {
        return apiClient.post(`/api/eventos/${eventoId}/relatorio-crachas/`, { convidado_ids: convidadoIds }, {
            responseType: 'blob',
        });
    },
    getPrismasReport(eventoId, convidadoIds) {
        return apiClient.post(`/api/eventos/${eventoId}/relatorio-prismas/`, { convidado_ids: convidadoIds }, {
            responseType: 'blob',
        });
    },
    searchMunicipes(query) {
        return apiClient.get(`/api/municipes/lookup/?q=${query}`);
    },
    createMunicipe(municipeData) {
        return apiClient.post('/api/municipes/', municipeData);
    },
    getCategorias() {
        return apiClient.get('/api/contatos/categorias/');
    },

    addConvidadosPorCategoria(eventoId, categoriaId) {
        return apiClient.post(`/api/eventos/${eventoId}/adicionar-por-categoria/`, { categoria_id: categoriaId });
    },
    getComunicacoes(eventoId) {
        return apiClient.get(`/api/comunicacoes/?evento=${eventoId}`);
    },

    getComunicacao(id) {
        return apiClient.get(`/api/comunicacoes/${id}/`);
    },
        
    createComunicacao(comunicacaoData) {
        const formData = new FormData();
        for (const key in comunicacaoData) {
            if (comunicacaoData[key] !== null && comunicacaoData[key] !== undefined) {
                formData.append(key, comunicacaoData[key]);
            }
        }
        return apiClient.post('/api/comunicacoes/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    updateComunicacao(id, comunicacaoData) {
        const formData = new FormData();
        
        for (const key in comunicacaoData) {
            const value = comunicacaoData[key];
            
            if (value === null || value === undefined) continue;

            if (key === 'arte' || key === 'anexo') {
                if (value instanceof File) {
                    formData.append(key, value);
                }
            } else if (typeof value === 'object' && !(value instanceof File)) {
            }
            else {
                formData.append(key, value);
            }
        }
        
        return apiClient.patch(`/api/comunicacoes/${id}/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    deleteComunicacao(id) {
        return apiClient.delete(`/api/comunicacoes/${id}/`);
    },
    enviarComunicacao(comunicacaoId) {
        // Aponta para a ação customizada 'enviar' que criamos no backend
        return apiClient.post(`/api/comunicacoes/${comunicacaoId}/enviar/`);
    },
    getDestinatarios(comunicacaoId, params = {}) {
        return apiClient.get('/api/destinatarios/', {
            params: { comunicacao: comunicacaoId, ...params },
        });
    },
    
    addDestinatario(payload) {
        return apiClient.post('/api/destinatarios/', payload);
    },

    deleteDestinatario(destinatarioId) {
        return apiClient.delete(`/api/destinatarios/${destinatarioId}/`);
    },

    addDestinatariosPorCategoria(comunicacaoId, categoriaId) {
        return apiClient.post(`/api/comunicacoes/${comunicacaoId}/adicionar-por-categoria/`, { categoria_id: categoriaId });
    },
    addDestinatariosPorCategorias(comunicacaoId, categoriaIds) {
        return apiClient.post(`/api/comunicacoes/${comunicacaoId}/adicionar-por-categoria/`, { categoria_ids: categoriaIds });
    },
    getMailingLists() {
        return apiClient.get('/api/mailing-lists/');
    },
    addDestinatariosPorMailingList(comunicacaoId, mailingListId) {
        return apiClient.post(`/api/comunicacoes/${comunicacaoId}/adicionar-por-mailing-list/`, { mailing_list_id: mailingListId });
    },
    addDestinatariosPorMailingLists(comunicacaoId, mailingListIds) {
        return apiClient.post(`/api/comunicacoes/${comunicacaoId}/adicionar-por-mailing-list/`, { mailing_list_ids: mailingListIds });
    },
    getLogsDeEnvio(comunicacaoId, params = {}) {
        return apiClient.get('/api/logs-de-envio/', {
            params: { comunicacao: comunicacaoId, ...params },
        });
    },
    getResumoLogsDeEnvio(comunicacaoId) {
        return apiClient.get(`/api/logs-de-envio/resumo/?comunicacao=${comunicacaoId}`);
    },
    getRelatorioComunicacaoPdf(comunicacaoId) {
        return apiClient.get(`/api/comunicacoes/${comunicacaoId}/relatorio-pdf/`, {
            responseType: 'blob',
        });
    },
    getListaDePresenca(eventoId) {
        return apiClient.get(`/api/lista-presenca/?evento=${eventoId}`);
    },
    
    exportarListaDePresenca(eventoId, filtro) {
        // A API de exportação ainda não suporta o filtro de texto, mas a estrutura está pronta
        return apiClient.get(`/api/lista-presenca/exportar-excel/?evento=${eventoId}`, {
            responseType: 'blob', // Essencial para o download de arquivos
        });
    },
    getChecklist(eventoId) {
        return apiClient.get(`/api/checklists/?evento=${eventoId}`);
    },
    getMasterChecklistItems() {
        return apiClient.get('/api/master-checklist-items/');
    },
    createMasterChecklistItem(itemData) {
        return apiClient.post('/api/master-checklist-items/', itemData);
    },
    updateMasterChecklistItem(itemId, itemData) {
        return apiClient.put(`/api/master-checklist-items/${itemId}/`, itemData);
    },
    deleteMasterChecklistItem(itemId) {
        return apiClient.delete(`/api/master-checklist-items/${itemId}/`);
    },
    addChecklistItem(itemData) {
        return apiClient.post('/api/checklist-items/', itemData);
    },
    updateChecklistItem(itemId, itemData) {
        return apiClient.patch(`/api/checklist-items/${itemId}/`, itemData);
    },
    deleteChecklistItem(itemId) {
        return apiClient.delete(`/api/checklist-items/${itemId}/`);
    },
    getChecklistReport(checklistId) {
        return apiClient.get(`/api/checklists/${checklistId}/gerar-relatorio/`, {
            responseType: 'blob',
        });
    },
    renewChecklistToken(checklistId) {
        return apiClient.post(`/api/checklists/${checklistId}/renovar-token/`);
    },
    getEventosReport(data_inicio, data_fim) {
        // Formata as datas para o formato AAAA-MM-DD
        const params = {
            data_inicio: data_inicio.toISOString().split('T')[0],
            data_fim: data_fim.toISOString().split('T')[0]
        };
        return apiClient.get('/api/eventos/gerar-relatorio-periodo/', {
            params: params,
            responseType: 'blob', // Essencial para download
        });
    },
    getPublicChecklist(token) {
        return apiClient.get(`/api/public/checklist/${token}/`);
    },
    submitChecklist(token, data) {
        return apiClient.post(`/api/public/checklist/${token}/`, data);
    },
    getMailingListDetail(id) {
        return apiClient.get(`/api/mailing-lists/${id}/`);
    },
    createMailingList(data) {
        return apiClient.post('/api/mailing-lists/', data);
    },
    updateMailingList(id, data) {
        return apiClient.put(`/api/mailing-lists/${id}/`, data);
    },
    deleteMailingList(id) {
        return apiClient.delete(`/api/mailing-lists/${id}/`);
    },
    getMunicipesOfMailingList(id) {
        return apiClient.get(`/api/mailing-lists/${id}/municipes/`);
    },
    addMunicipeToMailingList(listId, municipeId) {
        return apiClient.post(`/api/mailing-lists/${listId}/add-municipe/`, { municipe_id: municipeId });
    },
    removeMunicipeFromMailingList(listId, municipeId) {
        return apiClient.post(`/api/mailing-lists/${listId}/remove-municipe/`, { municipe_id: municipeId });
    },
    addMunicipesToMailingListByCategory(listId, categoryId) {
        return apiClient.post(`/api/mailing-lists/${listId}/add-by-category/`, { categoria_id: categoryId });
    },
};