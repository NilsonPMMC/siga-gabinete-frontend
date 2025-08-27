<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useAuthStore } from '@/stores/auth';

import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
const authStore = useAuthStore();

// --- INICIALIZAÇÃO ---
const isLoading = ref(true);
const toast = useToast();
const router = useRouter();
const confirm = useConfirm();

// --- ESTADO DO DIÁLOGO DE CRUD ---
const dialogoEventoVisivel = ref(false);
const eventoEmEdicao = ref({});

const filtroDataRelatorio = ref([]);
const isGeneratingReport = ref(false);

// --- FUNÇÕES DE CRUD ---
const recarregarEventos = async () => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  try {
    const response = await apiClient.get('/api/google/calendar/events/');
    calendarOptions.value.events = response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.detail || "Não foi possível carregar os eventos.";
    toast.add({ severity: 'error', summary: 'Erro de Integração', detail: errorMsg, life: 5000 });
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  recarregarEventos();

  // Define um período padrão para o filtro do relatório (o mês atual)
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  filtroDataRelatorio.value = [startOfMonth, endOfMonth];
});

// --- FUNÇÃO PARA GERAR O PDF ---
const gerarRelatorioPDF = async () => {
    if (!filtroDataRelatorio.value || !filtroDataRelatorio.value[0] || !filtroDataRelatorio.value[1]) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Por favor, selecione um período de datas para o relatório.', life: 3000 });
        return;
    }
    isGeneratingReport.value = true;
    try {
        const params = {
            data_inicio: filtroDataRelatorio.value[0].toISOString().slice(0, 10),
            data_fim: filtroDataRelatorio.value[1].toISOString().slice(0, 10),
        };
        const response = await apiClient.get('/api/relatorios/google-agenda/pdf/', { 
            params,
            responseType: 'blob', 
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `relatorio_google_agenda.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o relatório em PDF.', life: 3000 });
    } finally {
        isGeneratingReport.value = false;
    }
};

const handleDateSelect = (selectionInfo) => {
    eventoEmEdicao.value = {
        title: '',
        description: '',
        location: '',
        start: selectionInfo.start,
        end: selectionInfo.end,
        allDay: selectionInfo.allDay
    };
    dialogoEventoVisivel.value = true;
};

const handleEventClick = (clickInfo) => {
    eventoEmEdicao.value = {
        id: clickInfo.event.id,
        title: clickInfo.event.title,
        start: clickInfo.event.start,
        end: clickInfo.event.end,
        allDay: clickInfo.event.allDay,
        ...clickInfo.event.extendedProps,
        location: clickInfo.event.extendedProps.location || '',
    };
    dialogoEventoVisivel.value = true;
};

const salvarEvento = async () => {
    const payload = {
        title: eventoEmEdicao.value.title,
        description: eventoEmEdicao.value.description,
        location: eventoEmEdicao.value.location,
        start: new Date(eventoEmEdicao.value.start).toISOString(),
        end: new Date(eventoEmEdicao.value.end).toISOString(),
    };

    try {
        if (eventoEmEdicao.value.id) {
            // ATUALIZAR (PATCH)
            await apiClient.patch(`/api/google/calendar/events/${eventoEmEdicao.value.id}/`, payload);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Evento atualizado!', life: 3000 });
        } else {
            // CRIAR (POST)
            await apiClient.post('/api/google/calendar/events/create/', payload);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Evento criado!', life: 3000 });
        }
        dialogoEventoVisivel.value = false;
        recarregarEventos(); // Sincroniza o calendário
    } catch (error) {
        const errorMsg = error.response?.data?.detail || "Não foi possível salvar o evento.";
        toast.add({ severity: 'error', summary: 'Erro', detail: errorMsg, life: 4000 });
    }
};

const confirmarExclusao = () => {
    confirm.require({
        message: `Tem certeza que deseja excluir o evento "${eventoEmEdicao.value.title}" do seu Google Agenda?`,
        header: 'Confirmar Exclusão',
        icon: 'pi pi-exclamation-triangle',
        acceptClassName: 'p-button-danger',
        accept: async () => {
            try {
                await apiClient.delete(`/api/google/calendar/events/${eventoEmEdicao.value.id}/`);
                toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Evento excluído.', life: 3000 });
                dialogoEventoVisivel.value = false;
                recarregarEventos(); // Sincroniza o calendário
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir o evento.', life: 3000 });
            }
        },
    });
};

const calendarOptions = ref({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'timeGridWeek',
  headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
  events: [],
  locale: 'pt-br',
  buttonText: { today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' },
  allDayText: 'Dia todo',
  slotMinTime: '07:00:00',
  slotMaxTime: '22:00:00',
  selectable: true,
  editable: true, // Permite arrastar e redimensionar (futura melhoria)
  select: handleDateSelect,
  eventClick: handleEventClick,
});

const tituloDialogo = computed(() => eventoEmEdicao.value.id ? 'Editar Evento' : 'Novo Evento');
</script>

<template>
  <div class="page-container">
    <Toast />
    <ConfirmDialog />
    <header class="page-header">
      <div class="flex align-items-center">
        <h1>Minha Agenda Google</h1>
      </div>
    </header>

    <Card class="mb-4">
      <template #title>Relatório de Agenda</template>
      <template #content>
        <div class="grid formgrid p-fluid align-items-end">
          <div class="field col-12 md:col-4">
            <label for="filtroDataRelatorio">Selecione o Período do Relatório</label>
            <Calendar id="filtroDataRelatorio" v-model="filtroDataRelatorio" selectionMode="range" dateFormat="dd/mm/yy" appendTo="body" />
          </div>
          <div class="field col-12 md:col-3 flex align-items-end">
            <Button 
                label="Gerar PDF" 
                icon="pi pi-file-pdf" 
                class="p-button-danger"
                @click="gerarRelatorioPDF" 
                :loading="isGeneratingReport" />
          </div>
        </div>
      </template>
    </Card>

    <main>
      <Card>
        <template #content>
          <div v-if="isLoading" class="text-center p-5">
            <ProgressSpinner />
            <p>Carregando eventos do Google Agenda...</p>
          </div>
          <FullCalendar v-else :options="calendarOptions" />
        </template>
      </Card>
    </main>
    
    <Dialog v-model:visible="dialogoEventoVisivel" :header="tituloDialogo" :modal="true" :style="{width: '500px'}" class="p-fluid">
        <div class="field">
            <label for="evento-titulo">Título do Evento*</label>
            <InputText id="evento-titulo" v-model="eventoEmEdicao.title" />
        </div>
        <div class="field">
            <label for="evento-local">Local</label>
            <InputText id="evento-local" v-model="eventoEmEdicao.location" />
        </div>
        <div class="grid">
            <div class="field col-12 md:col-6">
                <label for="evento-inicio">Início*</label>
                <Calendar id="evento-inicio" v-model="eventoEmEdicao.start" showTime hourFormat="24" dateFormat="dd/mm/yy" />
            </div>
            <div class="field col-12 md:col-6">
                <label for="evento-fim">Término*</label>
                <Calendar id="evento-fim" v-model="eventoEmEdicao.end" showTime hourFormat="24" dateFormat="dd/mm/yy" />
            </div>
        </div>
        <div class="field">
            <label for="evento-desc">Descrição</label>
            <Textarea id="evento-desc" v-model="eventoEmEdicao.description" rows="4" />
        </div>

        <template #footer>
            <div class="flex justify-content-between">
                <div>
                    <Button v-if="eventoEmEdicao.id" label="Excluir" icon="pi pi-trash" severity="danger" text @click="confirmarExclusao" />
                </div>
                <div class="flex gap-2">
                    <Button label="Cancelar" icon="pi pi-times" text @click="dialogoEventoVisivel = false" />
                    <Button :label="eventoEmEdicao.id ? 'Salvar Alterações' : 'Criar Evento'" icon="pi pi-check" @click="salvarEvento" />
                </div>
            </div>
        </template>
    </Dialog>

    <Toast />

  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; align-items: center; margin-bottom: 2rem; }
</style>