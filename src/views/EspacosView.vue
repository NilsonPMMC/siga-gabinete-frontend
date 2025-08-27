<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useAuthStore } from '@/stores/auth';

// --- INICIALIZAÇÃO ---
const toast = useToast();
const confirm = useConfirm();
const authStore = useAuthStore();
const router = useRouter();
const isLoading = ref(true);
const espacos = ref([]);

// --- ESTADO DO DIÁLOGO DE CRUD ---
const dialogoCrudVisivel = ref(false);
const espacoEmEdicao = ref({});
const isEditMode = ref(false);

// --- ESTADO DO DIÁLOGO DE RESERVA ---
const dialogoReservaVisivel = ref(false);
const novaReserva = ref({});
const sugestoesMunicipes = ref([]);
const solicitanteSelecionado = ref(null);
const municipesOptions = ref([]);
const isLoadingMunicipes = ref(false);
let searchTimeout = null;

watch(solicitanteSelecionado, (novoValor) => {
    novaReserva.value.solicitante = novoValor ? novoValor.id : null;
});

// --- FUNÇÕES DE CARREGAMENTO E CRUD ---
const fetchEspacos = async () => {
  isLoading.value = true;
  try {
    const response = await apiClient.get('/api/espacos/');
    espacos.value = response.data;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os espaços.' });
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  try {
    const [espacosRes, municipesRes] = await Promise.all([
      apiClient.get('/api/espacos/'),
      apiClient.get('/api/municipes/lookup/')
    ]);
    espacos.value = espacosRes.data;
    municipesOptions.value = municipesRes.data;
  } catch (error) {
    console.error("Erro ao carregar dados iniciais:", error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os dados.' });
  } finally {
    isLoading.value = false;
  }
});

const abrirNovoDialogo = () => {
  isEditMode.value = false;
  espacoEmEdicao.value = { nome: '', capacidade: 0, descricao: '', ativo: true };
  dialogoCrudVisivel.value = true;
};

const abrirEditarDialogo = (espaco) => {
  isEditMode.value = true;
  espacoEmEdicao.value = { ...espaco };
  dialogoCrudVisivel.value = true;
};

const salvarEspaco = async () => {
  try {
    if (isEditMode.value) {
      await apiClient.put(`/api/espacos/${espacoEmEdicao.value.id}/`, espacoEmEdicao.value);
      toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Espaço atualizado!', life: 3000 });
    } else {
      await apiClient.post('/api/espacos/', espacoEmEdicao.value);
      toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Espaço criado!', life: 3000 });
    }
    dialogoCrudVisivel.value = false;
    fetchEspacos();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao salvar o espaço.', life: 3000 });
  }
};

const confirmarExclusao = (espaco) => {
  confirm.require({
    message: `Tem certeza que deseja excluir o espaço "${espaco.nome}"?`,
    header: 'Confirmação de Exclusão',
    icon: 'pi pi-exclamation-triangle',
    acceptClassName: 'p-button-danger',
    acceptLabel: 'Sim, Excluir',
    rejectLabel: 'Cancelar',
    accept: async () => {
      try {
        await apiClient.delete(`/api/espacos/${espaco.id}/`);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Espaço excluído.', life: 3000 });
        fetchEspacos();
      } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir o espaço.', life: 3000 });
      }
    },
  });
};

// --- FUNÇÕES PARA A RESERVA RÁPIDA ---
const abrirDialogoReserva = () => {
    novaReserva.value = {
        assunto: '',
        detalhes: '',
        solicitante: null,
        espaco: null,
        data_agendada: null,
        data_agendada_fim: null,
        conta: authStore.user?.perfil?.contas?.[0] || null
    };
    // Reseta também o estado do AutoComplete
    solicitanteSelecionado.value = null;
    sugestoesMunicipes.value = [];
    dialogoReservaVisivel.value = true;
};

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
    const { assunto, solicitante, espaco, data_agendada, data_agendada_fim, detalhes } = novaReserva.value;

    // 1. Validação dos campos do formulário (mantida como no seu código)
    if (!assunto || !espaco || !data_agendada || !data_agendada_fim) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Assunto, Espaço, Início e Fim são obrigatórios.', life: 3000 });
        return;
    }
    if (new Date(data_agendada_fim) <= new Date(data_agendada)) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'O horário de término deve ser posterior ao de início.', life: 3000 });
        return;
    }
    
    // 2. Mapeamento dos dados do formulário para o formato da NOVA API
    const payload = {
        titulo: assunto,
        solicitante: solicitante, // O campo 'solicitante' que adicionamos ao backend
        espaco: espaco,
        data_inicio: new Date(data_agendada).toISOString(),
        data_fim: new Date(data_agendada_fim).toISOString(),
        observacoes: detalhes || ''
    };

    try {
        // 3. Envio para a URL CORRETA da API de reservas
        await apiClient.post('/api/reservas-espaco/', payload);
        
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Espaço reservado com sucesso!', life: 3000 });
        dialogoReservaVisivel.value = false;
        // Se houver uma função para atualizar a agenda do espaço, chame-a aqui.
        // ex: fetchEventosDoEspaco();
    } catch (error) {
        // Extrai a mensagem de erro específica do backend (ex: conflito de horário)
        const errorMsg = error.response?.data?.non_field_errors?.[0] || Object.values(error.response.data)[0][0] || 'Não foi possível realizar a reserva.';
        toast.add({ severity: 'error', summary: 'Erro na Reserva', detail: errorMsg, life: 5000 });
    }
};

const verAgendaDoEspaco = (espacoId) => {
  router.push(`/espacos/${espacoId}/agenda`);
};
</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <h1>Gestão de Espaços</h1>
      <div class="flex gap-2">
        <Button label="Reservar Espaço" icon="pi pi-calendar-plus" class="p-button-success" @click="abrirDialogoReserva" />
        <Button v-if="authStore.isSuperuser" label="Novo Espaço" icon="pi pi-plus" @click="abrirNovoDialogo" />
      </div>
    </header>

    <main>
      <DataTable :value="espacos" :loading="isLoading" responsiveLayout="scroll">
        <Column header="Agenda" style="width: 5rem; text-align: center;">
          <template #body="slotProps">
            <Button 
              icon="pi pi-calendar" 
              text 
              rounded 
              severity="info" 
              @click="verAgendaDoEspaco(slotProps.data.id)" 
              title="Ver Agenda do Espaço"
              style="font-size: 1.5rem;"
            />
          </template>
        </Column>
        <Column field="nome" header="Nome do Espaço" sortable></Column>
        <Column field="capacidade" header="Capacidade" sortable></Column>
        <Column field="descricao" header="Descrição"></Column>
        <Column v-if="authStore.isSuperuser" header="Ações" style="width: 8rem; text-align: center;">
          <template #body="slotProps">
            <Button icon="pi pi-pencil" text rounded severity="secondary" @click="abrirEditarDialogo(slotProps.data)" title="Editar Espaço" />
            <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmarExclusao(slotProps.data)" title="Excluir Espaço" />
          </template>
        </Column>
        <template #empty>Nenhum espaço cadastrado.</template>
      </DataTable>
    </main>

    <Dialog v-model:visible="dialogoCrudVisivel" :style="{width: '450px'}" :header="isEditMode ? 'Editar Espaço' : 'Novo Espaço'" :modal="true" class="p-fluid">
      <div class="field">
        <label for="nome">Nome do Espaço*</label>
        <InputText id="nome" v-model="espacoEmEdicao.nome" required="true" />
      </div>
      <div class="field">
        <label for="capacidade">Capacidade de Pessoas</label>
        <InputNumber id="capacidade" v-model="espacoEmEdicao.capacidade" />
      </div>
      <div class="field">
        <label for="descricao">Descrição e Recursos</label>
        <Textarea id="descricao" v-model="espacoEmEdicao.descricao" rows="3" />
      </div>
      <template #footer>
        <Button label="Cancelar" icon="pi pi-times" text @click="dialogoCrudVisivel = false" />
        <Button label="Salvar" icon="pi pi-check" @click="salvarEspaco" />
      </template>
    </Dialog>

    <Dialog v-model:visible="dialogoReservaVisivel" :style="{width: '600px'}" header="Reserva Rápida de Espaço" :modal="true" class="p-fluid">
      <div class="field">
        <label for="reserva-assunto">Assunto da Reunião*</label>
        <InputText id="reserva-assunto" v-model="novaReserva.assunto" />
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
        <div class="field col-12 md-6">
          <label for="reserva-espaco">Espaço*</label>
          <Dropdown id="reserva-espaco" v-model="novaReserva.espaco" :options="espacos" optionLabel="nome" optionValue="id" placeholder="Selecione a sala" />
        </div>
        <div class="field col-12 md-6">
          <label for="reserva-conta">Gabinete Responsável</label>
          <InputText id="reserva-conta" :value="authStore.user?.perfil?.contas?.[0] ? 'Vinculado Automaticamente' : 'Nenhum'" disabled />
        </div>
      </div>
      <div class="grid">
        <div class="field col-12 md:col-6">
          <label for="reserva-inicio">Início*</label>
          <Calendar id="reserva-inicio" v-model="novaReserva.data_agendada" showTime hourFormat="24" dateFormat="dd/mm/yy" />
        </div>
        <div class="field col-12 md:col-6">
          <label for="reserva-fim">Término*</label>
          <Calendar id="reserva-fim" v-model="novaReserva.data_agendada_fim" showTime hourFormat="24" dateFormat="dd/mm/yy" />
        </div>
      </div>
      <div class="field">
        <label for="reserva-detalhes">Descrição/Observações</label>
        <Textarea id="reserva-detalhes" v-model="novaReserva.detalhes" rows="3" />
      </div>
      <template #footer>
        <Button label="Cancelar" icon="pi pi-times" text @click="dialogoReservaVisivel = false" />
        <Button label="Confirmar Reserva" icon="pi pi-check" @click="salvarReserva" />
      </template>
    </Dialog>

    <Toast />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
</style>