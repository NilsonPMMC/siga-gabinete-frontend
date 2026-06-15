<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/api';
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import InputSwitch from 'primevue/inputswitch';
import { buscarComInteligencia } from '@/services/atendimentos';
import { unwrapPaginatedResponse } from '@/utils/paginatedApi';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const toast = useToast();

const isLoading = ref(true);
const atendimentosNaTela = ref([]);
const totalRecords = ref(0);
const first = ref(0);
const page = ref(1);
const pageSize = ref(25);
const ordering = ref('-data_criacao');
const filtroTexto = ref('');
const filtroStatus = ref(null);
const filtroConta = ref(null);
const filtroAssunto = ref(null);
const filtroSla = ref(null);
const assuntosOptions = ref([]);
const usaBuscaIA = ref(false);
const resultadosBuscaIA = ref([]);
const contasOptions = ref([]);
const statusOptions = ref([
    { label: 'Todos', value: null },
    { label: 'Aberto', value: 'ABERTO' },
    { label: 'Em Análise', value: 'EM_ANALISE' },
    { label: 'Encaminhado', value: 'ENCAMINHADO' },
    { label: 'Concluído', value: 'CONCLUIDO' },
    { label: 'Arquivado', value: 'ARQUIVADO' },
]);
const slaOptions = ref([
    { label: 'Todos', value: null },
    { label: 'No prazo', value: 'NO_PRAZO' },
    { label: 'Em risco', value: 'EM_RISCO' },
    { label: 'Vencido', value: 'VENCIDO' },
]);

onMounted(async () => {
    if (!authStore.isAuthenticated) return;
    if (route.query.assunto_codigo === 'visita_recepcao' || route.query.preset === 'visita') {
        router.replace({ path: '/atendimentos' });
        return;
    }
    try {
        const [contasRes, assuntosRes] = await Promise.all([
            apiClient.get('/api/contas/'),
            apiClient.get('/api/assuntos-atendimento/'),
        ]);
        contasOptions.value = contasRes.data.map(conta => ({ label: conta.nome, value: conta.id }));
        assuntosOptions.value = assuntosRes.data.map((a) => ({ label: a.nome, value: a.id, codigo: a.codigo }));

        const q = route.query;
        if (q.assunto_id) {
            filtroAssunto.value = Number(q.assunto_id) || q.assunto_id;
        } else if (q.assunto_codigo) {
            const match = assuntosRes.data.find((a) => a.codigo === q.assunto_codigo);
            if (match) filtroAssunto.value = match.id;
        }
        await carregarAtendimentos();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os atendimentos.' });
    }
});

const montarParamsAtendimentos = () => {
    const params = {
        page: page.value,
        page_size: pageSize.value,
        ordering: ordering.value,
    };
    if (filtroTexto.value) params.q = filtroTexto.value;
    if (filtroStatus.value) params.status = filtroStatus.value;
    if (filtroConta.value) params.conta_id = filtroConta.value;
    if (filtroAssunto.value) params.assunto_id = filtroAssunto.value;
    if (filtroSla.value) params.sla_status = filtroSla.value;
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

const onPage = async (event) => {
    first.value = event.first;
    pageSize.value = event.rows;
    page.value = Math.floor(event.first / event.rows) + 1;
    await carregarAtendimentos();
};

const onSort = async (event) => {
    const prefix = event.sortOrder === -1 ? '-' : '';
    ordering.value = `${prefix}${event.sortField}`;
    first.value = 0;
    page.value = 1;
    await carregarAtendimentos();
};

const getStatusSeverity = (status) => {
    const map = { 
        'ABERTO': 'info', 
        'EM_ANALISE': 'warning', 
        'ENCAMINHADO': 'warning',
        'CONCLUIDO': 'success', 
        'ARQUIVADO': 'secondary' 
    };
    return map[status] || 'secondary';
};

const getSlaSeverity = (sla) => {
    const map = {
        'NO_PRAZO': 'success',
        'EM_RISCO': 'warning',
        'VENCIDO': 'danger',
    };
    return map[sla] || 'secondary';
};

const aplicarFiltros = async () => {
    resultadosBuscaIA.value = [];
    first.value = 0;
    page.value = 1;
    try {
        if (usaBuscaIA.value && filtroTexto.value.trim()) {
            isLoading.value = true;
            const dados = await buscarComInteligencia(filtroTexto.value.trim(), {
                conta_id: filtroConta.value || undefined
            });
            resultadosBuscaIA.value = dados || [];
            atendimentosNaTela.value = [];
            totalRecords.value = 0;
            isLoading.value = false;
        } else {
            await carregarAtendimentos();
        }
    } catch (error) {
        isLoading.value = false;
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível aplicar os filtros.' });
    }
};

const limparFiltros = async () => {
    filtroTexto.value = '';
    filtroStatus.value = null;
    filtroConta.value = null;
    filtroAssunto.value = null;
    filtroSla.value = null;
    usaBuscaIA.value = false;
    resultadosBuscaIA.value = [];
    first.value = 0;
    page.value = 1;
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
        accept: () => {
            apiClient.delete(`/api/atendimentos/${atendimento.id}/`)
                .then(async () => {
                    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Atendimento excluído!', life: 3000 });
                    await carregarAtendimentos();
                })
                .catch(error => {
                    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir o atendimento.', life: 4000 });
                });
        },
    });
};

const podeVerDetalhes = () => !authStore.isRecepcao;
const podeEditarOuExcluirAtendimento = (atendimento) => authStore.user?.is_superuser || !authStore.isRecepcao || (authStore.isRecepcao && atendimento.status === 'ABERTO');

const rowClassIA = (data) => (data.score_match ?? 0) >= 80 ? 'ia-high-relevance' : '';
</script>

<template>
  <ConfirmDialog></ConfirmDialog>
  <Toast />
  <div class="page-container">
    <header class="page-header">
      <h1>Atendimentos</h1>
      <Button label="Novo Atendimento" icon="pi pi-plus" @click="irParaNovoAtendimento" class="p-button-success" />
    </header>

    <Card class="mb-4">
      <template #title>Filtros de Busca</template>
      <template #content>
        <div class="grid formgrid p-fluid align-items-end">
          <div class="field col-12 md:col-5">
            <label for="filtroTexto">Buscar por protocolo, título, munícipe (nome, CPF, matrícula, perfil)</label>
            <div class="flex align-items-center gap-3 flex-wrap">
              <InputText id="filtroTexto" v-model="filtroTexto" placeholder="Ex.: protocolo, nilson, 12345678901..." @keyup.enter="aplicarFiltros" class="flex-1 min-w-0" />
              <div class="flex align-items-center gap-2">
                <InputSwitch id="usaBuscaIA" v-model="usaBuscaIA" />
                <label for="usaBuscaIA" class="cursor-pointer flex align-items-center gap-1">
                  <i class="pi pi-sparkles"></i>
                  Busca Inteligente
                </label>
              </div>
            </div>
          </div>
          <div class="field col-12 md:col-3">
            <label for="filtroStatus">Status</label>
            <Dropdown id="filtroStatus" v-model="filtroStatus" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Todos" showClear @change="aplicarFiltros" />
          </div>
          <div class="field col-12 md:col-3" v-if="authStore.user?.is_superuser || authStore.isRecepcao">
            <label for="filtroConta">Gabinete</label>
            <Dropdown id="filtroConta" v-model="filtroConta" :options="contasOptions" optionLabel="label" optionValue="value" placeholder="Todos" showClear @change="aplicarFiltros" />
            <small v-if="usaBuscaIA" class="p-text-secondary block mt-1">Na busca IA, limita ao gabinete selecionado</small>
          </div>
          <div class="field col-12 md:col-3">
            <label for="filtroAssunto">Assunto</label>
            <Dropdown id="filtroAssunto" v-model="filtroAssunto" :options="assuntosOptions" optionLabel="label" optionValue="value" placeholder="Todos" showClear @change="aplicarFiltros" />
          </div>
          <div class="field col-12 md:col-3">
            <label for="filtroSla">SLA</label>
            <Dropdown id="filtroSla" v-model="filtroSla" :options="slaOptions" optionLabel="label" optionValue="value" placeholder="Todos" showClear @change="aplicarFiltros" />
          </div>
          <div class="field col-12 md:col-4 flex justify-content-start gap-2">
            <Button label="Filtrar" icon="pi pi-filter" @click="aplicarFiltros" />
            <Button label="Limpar" icon="pi pi-times" @click="limparFiltros" class="p-button-secondary" />
          </div>
        </div>
      </template>
    </Card>

    <main>
      <div v-if="!resultadosBuscaIA.length" class="mb-2 text-sm text-color-secondary">
        Exibindo {{ atendimentosNaTela.length }} de {{ totalRecords }} atendimento(s).
      </div>

      <DataTable
        v-if="!resultadosBuscaIA.length"
        :value="atendimentosNaTela"
        :loading="isLoading"
        paginator
        lazy
        :rows="pageSize"
        :first="first"
        :totalRecords="totalRecords"
        :rowsPerPageOptions="[10, 25, 50, 100]"
        @page="onPage"
        @sort="onSort"
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
        <Column field="assunto_nome" header="Assunto" sortable style="min-width: 10rem">
          <template #body="slotProps">
            <Tag v-if="slotProps.data.assunto_nome" :value="slotProps.data.assunto_nome" severity="secondary" />
            <span v-else class="text-color-secondary">—</span>
          </template>
        </Column>
        <Column field="titulo" header="Título" style="width: 35%"></Column>
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
            <Tag :value="slotProps.data.status.replace(/_/g, ' ')" :severity="getStatusSeverity(slotProps.data.status)" />
          </template>
        </Column>
        <Column field="sla_status" header="SLA" sortable>
          <template #body="slotProps">
            <Tag
              v-if="slotProps.data.sla_status_display"
              :value="slotProps.data.sla_status_display"
              :severity="getSlaSeverity(slotProps.data.sla_status)"
            />
            <span v-else class="text-color-secondary">—</span>
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

      <DataTable
        v-else
        :value="resultadosBuscaIA"
        :loading="isLoading"
        :rowClass="rowClassIA"
        paginator
        :rows="15"
        responsiveLayout="scroll"
      >
        <Column field="protocolo" header="Protocolo"></Column>
        <Column field="titulo" header="Título" style="width: 35%"></Column>
        <Column field="nome_municipe" header="Munícipe"></Column>
        <Column field="nome_conta" header="Gabinete" v-if="authStore.isRecepcao || authStore.user?.is_superuser"></Column>
        <Column field="score_match" header="Match %">
          <template #body="slotProps">
            <Tag :value="`${(slotProps.data.score_match ?? 0).toFixed(1)}%`" :severity="(slotProps.data.score_match ?? 0) >= 70 ? 'success' : (slotProps.data.score_match ?? 0) >= 50 ? 'warning' : 'info'" />
          </template>
        </Column>
        <Column field="snippet" header="Trecho relevante">
          <template #body="slotProps">
            <span class="text-sm text-color-secondary">{{ (slotProps.data.snippet || '').substring(0, 120) }}{{ (slotProps.data.snippet || '').length > 120 ? '...' : '' }}</span>
          </template>
        </Column>
        <Column header="Ações" style="width: 8rem; text-align: center;">
          <template #body="slotProps">
            <Button v-if="podeVerDetalhes()" icon="pi pi-eye" text rounded @click="verDetalhes(slotProps.data.id)" title="Ver Detalhes" />
            <Button v-if="podeEditarOuExcluirAtendimento(slotProps.data)" icon="pi pi-pencil" text rounded severity="secondary" @click="editarAtendimento(slotProps.data.id)" title="Editar" />
          </template>
        </Column>
        <template #empty> Nenhum resultado na busca por IA. </template>
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

/* Destaque para resultados de alta relevância na busca IA */
:deep(.ia-high-relevance) {
  background-color: rgba(34, 197, 94, 0.08) !important;
}
</style>