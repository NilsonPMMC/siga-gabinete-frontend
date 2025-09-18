<template>
  <ConfirmDialog></ConfirmDialog>
  <div class="page-container" v-if="!isLoading && solicitacao">
    <Card>
      <template #subtitle>
        <div class="card-subtitle">
          <Button label="Voltar as Solicitações" icon="pi pi-arrow-left" @click="router.push('/agendas')" text size="small" />
        </div>
      </template>
      <template #title>
        <div class="card-title">
          <span>Detalhes da Solicitação de Agenda</span>
          <Tag :value="solicitacao.status" :severity="getStatusSeverity(solicitacao.status)" />
        </div>
        <p class="card-subtitle">
          <i class="pi pi-user"></i>
          <span>Solicitante: {{ solicitacao.solicitante_nome }}</span>
        </p>
      </template>
      <template #content>
        <p><strong>Assunto:</strong> {{ solicitacao.assunto }}</p>
        <p><strong>Detalhes:</strong> {{ solicitacao.detalhes || 'Nenhum detalhe adicional.' }}</p>
        <p><strong>Data Sugerida pelo Solicitante:</strong> {{ formatarData(solicitacao.data_sugerida) }}</p>
        <div v-if="solicitacao.status === 'AGENDADO' && solicitacao.data_agendada" class="agendamento-confirmado">
            <p>
                <i class="pi pi-check-circle" style="color: var(--green-500);"></i>
                <strong>Agendamento Confirmado para:</strong>
            </p>
            <span>
                <strong>Data e Hora:</strong> {{ formatarPeriodoAgendado(solicitacao.data_agendada, solicitacao.data_agendada_fim) }}
            </span>
            <span v-if="solicitacao.espaco_nome">
                <strong>Local:</strong> {{ solicitacao.espaco_nome }}
            </span>
        </div>
        <hr />

        <h3>Histórico da Solicitação</h3>
        <Timeline :value="solicitacao.tramitacoes" align="alternate" class="customized-timeline">
          <template #marker="slotProps">
            <span class="custom-marker shadow-2">
              <i class="pi pi-check"></i>
            </span>
          </template>
          <template #content="slotProps">
            <div class="flex align-items-center justify-content-between">
              <small>{{ formatarData(slotProps.item.data_tramitacao) }} - <strong>{{ slotProps.item.usuario_nome }}</strong></small>
              
              <Button 
                icon="pi pi-trash" 
                class="p-button-danger p-button-text p-button-sm" 
                @click="confirmarExclusao(slotProps.item)"
                title="Excluir este progresso"
              />
              </div>
            <p>{{ slotProps.item.despacho }}</p>
          </template>
        </Timeline>

        <hr />

        <div class="p-fluid">
          <h3>Adicionar Progresso</h3>
          <div class="field">
            <label for="despacho">Despacho / Nota de Progresso</label>
            <Textarea id="despacho" v-model="novaTramitacao.despacho" rows="3" placeholder="Ex: Verificado com o gestor, sugerir nova data."/>
          </div>
          
          <div class="grid formgrid">
            <div class="field col-12 md:col-3">
                <label for="data_agendada">Definir Início</label>
                <Calendar id="data_agendada" v-model="novaTramitacao.data_agendada" showTime hourFormat="24" dateFormat="dd/mm/yy" />
            </div>
            <div class="field col-12 md:col-3">
                <label for="data_agendada_fim">Definir Término</label>
                <Calendar id="data_agendada_fim" v-model="novaTramitacao.data_agendada_fim" showTime hourFormat="24" dateFormat="dd/mm/yy" />
            </div>
            <div class="field col-12 md:col-3">
                <label for="espaco">Espaço</label>
                <Dropdown id="espaco" v-model="novaTramitacao.espaco" :options="espacosOptions" optionLabel="nome" optionValue="id" placeholder="Selecione (opcional)" />
            </div>
            <div class="field col-12 md:col-3">
                <label for="status">Alterar Status</label>
                <Dropdown id="status" v-model="novaTramitacao.status" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Manter status" />
            </div>
          </div>

          <div class="flex justify-content-end mt-3">
            <Button label="Salvar Progresso" icon="pi pi-check" @click="salvarTramitacao" :loading="isSaving" />
          </div>
        </div>
      </template>
    </Card>
  </div>
  <div v-else class="text-center p-4">
    <ProgressSpinner />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import apiClient from '@/api'; // Seu cliente de API

// Supondo que você tenha um serviço para a API de atendimentos/agendas
// import agendaService from '@/services/agendaService'; 

const router = useRouter();
const route = useRoute();
const toast = useToast();
const confirm = useConfirm();
const solicitacaoId = route.params.id;

const solicitacao = ref(null);
const isLoading = ref(true);
const isSaving = ref(false);

const novaTramitacao = ref({
    despacho: '',
    data_agendada: null,
    data_agendada_fim: null,
    espaco: null,
    status: null
});

const espacosOptions = ref([]);
const statusOptions = ref([
    { label: 'Em Análise', value: 'EM_ANALISE' },
    { label: 'Agendado', value: 'AGENDADO' },
    { label: 'Negado', value: 'NEGADO' },
    { label: 'Cancelado', value: 'CANCELADO' },
    { label: 'Reagendar', value: 'REAGENDAR' }
]);

const formatarData = (data) => {
    if (!data) return 'N/D';
    return new Date(data).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const carregarDados = async () => {
  try {
    isLoading.value = true;
    // Carregar dados da solicitação (incluindo as tramitações aninhadas)
    const responseSolicitacao = await apiClient.get(`/api/solicitacoes-agenda/${solicitacaoId}/`);
    solicitacao.value = responseSolicitacao.data;

    // Carregar lista de espaços para o dropdown
    const responseEspacos = await apiClient.get('/api/espacos/');
    espacosOptions.value = responseEspacos.data;

  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os dados da solicitação.' });
  } finally {
    isLoading.value = false;
  }
};

const formatarPeriodoAgendado = (inicio, fim) => {
    if (!inicio) return 'Data não definida';
    const dataInicio = new Date(inicio);
    const dataFim = new Date(fim);

    const dataFormatada = dataInicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaInicio = dataInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const horaFim = dataFim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return `${dataFormatada} das ${horaInicio} às ${horaFim}`;
};

const getStatusSeverity = (status) => {
  const map = { 'SOLICITADO': 'info', 'EM_ANALISE': 'warning', 'AGENDADO': 'success', 'NEGADO': 'danger', 'CANCELADO': 'secondary', 'REAGENDAR': 'warning' };
  return map[status] || 'contrast';
};

const salvarTramitacao = async () => {
    const { despacho, data_agendada, data_agendada_fim, status, espaco } = novaTramitacao.value;

    // --- NOVA LÓGICA DE VALIDAÇÃO ---
    // Verifica se pelo menos uma ação foi tomada
    if (!despacho && !data_agendada && !status && !espaco) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Adicione um despacho ou altere os dados do agendamento.' });
        return;
    }

    // Validação de data/hora de início e fim (mantida)
    if (status === 'AGENDADO' && (!data_agendada || !data_agendada_fim)) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Para agendar, as datas de início e fim são obrigatórias.' });
        return;
    }
    if (data_agendada && data_agendada_fim && new Date(data_agendada_fim) <= new Date(data_agendada)) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'A data de término deve ser posterior à data de início.' });
        return;
    }
    
    isSaving.value = true;
    try {
        // --- LÓGICA DE DESPACHO AUTOMÁTICO ---
        let despachoParaSalvar = despacho;
        if (!despachoParaSalvar && status) {
            const statusLabel = statusOptions.value.find(s => s.value === status)?.label || status;
            despachoParaSalvar = `Status alterado para: ${statusLabel}.`;
        }
        if (!despachoParaSalvar && data_agendada) {
            despachoParaSalvar = "Data de agendamento foi definida/alterada.";
        }
        // Garante que, se nada foi digitado, pelo menos a nota automática seja salva
        if (!despachoParaSalvar) {
            despachoParaSalvar = "Registro de alteração nos dados do agendamento.";
        }

        // 1. Salva a nova tramitação com o despacho (manual ou automático)
        await apiClient.post('/api/tramitacoes-agenda/', {
            solicitacao: solicitacaoId,
            despacho: despachoParaSalvar,
        });

        // 2. Se houver mudança de status ou dados, atualiza a solicitação principal
        const temMudancaDeDados = status || data_agendada || espaco;
        if (temMudancaDeDados) {
            const dadosUpdate = {};
            if (status) dadosUpdate.status = status;
            if (espaco) dadosUpdate.espaco = espaco;
            if (data_agendada) dadosUpdate.data_agendada = new Date(data_agendada).toISOString();
            if (data_agendada_fim) dadosUpdate.data_agendada_fim = new Date(data_agendada_fim).toISOString();
            
            await apiClient.patch(`/api/solicitacoes-agenda/${solicitacaoId}/`, dadosUpdate);
        }

        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Progresso salvo!' });
        novaTramitacao.value = { despacho: '', data_agendada: null, data_agendada_fim: null, espaco: null, status: null }; 
        carregarDados();

    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar o progresso.' });
    } finally {
        isSaving.value = false;
    }
};

const confirmarExclusao = (tramitacao) => {
    confirm.require({
        message: 'Tem certeza que deseja excluir permanentemente este registro do histórico?',
        header: 'Confirmar Exclusão',
        icon: 'pi pi-exclamation-triangle',
        acceptClassName: 'p-button-danger',
        acceptLabel: 'Sim, Excluir',
        rejectLabel: 'Cancelar',
        accept: async () => {
            try {
                // Chama a API para deletar a tramitação específica
                await apiClient.delete(`/api/tramitacoes-agenda/${tramitacao.id}/`);
                toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Progresso excluído.', life: 3000 });
                
                // Recarrega os dados para atualizar a timeline na tela
                carregarDados();
            } catch (error) {
                console.error("Erro ao excluir tramitação:", error);
                toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir o progresso.', life: 3000 });
            }
        },
    });
};

onMounted(carregarDados);
</script>

<style scoped>
.page-container { padding: 2rem; }
.card-title { display: flex; justify-content: space-between; align-items: center; }
.card-subtitle { display: flex; align-items: center; margin-top: 1rem; gap: 0.5rem; font-size: 1rem; color: var(--text-color-secondary); }
hr { margin: 1.5rem 0; border: 0; border-top: 1px solid #dee2e6; }
.agendamento-confirmado {
    background-color: var(--green-50);
    border-left: 5px solid var(--green-500);
    padding: 1rem;
    margin-top: 1rem;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.agendamento-confirmado p {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
</style>