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
            <template #title>Relatório de Agenda</template>
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

                    <FullCalendar v-if="!loading" :options="calendarOptions" />
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
import { ref, onMounted, computed } from 'vue';
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

// --- INICIALIZAÇÃO ---
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const confirm = useConfirm();
const loading = ref(true);

const calendarOptions = ref({});
const dialogoEventoVisivel = ref(false);
const eventoEmEdicao = ref({});
const errors = ref({});
const activeTab = ref(0);
const dataInicio = ref(null);
const dataFim = ref(null);
const filtroDataRelatorio = ref(null); 
const downloadingPdf = ref(false);

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
const fetchEventos = async () => {
    if (!authStore.isAuthenticated) {
        isLoading.value = false;
        return;
    }
    loading.value = true;
    try {
        const response = await eventosService.getEventos();
        calendarOptions.value.events = response.data.map(evento => ({
            id: evento.id,
            title: evento.nome,
            start: evento.data_evento,
            color: getCorPorStatus(evento.status),
            extendedProps: evento
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