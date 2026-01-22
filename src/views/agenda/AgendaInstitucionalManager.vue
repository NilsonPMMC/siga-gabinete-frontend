<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { useAuthStore } from '@/stores/auth';
import { useConfirm } from "primevue/useconfirm";
import FullCalendar from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import InputSwitch from 'primevue/inputswitch';
import MunicipeFormModal from '@/components/municipes/MunicipeFormModal.vue';
import AgendaCompartilharModal from '@/components/agendas/AgendaCompartilharModal.vue';
import CompromissoDetalhesModal from '@/components/agendas/CompromissoDetalhesModal.vue';

const toast = useToast();
const authStore = useAuthStore();
const confirm = useConfirm();
const showCompartilharModal = ref(false);
const contaSelecionada = ref(null);
const showDetalhesModal = ref(false);
const eventoSelecionadoParaLeitura = ref(null);
const permissaoAtual = ref('LEITURA');

const usuarioPodeGerenciarConta = computed(() => {
    if (authStore.user?.is_superuser) return true;
    const minhasContas = authStore.user?.perfil?.contas || [];
    return minhasContas.includes(contaSelecionada.value);
});

// --- ESTADOS DO CALENDÁRIO ---
const calendarOptions = ref({
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'timeGridWeek',
    locale: 'pt-br',
    headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    buttonText: { today: 'Hoje', month: 'Mês', week: 'Semana', day: 'Dia' },
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    weekends: true,
    select: handleDateSelect,
    eventClick: handleEventClick,
    events: fetchEvents, // Função que carrega do backend
    eventDrop: handleEventDrop, // Arrastar e soltar
    allDayText: 'Dia todo',
    slotMinTime: '07:00:00',
    slotMaxTime: '22:00:00',
});

const calendarRef = ref(null);

// --- ESTADOS DO DIÁLOGO DE COMPROMISSO ---
const dialogCompromissoVisivel = ref(false);
const compromisso = ref({});
const isLoadingSalvar = ref(false);

const tiposCompromisso = [
    { label: 'Reunião Interna', value: 'REUNIAO_INTERNA' },
    { label: 'Atendimento Gabinete', value: 'ATENDIMENTO_GABINETE' },
    { label: 'Evento Externo', value: 'EVENTO_EXTERNO' },
    { label: 'Visita Técnica', value: 'VISITA_TECNICA' },
    { label: 'Cerimonial', value: 'CERIMONIAL' },
    { label: 'Almoço/Jantar', value: 'ALMOCO_JANTAR' }
];

const situacaoOptions = [
    { label: 'Agendado', value: 'AGENDADO' },
    { label: 'Em Andamento', value: 'EM_ANDAMENTO' },
    { label: 'Concluído', value: 'CONCLUIDO' },
    { label: 'Cancelado', value: 'CANCELADO' },
    { label: 'Adiado', value: 'ADIADO' }
];

// --- ESTADOS DE CONVIDADOS ---
const municipeSelecionado = ref(null);
const sugestoesMunicipes = ref([]);
const convidadosList = ref([]); // Lista local para exibição
const obsConvidado = ref('');

// --- ESTADOS DE CADASTRO RÁPIDO ---
const showMunicipeModal = ref(false);

// --- REFERÊNCIAS DE DADOS ---
const contas = ref([]);

async function carregarContas() {
    try {
        const res = await apiClient.get('/api/agenda-institucional/minhas_agendas/');
        contas.value = res.data;

        if (contas.value.length > 0) {
            contaSelecionada.value = contas.value[0].id;
            // Define a permissão inicial
            permissaoAtual.value = contas.value[0].permissao || 'LEITURA';
            
            if (calendarRef.value) {
                calendarRef.value.getApi().refetchEvents();
            }
        }
    } catch (e) { console.error(e); }
}

watch(contaSelecionada, (novoId) => {
    const conta = contas.value.find(c => c.id === novoId);
    if (conta) {
        permissaoAtual.value = conta.permissao;
    }
});

const podeEditar = computed(() => permissaoAtual.value === 'ESCRITA');

onMounted(async () => {
    carregarContas();
});

// --- FUNÇÕES DO CALENDÁRIO ---

async function fetchEvents(info, successCallback, failureCallback) {
    if (!contaSelecionada.value) {
        successCallback([]);
        return;
    }

    try {
        const params = {
            conta_id: contaSelecionada.value,
            // O backend espera 'data' (dia exato) ou range?
            // Se o filtro no backend (get_queryset) usa 'data_inicio__range', precisamos mandar datas.
            // O FullCalendar manda info.startStr e info.endStr.
            // Como sua view filtrava por 'data=' (dia único), vamos mandar o range e ajustar o backend se precisar.
            // Vou assumir que o backend filtra tudo da conta se não mandar data específica, ou filtra pelo range do request.
            start: info.startStr, 
            end: info.endStr
        };
        
        // Rota padrão do ViewSet (lista)
        const response = await apiClient.get('/api/agenda-institucional/', { params });
        
        const eventosMapeados = response.data.map(item => ({
            id: item.id,
            title: item.titulo,
            start: item.data_inicio,
            end: item.data_fim,
            backgroundColor: getCorEvento(item),
            borderColor: getCorEvento(item),
            extendedProps: { ...item }
        }));
        
        successCallback(eventosMapeados);
    } catch (error) {
        console.error("Erro eventos:", error);
        failureCallback(error);
    }
}

function getCorEvento(item) {
    if (item.situacao === 'CANCELADO') return '#ef4444'; // Vermelho
    if (item.situacao === 'CONCLUIDO') return '#22c55e'; // Verde
    if (item.situacao === 'EM_ANDAMENTO') return '#f59e0b'; // Laranja
    if (item.confidencial) return '#64748b'; // Cinza (Discreto)
    
    // Cores por Tipo (Opcional, se quiser diferenciar visualmente)
    if (item.tipo === 'EVENTO_EXTERNO') return '#8b5cf6'; // Roxo
    
    return '#3b82f6'; // Azul Padrão
}

function handleDateSelect(selectInfo) {
    // Novo Compromisso
    compromisso.value = {
        titulo: '',
        // CORREÇÃO: Converter string para objeto Date
        data_inicio: new Date(selectInfo.startStr), 
        data_fim: selectInfo.endStr ? new Date(selectInfo.endStr) : null,
        tipo: 'ATENDIMENTO_GABINETE',
        situacao: 'AGENDADO',
        confidencial: false,
        conta: contas.value.length > 0 ? contas.value[0].id : null
    };
    convidadosList.value = []; 
    dialogCompromissoVisivel.value = true;
}

function handleEventClick(clickInfo) {
    // --- CENÁRIO 1: APENAS LEITURA (Modo Visualização) ---
    // Se o usuário NÃO tiver permissão de escrita (podeEditar é false),
    // abrimos o modal de detalhes (apenas visualização).
    if (!podeEditar.value) {
        eventoSelecionadoParaLeitura.value = {
            id: clickInfo.event.id,
            title: clickInfo.event.title,
            start: clickInfo.event.start,
            end: clickInfo.event.end,
            // 'extendedProps' contém todos os campos extras que vieram do backend 
            // (descricao, convidados, situacao, tipo, etc.)
            extendedProps: clickInfo.event.extendedProps 
        };
        
        showDetalhesModal.value = true; // Abre o modal novo (CompromissoDetalhesModal)
        return; // Interrompe a função aqui para não abrir o formulário de edição
    }

    // --- CENÁRIO 2: PERMISSÃO DE ESCRITA (Modo Edição) ---
    // Se chegou aqui, o usuário pode editar. Preparamos o objeto 'compromisso'
    // para preencher o formulário no modal de edição.
    
    const dados = clickInfo.event.extendedProps;

    compromisso.value = {
        id: clickInfo.event.id,
        // Espalha as propriedades originais do backend (titulo, descricao, tipo, situacao, conta, etc)
        ...dados,
        
        // AJUSTE CRÍTICO DE DATAS:
        // O FullCalendar retorna objetos 'Date' nativos do JS em .start e .end.
        // Precisamos usar esses objetos (e não strings) para que o componente 
        // Calendar do PrimeVue funcione corretamente no formulário.
        data_inicio: clickInfo.event.start,
        
        // Se o evento não tiver data de fim (comum em eventos de bloco único),
        // assumimos que termina na mesma hora de início para evitar erros no formulário.
        data_fim: clickInfo.event.end ? clickInfo.event.end : clickInfo.event.start,
        
        // Garante que o ID da conta está correto
        conta: dados.conta 
    };
    
    // Carrega a lista de convidados para a tabela lateral de gestão de convidados
    convidadosList.value = dados.convidados || [];
    
    // Abre o modal de edição (Dialog com inputs)
    dialogCompromissoVisivel.value = true;
}

async function handleEventDrop(info) {
    // Atualiza data ao arrastar
    if (!confirm('Deseja mover este compromisso?')) {
        info.revert();
        return;
    }
    
    try {
        const id = info.event.id;
        const payload = {
            data_inicio: info.event.start.toISOString(),
            data_fim: info.event.end ? info.event.end.toISOString() : null
        };
        await apiClient.patch(`/api/agenda-institucional/${id}/`, payload);
        toast.add({ severity: 'success', summary: 'Atualizado', detail: 'Horário modificado.', life: 4000 });
    } catch (e) {
        info.revert();
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível mover o evento.', life: 4000 });
    }
}

// --- CRUD COMPROMISSO ---

async function salvarCompromisso() {
    if (!compromisso.value.titulo || !compromisso.value.conta) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Preencha o título e o gabinete.', life: 4000 });
        return;
    }

    isLoadingSalvar.value = true;
    try {
        const payload = { ...compromisso.value };
        if (payload.data_inicio instanceof Date) payload.data_inicio = payload.data_inicio.toISOString();
        if (payload.data_fim instanceof Date) payload.data_fim = payload.data_fim.toISOString();

        // Remove campos readonly que vêm do serializer
        delete payload.convidados; 
        delete payload.status_cor;
        delete payload.nome_conta;
        delete payload.tipo_label;

        let response;
        if (payload.id) {
            response = await apiClient.patch(`/api/agenda-institucional/${payload.id}/`, payload);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Compromisso atualizado.', life: 4000 });
        } else {
            response = await apiClient.post('/api/agenda-institucional/', payload);
            compromisso.value.id = response.data.id; // Define ID para poder adicionar convidados
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Compromisso criado.', life: 4000 });
        }

        // Recarrega o calendário
        if (calendarRef.value) {
            const calendarApi = calendarRef.value.getApi();
            calendarApi.refetchEvents();
        }
        
        // Se for criação, não fechamos o modal imediatamente para permitir adicionar convidados?
        // Ou fechamos. Vamos fechar por padrão.
        if (!convidadosList.value.length) {
             dialogCompromissoVisivel.value = false;
        } else {
            // Se tiver convidados na lista local (ainda não implementado adição local antes de salvar o pai),
            // mas a lógica abaixo trata adição individual.
        }
        dialogCompromissoVisivel.value = false;

    } catch (error) {
        console.error(error);
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao salvar.' });
    } finally {
        isLoadingSalvar.value = false;
    }
}

async function excluirCompromisso() {
    try {
        await apiClient.delete(`/api/agenda-institucional/${compromisso.value.id}/`);
        toast.add({ severity: 'success', summary: 'Excluído', detail: 'Compromisso removido da agenda.', life: 4000 });
        dialogCompromissoVisivel.value = false;
        calendarRef.value.getApi().refetchEvents();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao excluir.', life: 4000 });
    }
}

// --- GESTÃO DE CONVIDADOS ---

async function buscarMunicipes(event) {
    if (!event.query.trim()) return;
    try {
        const { data } = await apiClient.get('/api/municipes/lookup/', { params: { q: event.query } });
        sugestoesMunicipes.value = data;
    } catch (e) { console.error(e); }
}

async function adicionarConvidado() {
    if (!municipeSelecionado.value) return;
    if (!compromisso.value.id) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Salve o compromisso antes de adicionar convidados.', life: 4000 });
        return;
    }

    try {
        const payload = {
            municipe_id: municipeSelecionado.value.id,
            observacao: obsConvidado.value
        };
        // Chama a Action customizada do ViewSet
        const { data } = await apiClient.post(`/api/agenda-institucional/${compromisso.value.id}/adicionar-convidado/`, payload);
        
        // Atualiza a lista local com o retorno do backend
        convidadosList.value = data.convidados;
        
        // Limpa inputs
        municipeSelecionado.value = null;
        obsConvidado.value = '';
        toast.add({ severity: 'success', summary: 'Adicionado', detail: 'Convidado incluído na lista.', life: 4000 });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao adicionar convidado.', life: 4000 });
    }
}

function removerConvidado(convidadoId) {
    if (!compromisso.value.id) return;

    confirm.require({
        message: 'Tem certeza que deseja remover este convidado?',
        header: 'Confirmar Remoção',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                const payload = { convidado_id: convidadoId };
                const { data } = await apiClient.post(`/api/agenda-institucional/${compromisso.value.id}/remover-convidado/`, payload);
                convidadosList.value = data.convidados;
                toast.add({ severity: 'success', summary: 'Removido', detail: 'Convidado removido.', life: 4000 });
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao remover.', life: 4000 });
            }
        }
    });
}

// --- CADASTRO RÁPIDO ---
const abrirCadastroRapido = () => { showMunicipeModal.value = true; };
const aoSalvarMunicipe = (novo) => {
    municipeSelecionado.value = novo;
    showMunicipeModal.value = false;
};
const abrirModalCompartilhamento = () => {
    showCompartilharModal.value = true;
};
</script>

<template>
    <div class="page-container">
        <ConfirmDialog />
        <Toast />

        <header class="page-header">
            <div class="flex justify-content-between mb-3 align-items-center">
                <h1>Agenda Institucional</h1>
                
                <div class="flex gap-2">
                    <Dropdown 
                        v-model="contaSelecionada" 
                        :options="contas" 
                        optionLabel="nome" 
                        optionValue="id" 
                        placeholder="Selecione a Agenda"
                        class="w-20rem"
                        @change="calendarRef.getApi().refetchEvents()" 
                    />
                    
                    <Button label="Novo Compromisso" icon="pi pi-plus" @click="dialogCompromissoVisivel = true" />
                    
                    <Button 
                        label="Compartilhar" 
                        icon="pi pi-share-alt" 
                        severity="secondary" 
                        outlined 
                        @click="abrirModalCompartilhamento"
                        v-if="usuarioPodeGerenciarConta" 
                    />
                </div>
            </div>
        </header>

        <Message v-if="!podeEditar" severity="info" :closable="false" class="mb-3">
            <div class="flex align-items-center">
                <i class="pi pi-eye mr-2"></i>
                <span>Você está em <strong>Modo de Visualização</strong>. Você não pode criar ou editar eventos nesta agenda.</span>
            </div>
        </Message>

        <main>
            <Card>
                <template #content>
                    <div v-if="isLoading" class="text-center p-5">
                        <ProgressSpinner />
                        <p>Carregando agenda...</p>
                    </div>
                    <FullCalendar ref="calendarRef" :options="calendarOptions" />
                </template>
            </Card>
        </main>

        <Dialog 
            v-model:visible="dialogCompromissoVisivel" 
            :header="compromisso.id ? 'Editar Compromisso' : 'Novo Compromisso'" 
            :style="{ width: '800px' }" 
            :modal="true"
            class="p-fluid"
            maximizable
        >
            <div class="grid">
                <div class="field col-12 md:col-6">
                    <label>Gabinete Responsável</label>
                    <Dropdown v-model="compromisso.conta" :options="contas" optionLabel="nome" optionValue="id" placeholder="Selecione..." />
                </div>
                <div class="field col-12 md:col-6">
                    <label>Assunto / Título</label>
                    <InputText v-model="compromisso.titulo" placeholder="Ex: Reunião com Secretário" autofocus />
                </div>

                <div class="field col-12 md:col-6">
                    <label>Início</label>
                    <Calendar v-model="compromisso.data_inicio" showTime hourFormat="24" dateFormat="dd/mm/yy" />
                </div>
                <div class="field col-12 md:col-6">
                    <label>Fim (Previsão)</label>
                    <Calendar v-model="compromisso.data_fim" showTime hourFormat="24" dateFormat="dd/mm/yy" />
                </div>
                <!--
                <div class="field col-12">
                    <label>Pauta / Detalhes</label>
                    <Textarea v-model="compromisso.descricao" rows="3" />
                </div>

                <div class="field col-12 md:col-4">
                    <label>Tipo</label>
                    <Dropdown v-model="compromisso.tipo" :options="tiposCompromisso" optionLabel="label" optionValue="value" />
                </div>
                <div class="field col-12 md:col-4">
                    <label>Situação</label>
                    <Dropdown v-model="compromisso.situacao" :options="situacaoOptions" optionLabel="label" optionValue="value" />
                </div>
                <div class="field col-12 md:col-4 flex align-items-center gap-2 mt-4">
                    <InputSwitch v-model="compromisso.confidencial" inputId="confidencial" />
                    <label for="confidencial" class="cursor-pointer">Agenda Reservada</label>
                    <i class="pi pi-info-circle text-gray-500" v-tooltip.top="'Oculta detalhes para a recepção, mantendo apenas horário ocupado.'"></i>
                </div>
                -->
            </div>

            <div v-if="compromisso.id" class="mt-4 border-top-1 border-gray-200 pt-3">
                <h3 class="text-base font-bold mb-3"><i class="pi pi-users mr-2"></i>Lista de Convidados / Presença</h3>
                
                <div class="flex gap-2 align-items-end mb-3">
                    <div class="flex-1">
                        <label class="text-sm">Buscar Pessoa</label>
                        <div class="p-inputgroup">
                            <AutoComplete 
                                v-model="municipeSelecionado" 
                                :suggestions="sugestoesMunicipes" 
                                @complete="buscarMunicipes" 
                                field="nome_completo" 
                                placeholder="Digite o nome..."
                            />
                            <Button icon="pi pi-user-plus" @click="abrirCadastroRapido" v-tooltip="'Cadastrar Nova Pessoa'" />
                        </div>
                    </div>
                    <div class="flex-1">
                        <label class="text-sm">Observação (Para Recepção)</label>
                        <InputText v-model="obsConvidado" placeholder="Ex: Liberar entrada fundos" />
                    </div>
                    <Button icon="pi pi-plus" @click="adicionarConvidado" :disabled="!municipeSelecionado" />
                </div>

                <DataTable :value="convidadosList" size="small" stripedRows responsiveLayout="scroll" emptyMessage="Nenhum convidado listado.">
                    <Column header="Convidado">
                        <template #body="{ data }">
                            <div class="flex align-items-center gap-2">
                                <Avatar :image="data.foto_municipe" shape="circle" icon="pi pi-user" />
                                <div class="flex flex-column">
                                    <span class="font-medium">{{ data.nome_municipe }}</span>
                                    <small class="text-gray-500">{{ data.cargo_municipe }}</small>
                                </div>
                            </div>
                        </template>
                    </Column>
                    <Column field="observacao" header="Obs."></Column>
                    <Column header="Status" style="width: 100px">
                        <template #body="{ data }">
                            <Tag :value="data.chegou ? 'Presente' : 'Aguardando'" :severity="data.chegou ? 'success' : 'warning'" />
                        </template>
                    </Column>
                    <Column style="width: 3rem">
                        <template #body="{ data }">
                            <Button 
                                icon="pi pi-trash" 
                                text 
                                severity="danger" 
                                size="small" 
                                @click="removerConvidado(data.id)" 
                                v-tooltip.top="'Remover da lista'"
                            />
                        </template>
                    </Column>
                </DataTable>
            </div>
            <div v-else class="mt-4 p-3 bg-yellow-50 border-round text-yellow-800 text-sm">
                <i class="pi pi-info-circle mr-2"></i> Salve o compromisso primeiro para adicionar convidados.
            </div>

            <template #footer>
                <div class="flex justify-content-between w-full">
                    <Button v-if="compromisso.id" label="Excluir Evento" icon="pi pi-trash" severity="danger" text @click="confirm.require({ message: 'Confirmar exclusão?', accept: excluirCompromisso })" />
                    <div class="flex gap-2 ml-auto">
                        <Button label="Fechar" icon="pi pi-times" text @click="dialogCompromissoVisivel = false" />
                        <Button label="Salvar" icon="pi pi-check" @click="salvarCompromisso" :loading="isLoadingSalvar" />
                    </div>
                </div>
            </template>
        </Dialog>

        <MunicipeFormModal 
            v-model:visible="showMunicipeModal" 
            :municipeId="null" 
            @saved="aoSalvarMunicipe" 
        />
        <AgendaCompartilharModal 
            v-model:visible="showCompartilharModal" 
            :contaId="contaSelecionada" 
        />
        <CompromissoDetalhesModal 
            v-model:visible="showDetalhesModal" 
            :evento="eventoSelecionadoParaLeitura" 
        />
    </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
/* Ajustes finos do FullCalendar */
:deep(.fc-event) { cursor: pointer; }
:deep(.fc-daygrid-day-number) { text-decoration: none; color: inherit; }
</style>