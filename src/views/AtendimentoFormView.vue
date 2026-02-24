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

/** Triagem: null = não escolheu, 'atendimento' = protocolo, 'visita' = registro de visita */
const tipoRegistro = ref(null);

// Opções de origem do atendimento (obrigatório quando fluxo = Atendimento)
const opcoesOrigem = [
  { label: 'Presencial', value: 'PRESENCIAL' },
  { label: 'Telefone', value: 'TELEFONE' },
  { label: 'E-mail', value: 'EMAIL' },
  { label: 'WhatsApp', value: 'WHATSAPP' },
];

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

// Fluxo Registro de Visita: conta destino e usuário destino (opcional)
const visitaConta = ref(null);
const usuarioDestinoVisita = ref(null);
const usuariosFiltradosVisita = computed(() => {
  if (!visitaConta.value) return [];
  return usuarios.value.filter(u => u.contas && u.contas.includes(visitaConta.value));
});

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
      atendimento.value = { titulo: '', descricao: '', origem: 'PRESENCIAL', municipe: null, conta: null, responsavel: null, categorias: [] };
      tipoRegistro.value = null;
      const userProfile = authStore.user?.perfil;
      if (!authStore.isRecepcao && userProfile?.contas?.length === 1) {
          atendimento.value.conta = userProfile.contas[0];
      }
      visitaConta.value = userProfile?.contas?.length === 1 ? userProfile.contas[0] : null;
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

// --- SALVAR ATENDIMENTO ---
const salvarAtendimento = async () => {
  if (!tipoRegistro.value && !isEditMode.value) return;
  if (!isEditMode.value && tipoRegistro.value === 'atendimento' && !atendimento.value.origem) {
    toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione a origem do atendimento.', life: 3000 });
    return;
  }
  isLoading.value = true;
  atendimento.value.responsavel = responsavelSelecionado.value ? responsavelSelecionado.value.id : null;
  if (!atendimento.value.origem) atendimento.value.origem = 'PRESENCIAL';

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

// --- SALVAR REGISTRO DE VISITA (sem protocolo, dispara notificação interna) ---
const salvarVisita = async () => {
  if (!municipeSelecionado.value?.id || !visitaConta.value) {
    toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Preencha Munícipe e Gabinete de Destino.', life: 3000 });
    return;
  }
  isLoading.value = true;
  try {
    await apiClient.post('/api/checkins/', {
      municipe: municipeSelecionado.value.id,
      conta_destino: visitaConta.value,
      usuario_destino: usuarioDestinoVisita.value?.id ?? null,
    });
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Visita registrada. O responsável foi notificado.', life: 4000 });
    tipoRegistro.value = null;
    municipeSelecionado.value = null;
    visitaConta.value = authStore.user?.perfil?.contas?.length === 1 ? authStore.user.perfil.contas[0] : null;
    usuarioDestinoVisita.value = null;
    router.push('/');
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível registrar a visita.', life: 3000 });
  } finally {
    isLoading.value = false;
  }
};

const voltarTriagem = () => {
  tipoRegistro.value = null;
};
</script>

<template>
  <div class="page-container">
    <Card>
      <template #title>
        <div class="card-title">
          <Button icon="pi pi-arrow-left" @click="isEditMode ? router.push('/') : (tipoRegistro ? voltarTriagem() : router.push('/'))" text rounded />
          <h2 class="ml-2">
            {{ isEditMode ? 'Editar Atendimento' : (tipoRegistro === 'atendimento' ? 'Novo Atendimento (Protocolo)' : tipoRegistro === 'visita' ? 'Registro de Visita / Compromisso' : 'Tipo de Registro') }}
          </h2>
        </div>
      </template>
      <template #content>
        <!-- Triagem: escolha do tipo (apenas em modo criação) -->
        <div v-if="!isEditMode && !tipoRegistro" class="flex flex-column gap-3">
          <p class="text-color-secondary mb-2">Selecione o tipo de registro:</p>
          <div class="grid">
            <div class="col-12 md:col-6">
              <Card class="cursor-pointer hover:surface-hover transition-colors" @click="tipoRegistro = 'atendimento'">
                <template #title>
                  <span class="flex align-items-center gap-2">
                    <i class="pi pi-file-edit"></i>
                    Novo Atendimento (Protocolo)
                  </span>
                </template>
                <template #content>
                  <p class="m-0 text-color-secondary">Criar atendimento com protocolo, título, descrição e categorias. Exige origem (Presencial, Telefone, E-mail, WhatsApp).</p>
                </template>
              </Card>
            </div>
            <div class="col-12 md:col-6">
              <Card class="cursor-pointer hover:surface-hover transition-colors" @click="tipoRegistro = 'visita'">
                <template #title>
                  <span class="flex align-items-center gap-2">
                    <i class="pi pi-user-plus"></i>
                    Registro de Visita / Compromisso
                  </span>
                </template>
                <template #content>
                  <p class="m-0 text-color-secondary">Apenas registrar presença. Não gera protocolo. O responsável ou a conta será notificada.</p>
                </template>
              </Card>
            </div>
          </div>
        </div>

        <!-- Formulário: Novo Atendimento (ou Edição) -->
        <form v-else-if="tipoRegistro === 'atendimento' || isEditMode" @submit.prevent="salvarAtendimento" class="p-fluid">
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
                      <i v-if="slotProps.item.qualidade_dados === 'Baixo'" class="pi pi-exclamation-triangle text-orange-500 ml-2" v-tooltip.top="'Dados incompletos'"></i>
                    </div>
                    <small v-if="slotProps.item.nome_de_guerra" class="text-sm text-primary-500 font-italic">{{ slotProps.item.nome_de_guerra }}</small>
                    <small v-if="slotProps.item.cargo" class="text-sm text-color-secondary">{{ slotProps.item.cargo }}</small>
                  </div>
                </template>
              </AutoComplete>
              <Button type="button" icon="pi pi-plus" @click="abrirModalNovoMunicipe" title="Novo Munícipe" :disabled="!atendimento.conta" v-tooltip.top="!atendimento.conta ? 'Selecione um Gabinete primeiro' : ''" />
              <Button type="button" icon="pi pi-pencil" @click="abrirModalEditarMunicipe" :disabled="!municipeSelecionado" title="Editar Selecionado" />
            </div>
          </div>

          <div class="field">
            <label for="origem">{{ isEditMode ? 'Origem do Atendimento' : 'Origem do Atendimento*' }}</label>
            <Dropdown id="origem" v-model="atendimento.origem" :options="opcoesOrigem" optionLabel="label" optionValue="value" placeholder="Selecione a origem" />
          </div>

          <div class="field">
            <label for="responsavel">Atribuir a Responsável (Opcional)</label>
            <Dropdown id="responsavel" v-model="responsavelSelecionado" :options="usuariosFiltrados" optionLabel="username" placeholder="Selecione um responsável" filter showClear :disabled="!atendimento.conta" />
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

        <!-- Formulário: Registro de Visita (sem protocolo) -->
        <form v-else-if="tipoRegistro === 'visita'" @submit.prevent="salvarVisita" class="p-fluid">
          <div class="field">
            <label for="visita-conta">Gabinete de Destino*</label>
            <Dropdown id="visita-conta" v-model="visitaConta" :options="contas" optionLabel="nome" optionValue="id" placeholder="Selecione o gabinete" />
          </div>
          <div class="field">
            <label for="visita-municipe">Munícipe*</label>
            <div class="p-inputgroup">
              <AutoComplete
                id="visita-municipe"
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
                    <div>{{ slotProps.item.nome_completo }}</div>
                    <small v-if="slotProps.item.nome_de_guerra" class="text-sm text-primary-500 font-italic">{{ slotProps.item.nome_de_guerra }}</small>
                  </div>
                </template>
              </AutoComplete>
              <Button type="button" icon="pi pi-plus" @click="abrirModalNovoMunicipe" title="Novo Munícipe" :disabled="!visitaConta" v-tooltip.top="!visitaConta ? 'Selecione um Gabinete primeiro' : ''" />
              <Button type="button" icon="pi pi-pencil" @click="abrirModalEditarMunicipe" :disabled="!municipeSelecionado" title="Editar Selecionado" />
            </div>
          </div>
          <div class="field">
            <label for="visita-usuario">Usuário Destino / Responsável (Opcional)</label>
            <Dropdown id="visita-usuario" v-model="usuarioDestinoVisita" :options="usuariosFiltradosVisita" optionLabel="username" placeholder="Quem deve ser avisado?" filter showClear :disabled="!visitaConta" />
          </div>
          <Button type="submit" label="Registrar Visita" icon="pi pi-check" :loading="isLoading" class="mt-4" />
        </form>
      </template>
    </Card>

    <MunicipeFormModal v-model:visible="showMunicipeModal" :municipeId="municipeIdParaEditar" @saved="aoSalvarMunicipe" />
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; max-width: 800px; margin: auto; }
.field { margin-bottom: 1.5rem; }
.card-title { display: flex; align-items: center; }
label { font-weight: bold; margin-bottom: 0.5rem; display: block; }
</style>