<template>
    <div class="page-container">
        <Toast />
        <ConfirmDialog />
        <header class="page-header">
        <div class="flex align-items-center">
            <h1>Eventos da Conta</h1>
        </div>
        </header>
        <Card class="mb-4">
            <template #title>Relatório de Eventos</template>
            <template #content>
                <div class="grid formgrid p-fluid align-items-end">
                    <div class="field col-12 md:col-6">
                        <label for="filtroDataRelatorio">Selecione o Período do Relatório</label>
                        <Calendar id="filtroDataRelatorio" v-model="filtroDataRelatorio" selectionMode="range" dateFormat="dd/mm/yy" />
                    </div>
                    <div class="field col-12 md:col-3 flex align-items-end">
                        <Button 
                            label="Gerar PDF" 
                            icon="pi pi-file-pdf" 
                            class="p-button-danger"
                            @click="baixarRelatorioEventos" 
                            :loading="downloadingPdf"
                            :disabled="!filtroDataRelatorio || !filtroDataRelatorio[1]"
                        />
                    </div>
                </div>
            </template>
        </Card>
        <main>
            <Card>
                <template #content>
                    <Toast />
                    <ConfirmDialog></ConfirmDialog>

                    <Toolbar class="mb-4">
                        <template #start>
                            <Button label="Novo Evento" icon="pi pi-plus" class="p-button-success" @click="abrirDialogoNovoEvento" />
                        </template>
                        <template #end>
                            <h5 class="m-0">Calendário de Eventos</h5>
                        </template>
                    </Toolbar>

                    <div class="flex flex-column lg:flex-row lg:align-items-end gap-3 mb-4">
                        <div class="field mb-0 flex-1" style="max-width: 32rem;">
                            <label for="busca-evento-nome" class="block text-600 text-sm mb-1">Buscar evento (qualquer data)</label>
                            <div class="p-inputgroup">
                                <span class="p-inputgroup-addon"><i class="pi pi-search" aria-hidden="true" /></span>
                                <InputText
                                    id="busca-evento-nome"
                                    v-model="filtroBuscaEvento"
                                    type="search"
                                    class="w-full"
                                    placeholder="Nome do evento…"
                                    autocomplete="off"
                                    @keyup.enter="executarBuscaEventos"
                                />
                                <Button
                                    type="button"
                                    label="Buscar"
                                    icon="pi pi-list"
                                    :loading="loadingBusca"
                                    @click="executarBuscaEventos"
                                    v-tooltip.top="'Mostra todos os eventos que batem com o nome (em qualquer data). O calendário continua na semana atual.'"
                                />
                            </div>
                        </div>
                        <div class="field mb-0 flex-1" style="max-width: 22rem;">
                            <label for="filtro-status-eventos" class="block text-600 text-sm mb-1">Status</label>
                            <MultiSelect
                                id="filtro-status-eventos"
                                v-model="filtroStatusEventos"
                                :options="statusFiltroCalendarioOptions"
                                optionLabel="label"
                                optionValue="value"
                                placeholder="Todos os status"
                                display="chip"
                                class="w-full"
                                :showClear="true"
                                :maxSelectedLabels="2"
                                selectedItemsLabel="{0} status"
                            />
                        </div>
                        <Button
                            type="button"
                            label="Limpar filtros"
                            icon="pi pi-filter-slash"
                            class="p-button-text align-self-start lg:align-self-end"
                            :disabled="!filtroBuscaEvento?.trim() && !filtroStatusEventos?.length"
                            @click="limparFiltrosEventos"
                        />
                    </div>

                    <Dialog
                        v-model:visible="dialogResultadosBuscaVisivel"
                        header="Resultados da busca"
                        :modal="true"
                        :dismissableMask="true"
                        :style="{ width: 'min(96vw, 760px)' }"
                        :breakpoints="{ '768px': '95vw' }"
                    >
                        <p v-if="termoBuscaUtilizado" class="text-sm text-color-secondary mt-0 mb-3">
                            Termo: <strong>{{ termoBuscaUtilizado }}</strong>
                            <span v-if="filtroStatusEventos?.length" class="ml-2">
                                · Filtrando por status selecionado no calendário
                            </span>
                        </p>
                        <DataTable
                            :value="resultadosBusca"
                            :loading="loadingBusca"
                            responsiveLayout="scroll"
                            stripedRows
                            sortField="data_evento"
                            :sortOrder="1"
                            scrollHeight="420px"
                        >
                            <template #empty>
                                <span v-if="!loadingBusca">Nenhum evento encontrado.</span>
                            </template>
                            <Column field="data_evento" header="Dia" sortable :sortField="'data_evento'">
                                <template #body="{ data }">
                                    {{ formatarDiaEvento(data.data_evento) }}
                                </template>
                            </Column>
                            <Column header="Hora" sortable :sortField="'data_evento'">
                                <template #body="{ data }">
                                    {{ formatarHoraEvento(data.data_evento) }}
                                </template>
                            </Column>
                            <Column field="nome" header="Evento" sortable style="min-width: 12rem" />
                            <Column field="status" header="Status" sortable style="width: 9rem">
                                <template #body="{ data }">
                                    <Tag :value="labelStatus(data.status)" :severity="severidadeStatus(data.status)" />
                                </template>
                            </Column>
                            <Column header="" style="width: 8rem">
                                <template #body="{ data }">
                                    <Button
                                        type="button"
                                        label="Abrir"
                                        icon="pi pi-pencil"
                                        size="small"
                                        outlined
                                        @click="abrirEventoAPartirDaBusca(data)"
                                    />
                                </template>
                            </Column>
                        </DataTable>
                        <template #footer>
                            <Button label="Fechar" icon="pi pi-times" text @click="dialogResultadosBuscaVisivel = false" />
                        </template>
                    </Dialog>

                    <FullCalendar ref="fullCalendarRef" v-if="!loading" :options="calendarOptions" />
                    <div v-else class="text-center p-5"><ProgressSpinner /></div>
                </template>
            </Card>
        </main>
    </div>

    <Dialog v-model:visible="dialogoEventoVisivel" :style="{ width: '800px' }" :header="tituloDialogo" :modal="true" class="p-fluid">

        <div class="flex gap-2">
            <Button label="Comunicação" icon="pi pi-send" class="p-button-outlined" @click="navegarPara('evento-comunicacoes')" :disabled="isNew" />
            <Button label="Convidados" icon="pi pi-users" class="p-button-outlined" @click="navegarPara('evento-convidados')" :disabled="isNew" />
            <Button label="Presença" icon="pi pi-list-check" class="p-button-outlined" @click="navegarPara('evento-presenca')" :disabled="isNew" />
            <Button label="Checklist" icon="pi pi-check-square" class="p-button-outlined" @click="navegarPara('evento-checklist')" :disabled="isNew" />
        </div>
        
        <Divider />

        <div class="p-fluid formgrid grid mt-3">
            <div class="field col-12">
                <label for="nome">Nome do Evento</label>
                <InputText id="nome" v-model.trim="eventoEmEdicao.nome" required="true" :class="{'p-invalid': errors.nome}" />
                <small class="p-error">{{ errors.nome }}</small>
            </div>
            
            <div class="field col-12 md:col-6">
                <label for="data_inicio">Início</label>
                <Calendar id="data_inicio" v-model="eventoEmEdicao.data_evento" :showTime="true" hourFormat="24" dateFormat="dd/mm/yy" />
            </div>

            <div class="field col-12 md:col-6">
                <label for="local">Local</label>
                <InputText id="local" v-model="eventoEmEdicao.local" />
            </div>

            <div class="field col-12">
                <label for="descricao">Descrição</label>
                <Textarea id="descricao" v-model="eventoEmEdicao.descricao" rows="4" />
            </div>
            
            <div class="field col-12 md:col-6">
                <label for="status">Status</label>
                <Dropdown id="status" v-model="eventoEmEdicao.status" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Selecione um status"></Dropdown>
            </div>
            
            <div class="field col-12 md:col-6 flex flex-column justify-content-center">
                <label for="ativo" class="mb-3">Ativo para Check-in</label>
                <InputSwitch id="ativo" v-model="eventoEmEdicao.ativo" />
            </div>
        </div>

        <template #footer>
            <div class="flex gap-2">
                <Button label="Excluir" icon="pi pi-trash" class="p-button-danger" @click="confirmarDelete" :disabled="isNew" />
                <Button label="Salvar" icon="pi pi-check" @click="salvarEvento" />
            </div>
        </template>
    </Dialog>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import eventosService from '@/services/eventos';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useAuthStore } from '@/stores/auth';

import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Panel from 'primevue/panel';
import Calendar from 'primevue/calendar';
import Divider from 'primevue/divider'

import InputSwitch from 'primevue/inputswitch';
import InputText from 'primevue/inputtext';
import MultiSelect from 'primevue/multiselect';

// --- INICIALIZAÇÃO ---
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const confirm = useConfirm();
const loading = ref(true);

const calendarOptions = ref({});
const fullCalendarRef = ref(null);
const dialogoEventoVisivel = ref(false);
const eventoEmEdicao = ref({});
const errors = ref({});
const activeTab = ref(0);
const dataInicio = ref(null);
const dataFim = ref(null);
const filtroDataRelatorio = ref(null); 
const downloadingPdf = ref(false);
const filtroBuscaEvento = ref('');
const filtroStatusEventos = ref([]);
const statusFiltroCalendarioOptions = [
    { label: 'Agendado', value: 'agendado' },
    { label: 'Concluído', value: 'concluido' },
    { label: 'Cancelado', value: 'cancelado' },
    { label: 'Stand-by', value: 'standby' },
];
const dialogResultadosBuscaVisivel = ref(false);
const resultadosBusca = ref([]);
const loadingBusca = ref(false);
const termoBuscaUtilizado = ref('');

const limparFiltrosEventos = () => {
    filtroBuscaEvento.value = '';
    filtroStatusEventos.value = [];
    dialogResultadosBuscaVisivel.value = false;
    resultadosBusca.value = [];
    termoBuscaUtilizado.value = '';
    fetchEventos();
};

watch(
    filtroStatusEventos,
    () => {
        fetchEventos();
    },
    { deep: true }
);

const navegarPara = (routeName) => {
    // Fecha o modal antes de navegar
    dialogoEventoVisivel.value = false;
    // Usa o router para ir para a página de gestão dedicada
    router.push({ name: routeName, params: { id: eventoEmEdicao.value.id } });
};

const statusOptions = ref([
    { label: 'Agendado', value: 'agendado' },
    { label: 'Concluído', value: 'concluido' },
    { label: 'Cancelado', value: 'cancelado' },
    { label: 'Stand-by', value: 'standby' }
]);

const isNew = computed(() => !eventoEmEdicao.value.id);
const tituloDialogo = computed(() => isNew.value ? 'Novo Evento' : 'Gerenciar Evento');

const checklistUrl = computed(() => {
    if (eventoEmEdicao.value?.checklist?.token) {
        return `${window.location.origin}/checklist/${eventoEmEdicao.value.checklist.token}`;
    }
    return '';
});


// --- CARREGAMENTO DE DADOS ---
const formatarDiaEvento = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

const formatarHoraEvento = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const labelStatus = (s) =>
    ({ agendado: 'Agendado', concluido: 'Concluído', cancelado: 'Cancelado', standby: 'Stand-by' }[s] || s);

const severidadeStatus = (s) =>
    ({ agendado: 'success', concluido: 'secondary', cancelado: 'danger', standby: 'info' }[s] || 'secondary');

const executarBuscaEventos = async () => {
    const q = filtroBuscaEvento.value?.trim();
    if (!q) {
        toast.add({
            severity: 'warn',
            summary: 'Busca',
            detail: 'Digite um trecho do nome do evento para buscar.',
            life: 3000,
        });
        return;
    }
    loadingBusca.value = true;
    dialogResultadosBuscaVisivel.value = true;
    resultadosBusca.value = [];
    termoBuscaUtilizado.value = q;
    try {
        const params = { search: q };
        if (filtroStatusEventos.value?.length) {
            params.status = [...filtroStatusEventos.value];
        }
        const response = await eventosService.getEventos(params);
        const lista = Array.isArray(response.data) ? response.data : response.data?.results ?? [];
        lista.sort((a, b) => new Date(a.data_evento) - new Date(b.data_evento));
        resultadosBusca.value = lista;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao buscar eventos.', life: 3000 });
        dialogResultadosBuscaVisivel.value = false;
    } finally {
        loadingBusca.value = false;
    }
};

const navegarCalendarioParaData = (dataEvento) => {
    if (!dataEvento) return;
    const api = fullCalendarRef.value?.getApi?.();
    if (!api) return;
    api.gotoDate(dataEvento);
};

const abrirEventoAPartirDaBusca = (evento) => {
    dialogResultadosBuscaVisivel.value = false;
    navegarCalendarioParaData(evento?.data_evento);
    abrirDialogoEdicao({ id: evento.id });
};

const fetchEventos = async () => {
    if (!authStore.isAuthenticated) {
        loading.value = false;
        return;
    }
    loading.value = true;
    try {
        const params = {};
        if (filtroStatusEventos.value?.length) {
            params.status = [...filtroStatusEventos.value];
        }
        const response = await eventosService.getEventos(params);
        const lista = Array.isArray(response.data) ? response.data : response.data?.results ?? [];
        calendarOptions.value.events = lista.map((evento) => ({
            id: evento.id,
            title: evento.nome,
            start: evento.data_evento,
            color: getCorPorStatus(evento.status),
            extendedProps: evento,
        }));
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar eventos.' });
    } finally {
        loading.value = false;
    }
};

onMounted(fetchEventos);

// --- LÓGICA DO DIALOG (MODAL) ---
const abrirDialogoNovoEvento = (selectionInfo = null) => {
    eventoEmEdicao.value = {
        nome: '',
        descricao: '',
        local: '',
        ativo: true,
        status: 'agendado',
        data_evento: selectionInfo ? new Date(selectionInfo.startStr) : new Date(),
    };
    errors.value = {};
    activeTab.value = 0; // Sempre abre na primeira aba
    dialogoEventoVisivel.value = true;
};

const abrirDialogoEdicao = (eventoClicado) => {
    // Busca os dados mais recentes do evento para ter todas as informações (como o checklist)
    eventosService.getEvento(eventoClicado.id).then(response => {
        eventoEmEdicao.value = { 
            ...response.data,
            data_evento: new Date(response.data.data_evento)
        };
        errors.value = {};
        activeTab.value = 0; // Sempre abre na primeira aba
        dialogoEventoVisivel.value = true;
    }).catch(() => {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os detalhes do evento.' });
    });
};

const salvarEvento = async () => {
    errors.value = {};
    if (!eventoEmEdicao.value.nome) {
        errors.value.nome = "O nome do evento é obrigatório.";
        return;
    }

    try {
        if (!isNew.value) {
            await eventosService.updateEvento(eventoEmEdicao.value.id, eventoEmEdicao.value);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Evento atualizado!', life: 3000 });
        } else {
            await eventosService.createEvento(eventoEmEdicao.value);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Evento criado!' });
        }
        dialogoEventoVisivel.value = false;
        fetchEventos();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar o evento.', life: 3000 });
    }
};

const confirmarDelete = () => {
    confirm.require({
        message: `Tem certeza que deseja deletar o evento "${eventoEmEdicao.value.nome}"?`,
        header: 'Confirmação de Exclusão',
        icon: 'pi pi-info-circle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await eventosService.deleteEvento(eventoEmEdicao.value.id);
                toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Evento deletado.', life: 3000 });
                dialogoEventoVisivel.value = false;
                fetchEventos();
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível deletar o evento.', life: 3000 });
            }
        },
    });
};

const copiarLink = () => {
    navigator.clipboard.writeText(checklistUrl.value);
    toast.add({ severity: 'info', summary: 'Copiado', detail: 'Link copiado para a área de transferência', life: 3000 });
};

// --- CONFIGURAÇÃO DO CALENDÁRIO ---
calendarOptions.value = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'timeGridWeek',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' },
    events: [],
    selectable: true,
    select: abrirDialogoNovoEvento,
    eventClick: (clickInfo) => abrirDialogoEdicao(clickInfo.event.extendedProps),
    locale: 'pt-br',
    buttonText: { today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' },
    slotMinTime: '07:00:00',
    slotMaxTime: '22:00:00',
};

const getCorPorStatus = (status) => ({
    agendado: '#22C55E',
    concluido: '#64748B',
    cancelado: '#EF4444',
    standby: '#3B82F6',
})[status] || '#3B82F6';

const baixarRelatorioEventos = async () => {
    // A validação agora checa se o array tem duas datas
    if (!filtroDataRelatorio.value || !filtroDataRelatorio.value[1]) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Por favor, selecione um período completo (início e fim).', life: 3000 });
        return;
    }

    const [data_inicio, data_fim] = filtroDataRelatorio.value;

    downloadingPdf.value = true;
    try {
        // O serviço já espera duas datas, então a chamada continua a mesma
        const response = await eventosService.getEventosReport(data_inicio, data_fim);
        
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        
        const contentDisposition = response.headers['content-disposition'];
        let fileName = 'relatorio_eventos.pdf';
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
            if (fileNameMatch && fileNameMatch.length === 2)
                fileName = fileNameMatch[1];
        }

        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);

    } catch (err) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o relatório.', life: 3000 });
        console.error("Erro ao baixar relatório de eventos:", err);
    } finally {
        downloadingPdf.value = false;
    }
};
</script>

<style scoped>
/* Estilos para o container da página e o cabeçalho */
.page-container {
    padding: 2rem;
}
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
}
</style>