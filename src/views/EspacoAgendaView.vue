<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { useAuthStore } from '@/stores/auth';
import { useConfirm } from "primevue/useconfirm";
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

// --- INICIALIZAÇÃO ---
const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const confirm = useConfirm();

const isLoading = ref(true);
const espaco = ref(null);

// --- ESTADO DO DIÁLOGO ---
const dialogoEventoVisivel = ref(false);
const eventoEmEdicao = ref({});
const municipesOptions = ref([]);
const isLoadingMunicipes = ref(false);
const sugestoesMunicipes = ref([]);
const solicitanteSelecionado = ref(null);
let searchTimeout = null;

watch(solicitanteSelecionado, (novoValor) => {
    eventoEmEdicao.value.solicitante = novoValor ? novoValor.id : null;
});

// --- FUNÇÕES DE CARREGAMENTO (CORRIGIDA) ---
const fetchAgendaData = async () => {
    isLoading.value = true;
    const espacoId = route.params.id;
    try {
        const [espacoRes, reservasRes, agendasRes] = await Promise.all([
            apiClient.get(`/api/espacos/${espacoId}/`),
            // A CHAMADA AGORA ENVIA O FILTRO CORRETO
            apiClient.get(`/api/reservas-espaco/`, { params: { espaco: espacoId } }),
            apiClient.get(`/api/agendas/?espaco=${espacoId}&status=AGENDADO`)
        ]);
        
        espaco.value = espacoRes.data;

        // O resto da função para unificar os eventos continua igual...
        const eventosReservas = reservasRes.data.map(e => ({
            id: e.id,
            title: e.titulo,
            start: e.data_inicio,
            end: e.data_fim,
            color: '#10b981',
            extendedProps: { tipo: 'reserva', ...e }
        }));
        const eventosAgendas = agendasRes.data.map(e => ({
            id: e.id,
            title: e.assunto,
            start: e.data_agendada,
            end: e.data_agendada_fim,
            color: '#3B82F6',
            extendedProps: { tipo: 'agenda', ...e }
        }));

        calendarOptions.value.events = [...eventosReservas, ...eventosAgendas];

    } catch (error) {
        console.error("Erro ao carregar dados da agenda:", error);
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar a agenda do espaço.' });
    } finally {
        isLoading.value = false;
    }
};

onMounted(() => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  fetchAgendaData();
});

// --- LÓGICA DO CALENDÁRIO E CRUD (COM CORREÇÕES) ---

const handleEventClick = async (clickInfo) => {
    // Pega o tipo de evento que definimos (reserva ou agenda)
    const { tipo, id } = clickInfo.event.extendedProps;

    // Se for uma Solicitação de Agenda, apenas exibe um aviso
    if (tipo === 'agenda') {
        toast.add({ 
            severity: 'info', 
            summary: 'Aviso', 
            detail: 'Esta é uma Solicitação de Agenda. A edição deve ser feita na tela de Agendas.',
            life: 4000
        });
        return;
    }

    // Se for uma Reserva, busca os dados na API correta
    try {
        const response = await apiClient.get(`/api/reservas-espaco/${id}/`);
        const reservaCompleta = response.data;
        
        eventoEmEdicao.value = {
            ...reservaCompleta,
            data_inicio: new Date(reservaCompleta.data_inicio),
            data_fim: new Date(reservaCompleta.data_fim),
        };

        if (reservaCompleta.solicitante) {
            const solicitanteObj = { id: reservaCompleta.solicitante, nome_completo: reservaCompleta.solicitante_nome };
            municipesOptions.value = [solicitanteObj];
            solicitanteSelecionado.value = solicitanteObj;
        }
        dialogoEventoVisivel.value = true;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os detalhes da reserva.' });
    }
};

const handleDateSelect = (selectionInfo) => {
    // 1. Reseta o objeto principal da reserva (como já fazia)
    eventoEmEdicao.value = {
        titulo: '',
        observacoes: '',
        solicitante: null,
        espaco: espaco.value.id,
        data_inicio: selectionInfo.start,
        data_fim: selectionInfo.end,
    };
    
    // 2. Reseta o estado do AutoComplete (a parte que faltava)
    solicitanteSelecionado.value = null; // Limpa qualquer seleção anterior
    municipesOptions.value = [];       // Limpa a lista de sugestões antigas

    // 3. Abre o diálogo
    dialogoEventoVisivel.value = true;
};

const calendarOptions = ref({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'timeGridWeek',
  headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
  events: [],
  selectable: true,
  select: handleDateSelect,
  eventClick: handleEventClick,
  locale: 'pt-br',
  buttonText: { today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' },
  allDayText: 'Dia todo',
  slotMinTime: '07:00:00',
  slotMaxTime: '22:00:00',
});

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

const salvarReserva = async () => {
    const payloadOriginal = { ...eventoEmEdicao.value };

    // Validações
    if (!payloadOriginal.titulo || !payloadOriginal.data_inicio || !payloadOriginal.data_fim) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Assunto, Início e Término são obrigatórios.' });
        return;
    }
    if (new Date(payloadOriginal.data_fim) <= new Date(payloadOriginal.data_inicio)) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'O horário de término deve ser posterior ao de início.' });
        return;
    }
    
    // Mapeia os dados do formulário para o formato da nova API
    const payloadFinal = {
        id: payloadOriginal.id,
        titulo: payloadOriginal.titulo,
        solicitante: payloadOriginal.solicitante,
        espaco: payloadOriginal.espaco,
        data_inicio: new Date(payloadOriginal.data_inicio).toISOString(),
        data_fim: new Date(payloadOriginal.data_fim).toISOString(),
        observacoes: payloadOriginal.observacoes || payloadOriginal.detalhes || ''
    };

    try {
        if (payloadFinal.id) { // Edição
            await apiClient.put(`/api/reservas-espaco/${payloadFinal.id}/`, payloadFinal);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Reserva atualizada com sucesso!' });
        } else { // Criação
            await apiClient.post('/api/reservas-espaco/', payloadFinal);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Espaço reservado com sucesso!' });
        }
        dialogoEventoVisivel.value = false;
        fetchAgendaData(); // <-- Esta linha é a que atualiza o calendário!
    } catch (error) {
        const errorMsg = error.response?.data?.non_field_errors?.[0] || 'Não foi possível salvar a reserva.';
        toast.add({ severity: 'error', summary: 'Erro', detail: errorMsg, life: 4000 });
    }
};

const confirmarExclusao = () => {
    const reserva = eventoEmEdicao.value;
    confirm.require({
        message: `Tem certeza que deseja excluir a reserva "${reserva.titulo}"?`,
        header: 'Confirmar Exclusão',
        icon: 'pi pi-exclamation-triangle',
        acceptClassName: 'p-button-danger',
        accept: async () => {
            try {
                const idParaExcluir = reserva.id || clickInfo.event.extendedProps.id;
                await apiClient.delete(`/api/reservas-espaco/${idParaExcluir}/`);
                toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Reserva excluída.' });
                dialogoEventoVisivel.value = false;
                fetchAgendaData();
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir a reserva.' });
            }
        },
    });
};

const tituloDialogoEvento = computed(() => {
    return eventoEmEdicao.value.id ? 'Editar Reserva de Espaço' : 'Nova Reserva de Espaço';
});
</script>

<template>
  <div class="page-container">
    <Toast />
    <ConfirmDialog />
    <header v-if="espaco" class="page-header">
      <div class="flex align-items-center">
        <router-link to="/espacos">
          <Button icon="pi pi-arrow-left" severity="secondary" text rounded />
        </router-link>
        <h1 class="ml-2">Agenda do Espaço: {{ espaco.nome }}</h1>
      </div>
    </header>

    <main>
      <Card>
        <template #content>
          <div v-if="isLoading" class="text-center p-5">
            <ProgressSpinner />
            <p>Carregando agenda...</p>
          </div>
          <FullCalendar v-else :options="calendarOptions" ref="calendarRef" />
        </template>
      </Card>
    </main>

    <Dialog v-model:visible="dialogoEventoVisivel" :style="{width: '600px'}" :header="tituloDialogoEvento" :modal="true" class="p-fluid">
        <div class="field">
            <label for="reserva-assunto">Assunto da Reunião*</label>
            <InputText id="reserva-assunto" v-model="eventoEmEdicao.titulo" />
        </div>
        <div class="field">
            <label for="reserva-solicitante">Solicitante (Opcional)</label>
            <AutoComplete
                id="reserva-solicitante"
                v-model="solicitanteSelecionado"
                :suggestions="sugestoesMunicipes"
                @complete="buscarMunicipes"
                field="nome_completo"
                placeholder="Busque por nome ou apelido..."
                forceSelection
                style="width: 100%;"
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
        <div class="grid">
            <div class="field col-12 md:col-6">
                <label for="reserva-inicio">Início*</label>
                <Calendar id="reserva-inicio" v-model="eventoEmEdicao.data_inicio" showTime hourFormat="24" dateFormat="dd/mm/yy" />
            </div>
            <div class="field col-12 md:col-6">
                <label for="reserva-fim">Término*</label>
                <Calendar id="reserva-fim" v-model="eventoEmEdicao.data_fim" showTime hourFormat="24" dateFormat="dd/mm/yy" />
            </div>
        </div>
        <div class="field">
            <label for="reserva-detalhes">Descrição/Observações</label>
            <Textarea id="reserva-detalhes" v-model="eventoEmEdicao.observacoes" rows="3" />
        </div>
      <template #footer>
        <div class="flex justify-content-between">
          <div>
            <Button v-if="eventoEmEdicao.id" label="Excluir Reserva" icon="pi pi-trash" severity="danger" text @click="confirmarExclusao" />
          </div>
          <div class="flex gap-2">
            <Button label="Cancelar" icon="pi pi-times" text @click="dialogoEventoVisivel = false" />
            <Button :label="eventoEmEdicao.id ? 'Salvar Alterações' : 'Confirmar Reserva'" icon="pi pi-check" @click="salvarReserva" />
          </div>
        </div>
      </template>
    </Dialog>

  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
</style>