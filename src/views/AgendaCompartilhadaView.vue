<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { useAuthStore } from '@/stores/auth';

import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
const authStore = useAuthStore();

const isLoading = ref(true);
const toast = useToast();
const route = useRoute();
const contaId = route.params.id;
const nomeAgenda = ref('');

// --- NOVO: Variáveis para controlar o modal de detalhes ---
const detalheEventoVisivel = ref(false);
const eventoSelecionado = ref(null);
// --- FIM DA ADIÇÃO ---

// --- NOVO: Função para formatar data e hora ---
const formatarPeriodoEvento = computed(() => {
    if (!eventoSelecionado.value || !eventoSelecionado.value.start) return { data: '', horario: '' };

    const optionsData = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const optionsHora = { hour: '2-digit', minute: '2-digit', hour12: false };

    const dataInicio = new Date(eventoSelecionado.value.start);
    const dataFim = new Date(eventoSelecionado.value.end);

    const dataFormatada = new Intl.DateTimeFormat('pt-BR', optionsData).format(dataInicio);

    if (eventoSelecionado.value.allDay) {
        return { data: dataFormatada, horario: 'O dia todo' };
    }

    const horaInicio = new Intl.DateTimeFormat('pt-BR', optionsHora).format(dataInicio);
    const horaFim = new Intl.DateTimeFormat('pt-BR', optionsHora).format(dataFim);

    return { data: dataFormatada, horario: `${horaInicio} às ${horaFim}` };
});
// --- FIM DA ADIÇÃO ---

// --- NOVO: Função chamada ao clicar em um evento ---
const handleEventClick = (clickInfo) => {
    eventoSelecionado.value = {
        title: clickInfo.event.title,
        start: clickInfo.event.start,
        end: clickInfo.event.end,
        allDay: clickInfo.event.allDay,
        ...clickInfo.event.extendedProps
    };
    detalheEventoVisivel.value = true;
};
// --- FIM DA ADIÇÃO ---

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
  selectable: false,
  editable: false,
  eventClick: handleEventClick, // <-- AJUSTE AQUI: Diz ao calendário para usar nossa nova função
});

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  try {
    const response = await apiClient.get(`/api/agendas-compartilhadas/${contaId}/`);
    calendarOptions.value.events = response.data;
    
    const contaResponse = await apiClient.get(`/api/contas/`);
    const conta = contaResponse.data.find(c => c.id == contaId);
    if (conta) {
      nomeAgenda.value = conta.nome;
    }

  } catch (error) {
    const errorMsg = error.response?.data?.detail || "Não foi possível carregar os eventos desta agenda.";
    toast.add({ severity: 'error', summary: 'Erro de Acesso', detail: errorMsg, life: 5000 });
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="page-container">
    <Toast />

    <Dialog v-model:visible="detalheEventoVisivel" header="Detalhes do Compromisso" :modal="true" :style="{width: '500px'}">
        <div v-if="eventoSelecionado" class="event-details">
            
            <h2 class="event-title">{{ eventoSelecionado.title }}</h2>

            <div class="detail-item">
                <i class="pi pi-calendar"></i>
                <span>{{ formatarPeriodoEvento.data }}</span>
            </div>
            <div class="detail-item">
                <i class="pi pi-clock"></i>
                <span>{{ formatarPeriodoEvento.horario }}</span>
            </div>
            <div v-if="eventoSelecionado.location" class="detail-item">
                <i class="pi pi-map-marker"></i>
                <span>{{ eventoSelecionado.location }}</span>
            </div>
            <div v-if="eventoSelecionado.description" class="detail-item description">
                <i class="pi pi-align-left"></i>
                <p v-html="eventoSelecionado.description.replace(/\n/g, '<br>')"></p>
            </div>
        </div>

        <template #footer>
            <Button label="Fechar" icon="pi pi-times" @click="detalheEventoVisivel = false" autofocus />
        </template>
    </Dialog>

    <header class="page-header">
      <div class="flex align-items-center gap-3">
        <router-link to="/agendas-compartilhadas">
          <Button icon="pi pi-arrow-left" severity="secondary" text rounded />
        </router-link>
        <div>
          <h1 class="mb-0">Agenda de {{ nomeAgenda || '...' }}</h1>
          <p class="mt-1 text-color-secondary">Visualização de compromissos da equipe.</p>
        </div>
      </div>
    </header>

    <main>
      <Card>
        <template #content>
          <div v-if="isLoading" class="text-center p-5">
            <ProgressSpinner />
            <p>Carregando eventos...</p>
          </div>
          <FullCalendar v-else :options="calendarOptions" />
        </template>
      </Card>
    </main>
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { margin-bottom: 2rem; }

/* --- NOVO CSS para os detalhes do evento --- */
.event-details .event-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin-top: 0;
    margin-bottom: 1.5rem;
    color: var(--primary-color);
}
.event-details .detail-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
    font-size: 1rem;
}
.event-details .detail-item i {
    color: var(--primary-color);
    margin-top: 4px;
}
.event-details .detail-item.description p {
    margin: 0;
    line-height: 1.5;
    white-space: pre-wrap; /* Preserva quebras de linha e espaços */
}
.no-underline {
    text-decoration: none;
}
</style>