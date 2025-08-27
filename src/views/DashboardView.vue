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

// --- NOVO ESTADO PARA CHECK-IN / REGISTRO DE VISITAS ---
const visitasDoDia = ref([]);
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

const carregarVisitasDoDia = async () => {
    try {
        const visitasRes = await apiClient.get('/api/checkins/');
        visitasDoDia.value = visitasRes.data;
    } catch (error) {
        console.error("Erro ao carregar visitas do dia:", error);
    }
};

// --- CARREGAMENTO INICIAL ---
onMounted(async () => {
    if (!authStore.isAuthenticated) return;
    isLoading.value = true;
    try {
        const [atendimentosRes, contasRes] = await Promise.all([
            apiClient.get('/api/atendimentos/'),
            apiClient.get('/api/contas/')
        ]);
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

        if (authStore.isRecepcao || authStore.user?.is_superuser) {
            await carregarVisitasDoDia();
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
        await carregarVisitasDoDia(); // Recarrega a lista para refletir a mudança
        
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
                await carregarVisitasDoDia(); // Recarrega a lista
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
        <Button v-if="authStore.isRecepcao || authStore.user?.is_superuser" 
            label="Registrar Visita (Check-in)" 
            icon="pi pi-user-plus" 
            @click="abrirDialogoParaCriacaoCheckIn"  
            class="p-button-secondary" />
        <Button label="Novo Atendimento" icon="pi pi-plus" @click="irParaNovoAtendimento" class="p-button-success" />
      </div>
    </header>
    
    <DashboardSummary class="mb-4" />

    <Card class="mb-4" v-if="authStore.isRecepcao || authStore.user?.is_superuser">
        <template #title>Visitantes de Hoje</template>
        <template #content>
            <DataTable :value="visitasDoDia" :loading="isLoading" responsiveLayout="scroll" :rows="5" paginator :alwaysShowPaginator="false">
                <Column field="data_checkin" header="Horário">
                    <template #body="slotProps">{{ new Date(slotProps.data.data_checkin).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}</template>
                </Column>
                <Column field="municipe_nome" header="Visitante"></Column>
                <Column field="conta_destino_nome" header="Destino"></Column>
                <Column field="observacao" header="Observação"></Column>
                <Column field="registrado_por_nome" header="Registrado Por"></Column>
                <Column header="Ações" style="width: 8rem; text-align: center;">
                  <template #body="slotProps">
                    <Button icon="pi pi-pencil" text rounded severity="secondary" @click="abrirDialogoParaEdicaoCheckIn(slotProps.data)" title="Editar" />
                    <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmarExclusaoCheckIn(slotProps.data)" title="Excluir" />
                  </template>
                </Column>
                <template #empty> Nenhum visitante registrado hoje. </template>
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