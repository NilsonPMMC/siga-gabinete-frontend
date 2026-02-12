<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { useAuthStore } from '@/stores/auth';
import { format } from 'date-fns'; // <--- IMPORTANTE: Instalar/Importar date-fns

import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

const authStore = useAuthStore();
const isLoading = ref(true);
const toast = useToast();
const route = useRoute();
const contaId = route.params.id; // Esse é o agenda_id
const nomeAgenda = ref('');

// --- ESTADOS DE IMPRESSÃO (NOVO) ---
const showDateDialog = ref(false);
const datasSelecionadas = ref(null);
const isDownloading = ref(false);
// -----------------------------------

// Variáveis para controlar o modal de detalhes
const detalheEventoVisivel = ref(false);
const eventoSelecionado = ref(null);

// Função para formatar data e hora do detalhe
const formatarPeriodoEvento = computed(() => {
    if (!eventoSelecionado.value || !eventoSelecionado.value.start) return { data: '', horario: '' };

    const optionsData = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const optionsHora = { hour: '2-digit', minute: '2-digit', hour12: false };

    const dataInicio = new Date(eventoSelecionado.value.start);
    const dataFim = new Date(eventoSelecionado.value.end || eventoSelecionado.value.start); // Fallback se não tiver fim

    const dataFormatada = new Intl.DateTimeFormat('pt-BR', optionsData).format(dataInicio);

    if (eventoSelecionado.value.allDay) {
        return { data: dataFormatada, horario: 'O dia todo' };
    }

    const horaInicio = new Intl.DateTimeFormat('pt-BR', optionsHora).format(dataInicio);
    const horaFim = new Intl.DateTimeFormat('pt-BR', optionsHora).format(dataFim);

    return { data: dataFormatada, horario: `${horaInicio} às ${horaFim}` };
});

const handleEventClick = (clickInfo) => {
    eventoSelecionado.value = {
        title: clickInfo.event.title,
        start: clickInfo.event.start,
        end: clickInfo.event.end,
        allDay: clickInfo.event.allDay,
        location: clickInfo.event.extendedProps.location, // Garante que pegue props estendidas
        description: clickInfo.event.extendedProps.description,
        ...clickInfo.event.extendedProps
    };
    detalheEventoVisivel.value = true;
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
  selectable: false,
  editable: false,
  eventClick: handleEventClick,
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
    
    // Busca o nome da conta para exibir no título
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

// --- FUNÇÕES DE IMPRESSÃO (NOVO) ---
const abrirDialogoImpressao = () => {
    console.log("--- DEBUG: Botão Imprimir Clicado ---");
    
    // Define padrão: Data atual
    const hoje = new Date();
    datasSelecionadas.value = [hoje, hoje];
    
    console.log("1. Definindo datas padrão:", datasSelecionadas.value);
    
    showDateDialog.value = true;
    
    console.log("2. Alterei showDateDialog para TRUE. Valor atual:", showDateDialog.value);
};

const confirmarImpressao = async () => {
    if (!datasSelecionadas.value || !datasSelecionadas.value[0]) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione pelo menos uma data.', life: 3000 });
        return;
    }

    const dataInicioOriginal = datasSelecionadas.value[0];
    const dataFimOriginal = datasSelecionadas.value[1] ? datasSelecionadas.value[1] : dataInicioOriginal;

    // Ajusta datas para sempre começar na segunda-feira e terminar no domingo
    // getDay() retorna: 0=Domingo, 1=Segunda, ..., 6=Sábado
    const diaSemanaInicio = dataInicioOriginal.getDay();
    const diasParaVoltar = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1; // Se domingo, volta 6 dias; senão volta (dia-1)
    const dataInicioAjustada = new Date(dataInicioOriginal);
    dataInicioAjustada.setDate(dataInicioOriginal.getDate() - diasParaVoltar);
    
    const diaSemanaFim = dataFimOriginal.getDay();
    const diasParaAvancar = diaSemanaFim === 0 ? 0 : 7 - diaSemanaFim; // Se domingo, não avança; senão avança até domingo
    const dataFimAjustada = new Date(dataFimOriginal);
    dataFimAjustada.setDate(dataFimOriginal.getDate() + diasParaAvancar);

    showDateDialog.value = false;
    isDownloading.value = true;
    
    toast.add({ severity: 'info', summary: 'Gerando PDF', detail: 'Aguarde...', life: 2000 });

    try {
        const response = await apiClient.get('/api/relatorios/google/agenda-pdf/', {
            params: { 
                agenda_id: contaId, // ID da conta vindo da URL
                data_inicio: format(dataInicioAjustada, 'yyyy-MM-dd'),
                data_fim: format(dataFimAjustada, 'yyyy-MM-dd')
            },
            responseType: 'blob'
        });

        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        const nomeArquivo = `Agenda_${nomeAgenda.value.replace(/\s+/g, '_')}_${format(dataInicioOriginal, 'dd-MM')}.pdf`;
        link.setAttribute('download', nomeArquivo);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Download iniciado.', life: 3000 });

    } catch (error) {
        console.error(error);
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao gerar o PDF.', life: 4000 });
    } finally {
        isDownloading.value = false;
    }
};
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

    <Dialog v-model:visible="showDateDialog" header="Imprimir Agenda" :modal="true" :style="{ width: '450px' }">
        <div class="p-fluid">
            <div class="field">
                <label for="range">Selecione o Período</label>
                <Calendar 
                    id="range" 
                    v-model="datasSelecionadas" 
                    selectionMode="range" 
                    :manualInput="false" 
                    dateFormat="dd/mm/yy" 
                    placeholder="Início e Fim"
                    showIcon
                />
                <small class="block mt-2 text-500">
                    O relatório aplicará automaticamente os filtros de privacidade do seu perfil.
                </small>
            </div>
        </div>
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="showDateDialog = false" />
            <Button label="Baixar PDF" icon="pi pi-print" @click="confirmarImpressao" :loading="isDownloading" autofocus />
        </template>
    </Dialog>

    <header class="page-header flex justify-content-between align-items-center">
      <div class="flex align-items-center gap-3">
        <router-link to="/agendas-compartilhadas">
          <Button icon="pi pi-arrow-left" severity="secondary" text rounded />
        </router-link>
        <div>
          <h1 class="mb-0 text-2xl">Agenda: {{ nomeAgenda || '...' }}</h1>
          <p class="mt-1 text-sm text-color-secondary">Visualização detalhada.</p>
        </div>
      </div>
      
      <div>
        <Button 
            label="Imprimir" 
            icon="pi pi-print" 
            @click="abrirDialogoImpressao" 
            :loading="isDownloading"
            severity="secondary"
            outlined
        />
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
    white-space: pre-wrap; 
}
.no-underline {
    text-decoration: none;
}
</style>