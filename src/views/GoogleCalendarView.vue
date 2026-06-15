<template>
  <div class="google-calendar-view">
    <header class="page-header">
      <div class="flex align-items-center gap-3">
        <i class="pi pi-google text-xl"></i>
        <h1 class="m-0">Minha Agenda</h1>
      </div>
      <span v-if="selectedViewAccount && !loadingEvents" class="events-badge">
        {{ calendarEvents.length }} evento(s) no período
      </span>
    </header>

    <Message
      v-if="modoSomenteLeitura"
      severity="info"
      :closable="false"
      class="mb-3"
    >
      Visualização pelo SIGA — você não precisa conectar sua conta Google.
    </Message>

    <Card class="mb-4">
      <template #content>
        <div class="grid formgrid p-fluid align-items-end mb-3">
          <div class="col-12 md:col-9">
            <label>Conta Google Calendar</label>
            <GoogleAccountSelector
              v-model="selectedViewAccount"
              :showActions="false"
              :autoSelectDefault="true"
              @account-selected="onViewAccountSelected"
              @authorization-complete="onAuthorizationComplete"
            />
          </div>
          <div class="col-12 md:col-3 flex align-items-end">
            <Button
              v-if="needsQuickAuthorization"
              label="Conectar Google"
              icon="pi pi-google"
              @click="quickGoogleAuth"
              :loading="quickAuthLoading"
              class="p-button-success w-full"
            />
            <Button
              v-else-if="tokenExpired && podeCriarEventos"
              label="Renovar Token"
              icon="pi pi-refresh"
              @click="renovarToken"
              :loading="renewTokenLoading"
              class="p-button-info w-full"
            />
          </div>
        </div>

        <div class="grid formgrid p-fluid align-items-end mb-3">
          <div class="col-12 md:col-9">
            <label for="filtroDataRelatorio">Período do Relatório</label>
            <Calendar
              id="filtroDataRelatorio"
              v-model="filtroDataRelatorio"
              selectionMode="range"
              dateFormat="dd/mm/yy"
              appendTo="body"
            />
          </div>
          <div class="col-12 md:col-3 flex align-items-end">
            <Button
              label="Gerar PDF"
              icon="pi pi-file-pdf"
              class="p-button-danger"
              @click="gerarRelatorioPDF"
              :loading="isGeneratingReport"
            />
          </div>
        </div>
        <div class="account-meta mt-2" v-if="selectedViewAccountData">
          <small class="status-row">
            <GoogleAccountStatus :account="selectedViewAccountData" iconOnly />
            <PermissionBadge :permissions="selectedViewAccountData.permissoes_usuario" iconOnly />
            <span class="last-sync" v-if="selectedViewAccountData.token_status?.last_updated">
              Última sinc: {{ formatDateTime(selectedViewAccountData.token_status.last_updated) }}
            </span>
          </small>
        </div>
      </template>
    </Card>

    <div class="calendar-section">

      <div class="calendar-container" :class="{ 'calendar-container--inactive': !selectedViewAccount }">
        <FullCalendar
          ref="calendar"
          :options="calendarOptions"
          class="custom-calendar"
        />
      </div>

      <div v-if="!selectedViewAccount" class="text-center p-6 calendar-empty-state">
        <i class="pi pi-calendar text-4xl text-400 mb-4"></i>
        <h4 class="text-600 mb-3">Selecione uma conta Google</h4>
        <p class="text-500">Selecione uma conta Google Calendar acima para visualizar os eventos.</p>
      </div>
    </div>

    <GoogleEventModal
      v-if="podeGerenciarEventos"
      :key="selectedViewAccount || 'sem-conta'"
      v-model="showEventModal"
      :evento="selectedCrudEvent"
      :selectedAccount="selectedViewAccountData"
      :selectedAccountId="selectedViewAccount"
      @event-created="onEventCreated"
      @event-updated="onEventCreated"
      @event-deleted="onEventDeleted"
    />

    <ConfirmDialog />

    <Dialog
      v-model:visible="showEventDetails"
      header="Detalhes do Evento"
      :modal="true"
      :style="{ width: '520px' }"
    >
      <div v-if="selectedEventDetails" class="p-fluid">
        <div class="field">
          <label>Título</label>
          <div class="event-detail-value">{{ selectedEventDetails.title || 'Sem título' }}</div>
        </div>
        <div class="field">
          <label>Início</label>
          <div class="event-detail-value">{{ formatDateTime(selectedEventDetails.start) }}</div>
        </div>
        <div class="field">
          <label>Fim</label>
          <div class="event-detail-value">{{ formatDateTime(selectedEventDetails.end) }}</div>
        </div>
        <div class="field" v-if="selectedEventDetails.location">
          <label>Local</label>
          <div class="event-detail-value">{{ selectedEventDetails.location }}</div>
        </div>
        <div class="field">
          <label>Descrição</label>
          <div class="event-detail-value">{{ selectedEventDetails.description || 'Sem descrição.' }}</div>
        </div>
      </div>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/stores/auth';

// Components
import Button from 'primevue/button';
import Message from 'primevue/message';
import Toast from 'primevue/toast';
import Card from 'primevue/card';
import Calendar from 'primevue/calendar';
import Dialog from 'primevue/dialog';

// Google Calendar Components
import GoogleAccountSelector from '@/components/google-calendar/GoogleAccountSelector.vue';
import GoogleEventModal from '@/components/google-calendar/GoogleEventModal.vue';
import GoogleAccountStatus from '@/components/google-calendar/GoogleAccountStatus.vue';
import PermissionBadge from '@/components/google-calendar/PermissionBadge.vue';

// API
import apiClient from '@/api';
import {
  normalizeGoogleAccount,
  isSomenteLeituraSiga,
  podeAutorizarGoogle,
} from '@/utils/googleCalendarAccount';

// FullCalendar
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';

// Composables
const toast = useToast();
const authStore = useAuthStore();

// State
const selectedViewAccount = ref(null);
const selectedViewAccountData = ref(null);
const loadingEvents = ref(false);
const calendarEvents = ref([]);
const showEventModal = ref(false);
const quickAuthLoading = ref(false);
const renewTokenLoading = ref(false);
const showEventDetails = ref(false);
const selectedEventDetails = ref(null);
const selectedCrudEvent = ref(null);
const calendar = ref(null);
const visibleRange = ref({
  start_date: null,
  end_date: null
});
const calendarRangeReady = ref(false);
const filtroDataRelatorio = ref([]);
const isGeneratingReport = ref(false);
let loadEventsSeq = 0;

// Computed
const modoSomenteLeitura = computed(() => {
  const account = selectedViewAccountData.value;
  return account ? isSomenteLeituraSiga(account) : false;
});

const podeCriarEventos = computed(() => {
  const perms = selectedViewAccountData.value?.permissoes_usuario;
  return Boolean(perms?.pode_criar);
});

const podeEditarEventos = computed(() => {
  const perms = selectedViewAccountData.value?.permissoes_usuario;
  return Boolean(perms?.pode_editar);
});

const podeExcluirEventos = computed(() => {
  const perms = selectedViewAccountData.value?.permissoes_usuario;
  return Boolean(perms?.pode_excluir);
});

const podeGerenciarEventos = computed(() =>
  podeCriarEventos.value || podeEditarEventos.value || podeExcluirEventos.value
);

const needsQuickAuthorization = computed(() => {
  const account = selectedViewAccountData.value;
  if (!account || !podeAutorizarGoogle(account)) return false;
  return Boolean(account.token_status?.precisa_autorizacao);
});

const tokenExpired = computed(() => {
  const status = selectedViewAccountData.value?.token_status;
  return Boolean(status?.has_valid_token && status?.expires_soon);
});

// Funções para FullCalendar
const handleDateSelect = (selectInfo) => {
  const permissions = selectedViewAccountData.value?.permissoes_usuario;
  if (!permissions?.pode_criar) {
    toast.add({
      severity: 'warn',
      summary: 'Sem Permissão',
      detail: 'Você não tem permissão para criar eventos nesta conta',
      life: 3000
    });
    return;
  }
  
  selectedCrudEvent.value = {
    conta_google_id: selectedViewAccount.value,
    titulo: '',
    descricao: '',
    data_inicio: selectInfo.start,
    data_fim: selectInfo.end,
    localizacao: '',
  };
  showEventModal.value = true;
  selectInfo.view.calendar.unselect();
};

const handleEventClick = (clickInfo) => {
  if (podeGerenciarEventos.value) {
    selectedCrudEvent.value = {
      id: clickInfo.event.id,
      conta_google_id: clickInfo.event.extendedProps?.conta_google_id || selectedViewAccount.value,
      titulo: clickInfo.event.title || '',
      descricao: clickInfo.event.extendedProps?.description || '',
      data_inicio: clickInfo.event.start,
      data_fim: clickInfo.event.end,
      localizacao: clickInfo.event.extendedProps?.location || '',
    };
    showEventModal.value = true;
    return;
  }
  selectedEventDetails.value = {
    title: clickInfo.event.title,
    start: clickInfo.event.start,
    end: clickInfo.event.end,
    description: clickInfo.event.extendedProps?.description || '',
    location: clickInfo.event.extendedProps?.location || '',
  };
  showEventDetails.value = true;
};

const handleEventDidMount = (info) => {
  if (info.event.extendedProps.description) {
    info.el.setAttribute('title', info.event.extendedProps.description);
  }
};

const handleDatesSet = (dateInfo) => {
  const startDate = dateInfo.startStr?.slice(0, 10) || null;
  const inclusiveEnd = new Date(dateInfo.end);
  inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
  const endDate = inclusiveEnd.toISOString().slice(0, 10);

  visibleRange.value = {
    start_date: startDate,
    end_date: endDate
  };
  calendarRangeReady.value = true;
};

const buildCalendarOptions = () => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay'
  },
  initialView: 'timeGridWeek',
  locale: ptBrLocale,
  selectable: podeCriarEventos.value,
  selectMirror: podeCriarEventos.value,
  dayMaxEvents: true,
  weekends: true,
  editable: false,
  events: [],
  select: podeCriarEventos.value ? handleDateSelect : undefined,
  eventClick: handleEventClick,
  eventDidMount: handleEventDidMount,
  datesSet: handleDatesSet,
  height: 'auto',
  contentHeight: 600,
  slotMinTime: '06:00:00',
  slotMaxTime: '22:00:00'
});

const calendarOptions = ref(buildCalendarOptions());

watch(podeCriarEventos, () => {
  calendarOptions.value = {
    ...buildCalendarOptions(),
    events: calendarEvents.value,
  };
});

const applyEventsToCalendar = (events) => {
  const calendarApi = calendar.value?.getApi?.();
  if (calendarApi) {
    calendarApi.getEventSources().forEach((source) => source.remove());
    calendarApi.addEventSource({ id: 'google-events', events });
    return;
  }
  calendarOptions.value = {
    ...calendarOptions.value,
    events,
  };
};

// Carregar eventos
const loadEvents = async () => {
  if (!selectedViewAccount.value || !calendarRangeReady.value || !visibleRange.value.start_date) {
    return;
  }

  const seq = ++loadEventsSeq;
  loadingEvents.value = true;

  try {
    const response = await apiClient.get('/api/google-calendar/events/list_events/', {
      params: {
        conta_google_id: selectedViewAccount.value,
        start_date: visibleRange.value.start_date,
        end_date: visibleRange.value.end_date,
      }
    });

    if (seq !== loadEventsSeq) return;

    const contaId = selectedViewAccount.value;
    const events = (response.data.events || []).map(event => ({
      id: event.id,
      title: event.summary || 'Sem título',
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      allDay: !event.start.dateTime,
      extendedProps: {
        description: event.description || '',
        location: event.location || '',
        conta_google_id: contaId,
      },
      status: event.status || 'confirmed',
      backgroundColor: '#007bff',
      borderColor: '#007bff',
      textColor: '#ffffff'
    }));

    calendarEvents.value = events;
    applyEventsToCalendar(events);
  } catch (error) {
    if (seq !== loadEventsSeq) return;
    console.error('Erro ao carregar eventos:', error);
    toast.add({
      severity: 'error',
      summary: 'Erro',
      detail: 'Não foi possível carregar os eventos do Google Calendar',
      life: 5000
    });
  } finally {
    if (seq === loadEventsSeq) {
      loadingEvents.value = false;
    }
  }
};

const gerarRelatorioPDF = async () => {
  if (!selectedViewAccount.value) {
    toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione uma conta antes de gerar o relatório.', life: 3000 });
    return;
  }
  if (!filtroDataRelatorio.value || !filtroDataRelatorio.value[0] || !filtroDataRelatorio.value[1]) {
    toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione um período para o relatório.', life: 3000 });
    return;
  }
  isGeneratingReport.value = true;
  try {
    const dataInicioOriginal = new Date(filtroDataRelatorio.value[0]);
    const dataFimOriginal = new Date(filtroDataRelatorio.value[1]);

    const diaSemanaInicio = dataInicioOriginal.getDay();
    const diasParaVoltar = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1;
    const dataInicioAjustada = new Date(dataInicioOriginal);
    dataInicioAjustada.setDate(dataInicioOriginal.getDate() - diasParaVoltar);

    const diaSemanaFim = dataFimOriginal.getDay();
    const diasParaAvancar = diaSemanaFim === 0 ? 0 : 7 - diaSemanaFim;
    const dataFimAjustada = new Date(dataFimOriginal);
    dataFimAjustada.setDate(dataFimOriginal.getDate() + diasParaAvancar);

    const response = await apiClient.get('/api/relatorios/google-agenda/pdf/', {
      params: {
        conta_google_id: selectedViewAccount.value,
        data_inicio: dataInicioAjustada.toISOString().slice(0, 10),
        data_fim: dataFimAjustada.toISOString().slice(0, 10),
      },
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'relatorio_google_agenda.pdf');
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

// Autorização rápida
const quickGoogleAuth = async () => {
  quickAuthLoading.value = true;
  try {
    const clientId = '665750686651-f5m7bjam5hs53i3jjdeqkomee2jgk4f1.apps.googleusercontent.com';
    const redirectUri = encodeURIComponent('https://gabinete.mogidascruzes.sp.gov.br/api/google-calendar/auth/1/callback/');
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');
    
    const authUrl = `https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&access_type=offline&prompt=consent`;
    
    window.open(authUrl, '_blank');
    
    toast.add({
      severity: 'info',
      summary: 'Autorização Iniciada',
      detail: 'Complete a autorização na nova aba que foi aberta',
      life: 5000
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Erro',
      detail: 'Erro ao iniciar autorização',
      life: 3000
    });
  } finally {
    quickAuthLoading.value = false;
  }
};

const renovarToken = async () => {
  if (!selectedViewAccount.value) return;
  renewTokenLoading.value = true;
  try {
    await apiClient.post('/api/google-calendar/auth/refresh/', {
      conta_google_id: selectedViewAccount.value,
    });
    toast.add({
      severity: 'success',
      summary: 'Token Renovado',
      detail: 'Token de acesso renovado com sucesso.',
      life: 3000,
    });
    loadEvents();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Erro',
      detail: 'Não foi possível renovar o token.',
      life: 4000,
    });
  } finally {
    renewTokenLoading.value = false;
  }
};

// Event handlers
const onViewAccountSelected = (account) => {
  selectedViewAccountData.value = account ? normalizeGoogleAccount(account) : null;
};

const onAuthorizationComplete = (account) => {
  toast.add({
    severity: 'success',
    summary: 'Autorização Completa!',
    detail: `Conta "${account?.nome || account?.id}" autorizada com sucesso. Recarregando dados...`,
    life: 5000
  });

  setTimeout(() => {
    window.location.reload();
  }, 2000);
};

const onEventCreated = () => {
  selectedCrudEvent.value = null;
  toast.add({
    severity: 'success',
    summary: 'Evento salvo',
    detail: 'Evento salvo com sucesso no Google Calendar.',
    life: 4000,
  });
  loadEvents();
};

const onEventDeleted = () => {
  selectedCrudEvent.value = null;
  showEventDetails.value = false;
  loadEvents();
};

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return '—';
  }
};

watch(
  () => [selectedViewAccount.value, visibleRange.value.start_date, calendarRangeReady.value],
  ([accountId, startDate, rangeReady]) => {
    if (accountId && startDate && rangeReady) {
      loadEvents();
    }
  }
);

watch(selectedViewAccount, (accountId) => {
  if (!accountId) {
    selectedViewAccountData.value = null;
    calendarEvents.value = [];
    selectedCrudEvent.value = null;
    applyEventsToCalendar([]);
  }
});

// Lifecycle
onMounted(() => {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  filtroDataRelatorio.value = [startOfMonth, endOfMonth];
  if (!authStore.isAuthenticated) {
    toast.add({
      severity: 'warn',
      summary: 'Autenticação Necessária',
      detail: 'Você precisa estar logado para acessar o Google Calendar',
      life: 5000
    });
  }
});
</script>

<style scoped>
.google-calendar-view {
  padding: 2rem;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.calendar-section {
  min-height: 600px;
}

.account-meta {
  display: block;
}

.calendar-container {
  animation: fadeIn 0.3s ease;
}

.calendar-container--inactive {
  visibility: hidden;
  height: 0;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.calendar-empty-state {
  margin-top: -0.5rem;
}

.events-badge {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.last-sync {
  font-size: 0.85rem;
  color: var(--text-color-secondary);
}

.event-detail-value {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background: var(--surface-50);
  min-height: 2.25rem;
  white-space: pre-wrap;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* FullCalendar customization */
:deep(.fc) {
  font-family: inherit;
}

:deep(.fc-toolbar-title) {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-color);
}

:deep(.fc-button-primary) {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

:deep(.fc-button-primary:hover) {
  background-color: var(--primary-color-dark);
  border-color: var(--primary-color-dark);
}

:deep(.fc-event) {
  font-size: 0.75rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

:deep(.fc-event:hover) {
  opacity: 0.8;
  transform: translateY(-1px);
}

/* Responsividade */
@media (max-width: 768px) {
  .google-calendar-view {
    padding: 0.5rem;
  }
  
  :deep(.fc-toolbar) {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>