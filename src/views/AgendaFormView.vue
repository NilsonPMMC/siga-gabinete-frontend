<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from "primevue/usetoast";

// Importa o Componente Reutilizável
import MunicipeFormModal from '@/components/municipes/MunicipeFormModal.vue';

// --- INICIALIZAÇÃO E ESTADO ---
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const solicitacao = ref({});
const isEditMode = computed(() => !!route.params.id);
const isLoading = ref(false);

// Estados do AutoComplete
const sugestoesMunicipes = ref([]);
const municipeSelecionado = ref(null);
const isLoadingMunicipes = ref(false);
let searchTimeout = null;

const contas = ref([]);
const categoriasContato = ref([]);

// --- ESTADOS DO MODAL REUTILIZÁVEL ---
const showMunicipeModal = ref(false);
const municipeIdParaEditar = ref(null); // Null = Criar Novo, ID = Editar

// Sincroniza o objeto selecionado com o ID no formulário
watch(municipeSelecionado, (novoValor) => {
  solicitacao.value.solicitante = novoValor ? novoValor.id : null;
});

// --- FUNÇÕES DE CARREGAMENTO ---
const fetchDropdownData = async () => {
    try {
        const [contasRes, categoriasContatoRes] = await Promise.all([
            apiClient.get('/api/contas/'),
            apiClient.get('/api/contatos/categorias/'),
        ]);
        
        if (!authStore.user?.is_superuser) {
            const userContasIds = authStore.user?.perfil?.contas || [];
            contas.value = contasRes.data.filter(conta => userContasIds.includes(conta.id));
        } else {
            contas.value = contasRes.data;
        }

        categoriasContato.value = categoriasContatoRes.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar dados de apoio.' });
    }
};

onMounted(async () => {
    if (!authStore.isAuthenticated) { isLoading.value = false; return; }
    isLoading.value = true;
    await fetchDropdownData();

    if (isEditMode.value) {
        try {
            const { data } = await apiClient.get(`/api/solicitacoes-agenda/${route.params.id}/`);
            if (data.data_sugerida) data.data_sugerida = new Date(data.data_sugerida);
            solicitacao.value = data;

            if (data.solicitante) {
                const municipeRes = await apiClient.get(`/api/municipes/lookup/?q=${data.solicitante}`);
                if (municipeRes.data.length > 0) {
                    municipeSelecionado.value = municipeRes.data[0];
                }
            }
        } catch (error) { 
            toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os dados.' }); 
        }
    } else {
        const userProfile = authStore.user?.perfil;
        let contaInicial = null;
        if (!authStore.isRecepcao && userProfile?.contas?.length === 1) {
            contaInicial = userProfile.contas[0];
        }
        solicitacao.value = { conta: contaInicial };
    }
    isLoading.value = false;
});

// --- LÓGICA DE AUTOCOMPLETE ---
const buscarMunicipes = (event) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    isLoadingMunicipes.value = true;
    try {
      const params = {};
      if (event.query?.trim()) params.q = event.query;
      const { data } = await apiClient.get('/api/municipes/lookup/', { params });
      sugestoesMunicipes.value = data;
    } catch (error) {
      console.error("Erro ao buscar munícipes:", error);
    } finally {
      isLoadingMunicipes.value = false;
    }
  }, 300);
};

// --- LÓGICA DO MODAL (SIMPLIFICADA) ---

// Abre para CRIAR
const abrirModalNovoMunicipe = () => {
    municipeIdParaEditar.value = null;
    showMunicipeModal.value = true;
};

// Abre para EDITAR (se tiver alguém selecionado)
const abrirModalEditarMunicipe = () => {
    if (solicitacao.value.solicitante) {
        municipeIdParaEditar.value = solicitacao.value.solicitante;
        showMunicipeModal.value = true;
    }
};

// Callback quando o componente salva com sucesso
const aoSalvarMunicipe = (municipeSalvo) => {
    // Atualiza o objeto selecionado no AutoComplete
    municipeSelecionado.value = municipeSalvo;
    // Fecha o modal
    showMunicipeModal.value = false;
};

// --- SALVAR AGENDA ---
const salvarAgenda = async () => {
  isLoading.value = true;
  const payload = { ...solicitacao.value };
  
  if (payload.data_sugerida) {
    payload.data_sugerida = new Date(payload.data_sugerida).toISOString();
  }
  
  try {
    const { data } = isEditMode.value
      ? await apiClient.put(`/api/solicitacoes-agenda/${payload.id}/`, payload)
      : await apiClient.post('/api/solicitacoes-agenda/', payload);
    
    toast.add({ severity: 'success', summary: 'Sucesso', detail: `Solicitação ${isEditMode.value ? 'atualizada' : 'criada'}!`, life: 3000 });
    router.push('/agendas');
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao salvar a solicitação.', life: 3000 });
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="page-container">
    <Card>
      <template #title>
        <div class="card-title">
          <Button icon="pi pi-arrow-left" @click="router.push('/agendas')" text rounded />
          <h2 class="ml-2">{{ isEditMode ? 'Editar Solicitação de Agenda' : 'Nova Solicitação de Agenda' }}</h2>
        </div>
      </template>
      <template #content>
        <form @submit.prevent="salvarAgenda" class="p-fluid">
          
          <div class="field">
            <label for="conta">Gabinete Solicitado*</label>
            <Dropdown id="conta" v-model="solicitacao.conta" :options="contas" optionLabel="nome" optionValue="id" placeholder="Selecione um gabinete" />
          </div>
          
          <div class="field">
              <label for="solicitante">Solicitante*</label>
              <div class="p-inputgroup">
                  <AutoComplete
                      id="solicitante"
                      v-model="municipeSelecionado"
                      :suggestions="sugestoesMunicipes"
                      @complete="buscarMunicipes"
                      field="nome_completo"
                      placeholder="Digite para buscar um solicitante..."
                      forceSelection
                      style="width: 100%;"
                  >
                      <template #item="slotProps">
                          <div class="flex flex-column align-items-start">
                              <div>{{ slotProps.item.nome_completo }}</div>
                              <small v-if="slotProps.item.nome_de_guerra" class="text-sm text-primary-500 font-italic">
                                  {{ slotProps.item.nome_de_guerra }}
                              </small>
                              <small v-if="slotProps.item.cargo" class="text-sm text-color-secondary">{{ slotProps.item.cargo }}</small>
                          </div>
                      </template>
                  </AutoComplete>
                  
                  <Button 
                      type="button"
                      icon="pi pi-plus" 
                      @click="abrirModalNovoMunicipe"
                      title="Adicionar Novo Solicitante"
                      :disabled="!solicitacao.conta" 
                      v-tooltip.top="!solicitacao.conta ? 'Selecione um Gabinete primeiro' : ''"
                    />
                  
                  <Button 
                      type="button" 
                      icon="pi pi-pencil" 
                      @click="abrirModalEditarMunicipe" 
                      :disabled="!solicitacao.solicitante"
                      title="Editar Solicitante Selecionado" 
                  />
              </div>
          </div>

          <div class="field">
            <label for="assunto">Assunto*</label>
            <InputText id="assunto" v-model="solicitacao.assunto" />
          </div>
          <div class="field">
            <label for="detalhes">Detalhes Adicionais</label>
            <Textarea id="detalhes" v-model="solicitacao.detalhes" rows="4" autoResize />
          </div>
          <div class="field">
            <label for="data_sugerida">Data Sugerida (Opcional)</label>
            <Calendar id="data_sugerida" v-model="solicitacao.data_sugerida" showTime hourFormat="24" dateFormat="dd/mm/yy" />
          </div>
          
          <Button type="submit" label="Salvar Solicitação" icon="pi pi-save" :loading="isLoading" class="mt-4" />
        </form>
      </template>
    </Card>

    <MunicipeFormModal 
        v-model:visible="showMunicipeModal" 
        :municipeId="municipeIdParaEditar" 
        @saved="aoSalvarMunicipe" 
    />

  </div>
</template>

<style scoped>
.page-container { padding: 2rem; max-width: 800px; margin: auto; }
.field { margin-bottom: 1.5rem; }
.card-title { display: flex; align-items: center; }
label { font-weight: bold; margin-bottom: 0.5rem; display: block; }
</style>