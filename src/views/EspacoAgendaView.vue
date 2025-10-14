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
import InputSwitch from 'primevue/inputswitch';

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

// --- NOVOS ESTADOS PARA RECORRÊNCIA ---
const isRecorrente = ref(false);
const frequencia = ref(null);
const dataFimRecorrencia = ref(null);
const frequenciaOptions = ref([
    { label: 'Semanalmente', value: 'SEMANAL' },
]);

// --- INÍCIO DA CORREÇÃO ---
// A linha abaixo estava faltando. Ela cria a variável computada que o template precisa.
const isEdicaoRecorrente = computed(() => !!eventoEmEdicao.value.grupo_recorrencia);
// --- FIM DA CORREÇÃO ---

watch(solicitanteSelecionado, (novoValor) => {
    eventoEmEdicao.value.solicitante = novoValor ? novoValor.id : null;
});

// --- FUNÇÕES DE CARREGAMENTO ---
const fetchAgendaData = async () => {
    isLoading.value = true;
    const espacoId = route.params.id;
    try {
        const [espacoRes, reservasRes, agendasRes] = await Promise.all([
            apiClient.get(`/api/espacos/${espacoId}/`),
            apiClient.get(`/api/reservas-espaco/`, { params: { espaco: espacoId } }),
            apiClient.get(`/api/espacos/${espacoId}/agenda/`)
        ]);
        
        espaco.value = espacoRes.data;

        // Adiciona cor diferente para eventos recorrentes
        const eventosReservas = reservasRes.data.map(e => ({
            id: e.id,
            title: e.titulo,
            start: e.data_inicio,
            end: e.data_fim,
            color: e.grupo_recorrencia ? '#059669' : '#10b981', 
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

// --- LÓGICA DO CALENDÁRIO E CRUD ---
const handleEventClick = async (clickInfo) => {
    const { tipo, id } = clickInfo.event.extendedProps;

    if (tipo === 'agenda') {
        toast.add({ severity: 'info', summary: 'Aviso', detail: 'Esta é uma Solicitação de Agenda. A edição deve ser feita na tela de Agendas.', life: 4000 });
        return;
    }

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
            sugestoesMunicipes.value = [solicitanteObj];
            solicitanteSelecionado.value = solicitanteObj;
        } else {
            solicitanteSelecionado.value = null; // Garante que limpe se não houver solicitante
        }
        dialogoEventoVisivel.value = true;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os detalhes da reserva.' });
    }
};

const handleDateSelect = (selectionInfo) => {
    eventoEmEdicao.value = {
        titulo: '',
        observacoes: '',
        solicitante: null,
        espaco: espaco.value.id,
        data_inicio: selectionInfo.start,
        data_fim: selectionInfo.end,
    };
    
    isRecorrente.value = false;
    frequencia.value = null;
    dataFimRecorrencia.value = null;
    solicitanteSelecionado.value = null;

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
            const params = { q: event.query || '' };
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
    const payload = { ...eventoEmEdicao.value };

    if (!payload.titulo || !payload.data_inicio || !payload.data_fim) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Assunto, Início e Término são obrigatórios.', life: 3000 });
        return;
    }
    if (new Date(payload.data_fim) <= new Date(payload.data_inicio)) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'O horário de término deve ser posterior ao de início.', life: 3000 });
        return;
    }
    if (isRecorrente.value && (!frequencia.value || !dataFimRecorrencia.value)) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Para eventos recorrentes, a frequência e a data final são obrigatórias.', life: 3000 });
        return;
    }
     if (isRecorrente.value && new Date(dataFimRecorrencia.value) <= new Date(payload.data_inicio)) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'A data final da recorrência deve ser posterior à data de início.', life: 3000 });
        return;
    }

    try {
        if (payload.id) { 
            await apiClient.put(`/api/reservas-espaco/${payload.id}/`, payload);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Reserva atualizada com sucesso!', life: 3000 });
        } else {
            const payloadCriacao = {
                ...payload,
                is_recorrente: isRecorrente.value,
                frequencia: isRecorrente.value ? frequencia.value : null,
                data_fim_recorrencia: isRecorrente.value ? dataFimRecorrencia.value.toISOString().split('T')[0] : null
            };
            await apiClient.post('/api/reservas-espaco/', payloadCriacao);
            const detailMsg = isRecorrente.value ? 'Reservas recorrentes criadas com sucesso!' : 'Espaço reservado com sucesso!';
            toast.add({ severity: 'success', summary: 'Sucesso', detail: detailMsg, life: 3000 });
        }
        dialogoEventoVisivel.value = false;
        fetchAgendaData();
    } catch (error) {
        const errorMsg = error.response?.data?.detail || error.response?.data?.non_field_errors?.[0] || 'Não foi possível salvar a reserva.';
        toast.add({ severity: 'error', summary: 'Erro', detail: errorMsg, life: 5000 });
    }
};

const confirmarExclusaoRecorrente = () => {
    const reserva = eventoEmEdicao.value;
    confirm.require({
        message: `Você deseja excluir apenas esta ocorrência ou toda a série de eventos?`,
        header: 'Excluir Evento Recorrente',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Apenas esta',
        accept: () => excluirReserva(reserva.id, 'unica'),
        rejectLabel: 'Toda a série',
        reject: () => excluirReserva(reserva.id, 'serie'),
        rejectClassName: 'p-button-danger'
    });
};

const excluirReserva = async (id, escopo = 'unica') => {
    try {
        await apiClient.delete(`/api/reservas-espaco/${id}/`, { params: { escopo } });
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Reserva(s) excluída(s).', life: 3000 });
        dialogoEventoVisivel.value = false;
        fetchAgendaData();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir a reserva.', life: 3000 });
    }
}

const tituloDialogoEvento = computed(() => {
    if (!eventoEmEdicao.value.id) return 'Nova Reserva de Espaço';
    if (isEdicaoRecorrente.value) return 'Editar Série de Reservas';
    return 'Editar Reserva';
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
            <Message v-if="isEdicaoRecorrente" severity="info">
                Você está editando uma série de eventos. Alterações no assunto e descrição serão aplicadas a todos. Para alterar datas, exclua a série e crie-a novamente.
            </Message>
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
                    :disabled="isEdicaoRecorrente"
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
                    <Calendar id="reserva-inicio" v-model="eventoEmEdicao.data_inicio" showTime hourFormat="24" dateFormat="dd/mm/yy" :disabled="isEdicaoRecorrente" />
                </div>
                <div class="field col-12 md:col-6">
                    <label for="reserva-fim">Término*</label>
                    <Calendar id="reserva-fim" v-model="eventoEmEdicao.data_fim" showTime hourFormat="24" dateFormat="dd/mm/yy" :disabled="isEdicaoRecorrente" />
                </div>
            </div>
            
            <div v-if="!eventoEmEdicao.id" class="card p-3 border-1 surface-border">
                <div class="field-checkbox flex align-items-center">
                    <InputSwitch id="recorrente" v-model="isRecorrente" />
                    <label for="recorrente" class="ml-2">Repetir este evento</label>
                </div>
                <div v-if="isRecorrente" class="grid mt-2">
                    <div class="field col-12 md:col-6">
                        <label for="frequencia">Frequência</label>
                        <Dropdown id="frequencia" v-model="frequencia" :options="frequenciaOptions" optionLabel="label" optionValue="value" placeholder="Selecione"/>
                    </div>
                    <div class="field col-12 md:col-6">
                        <label for="data-fim-recorrencia">Repetir até</label>
                        <Calendar id="data-fim-recorrencia" v-model="dataFimRecorrencia" dateFormat="dd/mm/yy" />
                    </div>
                </div>
            </div>

            <div class="field mt-3">
                <label for="reserva-detalhes">Descrição/Observações</label>
                <Textarea id="reserva-detalhes" v-model="eventoEmEdicao.observacoes" rows="3" />
            </div>
            <template #footer>
                <div class="flex justify-content-between">
                    <div>
                        <Button v-if="eventoEmEdicao.id && !isEdicaoRecorrente" label="Excluir" icon="pi pi-trash" severity="danger" text @click="confirm.require({ message: 'Deseja excluir esta reserva?', header: 'Confirmar Exclusão', accept: () => excluirReserva(eventoEmEdicao.id, 'unica') })" />
                        <Button v-if="isEdicaoRecorrente" label="Excluir Opções" icon="pi pi-trash" severity="danger" text @click="confirmarExclusaoRecorrente" />
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