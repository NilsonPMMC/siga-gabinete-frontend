<template>
    <Panel :header="titulo" :toggleable="toggleable" :collapsed="collapsed" class="mt-3">
        <DataTable
            :value="logs"
            :loading="loading"
            paginator
            :rows="rows"
            responsiveLayout="scroll"
            size="small"
            emptyMessage="Nenhum registro de auditoria encontrado."
        >
            <Column header="Data e Hora" style="width: 11rem">
                <template #body="{ data }">
                    {{ formatarTimestamp(data.timestamp) }}
                </template>
            </Column>
            <Column header="Usuário" style="width: 12rem">
                <template #body="{ data }">
                    {{ data.usuario_nome || 'Sistema' }}
                </template>
            </Column>
            <Column header="Ação" style="width: 16rem">
                <template #body="{ data }">
                    {{ data.acao_display || data.acao }}
                </template>
            </Column>
            <Column field="detalhes" header="Detalhes" />
        </DataTable>
    </Panel>
</template>

<script setup>
import { ref, watch } from 'vue';
import Panel from 'primevue/panel';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import contatosService from '@/services/contatos';
import { unwrapPaginatedResponse } from '@/utils/paginatedApi';

const props = defineProps({
    municipeId: { type: [Number, String], default: null },
    modo: { type: String, default: 'municipe' },
    titulo: { type: String, default: 'Auditoria de alterações' },
    toggleable: { type: Boolean, default: true },
    collapsed: { type: Boolean, default: false },
    rows: { type: Number, default: 10 },
    pageSize: { type: Number, default: 30 },
    refreshKey: { type: Number, default: 0 },
});

const logs = ref([]);
const loading = ref(false);

const formatarTimestamp = (valor) => {
    if (!valor) return '—';
    return new Date(valor).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const carregarLogs = async () => {
    loading.value = true;
    try {
        const params = { pageSize: props.pageSize };
        if (props.municipeId) {
            params.municipeId = props.municipeId;
        } else if (props.modo === 'recentes') {
            params.grupo = 'contatos';
        }
        const response = await contatosService.getCrmLogs(params);
        const { results } = unwrapPaginatedResponse(response);
        logs.value = results;
    } catch (err) {
        console.error('Erro ao carregar logs CRM:', err);
        logs.value = [];
    } finally {
        loading.value = false;
    }
};

watch(
    () => [props.municipeId, props.modo, props.refreshKey],
    () => { carregarLogs(); },
    { immediate: true },
);
</script>
