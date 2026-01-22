<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { format, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '@/stores/auth'; // Importar AuthStore para debug

const toast = useToast();
const authStore = useAuthStore(); // Usar AuthStore

// --- ESTADOS ---
const dataSelecionada = ref(new Date());
const agendaDoDia = ref([]);
const isLoading = ref(false);
const autoRefreshInterval = ref(null);
const filtroGabinete = ref(''); 

// --- INICIALIZAÇÃO ---
onMounted(() => {
    // DEBUG: Verificar quem está logado
    console.log("--- DEBUG INICIALIZAÇÃO ---");
    console.log("Usuário Logado:", authStore.user?.username);
    console.log("É Superuser?", authStore.user?.is_superuser);
    console.log("Contas Vinculadas:", authStore.user?.perfil?.contas);
    
    carregarAgenda();
    
    autoRefreshInterval.value = setInterval(() => {
        carregarAgenda(true); 
    }, 60000);
});

onUnmounted(() => {
    if (autoRefreshInterval.value) clearInterval(autoRefreshInterval.value);
});

watch(dataSelecionada, () => {
    carregarAgenda();
});

// --- CARREGAMENTO DE DADOS ---
async function carregarAgenda(silencioso = false) {
    if (!silencioso) isLoading.value = true;
    
    try {
        const dataStr = format(dataSelecionada.value, 'yyyy-MM-dd');
        
        console.log(`--- BUSCANDO AGENDA ---`);
        console.log(`Data Alvo: ${dataStr}`);
        
        const response = await apiClient.get('/api/agenda-institucional/', {
            params: { data: dataStr }
        });
        
        console.log("Resposta API (Status):", response.status);
        console.log("Dados Recebidos (Raw):", response.data);
        
        agendaDoDia.value = response.data;
        
        if (response.data.length === 0) {
            console.warn("A API retornou lista vazia. Verifique:");
            console.warn("1. Se existem eventos nesta data.");
            console.warn("2. Se o usuário tem permissão na Conta onde o evento foi criado.");
        }

    } catch (error) {
        console.error("ERRO CRÍTICO AO CARREGAR:", error);
        if (!silencioso) toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível atualizar a agenda.' });
    } finally {
        if (!silencioso) isLoading.value = false;
    }
}

// --- AÇÕES ---
async function toggleCheckin(convidado) {
    const estadoOriginal = convidado.chegou;
    convidado.chegou = !convidado.chegou; 
    
    try {
        console.log(`Enviando Check-in para Convidado ID: ${convidado.id}`);
        const response = await apiClient.post(`/api/agenda-institucional/convidado/${convidado.id}/checkin/`);
        
        convidado.chegou = response.data.chegou;
        convidado.horario_chegada = response.data.horario;
        
        const msg = convidado.chegou ? 'Entrada registrada' : 'Check-in cancelado';
        toast.add({ severity: 'success', summary: 'Sucesso', detail: msg, life: 2000 });
        
    } catch (error) {
        console.error("Erro no Check-in:", error);
        convidado.chegou = estadoOriginal;
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao registrar check-in.' });
    }
}

// --- COMPUTEDS E HELPERS ---
const agendaFiltrada = computed(() => {
    if (!filtroGabinete.value) return agendaDoDia.value;
    const termo = filtroGabinete.value.toLowerCase();
    return agendaDoDia.value.filter(evento => 
        evento.nome_conta.toLowerCase().includes(termo) || 
        evento.titulo.toLowerCase().includes(termo)
    );
});

const dataFormatadaTopo = computed(() => {
    return format(dataSelecionada.value, "EEEE, d 'de' MMMM", { locale: ptBR });
});

function getBadgeSeverity(evento) {
    if (evento.situacao === 'CANCELADO') return 'danger';
    if (evento.situacao === 'CONCLUIDO') return 'success';
    if (evento.situacao === 'EM_ANDAMENTO') return 'warning';
    return 'info'; 
}

function formatarHora(isoString) {
    if (!isoString) return '';
    return format(parseISO(isoString), 'HH:mm');
}
</script>

<template>
    <div class="page-container">
        <Toast />
        
        <Card class="mb-4">
            <template #content>
                <div class="flex flex-column align-items-center">
                    <div class="flex justify-between align-items-center gap-3">
                        <Button icon="pi pi-chevron-left" text rounded @click="dataSelecionada = new Date(dataSelecionada.setDate(dataSelecionada.getDate() - 1))" />
                        <div class="text-center">
                            <h2 class="text-xl font-bold text-900 m-0 capitalize">{{ dataFormatadaTopo }}</h2>
                            <span class="text-sm text-500">Visão do Dia</span>
                        </div>
                        <Button icon="pi pi-chevron-right" text rounded @click="dataSelecionada = new Date(dataSelecionada.setDate(dataSelecionada.getDate() + 1))" />
                    </div>
                </div>
            </template>
        </Card>

        <div v-if="isLoading && agendaDoDia.length === 0" class="flex justify-content-center p-5">
            <ProgressSpinner />
        </div>

        <div v-else-if="agendaFiltrada.length === 0" class="flex flex-column align-items-center justify-content-center p-6 text-center text-500">
            <i class="pi pi-calendar-times text-6xl mb-3"></i>
            <p class="text-xl">Nenhum compromisso agendado para esta data.</p>
        </div>

        <div v-else class="flex flex-column gap-4 pb-4">
            
            <div v-for="evento in agendaFiltrada" :key="evento.id" class="card border-left-3 border-round shadow-1 event-card" 
                 :class="`border-${getBadgeSeverity(evento)}`" style="border-left-width: 6px !important;">
                
                <div class="flex flex-column md:flex-row justify-content-between border-bottom-1 border-100 p-3">
                    <div class="flex align-items-start gap-3">
                        <div class="text-center px-3 py-2 bg-blue-50 border-round text-blue-900">
                            <div class="text-xl font-bold">{{ formatarHora(evento.data_inicio) }}</div>
                            <div class="text-xs">às {{ formatarHora(evento.data_fim) }}</div>
                        </div>
                        
                        <div>
                            <div class="flex align-items-center gap-2 mb-1">
                                <Tag :value="evento.nome_conta" class="text-xs" severity="secondary" icon="pi pi-building"></Tag>
                                <Tag :value="evento.situacao.replace('_', ' ')" :severity="getBadgeSeverity(evento)" class="text-xs"></Tag>
                                <Tag v-if="evento.confidencial" value="Reservado" icon="pi pi-lock" severity="contrast" class="text-xs"></Tag>
                            </div>
                            
                            <h3 class="text-xl font-medium text-900 m-0">
                                {{ evento.confidencial ? 'Compromisso Oficial (Reservado)' : evento.titulo }}
                            </h3>
                            <p v-if="!evento.confidencial && evento.descricao" class="text-600 mt-1 text-sm line-clamp-2">
                                {{ evento.descricao }}
                            </p>
                            <div class="text-sm text-500 mt-1 flex align-items-center gap-1">
                                <i class="pi pi-map-marker text-xs"></i> {{ evento.local }}
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="evento.convidados && evento.convidados.length > 0" class="p-3">
                    <h4 class="text-sm font-bold text-700 uppercase mb-2 ml-1">Lista de Presença</h4>
                    
                    <div class="grid">
                        <div v-for="convidado in evento.convidados" :key="convidado.id" class="col-6">
                            <div class="guest-card p-2 border-1 border-round flex align-items-center justify-content-between gap-2 bg-surface-0"
                                 :class="{'border-green-500 bg-green-50': convidado.chegou, 'border-200': !convidado.chegou}">
                                
                                <div class="flex align-items-center gap-2 overflow-hidden">
                                    <Avatar :image="convidado.foto_municipe" icon="pi pi-user" shape="circle" size="large" class="flex-shrink-0" />
                                    <div class="white-space-nowrap overflow-hidden text-overflow-ellipsis">
                                        <div class="font-bold text-900">{{ convidado.nome_municipe }}</div>
                                        <div class="text-xs text-600">{{ convidado.cargo_municipe || convidado.empresa_municipe || 'Convidado' }}</div>
                                        <div v-if="convidado.observacao" class="text-xs text-orange-600 font-medium">
                                            <i class="pi pi-info-circle" style="font-size: 0.7rem"></i> {{ convidado.observacao }}
                                        </div>
                                    </div>
                                </div>

                                <Button 
                                    :icon="convidado.chegou ? 'pi pi-check-circle' : 'pi pi-sign-in'" 
                                    :label="convidado.chegou ? 'Presente' : 'Entrada'" 
                                    :severity="convidado.chegou ? 'success' : 'secondary'" 
                                    :outlined="!convidado.chegou"
                                    size="small"
                                    @click="toggleCheckin(convidado)"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else class="text-center p-3 bg-gray-50 border-round text-sm text-500">
                    Nenhum convidado externo listado para este evento.
                </div>

            </div>
        </div>
    </div>
</template>

<style scoped>
.page-container { padding: 2rem; }

/* Sticky Header para facilitar navegação em listas longas */
.sticky-header {
    position: sticky;
    top: 1rem;
    z-index: 100;
    backdrop-filter: blur(10px);
    background-color: rgba(255, 255, 255, 0.95);
}

.event-card {
    transition: transform 0.2s;
}
.event-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.1) !important;
}

.guest-card {
    transition: all 0.3s ease;
}

/* Utilitário para limitar texto */
.line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>