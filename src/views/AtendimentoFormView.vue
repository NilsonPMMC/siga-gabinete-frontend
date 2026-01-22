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

const atendimento = ref({});
const isEditMode = computed(() => !!route.params.id);

// Estados do AutoComplete de Munícipe
const sugestoesMunicipes = ref([]);
const municipeSelecionado = ref(null);
let searchTimeout = null;

// Estados dos Selects
const contas = ref([]);
const usuarios = ref([]);
const categorias = ref([]);
const usuariosFiltrados = ref([]);
const responsavelSelecionado = ref(null);

const isLoading = ref(true);

// --- ESTADOS DO MODAL REUTILIZÁVEL ---
const showMunicipeModal = ref(false);
const municipeIdParaEditar = ref(null); // Null = Criar Novo, ID = Editar

// --- LÓGICA DE FILTRO DE RESPONSÁVEL (Mantida intacta) ---
watch(() => atendimento.value.conta, (novaContaId) => {
    if (responsavelSelecionado.value) {
        const contasDoResponsavel = responsavelSelecionado.value.contas || [];
        
        if (!contasDoResponsavel.includes(novaContaId)) {
            responsavelSelecionado.value = null;
        }
    }

    if (novaContaId) {
        usuariosFiltrados.value = usuarios.value.filter(usuario =>
            usuario.contas && usuario.contas.includes(novaContaId)
        );
    } else {
        usuariosFiltrados.value = [];
    }
}, { immediate: true });

// --- CARREGAMENTO DE DADOS (Mantido igual) ---
const fetchDropdownData = async () => {
    try {
        const [contasRes, usuariosRes, categoriasAtendimentoRes] = await Promise.all([
            apiClient.get('/api/contas/'),
            apiClient.get('/api/usuarios/'),
            apiClient.get('/api/categorias/')
        ]);

        if (!authStore.user?.is_superuser) {
            const userContasIds = authStore.user?.perfil?.contas || [];
            contas.value = contasRes.data.filter(conta => userContasIds.includes(conta.id));
        } else {
            contas.value = contasRes.data;
        }

        usuarios.value = usuariosRes.data.filter(user => !user.groups.includes('Recepção'));
        categorias.value = categoriasAtendimentoRes.data;

    } catch (error) { 
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar dados de apoio.', life: 3000 }); 
    }
};

onMounted(async () => {
  if (!authStore.isAuthenticated) { isLoading.value = false; return; }
  
  await fetchDropdownData();
  
  if (isEditMode.value) {
    try {
      const { data } = await apiClient.get(`/api/atendimentos/${route.params.id}/`);
      atendimento.value = { ...data, categorias: data.categorias?.map(c => c.id) || [] };

      if (data.responsavel_obj) responsavelSelecionado.value = data.responsavel_obj;

      if (data.municipe) {
        const municipeRes = await apiClient.get(`/api/municipes/lookup/?q=${data.municipe}`);
        if (municipeRes.data.length > 0) municipeSelecionado.value = municipeRes.data[0];
      }
    } catch (error) { toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os dados.' }); }
  } else {
      atendimento.value = { titulo: '', descricao: '', municipe: null, conta: null, responsavel: null, categorias: [] };
      const userProfile = authStore.user?.perfil;
      if (!authStore.isRecepcao && userProfile?.contas?.length === 1) {
          atendimento.value.conta = userProfile.contas[0];
      }
  }
  isLoading.value = false;
});

// --- LÓGICA DE AUTOCOMPLETE (Mantida) ---
const buscarMunicipes = (event) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    try {
      const termoBusca = event.query || '';
      const { data } = await apiClient.get('/api/municipes/lookup/', { params: { q: termoBusca } });
      sugestoesMunicipes.value = data;
    } catch (error) {
      sugestoesMunicipes.value = [];
    }
  }, 300);
};

watch(municipeSelecionado, (novoValor) => {
  atendimento.value.municipe = novoValor ? novoValor.id : null;
});

// --- LÓGICA DO MODAL (SIMPLIFICADA) ---

// Abre para CRIAR
const abrirModalNovoMunicipe = () => {
    municipeIdParaEditar.value = null; // Modo criação
    showMunicipeModal.value = true;
};

// Abre para EDITAR (se tiver alguém selecionado)
const abrirModalEditarMunicipe = () => {
    if (municipeSelecionado.value) {
        municipeIdParaEditar.value = municipeSelecionado.value.id;
        showMunicipeModal.value = true;
    }
};

// Callback quando o componente salva com sucesso
const aoSalvarMunicipe = (municipeSalvo) => {
    // 1. Atualiza o objeto selecionado no AutoComplete
    // Formata do jeito que o AutoComplete espera (com texto_busca se precisar)
    const municipeFormatado = {
        ...municipeSalvo,
        texto_busca: `${municipeSalvo.nome_completo} ${municipeSalvo.nome_de_guerra || ''}`
    };
    
    municipeSelecionado.value = municipeFormatado;
    
    // 2. Fecha o modal (o componente já emite o evento, mas garantimos aqui)
    showMunicipeModal.value = false;
};

// --- SALVAR ATENDIMENTO (Mantido) ---
const salvarAtendimento = async () => {
  isLoading.value = true;
  atendimento.value.responsavel = responsavelSelecionado.value ? responsavelSelecionado.value.id : null;
  
  try {
    const { data } = isEditMode.value
      ? await apiClient.put(`/api/atendimentos/${atendimento.value.id}/`, atendimento.value)
      : await apiClient.post('/api/atendimentos/', atendimento.value);
    
    toast.add({ severity: 'success', summary: 'Sucesso', detail: isEditMode.value ? 'Atendimento atualizado!' : `Atendimento criado! Protocolo: ${data.protocolo}`, life: 3000 });
    router.push(authStore.isRecepcao ? '/' : `/atendimentos/${data.id}`);
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar o atendimento.', life: 3000 });
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
          <Button icon="pi pi-arrow-left" @click="router.push('/')" text rounded />
          <h2 class="ml-2">{{ isEditMode ? 'Editar Atendimento' : 'Novo Atendimento' }}</h2>
        </div>
      </template>
      <template #content>
        <form @submit.prevent="salvarAtendimento" class="p-fluid">
          
          <div class="field">
            <label for="conta">Gabinete de Destino*</label>
            <Dropdown id="conta" v-model="atendimento.conta" :options="contas" optionLabel="nome" optionValue="id" placeholder="Selecione um gabinete" />
          </div>

          <div class="field">
              <label for="municipe">Munícipe*</label>
              <div class="p-inputgroup">
                  <AutoComplete
                      id="municipe"
                      v-model="municipeSelecionado"
                      :suggestions="sugestoesMunicipes"
                      @complete="buscarMunicipes"
                      field="nome_completo"
                      placeholder="Digite para buscar..."
                      forceSelection
                      style="width: 100%;"
                  >
                      <template #item="slotProps">
                          <div class="flex flex-column align-items-start">
                              <div>{{ slotProps.item.nome_completo }}
                                  <i v-if="slotProps.item.qualidade_dados === 'Baixo'" 
                                     class="pi pi-exclamation-triangle text-orange-500 ml-2" 
                                     v-tooltip.top="'Dados incompletos'"></i>
                              </div>
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
                      title="Novo Munícipe"
                      :disabled="!atendimento.conta" 
                      v-tooltip.top="!atendimento.conta ? 'Selecione um Gabinete primeiro' : ''"
                  />
                  
                  <Button 
                      type="button" 
                      icon="pi pi-pencil" 
                      @click="abrirModalEditarMunicipe" 
                      :disabled="!municipeSelecionado"
                      title="Editar Selecionado" 
                  />
              </div>
          </div>

          <div class="field">
              <label for="responsavel">Atribuir a Responsável (Opcional)</label>
              <Dropdown 
                  id="responsavel" 
                  v-model="responsavelSelecionado" 
                  :options="usuariosFiltrados"
                  optionLabel="username"
                  placeholder="Selecione um responsável" 
                  filter 
                  showClear 
                  :disabled="!atendimento.conta" />
          </div>

          <div class="field">
            <label for="titulo">Título do Atendimento*</label>
            <InputText id="titulo" type="text" v-model="atendimento.titulo" />
          </div>
          <div class="field">
            <label for="descricao">Descrição Detalhada</label>
            <Textarea id="descricao" v-model="atendimento.descricao" rows="5" autoResize />
          </div>

          <Button type="submit" label="Salvar Atendimento" icon="pi pi-save" :loading="isLoading" class="mt-4" />
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