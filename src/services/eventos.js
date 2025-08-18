// src/services/eventos.js

// AJUSTE FINAL: O caminho correto para sair da pasta 'services' e encontrar 'api.js'
import apiClient from '../api'; // Usamos '../api' e o nome da variável 'apiClient'

// O resto do arquivo permanece o mesmo, apenas trocando 'api' por 'apiClient'
export default {
    // --- Eventos ---
    getEventos() {
        return apiClient.get('/api/eventos/');
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

    deleteConvidado(convidadoId) {
        return apiClient.delete(`/api/convidados/${convidadoId}/`);
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
    getDestinatarios(comunicacaoId) {
        return apiClient.get(`/api/destinatarios/?comunicacao=${comunicacaoId}`);
    },
    
    addDestinatario(payload) {
        return apiClient.post('/api/destinatarios/', payload);
    },

    deleteDestinatario(destinatarioId) {
        return apiClient.delete(`/api/destinatarios/${destinatarioId}/`);
    },

    addDestinatariosPorCategoria(comunicacaoId, categoriaId) {
        // AJUSTE: A URL agora é na rota de 'comunicacoes'
        return apiClient.post(`/api/comunicacoes/${comunicacaoId}/adicionar-por-categoria/`, { categoria_id: categoriaId });
    },
    getLogsDeEnvio(comunicacaoId) {
        return apiClient.get(`/api/logs-de-envio/?comunicacao=${comunicacaoId}`);
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
        // Assume que o checklist é 1-para-1 com o evento
        return apiClient.get(`/api/checklists/?evento=${eventoId}`);
    },
    getPublicChecklist(token) {
        return apiClient.get(`/api/public/checklist/${token}/`);
    },
    submitChecklist(token, data) {
        return apiClient.post(`/api/public/checklist/${token}/`, data);
    },
};