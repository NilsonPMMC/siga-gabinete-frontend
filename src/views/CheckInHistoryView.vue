<script setup>
import { ref, onMounted, computed } from 'vue';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useAuthStore } from '@/stores/auth';

const toast = useToast();
const confirm = useConfirm();
const authStore = useAuthStore();

const visitas = ref([]);
const isLoading = ref(true);

// --- Estado para o diálogo de Edição/Criação ---
const dialogoVisivel = ref(false);
const visitaEmEdicao = ref({});
const isSaving = ref(false);
const municipesOptions = ref([]);
const contasOptions = ref([]);

// --- Estado para os filtros ---
const hoje = new Date();
const umMesAtras = new Date();
umMesAtras.setMonth(hoje.getMonth() - 1);
const filtroData = ref([umMesAtras, hoje]); // Filtro padrão para o último mês

const isGeneratingReport = ref(false);

const carregarVisitas = async () => {
    isLoading.value = true;
    try {
        const params = {};
        if (filtroData.value && filtroData.value[0] && filtroData.value[1]) {
            params.data_inicio = filtroData.value[0].toISOString().slice(0, 10);
            params.data_fim = filtroData.value[1].toISOString().slice(0, 10);
        }
        const response = await apiClient.get('/api/checkins/', { params });
        visitas.value = response.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os registros.' });
    } finally {
        isLoading.value = false;
    }
};

onMounted(async () => {
    if (!authStore.isAuthenticated) {
        isLoading.value = false;
        return;
    }
    isLoading.value = true;
    carregarVisitas();
    // Carrega a lista de contas para o dropdown de edição
    const contasRes = await apiClient.get('/api/contas/');
    contasOptions.value = contasRes.data.map(c => ({ label: c.nome, value: c.id }));
});

const abrirDialogoEdicao = (visita) => {
    visitaEmEdicao.value = { ...visita };
    // Garante que o munícipe atual esteja na lista do dropdown para exibição
    municipesOptions.value = [{ id: visita.municipe, nome_completo: visita.municipe_nome }];
    dialogoVisivel.value = true;
};

const salvarVisita = async () => {
    if (!visitaEmEdicao.value.municipe || !visitaEmEdicao.value.conta_destino) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Visitante e Destino são obrigatórios.', life: 3000 });
        return;
    }
    isSaving.value = true;
    try {
        const payload = {
            municipe: visitaEmEdicao.value.municipe,
            conta_destino: visitaEmEdicao.value.conta_destino,
            observacao: visitaEmEdicao.value.observacao,
        };
        await apiClient.patch(`/api/checkins/${visitaEmEdicao.value.id}/`, payload);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Registro atualizado!', life: 3000 });
        dialogoVisivel.value = false;
        carregarVisitas();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível atualizar o registro.', life: 3000 });
    } finally {
        isSaving.value = false;
    }
};

const confirmarExclusao = (visita) => {
    confirm.require({
        message: `Tem certeza que deseja excluir o check-in de ${visita.municipe_nome}?`,
        header: 'Confirmar Exclusão',
        icon: 'pi pi-exclamation-triangle',
        acceptClassName: 'p-button-danger',
        accept: async () => {
            try {
                await apiClient.delete(`/api/checkins/${visita.id}/`);
                toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Registro excluído.', life: 3000 });
                carregarVisitas();
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao excluir o registro.', life: 3000 });
            }
        },
    });
};

const tituloDialogo = computed(() => visitaEmEdicao.value.id ? 'Editar Registro de Visita' : 'Novo Registro');

const gerarRelatorioCheckinsPDF = async () => {
    // Reutiliza o filtro de data que já existe na tela
    if (!filtroData.value || !filtroData.value[0] || !filtroData.value[1]) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione um período de datas para gerar o relatório.', life: 3000 });
        return;
    }
    isGeneratingReport.value = true;
    try {
        const params = {
            data_inicio: filtroData.value[0].toISOString().slice(0, 10),
            data_fim: filtroData.value[1].toISOString().slice(0, 10),
        };
        const response = await apiClient.get('/api/relatorios/checkins/pdf/', { 
            params,
            responseType: 'blob', 
        });

        // Lógica para forçar o download do arquivo no navegador
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `relatorio_checkins.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o relatório de check-ins.', life: 3000 });
    } finally {
        isGeneratingReport.value = false;
    }
};
</script>

<template>
  <div class="page-container">
    <ConfirmDialog />
    <Toast />
    <header class="page-header">
      <h1>Histórico de Check-ins</h1>
    </header>

    <Card class="mb-4">
      <template #content>
        <div class="grid formgrid p-fluid align-items-end gap-2">
            <div class="field col-12 md:col-4">
                <label for="filtroData">Filtrar por Período</label>
                <Calendar id="filtroData" v-model="filtroData" selectionMode="range" dateFormat="dd/mm/yy" appendTo="body" />
            </div>
            <div class="field col-fixed flex gap-2">
                <Button label="Buscar" icon="pi pi-search" @click="carregarVisitas" :loading="isLoading" />
                <Button 
                    v-if="authStore.user?.is_superuser"
                    label="Exportar PDF" 
                    icon="pi pi-file-pdf" 
                    class="p-button-secondary" 
                    @click="gerarRelatorioCheckinsPDF" 
                    :loading="isGeneratingReport"
                    v-tooltip.top="'Gerar relatório de check-ins/visitas em PDF por período'"
                />
            </div>
        </div>
      </template>
    </Card>

    <main>
      <DataTable :value="visitas" :loading="isLoading" paginator :rows="15" responsiveLayout="scroll" stripedRows>
        <Column field="data_checkin" header="Data e Hora" sortable>
            <template #body="slotProps">
                {{ new Date(slotProps.data.data_checkin).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
            </template>
        </Column>
        <Column field="municipe_nome" header="Visitante" sortable></Column>
        <Column field="conta_destino_nome" header="Destino" sortable></Column>
        <Column field="observacao" header="Observação"></Column>
        <Column field="registrado_por_nome" header="Registrado Por" sortable></Column>
        
        <Column header="Ações" style="width: 8rem">
          <template #body="slotProps">
            <Button icon="pi pi-pencil" text rounded severity="secondary" @click="abrirDialogoEdicao(slotProps.data)" title="Editar" />
            <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmarExclusao(slotProps.data)" title="Excluir" />
          </template>
        </Column>

        <template #empty>Nenhum registro encontrado para o período.</template>
      </DataTable>
    </main>

    <Dialog v-model:visible="dialogoVisivel" :header="tituloDialogo" :modal="true" :style="{width: '450px'}">
        <div class="p-fluid">
            <div class="field">
                <label>Visitante</label>
                <InputText :value="visitaEmEdicao.municipe_nome" disabled />
            </div>
            <div class="field">
                <label>Gabinete de Destino</label>
                <Dropdown v-model="visitaEmEdicao.conta_destino" :options="contasOptions" optionLabel="label" optionValue="value" />
            </div>
            <div class="field">
                <label>Observação</label>
                <Textarea v-model="visitaEmEdicao.observacao" rows="3" />
            </div>
        </div>
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="dialogoVisivel = false" />
            <Button label="Salvar Alterações" icon="pi pi-check" @click="salvarVisita" :loading="isSaving" />
        </template>
    </Dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
</style>