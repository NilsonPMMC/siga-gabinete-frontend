<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useAuthStore } from '@/stores/auth';

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
const statusOptions = ref([
    { label: 'Solicitado', value: 'SOLICITADO' },
    { label: 'Em Análise', value: 'EM_ANALISE' },
    { label: 'Agendado', value: 'AGENDADO' },
    { label: 'Negado', value: 'NEGADO' },
    { label: 'Cancelado', value: 'CANCELADO' }
]);

// --- LÓGICA DO MODAL ---
const dialogoVisivel = ref(false);
const solicitacaoSelecionada = ref(null);
const dataAgendada = ref(null); // Guarda a data escolhida no calendário
const dataAgendadaFim = ref(null); // <<< NOVO: Para o horário de término
const espacoSelecionado = ref(null); // <<< NOVO: Para o espaço escolhido
const espacosOptions = ref([]); // <<< NOVO: Para a lista de espaços

// Função para abrir o diálogo de gerenciamento
const abrirDialogo = (solicitacao) => {
  solicitacaoSelecionada.value = { ...solicitacao };
  // Converte as datas do backend para objetos Date que o componente Calendar entende
  dataAgendada.value = solicitacao.data_agendada ? new Date(solicitacao.data_agendada) : null;
  dataAgendadaFim.value = solicitacao.data_agendada_fim ? new Date(solicitacao.data_agendada_fim) : null;
  espacoSelecionado.value = solicitacao.espaco; // Pega o ID do espaço já vinculado, se houver
  dialogoVisivel.value = true;
};

// Função para salvar as alterações de status ou data
const salvarAlteracoes = async (novoStatus) => {
    if (!solicitacaoSelecionada.value) return;

    const solicitacaoId = solicitacaoSelecionada.value.id;
    const payload = { 
        status: novoStatus,
        espaco: espacoSelecionado.value,
    };
    
    // Se o status for 'AGENDADO', valida e inclui as datas
    if (novoStatus === 'AGENDADO') {
        if (!dataAgendada.value || !dataAgendadaFim.value) {
            toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Por favor, selecione o horário de início e término.' });
            return;
        }
        if (new Date(dataAgendadaFim.value) <= new Date(dataAgendada.value)) {
            toast.add({ severity: 'warn', summary: 'Atenção', detail: 'O horário de término deve ser posterior ao de início.' });
            return;
        }
        payload.data_agendada = new Date(dataAgendada.value).toISOString();
        payload.data_agendada_fim = new Date(dataAgendadaFim.value).toISOString();
    }

    try {
        // PASSO 1: ATUALIZA O STATUS DA SOLICITAÇÃO DE AGENDA (COMO ANTES)
        const response = await apiClient.patch(`/api/agendas/${solicitacaoId}/`, payload);
        
        // PASSO 2 (NOVO): SE CONFIRMOU E RESERVOU UM ESPAÇO, CRIA A RESERVA NA TABELA NOVA
        if (novoStatus === 'AGENDADO' && espacoSelecionado.value) {
            const reservaPayload = {
                titulo: `Reunião: ${solicitacaoSelecionada.value.assunto}`,
                solicitante: solicitacaoSelecionada.value.solicitante, // O solicitante que já estava na agenda
                espaco: espacoSelecionado.value,
                data_inicio: payload.data_agendada,
                data_fim: payload.data_agendada_fim,
                observacoes: `Reserva criada a partir da solicitação de agenda #${solicitacaoId}.`
            };
            
            // Chama a nova API de reservas
            await apiClient.post('/api/reservas-espaco/', reservaPayload);
            toast.add({ severity: 'info', summary: 'Espaço Reservado', detail: `O espaço foi reservado com sucesso na nova tabela.`, life: 4000 });
        }
        
        // Atualiza a lista na tela instantaneamente
        const index = solicitacoes.value.findIndex(s => s.id === solicitacaoId);
        if (index !== -1) {
            solicitacoes.value[index] = response.data;
            todasSolicitacoes.value[solicitacoes.value.findIndex(s => s.id === solicitacaoId)] = response.data;
        }

        toast.add({ severity: 'success', summary: 'Sucesso', detail: `Solicitação atualizada.` });
        dialogoVisivel.value = false;

    } catch (error) {
        // A "mágica" anti-conflito: exibe o erro vindo do backend
        const errorMsg = error.response?.data?.non_field_errors?.[0] || 'Não foi possível atualizar a solicitação.';
        toast.add({ severity: 'error', summary: 'Erro', detail: errorMsg, life: 5000 });
    }
};

// Função para confirmar e executar a exclusão
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
        await apiClient.delete(`/api/agendas/${solicitacao.id}/`);
        // Remove o item da lista na tela, sem precisar recarregar a página
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
    // Agora, busca as solicitações E a lista de espaços disponíveis
    const [solicitacoesRes, espacosRes] = await Promise.all([
        apiClient.get('/api/agendas/'),
        apiClient.get('/api/espacos/')
    ]);
    todasSolicitacoes.value = solicitacoesRes.data;
    solicitacoes.value = solicitacoesRes.data;
    espacosOptions.value = espacosRes.data; // Alimenta o nosso novo dropdown
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro de Rede', detail: 'Não foi possível carregar os dados.' });
  } finally {
    isLoading.value = false;
  }
});

// Função auxiliar para colorir as tags de status
const getStatusSeverity = (status) => {
  const map = { 'SOLICITADO': 'info', 'EM_ANALISE': 'warning', 'AGENDADO': 'success', 'NEGADO': 'danger', 'CANCELADO': 'secondary' };
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
  if (filtroStatus.value) {
    items = items.filter(s => s.status === filtroStatus.value);
  }
  solicitacoes.value = items; // A mágica está aqui: atualiza a mesma variável que a tabela usa
};

const limparFiltros = () => {
  filtroTexto.value = '';
  filtroStatus.value = null;
  solicitacoes.value = [...todasSolicitacoes.value]; // Restaura a partir da lista de backup
};

// Função para o botão de editar
const editarSolicitacao = (id) => {
  router.push(`/agendas/editar/${id}`);
};

// Função para o botão de criar
const irParaNovaSolicitacao = () => {
  router.push('/agendas/novo');
};

const criarEventoGoogle = async (solicitacao) => {
    // Adiciona um feedback visual de carregamento
    const originalStatus = solicitacao.status;
    solicitacoes.value = solicitacoes.value.map(s => 
        s.id === solicitacao.id ? { ...s, status: 'ENVIANDO' } : s
    );

    try {
        const response = await apiClient.post(`/api/agendas/${solicitacao.id}/criar-evento-google/`);
        toast.add({ severity: 'success', summary: 'Sucesso!', detail: response.data.detail, life: 4000 });
        
        // Atualiza o item na lista com o novo link (se você adicionou o campo no modelo)
        const index = todasSolicitacoes.value.findIndex(s => s.id === solicitacao.id);
        if (index !== -1) {
            todasSolicitacoes.value[index].link_google_agenda = response.data.googleEventUrl;
            todasSolicitacoes.value[index].status = originalStatus; // Restaura o status visual
        }
        aplicarFiltros();

    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro de Integração', detail: error.response?.data?.detail || 'Não foi possível criar o evento.', life: 5000 });
        // Restaura o status visual em caso de erro
        solicitacoes.value = solicitacoes.value.map(s => 
            s.id === solicitacao.id ? { ...s, status: originalStatus } : s
        );
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
                const response = await apiClient.post(`/api/agendas/${solicitacao.id}/remover-link-google/`);
                
                // Atualiza a lista na tela com os dados retornados (sem o link)
                const index = solicitacoes.value.findIndex(s => s.id === solicitacao.id);
                if (index !== -1) {
                    solicitacoes.value[index] = response.data;
                }
                toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Evento desvinculado.' });
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível desvincular o evento.' });
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
                  <Dropdown id="filtroStatus" v-model="filtroStatus" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Todos" showClear @change="aplicarFiltros"/>
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
              <Button icon="pi pi-cog" text rounded @click="abrirDialogo(slotProps.data)" title="Gerenciar Solicitação" />
              
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

    <Dialog v-model:visible="dialogoVisivel" :style="{width: '50rem'}" header="Gerenciar Solicitação de Agenda" :modal="true" :draggable="false">
        <div v-if="solicitacaoSelecionada">
            <p><strong>Solicitante:</strong> {{ solicitacaoSelecionada.solicitante_nome }}</p>
            <p><strong>Gabinete:</strong> {{ solicitacaoSelecionada.conta_nome }}</p>
            <p><strong>Data da Solicitação:</strong> {{ new Date(solicitacaoSelecionada.data_criacao).toLocaleString('pt-BR') }}</p>
            <p><strong>Data Sugerida:</strong> {{ solicitacaoSelecionada.data_sugerida ? new Date(solicitacaoSelecionada.data_sugerida).toLocaleString('pt-BR') : 'Não informada' }}</p>
            <hr>
            <h4>Assunto: {{ solicitacaoSelecionada.assunto }}</h4>
            <p style="white-space: pre-wrap;">{{ solicitacaoSelecionada.detalhes }}</p>
            <hr>
            <div class="grid formgrid p-fluid">
                <div class="field col-12 md:col-4">
                    <label for="espaco">Reservar Espaço (Opcional)</label>
                    <Dropdown id="espaco" v-model="espacoSelecionado" :options="espacosOptions" optionLabel="nome" optionValue="id" placeholder="Nenhum" showClear />
                </div>
                <div class="field col-12 md:col-4">
                    <label for="data_agendada">Definir Início da Reunião</label>
                    <Calendar id="data_agendada" v-model="dataAgendada" showTime hourFormat="24" dateFormat="dd/mm/yy" />
                </div>
                <div class="field col-12 md:col-4">
                    <label for="data_agendada_fim">Definir Término da Reunião</label>
                    <Calendar id="data_agendada_fim" v-model="dataAgendadaFim" showTime hourFormat="24" dateFormat="dd/mm/yy" />
                </div>
            </div>
        </div>
        <template #footer>
            <Button label="Negar" icon="pi pi-times" severity="danger" @click="salvarAlteracoes('NEGADO')" />
            <Button label="Em Análise" icon="pi pi-spin pi-spinner" severity="warning" @click="salvarAlteracoes('EM_ANALISE')" />
            <Button label="Confirmar Agendamento" icon="pi pi-check" severity="success" @click="salvarAlteracoes('AGENDADO')" />
        </template>
    </Dialog>

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
  font-size: 0.9rem; /* Tamanho da fonte principal da data */
}
.data-formatada small {
  font-size: 0.8rem; /* Tamanho menor para a hora */
  color: #6c757d; /* Cor secundária para a hora */
}
</style>