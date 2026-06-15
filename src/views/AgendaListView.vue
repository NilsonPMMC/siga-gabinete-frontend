<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useAuthStore } from '@/stores/auth';
import GoogleEventModal from '@/components/google-calendar/GoogleEventModal.vue';

// Inicialização das ferramentas e do estado do componente
const solicitacoes = ref([]);
const isLoading = ref(true);
const toast = useToast();
const confirm = useConfirm();
const router = useRouter();
const authStore = useAuthStore();

const todasSolicitacoes = ref([]); // Guarda a lista completa vinda da API
const filtroTexto = ref('');
const filtroStatus = ref(null);
const showGoogleEventModal = ref(false);
const selectedSolicitacao = ref(null);
const statusOptions = ref([
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

// --- LÓGICA DO MODAL REMOVIDA ---
// As funções abrirDialogo e salvarAlteracoes foram removidas.

// Função para confirmar e executar a exclusão (Mantida)
const confirmarExclusao = (solicitacao) => {
  confirm.require({
    message: 'Tem certeza que deseja excluir permanentemente esta solicitação de agenda?',
    header: 'Confirmação de Exclusão',
    icon: 'pi pi-exclamation-triangle',
    acceptClassName: 'p-button-danger',
    acceptLabel: 'Sim, Excluir',
    rejectLabel: 'Cancelar',
    accept: async () => {
      try {
        await apiClient.delete(`/api/solicitacoes-agenda/${solicitacao.id}/`);
        solicitacoes.value = solicitacoes.value.filter(s => s.id !== solicitacao.id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Solicitação excluída.', life: 3000 });
      } catch (error) {
        console.error("Erro ao excluir solicitação:", error);
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir a solicitação.', life: 3000 });
      }
    },
  });
};

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  try {
    // A busca de 'espacos' foi removida pois não é mais necessária nesta tela
    const solicitacoesRes = await apiClient.get('/api/solicitacoes-agenda/');
    todasSolicitacoes.value = solicitacoesRes.data;
    solicitacoes.value = solicitacoesRes.data;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro de Rede', detail: 'Não foi possível carregar os dados.' });
  } finally {
    isLoading.value = false;
  }
});

// Funções de filtro (Mantidas)
const getStatusSeverity = (status) => {
  const map = { 'SOLICITADO': 'info', 'EM_ANALISE': 'warning', 'AGENDADO': 'success', 'AGENDAR': 'warning', 'NEGADO': 'danger', 'CANCELADO': 'secondary', 'REAGENDAR': 'warning', 'ENCAMINHADO': 'warning', 'CONCLUIDO': 'success' };
  return map[status] || 'contrast';
};

const aplicarFiltros = () => {
  let items = [...todasSolicitacoes.value];
  if (filtroTexto.value) {
    const busca = filtroTexto.value.toLowerCase();
    items = items.filter(s =>
      (s.assunto && s.assunto.toLowerCase().includes(busca)) ||
      (s.solicitante_nome && s.solicitante_nome.toLowerCase().includes(busca))
    );
  }
  if (filtroStatus.value && filtroStatus.value.length > 0) {
    items = items.filter(s => filtroStatus.value.includes(s.status));
  }
  solicitacoes.value = items;
};

const limparFiltros = () => {
  filtroTexto.value = '';
  filtroStatus.value = null;
  solicitacoes.value = [...todasSolicitacoes.value];
};

// --- FUNÇÕES DE NAVEGAÇÃO ---

// NOVA FUNÇÃO para ir para a tela de detalhes
const verDetalhes = (solicitacao) => {
  router.push({ name: 'agenda-detalhes', params: { id: solicitacao.id } });
};

// Função para o botão de editar (Mantida)
const editarSolicitacao = (id) => {
  router.push(`/agendas/editar/${id}`);
};

// Função para o botão de criar (Mantida)
const irParaNovaSolicitacao = () => {
  router.push('/agendas/novo');
};

// Funções do Google Agenda (Atualizadas para Múltiplas Contas)
const criarEventoGoogle = (solicitacao) => {
    selectedSolicitacao.value = solicitacao;
    showGoogleEventModal.value = true;
};

const onEventCreated = async (eventData) => {
    if (selectedSolicitacao.value) {
        toast.add({ 
            severity: 'success', 
            summary: 'Evento Criado!', 
            detail: `Evento "${eventData.titulo}" criado no Google Calendar`,
            life: 5000 
        });
        
        // Atualizar a solicitação com o link do Google
        const index = todasSolicitacoes.value.findIndex(s => s.id === selectedSolicitacao.value.id);
        if (index !== -1 && eventData.link_google) {
            todasSolicitacoes.value[index].link_google_agenda = eventData.link_google;
        }
        
        aplicarFiltros();
    }
};

const removerLinkGoogle = (solicitacao) => {
    confirm.require({
        message: 'Isso irá desvincular o evento do Google Calendar desta solicitação, permitindo que um novo seja criado. Deseja continuar?',
        header: 'Confirmar Desvinculação',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sim, desvincular',
        rejectLabel: 'Cancelar',
        accept: async () => {
            try {
                const response = await apiClient.post(`/api/solicitacoes-agenda/${solicitacao.id}/remover-link-google/`);
                const index = solicitacoes.value.findIndex(s => s.id === solicitacao.id);
                if (index !== -1) {
                    solicitacoes.value[index] = response.data;
                }
                toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Evento desvinculado.', life: 3000 });
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível desvincular o evento.', life: 3000 });
            }
        },
    });
};
</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <h1>Solicitações de Agenda</h1>
      <Button label="Nova Solicitação" icon="pi pi-plus" @click="irParaNovaSolicitacao" class="p-button-success" />
    </header>

    <Card class="mb-4">
      <template #title>Filtros de Busca</template>
      <template #content>
        <div class="grid formgrid p-fluid align-items-end">
            <div class="field col-12 md:col-6">
                <label for="filtroTexto">Buscar por Assunto ou Solicitante</label>
                <InputText id="filtroTexto" v-model="filtroTexto" placeholder="Digite aqui..." @keyup.enter="aplicarFiltros" />
            </div>
            <div class="field col-12 md:col-3">
                <label for="filtroStatus">Status</label>
                <MultiSelect v-model="filtroStatus" display="chip" :options="statusOptions" optionLabel="label" optionValue="value" filter placeholder="Todos" :maxSelectedLabels="3" />
            </div>
            <div class="field col-12 md:col-3 flex justify-content-start gap-2">
                <Button label="Filtrar" icon="pi pi-filter" @click="aplicarFiltros" />
                <Button label="Limpar" icon="pi pi-times" @click="limparFiltros" class="p-button-secondary" />
            </div>
        </div>
      </template>
    </Card>

    <main>
      <DataTable :value="solicitacoes" :loading="isLoading" paginator :rows="10" responsiveLayout="scroll">
        <Column header="Data Sugerida">
          <template #body="slotProps">
            <div v-if="slotProps.data.data_sugerida" class="data-formatada">
              <span>{{ new Date(slotProps.data.data_sugerida).toLocaleDateString('pt-BR') }}</span>
              <small>{{ new Date(slotProps.data.data_sugerida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}</small>
            </div>
          </template>
        </Column>
        <Column field="assunto" header="Assunto" style="width: 40%"></Column>
        <Column field="solicitante_nome" header="Solicitante"></Column>
        <Column field="conta_nome" header="Gabinete"></Column>
        <Column field="status" header="Status">
            <template #body="slotProps">
                <Tag :value="slotProps.data.status.replace('_', ' ')" :severity="getStatusSeverity(slotProps.data.status)" />
            </template>
        </Column>
        <Column header="Ações" style="width: 8rem; text-align: center; display:flex; justify-content: center;">
            <template #body="slotProps">
              <Button icon="pi pi-eye" text rounded @click="verDetalhes(slotProps.data)" title="Ver Detalhes e Histórico" />
              
              <Button 
                  v-if="slotProps.data.status === 'AGENDADO' && !slotProps.data.link_google_agenda" 
                  icon="pi pi-google" 
                  text rounded severity="success" 
                  @click="criarEventoGoogle(slotProps.data)" 
                  title="Criar evento no Google Agenda"
              />
              <Button 
                  v-if="slotProps.data.link_google_agenda" 
                  icon="pi pi-google" text rounded severity="danger" 
                  @click="removerLinkGoogle(slotProps.data)" 
                  title="Desvincular evento do Google Agenda"
              />

              <Button icon="pi pi-pencil" text rounded severity="secondary" @click="editarSolicitacao(slotProps.data.id)" />
              <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmarExclusao(slotProps.data)" title="Excluir Solicitação" />
            </template>
        </Column>
        <template #empty> Nenhuma solicitação de agenda encontrada. </template>
      </DataTable>
    </main>

    <!-- Modal de Criação de Evento Google -->
    <GoogleEventModal
      v-model="showGoogleEventModal"
      :evento="selectedSolicitacao ? {
        titulo: selectedSolicitacao.titulo || 'Reunião',
        descricao: selectedSolicitacao.observacoes || '',
        data_inicio: selectedSolicitacao.data_inicio ? new Date(selectedSolicitacao.data_inicio) : null,
        data_fim: selectedSolicitacao.data_fim ? new Date(selectedSolicitacao.data_fim) : null,
        localizacao: selectedSolicitacao.local || ''
      } : null"
      @event-created="onEventCreated"
    />
    
    <Toast />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
hr { margin: 1.5rem 0; border: 0; border-top: 1px solid #dee2e6; }
.field { margin-bottom: 1rem; }
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