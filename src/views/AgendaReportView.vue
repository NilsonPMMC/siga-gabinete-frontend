<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import apiClient from '@/api';
import { useAuthStore } from '@/stores/auth';
import MultiSelect from 'primevue/multiselect';

const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const todasSolicitacoes = ref([]);
const solicitacoesNaTela = ref([]);
const isLoading = ref(false);
const isExporting = ref(false);

// Filtros
const dataInicio = ref(null);
const dataFim = ref(null);
const filtroConta = ref(null);
const filtroStatus = ref(null);
const contasOptions = ref([]);
const statusOptions = ref([
    { label: 'Todos', value: null },
    { label: 'Solicitado', value: 'SOLICITADO' },
    { label: 'Em Análise', value: 'EM_ANALISE' },
    { label: 'Agendado', value: 'AGENDADO' },
    { label: 'Agendar', value: 'AGENDAR' },
    { label: 'Negado', value: 'NEGADO' },
    { label: 'Cancelado', value: 'CANCELADO' },
    { label: 'Reagendar', value: 'REAGENDAR' },
    { label: 'Encaminhado', value: 'ENCAMINHADO' },
    { label: 'Concluido', value: 'CONCLUIDO' }
]);

// --- LÓGICA DO MODAL (AS PEÇAS QUE FALTAVAM) ---
const dialogoVisivel = ref(false);
const solicitacaoSelecionada = ref(null);
const dataAgendada = ref(null);

const aplicarFiltros = () => {
  let items = [...todasSolicitacoes.value];

  // Verifica se o array de filtros não está vazio
  if (filtroStatus.value && filtroStatus.value.length > 0) {
    // Filtra os itens mantendo apenas aqueles cujo status ESTÁ INCLUÍDO no array filtroStatus
    items = items.filter(s => filtroStatus.value.includes(s.status));
  }
  
  // Lógica para outros filtros permanece a mesma...
  
  solicitacoesNaTela.value = items;
};

const abrirDialogo = (solicitacao) => {
  console.log('[DEBUG] PASSO 1: Botão da engrenagem foi clicado. Tentando abrir para a solicitação:', solicitacao);
  solicitacaoSelecionada.value = { ...solicitacao };
  dataAgendada.value = solicitacao.data_agendada ? new Date(solicitacao.data_agendada) : null;
  dialogoVisivel.value = true;
  console.log('[DEBUG] PASSO 2: A variável `dialogoVisivel` foi alterada para:', dialogoVisivel.value);
};

watch(dialogoVisivel, (novoValor) => {
  console.log('[DEBUG] O "observador" detectou uma mudança em `dialogoVisivel`. Novo valor é:', novoValor);
});

const salvarAlteracoes = async (novoStatus) => {
  if (!solicitacaoSelecionada.value) return;
  const payload = { status: novoStatus };
  const solicitacaoId = solicitacaoSelecionada.value.id;

  if (novoStatus === 'AGENDADO') {
    if (!dataAgendada.value) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Por favor, selecione uma data para agendar.', life: 3000 });
        return;
    }
    payload.data_agendada = new Date(dataAgendada.value).toISOString();
  }

  try {
    const response = await apiClient.patch(`/api/solicitacoes-agenda/${solicitacaoId}/`, payload);
    const index = todasSolicitacoes.value.findIndex(s => s.id === solicitacaoId);
    if (index !== -1) {
      todasSolicitacoes.value[index] = response.data;
      solicitacoesNaTela.value[index] = response.data;
    }
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Solicitação atualizada.', life: 3000 });
    dialogoVisivel.value = false;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível atualizar a solicitação.', life: 3000 });
  }
};
// --- FIM DA LÓGICA DO MODAL ---

const buscarDados = async () => {
  isLoading.value = true;
  try {
    // A busca no backend já aplica os filtros de permissão de conta.
    const response = await apiClient.get('/api/solicitacoes-agenda/');
    todasSolicitacoes.value = response.data;
    solicitacoesNaTela.value = response.data; // Popula a tabela
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os dados.', life: 3000 });
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
    if (!authStore.isAuthenticated) {
      isLoading.value = false;
      return;
    }
    buscarDados();
    if (authStore.user?.is_superuser) {
        try {
            const resContas = await apiClient.get('/api/contas/');
            contasOptions.value = resContas.data.map(c => ({ label: c.nome, value: c.id }));
        } catch (error) { console.error("Erro ao buscar contas:", error); }
    }
});

// Exporta o PDF com os mesmos filtros
const exportarPDF = async () => {
  isExporting.value = true;
  const params = new URLSearchParams();
  if (dataInicio.value) params.append('data_inicio', new Date(dataInicio.value).toISOString().slice(0, 10));
  if (dataFim.value) params.append('data_fim', new Date(dataFim.value).toISOString().slice(0, 10));
  if (filtroConta.value) params.append('conta_id', filtroConta.value);
  if (filtroStatus.value && filtroStatus.value.length > 0) {
    // Itera sobre o array e adiciona cada status como um parâmetro separado
    filtroStatus.value.forEach(status => {
      params.append('status', status);
    });
  }

  try {
    const response = await apiClient.get('/api/relatorios/agendas/pdf/', { params, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_agendas_${new Date().getTime()}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error("Erro ao gerar PDF de agendas:", error);
  } finally {
    isExporting.value = false;
  }
};
</script>

<template>
  <Toast /> <Dialog />
  <div class="page-container">

    <header class="page-header">
      <h1>Relatório de Solicitações de Agenda</h1>
    </header>

    <Card class="mb-4">
      <template #title>Filtros</template>
      <template #content>
        <div class="grid formgrid p-fluid align-items-end gap-3">
          <div class="field col"><label>Data de Início</label><Calendar v-model="dataInicio" dateFormat="dd/mm/yy" appendTo="body" /></div>
          <div class="field col"><label>Data de Fim</label><Calendar v-model="dataFim" dateFormat="dd/mm/yy" appendTo="body" /></div>
          <div class="field col" v-if="authStore.user?.is_superuser"><label>Gabinete</label><Dropdown v-model="filtroConta" :options="contasOptions" optionLabel="label" optionValue="value" placeholder="Todos" showClear /></div>
          <div class="field col">
            <label>Status</label>
            <MultiSelect v-model="filtroStatus" display="chip" :options="statusOptions" optionLabel="label" optionValue="value" filter placeholder="Todos" :maxSelectedLabels="3" />
          </div>
          <div class="field col flex gap-2">
            <Button label="Aplicar Filtros" icon="pi pi-filter" @click="aplicarFiltros" :loading="isLoading" />
            <Button label="Exportar PDF" icon="pi pi-file-pdf" class="p-button-secondary" @click="exportarPDF" :loading="isExporting" />
          </div>
        </div>
      </template>
    </Card>

    <DataTable :value="solicitacoesNaTela" :loading="isLoading" paginator :rows="15">
      <Column field="data_criacao" header="Data Solic." sortable>
        <template #body="slotProps">
          <div v-if="slotProps.data.data_criacao" class="data-formatada">
            <span>{{ new Date(slotProps.data.data_criacao).toLocaleDateString('pt-BR') }}</span>
            <small>{{ new Date(slotProps.data.data_criacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}</small>
          </div>
        </template>
      </Column>
      <Column field="solicitante_nome" header="Solicitante" sortable></Column>
      <Column header="Cargo(s) / Órgão(s)">
        <template #body="slotProps">{{ slotProps.data.solicitante_perfis_resumo || '—' }}</template>
      </Column>
      <Column field="assunto" header="Assunto"></Column>
      <Column field="status" header="Status" sortable><template #body="slotProps"><Tag :value="slotProps.data.status.replace('_', ' ')" /></template></Column>
    </DataTable>
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; margin: auto; }
.field { margin-bottom: 1.5rem; }
.card-title { display: flex; align-items: center; }
label { font-weight: bold; margin-bottom: 0.5rem; display: block; }
.data-formatada {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  font-size: 0.9rem; /* Tamanho da fonte principal da data */
}
.data-formatada small {
  font-size: 0.8rem; /* Tamanho menor para a hora */
  color: #6c757d; /* Cor secundária para a hora */
}
</style>
