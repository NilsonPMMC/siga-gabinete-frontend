<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/api';
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import ConfirmDialog from 'primevue/confirmdialog';
import DashboardSummary from '@/components/DashboardSummary.vue';
import { unwrapPaginatedResponse } from '@/utils/paginatedApi';

const authStore = useAuthStore();
const router = useRouter();
const confirm = useConfirm();
const toast = useToast();

const isLoading = ref(true);
const atendimentosNaTela = ref([]);
const totalRecords = ref(0);
const first = ref(0);
const page = ref(1);
const pageSize = ref(25);
const filtroTexto = ref('');
const filtroConta = ref(null);
const contasOptions = ref([]);
const summaryData = ref(null);

onMounted(async () => {
    if (!authStore.isAuthenticated) return;
    isLoading.value = true;
    try {
        const [contasRes, summaryRes] = await Promise.all([
            apiClient.get('/api/contas/'),
            apiClient.get('/api/dashboard/summary/')
        ]);
        summaryData.value = summaryRes.data;
        await carregarAtendimentos();

        const todasAsContas = contasRes.data;
        if (!authStore.user?.is_superuser) {
            const userContasIds = authStore.user?.perfil?.contas || [];
            contasOptions.value = todasAsContas
                .filter(conta => userContasIds.includes(conta.id))
                .map(conta => ({ label: conta.nome, value: conta.id }));
        } else {
            contasOptions.value = todasAsContas.map(conta => ({ label: conta.nome, value: conta.id }));
        }
  } catch (error) {
    console.error("Erro ao carregar dados do dashboard:", error);
    toast.add({ severity: 'error', summary: 'Erro de Rede', detail: 'Não foi possível carregar os dados.', life: 3000 });
  } finally {
    isLoading.value = false;
  }
});

const getStatusSeverity = (status) => {
  const map = { 'ABERTO': 'info', 'EM_ANALISE': 'warning', 'CONCLUIDO': 'success', 'ARQUIVADO': 'secondary' };
  return map[status] || 'secondary';
};

const montarParamsAtendimentos = () => {
    const params = {
        status: 'ABERTO',
        page: page.value,
        page_size: pageSize.value,
        ordering: '-data_criacao',
    };
    if (filtroTexto.value) params.q = filtroTexto.value;
    if (filtroConta.value) params.conta_id = filtroConta.value;
    return params;
};

const carregarAtendimentos = async () => {
    isLoading.value = true;
    try {
        const response = await apiClient.get('/api/atendimentos/', { params: montarParamsAtendimentos() });
        const { results, count } = unwrapPaginatedResponse(response);
        atendimentosNaTela.value = results;
        totalRecords.value = count;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os atendimentos.' });
    } finally {
        isLoading.value = false;
    }
};

const aplicarFiltros = async () => {
    first.value = 0;
    page.value = 1;
    await carregarAtendimentos();
};

const limparFiltros = async () => {
    filtroTexto.value = '';
    filtroConta.value = null;
    first.value = 0;
    page.value = 1;
    await carregarAtendimentos();
};

const onPage = async (event) => {
    first.value = event.first;
    pageSize.value = event.rows;
    page.value = Math.floor(event.first / event.rows) + 1;
    await carregarAtendimentos();
};

const verDetalhes = (id) => router.push(`/atendimentos/${id}`);
const editarAtendimento = (id) => router.push(`/atendimentos/editar/${id}`);
const irParaNovoAtendimento = () => router.push('/atendimentos/novo');

const confirmarExclusao = (atendimento) => {
    confirm.require({
        message: `Tem certeza que deseja excluir o protocolo ${atendimento.protocolo}?`,
        header: 'Confirmação de Exclusão',
        icon: 'pi pi-exclamation-triangle',
        acceptClassName: 'p-button-danger',
        acceptLabel: 'Sim, Excluir',
        rejectLabel: 'Cancelar',
        accept: () => {
            apiClient.delete(`/api/atendimentos/${atendimento.id}/`)
                .then(async () => {
                    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Atendimento excluído!', life: 3000 });
                    await carregarAtendimentos();
                })
                .catch(error => {
                    const errorMsg = error.response?.data?.detail || 'Não foi possível excluir o atendimento.';
                    toast.add({ severity: 'error', summary: 'Erro', detail: errorMsg, life: 4000 });
                });
        },
    });
};

const podeVerDetalhes = () => !authStore.isRecepcao;
const podeEditarOuExcluirAtendimento = (atendimento) => authStore.user?.is_superuser || !authStore.isRecepcao || (authStore.isRecepcao && atendimento.status === 'ABERTO');
</script>

<template>
  <ConfirmDialog></ConfirmDialog>
  <div class="page-container">
    <header class="page-header">
      <h1>Dashboard</h1>
      <Button label="Novo Atendimento" icon="pi pi-plus" @click="irParaNovoAtendimento" class="p-button-success" />
    </header>
    
    <DashboardSummary class="mb-4" :summaryDataProp="summaryData" :fetchInParent="true" />

    <Card class="mb-4">
      <template #title>Filtros de Atendimentos</template>
      <template #content>
        <div class="grid formgrid p-fluid align-items-end">
          <div class="field col-12 md:col-6">
            <label for="filtroTexto">Buscar por Protocolo, Título ou Nome</label>
            <InputText id="filtroTexto" v-model="filtroTexto" placeholder="Digite aqui..." @keyup.enter="aplicarFiltros" />
          </div>
          <div class="field col-12 md:col-4" v-if="authStore.user?.is_superuser || authStore.isRecepcao">
            <label for="filtroConta">Gabinete</label>
            <Dropdown id="filtroConta" v-model="filtroConta" :options="contasOptions" optionLabel="label" optionValue="value" placeholder="Todos" showClear />
          </div>
          <div class="field col-12 md:col-4 flex justify-content-start gap-2">
            <Button label="Filtrar" icon="pi pi-filter" @click="aplicarFiltros" />
            <Button label="Limpar" icon="pi pi-times" @click="limparFiltros" class="p-button-secondary" />
          </div>
        </div>
      </template>
    </Card>

    <main>
      <DataTable
        :value="atendimentosNaTela"
        :loading="isLoading"
        paginator
        lazy
        :rows="pageSize"
        :first="first"
        :totalRecords="totalRecords"
        :rowsPerPageOptions="[10, 25, 50, 100]"
        @page="onPage"
        responsiveLayout="scroll"
      >
        <Column field="protocolo" header="Protocolo" sortable></Column>
        <Column field="data_criacao" header="Data" sortable>
          <template #body="slotProps">
            <div v-if="slotProps.data.data_criacao" class="data-formatada">
              <span>{{ new Date(slotProps.data.data_criacao).toLocaleDateString('pt-BR') }}</span>
              <small>{{ new Date(slotProps.data.data_criacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}</small>
            </div>
          </template>
        </Column>
        <Column field="titulo" header="Título" style="width: 40%"></Column>
        <Column field="nome_conta" header="Gabinete" sortable v-if="authStore.isRecepcao || authStore.user?.is_superuser"></Column>
        <Column field="nome_municipe" header="Munícipe" sortable>
          <template #body="slotProps">
            <RouterLink :to="`/municipes/${slotProps.data.municipe}/historico`">
              {{ slotProps.data.nome_municipe }}
            </RouterLink>
          </template>
        </Column>
        <Column field="status" header="Status" sortable>
          <template #body="slotProps">
            <Tag :value="slotProps.data.status.replace('_', ' ')" :severity="getStatusSeverity(slotProps.data.status)" />
          </template>
        </Column>
        <Column header="Ações" style="width: 8rem; text-align: center; display:flex; justify-content: center;">
          <template #body="slotProps">
              <Button v-if="podeVerDetalhes()" icon="pi pi-eye" text rounded @click="verDetalhes(slotProps.data.id)" title="Ver Detalhes" />
              <Button v-if="podeEditarOuExcluirAtendimento(slotProps.data)" icon="pi pi-pencil" text rounded severity="secondary" @click="editarAtendimento(slotProps.data.id)" title="Editar" />
              <Button v-if="podeEditarOuExcluirAtendimento(slotProps.data)" icon="pi pi-trash" text rounded severity="danger" @click="confirmarExclusao(slotProps.data)" title="Excluir" />
          </template>
        </Column>
        <template #empty> Nenhum atendimento encontrado. </template>
      </DataTable>
    </main>

  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.data-formatada {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  font-size: 0.9rem;
}
.data-formatada small {
  font-size: 0.8rem;
  color: #6c757d;
}
</style>
