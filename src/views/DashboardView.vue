<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/api';
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import ConfirmDialog from 'primevue/confirmdialog';
import DashboardSummary from '@/components/DashboardSummary.vue';

const authStore = useAuthStore();
const router = useRouter();
const confirm = useConfirm();
const toast = useToast();

const isLoading = ref(true);

// --- ESTADO PARA ATENDIMENTOS ---
const todosAtendimentos = ref([]);
const atendimentosNaTela = ref([]);
const filtroTexto = ref('');
const filtroStatus = ref(null);
const filtroConta = ref(null);
const contasOptions = ref([]);
const statusOptions = ref([
  { label: 'Aberto', value: 'ABERTO' },
  { label: 'Em Análise', value: 'EM_ANALISE' },
  { label: 'Concluído', value: 'CONCLUIDO' },
  { label: 'Arquivado', value: 'ARQUIVADO' },
]);

// --- ESTADO PARA CHECK-IN / REGISTRO DE VISITAS ---
const summaryData = ref(null);

// --- AGENDA / RECEPÇÃO HOJE: navegação por data ---
const dataAgendaSelecionada = ref(null);
const visitasAgenda = ref([]);
const isLoadingAgenda = ref(false);
const dialogoCheckInVisivel = ref(false);
const novoCheckIn = ref({});
const isLoadingCheckIn = ref(false);

// Refs para os dropdowns do novo diálogo
const sugestoesMunicipes = ref([]); 
const municipeSelecionadoCheckIn = ref(null);
const isLoadingMunicipes = ref(false);
let searchTimeout = null;

watch(municipeSelecionadoCheckIn, (novoValor) => {
    novoCheckIn.value.municipe = novoValor ? novoValor.id : null;
});

const formatarDataAgenda = (dataStr) => {
    if (!dataStr) return '';
    const d = new Date(dataStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const carregarVisitasAgenda = async () => {
    if (!dataAgendaSelecionada.value) return;
    isLoadingAgenda.value = true;
    try {
        const res = await apiClient.get('/api/dashboard/visitas/', { params: { data: dataAgendaSelecionada.value } });
        visitasAgenda.value = res.data;
    } catch (error) {
        console.error("Erro ao carregar visitas da agenda:", error);
        visitasAgenda.value = [];
    } finally {
        isLoadingAgenda.value = false;
    }
};

const irParaDataAnterior = () => {
    const d = new Date(dataAgendaSelecionada.value + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    dataAgendaSelecionada.value = d.toISOString().slice(0, 10);
    carregarVisitasAgenda();
};

const irParaProximaData = () => {
    const hoje = new Date().toISOString().slice(0, 10);
    if (dataAgendaSelecionada.value >= hoje) return;
    const d = new Date(dataAgendaSelecionada.value + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    dataAgendaSelecionada.value = d.toISOString().slice(0, 10);
    carregarVisitasAgenda();
};

const hojeStr = () => new Date().toISOString().slice(0, 10);
const podeAvancarData = computed(() => dataAgendaSelecionada.value < hojeStr());

// --- CARREGAMENTO INICIAL ---
onMounted(async () => {
    if (!authStore.isAuthenticated) return;
    isLoading.value = true;
    try {
        const [atendimentosRes, contasRes, summaryRes] = await Promise.all([
            apiClient.get('/api/atendimentos/'),
            apiClient.get('/api/contas/'),
            apiClient.get('/api/dashboard/summary/')
        ]);
        summaryData.value = summaryRes.data;
        if (summaryRes.data?.visitas_hoje !== undefined) {
            dataAgendaSelecionada.value = new Date().toISOString().slice(0, 10);
            visitasAgenda.value = summaryRes.data.visitas_hoje || [];
        }
        // Guarda a lista completa como nossa "base de dados"
        todosAtendimentos.value = atendimentosRes.data;
        // A tela começa mostrando APENAS os atendimentos abertos
        atendimentosNaTela.value = todosAtendimentos.value.filter(at => at.status === 'ABERTO');

        const todasAsContas = contasRes.data;
        
        // Se o usuário não for superusuário, filtra a lista de contas.
        if (!authStore.user?.is_superuser) {
            const userContasIds = authStore.user?.perfil?.contas || [];
            // Mostra apenas as contas que estão no perfil do usuário
            contasOptions.value = todasAsContas
                .filter(conta => userContasIds.includes(conta.id))
                .map(conta => ({ label: conta.nome, value: conta.id }));
        } else {
            // Superusuário vê todas as contas.
            contasOptions.value = todasAsContas.map(conta => ({ label: conta.nome, value: conta.id }));
        }


  } catch (error) {
    console.error("Erro ao carregar dados do dashboard:", error);
    toast.add({ severity: 'error', summary: 'Erro de Rede', detail: 'Não foi possível carregar os dados.', life: 3000 });
  } finally {
    isLoading.value = false;
  }
});

// --- FUNÇÕES PARA ATENDIMENTOS (sem alterações) ---
const getStatusSeverity = (status) => {
  const map = { 'ABERTO': 'info', 'EM_ANALISE': 'warning', 'CONCLUIDO': 'success', 'ARQUIVADO': 'secondary' };
  return map[status] || 'secondary';
};

const aplicarFiltros = () => {
    // Começa sempre com a lista completa de atendimentos
    let items = [...todosAtendimentos.value];

    // PRIMEIRO FILTRO (IMPLÍCITO): Sempre filtra por "ABERTO"
    items = items.filter(at => at.status === 'ABERTO');

    // SEGUNDO FILTRO: Aplica a busca por texto (agora incluindo nome)
    if (filtroTexto.value) {
        const busca = filtroTexto.value.toLowerCase();
        items = items.filter(at =>
            (at.protocolo && at.protocolo.toLowerCase().includes(busca)) ||
            (at.titulo && at.titulo.toLowerCase().includes(busca)) ||
            (at.nome_municipe && at.nome_municipe.toLowerCase().includes(busca)) // <-- BUSCA POR NOME ADICIONADA
        );
    }

    // TERCEIRO FILTRO: Aplica o filtro de gabinete
    if (filtroConta.value) {
        items = items.filter(at => at.conta === filtroConta.value);
    }
    atendimentosNaTela.value = items;
};

const limparFiltros = () => {
    filtroTexto.value = '';
    filtroConta.value = null;
    // Ao limpar, volta a mostrar todos os atendimentos ABERTOS
    atendimentosNaTela.value = todosAtendimentos.value.filter(at => at.status === 'ABERTO');
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
                .then(() => {
                    todosAtendimentos.value = todosAtendimentos.value.filter(a => a.id !== atendimento.id);
                    atendimentosNaTela.value = atendimentosNaTela.value.filter(a => a.id !== atendimento.id);
                    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Atendimento excluído!', life: 3000 });
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


// --- NOVAS FUNÇÕES PARA CHECK-IN ---
const abrirDialogoParaCriacaoCheckIn = () => {
    // Reseta o formulário para um novo registro
    novoCheckIn.value = { municipe: null, conta_destino: null, observacao: '' };
    municipeSelecionadoCheckIn.value = null; // Limpa o objeto do autocomplete
    sugestoesMunicipes.value = []; // Limpa as sugestões
    dialogoCheckInVisivel.value = true;
};

const abrirDialogoParaEdicaoCheckIn = async (visita) => {
    // Preenche o formulário com os dados da visita selecionada
    novoCheckIn.value = { ...visita };
    dialogoCheckInVisivel.value = true;

    // Busca o objeto completo do munícipe para preencher o AutoComplete
    if (visita.municipe) {
        try {
            const response = await apiClient.get(`/api/municipes/lookup/?q=${visita.municipe}`);
            if (response.data.length > 0) {
                municipeSelecionadoCheckIn.value = response.data[0];
            }
        } catch (error) {
            toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar o visitante.', life: 3000 });
        }
    }
};

const buscarMunicipes = (event) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        isLoadingMunicipes.value = true;
        try {
            const params = {};
            // O AutoComplete usa event.query
            if (event.query?.trim()) {
                params.q = event.query;
            }
            const { data } = await apiClient.get('/api/municipes/lookup/', { params });
            sugestoesMunicipes.value = data;
        } catch (error) { 
            console.error("Erro ao buscar munícipes:", error);
            sugestoesMunicipes.value = [];
        } finally { 
            isLoadingMunicipes.value = false; 
        }
    }, 300);
};

const salvarCheckIn = async () => {
    if (!novoCheckIn.value.municipe || !novoCheckIn.value.conta_destino) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Visitante e Destino são obrigatórios.', life: 3000 });
        return;
    }
    isLoadingCheckIn.value = true;
    try {
        let response;
        const payload = {
            municipe: novoCheckIn.value.municipe,
            conta_destino: novoCheckIn.value.conta_destino,
            observacao: novoCheckIn.value.observacao,
        };

        if (novoCheckIn.value.id) {
            // Se tem ID, é uma ATUALIZAÇÃO (PATCH)
            response = await apiClient.patch(`/api/checkins/${novoCheckIn.value.id}/`, payload);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Check-in atualizado!', life: 3000 });
        } else {
            // Se não tem ID, é uma CRIAÇÃO (POST)
            response = await apiClient.post('/api/checkins/', novoCheckIn.value);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Check-in registrado!', life: 3000 });
        }
        
        dialogoCheckInVisivel.value = false;
        await carregarVisitasAgenda(); // Recarrega a lista para refletir a mudança
        
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: `Não foi possível salvar o registro.`, life: 3000 });
    } finally {
        isLoadingCheckIn.value = false;
    }
};

const confirmarExclusaoCheckIn = (visita) => {
    confirm.require({
        message: `Tem certeza que deseja excluir o check-in de ${visita.municipe_nome}?`,
        header: 'Confirmar Exclusão',
        icon: 'pi pi-exclamation-triangle',
        acceptClassName: 'p-button-danger',
        accept: async () => {
            try {
                await apiClient.delete(`/api/checkins/${visita.id}/`);
                toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Registro excluído.', life: 3000 });
                await carregarVisitasAgenda(); // Recarrega a lista
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao excluir o registro.', life: 3000 });
            }
        },
    });
};

const tituloDialogoCheckIn = computed(() => {
    return novoCheckIn.value.id ? 'Editar Registro de Visita' : 'Registrar Nova Visita (Check-in)';
});
</script>

<template>
  <ConfirmDialog></ConfirmDialog>
  <div class="page-container">
    <header class="page-header">
      <h1>Dashboard</h1>
      <div class="flex gap-2">
        <Button label="Novo Atendimento" icon="pi pi-plus" @click="irParaNovoAtendimento" class="p-button-success" />
      </div>
    </header>
    
    <DashboardSummary class="mb-4" :summaryDataProp="summaryData" :fetchInParent="true" />

    <Card v-if="summaryData?.visitas_hoje !== undefined" class="mb-4">
      <template #title>
        <div class="flex align-items-center justify-content-between flex-wrap gap-2">
          <span>📅 Agenda / Recepção Hoje ({{ visitasAgenda.length }})</span>
          <div class="flex align-items-center gap-2">
            <Button v-if="authStore.isRecepcao || authStore.user?.is_superuser" label="Registrar Visita" icon="pi pi-plus" size="small" @click="abrirDialogoParaCriacaoCheckIn" />
            <Button icon="pi pi-chevron-left" text rounded :disabled="!dataAgendaSelecionada" @click="irParaDataAnterior" title="Dia anterior" />
            <span class="text-sm font-medium">{{ formatarDataAgenda(dataAgendaSelecionada) }}</span>
            <Button icon="pi pi-chevron-right" text rounded :disabled="!podeAvancarData" @click="irParaProximaData" title="Próximo dia" />
          </div>
        </div>
      </template>
      <template #content>
        <DataTable :value="visitasAgenda" :loading="isLoadingAgenda" size="small" responsiveLayout="scroll" stripedRows>
          <Column field="data_checkin" header="Horário" style="width: 6rem;">
            <template #body="{ data }">
              {{ data.data_checkin ? new Date(data.data_checkin).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-' }}
            </template>
          </Column>
          <Column field="municipe_nome" header="Visitante"></Column>
          <Column field="conta_destino_nome" header="Destino"></Column>
          <Column header="Para quem" style="min-width: 10rem;">
            <template #body="{ data }">
              <Tag v-if="!data.usuario_destino_nome" severity="secondary" value="Sem Destino Definido" class="text-xs" />
              <span v-else class="text-sm">Para: {{ data.usuario_destino_nome }}</span>
            </template>
          </Column>
          <Column field="observacao" header="Observação"></Column>
          <Column v-if="authStore.isRecepcao || authStore.user?.is_superuser" header="Ações" style="width: 8rem; text-align: center;">
            <template #body="{ data }">
              <Button icon="pi pi-pencil" text rounded severity="secondary" @click="abrirDialogoParaEdicaoCheckIn(data)" title="Editar" />
              <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmarExclusaoCheckIn(data)" title="Excluir" />
            </template>
          </Column>
          <template #empty>Nenhum registro de visita/compromisso para {{ dataAgendaSelecionada ? formatarDataAgenda(dataAgendaSelecionada) : 'esta data' }}.</template>
        </DataTable>
      </template>
    </Card>

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
      <DataTable :value="atendimentosNaTela" :loading="isLoading" paginator :rows="10" responsiveLayout="scroll">
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

    <Dialog v-model:visible="dialogoCheckInVisivel" :header="tituloDialogoCheckIn" :modal="true" :style="{width: '450px'}">
        <div class="p-fluid">
            <div class="field">
                <label for="checkin-municipe">Visitante*</label>
                <AutoComplete
                    id="checkin-municipe"
                    v-model="municipeSelecionadoCheckIn"
                    :suggestions="sugestoesMunicipes"
                    @complete="buscarMunicipes"
                    field="nome_completo"
                    placeholder="Busque por nome ou apelido..."
                    forceSelection
                >
                    <template #item="slotProps">
                        <div class="flex flex-column align-items-start">
                            <div>{{ slotProps.item.nome_completo }}</div>
                            <small v-if="slotProps.item.nome_de_guerra" class="text-sm text-primary-500 font-italic">
                                {{ slotProps.item.nome_de_guerra }}
                            </small>
                        </div>
                    </template>
                </AutoComplete>
            </div>

            <div class="field">
                <label for="checkin-destino">Gabinete de Destino*</label>
                <Dropdown id="checkin-destino" v-model="novoCheckIn.conta_destino" :options="contasOptions" optionLabel="label" optionValue="value" placeholder="Selecione o destino" showClear/>
            </div>

            <div class="field">
                <label for="checkin-obs">Observação</label>
                <Textarea id="checkin-obs" v-model="novoCheckIn.observacao" rows="3" />
            </div>
        </div>
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="dialogoCheckInVisivel = false" />
            <Button :label="novoCheckIn.id ? 'Salvar Alterações' : 'Registrar'" icon="pi pi-check" @click="salvarCheckIn" :loading="isLoadingCheckIn"/>
        </template>
    </Dialog>

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