<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from "primevue/usetoast";
import MunicipeFormModal from '@/components/municipes/MunicipeFormModal.vue';
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const atendimento = ref({});
const isEditMode = computed(() => !!route.params.id);

const opcoesOrigem = [
  { label: 'Presencial', value: 'PRESENCIAL' },
  { label: 'Telefone', value: 'TELEFONE' },
  { label: 'E-mail', value: 'EMAIL' },
  { label: 'WhatsApp', value: 'WHATSAPP' },
];

const sugestoesMunicipes = ref([]);
const municipeSelecionado = ref(null);
let searchTimeout = null;

const contas = ref([]);
const usuarios = ref([]);
const assuntos = ref([]);
const usuariosFiltrados = ref([]);
const responsavelSelecionado = ref(null);

const isLoading = ref(true);
const isSugerindoAssunto = ref(false);
const ultimaSugestaoAssunto = ref(null);

const showMunicipeModal = ref(false);
const municipeIdParaEditar = ref(null);

watch(() => atendimento.value.conta, (novaContaId) => {
    if (responsavelSelecionado.value) {
        const contasDoResponsavel = responsavelSelecionado.value.contas || [];
        if (!contasDoResponsavel.includes(novaContaId)) {
            responsavelSelecionado.value = null;
        }
    }
    if (novaContaId) {
        usuariosFiltrados.value = usuarios.value.filter(
            (usuario) => usuario.contas && usuario.contas.includes(novaContaId)
        );
    } else {
        usuariosFiltrados.value = [];
    }
}, { immediate: true });

const fetchDropdownData = async () => {
    try {
        const [contasRes, usuariosRes, assuntosRes] = await Promise.all([
            apiClient.get('/api/contas/'),
            apiClient.get('/api/usuarios/'),
            apiClient.get('/api/assuntos-atendimento/'),
        ]);

        if (!authStore.user?.is_superuser) {
            const userContasIds = authStore.user?.perfil?.contas || [];
            contas.value = contasRes.data.filter((conta) => userContasIds.includes(conta.id));
        } else {
            contas.value = contasRes.data;
        }

        usuarios.value = usuariosRes.data.filter((user) => !user.groups.includes('Recepção'));
        assuntos.value = assuntosRes.data.map((a) => ({
            label: a.nome,
            value: a.id,
            codigo: a.codigo,
        }));
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar dados de apoio.', life: 3000 });
    }
};

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }

  await fetchDropdownData();

  if (isEditMode.value) {
    try {
      const { data } = await apiClient.get(`/api/atendimentos/${route.params.id}/`);
      atendimento.value = {
        ...data,
        assunto_id: data.assunto ?? data.assunto_obj?.id ?? null,
      };
      if (data.responsavel_obj) responsavelSelecionado.value = data.responsavel_obj;
      if (data.municipe) {
        const municipeRes = await apiClient.get(`/api/municipes/lookup/?q=${data.municipe}`);
        if (municipeRes.data.length > 0) municipeSelecionado.value = municipeRes.data[0];
      }
    } catch (error) {
      toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os dados.' });
    }
  } else {
      atendimento.value = {
        titulo: '',
        descricao: '',
        origem: 'PRESENCIAL',
        municipe: null,
        conta: null,
        responsavel: null,
        assunto_id: null,
      };
      const userProfile = authStore.user?.perfil;
      if (!authStore.isRecepcao && userProfile?.contas?.length === 1) {
          atendimento.value.conta = userProfile.contas[0];
      }
  }
  isLoading.value = false;
});

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

const abrirModalNovoMunicipe = () => {
    municipeIdParaEditar.value = null;
    showMunicipeModal.value = true;
};

const abrirModalEditarMunicipe = () => {
    if (municipeSelecionado.value) {
        municipeIdParaEditar.value = municipeSelecionado.value.id;
        showMunicipeModal.value = true;
    }
};

const aoSalvarMunicipe = (municipeSalvo) => {
    municipeSelecionado.value = {
        ...municipeSalvo,
        texto_busca: `${municipeSalvo.nome_completo} ${municipeSalvo.nome_de_guerra || ''}`,
    };
    showMunicipeModal.value = false;
};

const sugerirAssuntoIA = async () => {
  if (!atendimento.value.titulo?.trim() && !atendimento.value.descricao?.trim()) {
    toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Preencha título ou descrição antes de solicitar a sugestão.', life: 3000 });
    return;
  }
  isSugerindoAssunto.value = true;
  try {
    const payload = {
      titulo: atendimento.value.titulo,
      descricao: atendimento.value.descricao,
      origem: atendimento.value.origem || 'PRESENCIAL',
      municipe: atendimento.value.municipe,
      conta: atendimento.value.conta,
    };
    let res;
    if (isEditMode.value && atendimento.value.id) {
      res = await apiClient.post(`/api/atendimentos/${atendimento.value.id}/sugerir-assunto/`);
    } else {
      res = await apiClient.post('/api/atendimentos/sugerir-assunto-preview/', payload);
    }
    const sugestao = res.data.sugestao_ia || res.data;
    ultimaSugestaoAssunto.value = sugestao;
    if (sugestao.assunto_id) {
      atendimento.value.assunto_id = sugestao.assunto_id;
    }
    const pct = sugestao.confianca != null ? ` (${Math.round(sugestao.confianca * 100)}%)` : '';
    toast.add({
      severity: 'success',
      summary: 'Sugestão IA',
      detail: `${sugestao.assunto_nome || 'Assunto'}${pct}${sugestao.justificativa ? ' — ' + sugestao.justificativa : ''}`,
      life: 6000,
    });
  } catch (error) {
    const msg = error.response?.data?.erro || error.response?.data?.detail || 'Não foi possível obter sugestão da IA.';
    toast.add({ severity: 'error', summary: 'Erro', detail: msg, life: 4000 });
  } finally {
    isSugerindoAssunto.value = false;
  }
};

const salvarAtendimento = async () => {
  if (!atendimento.value.origem) {
    toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione a origem do atendimento.', life: 3000 });
    return;
  }
  if (!atendimento.value.assunto_id) {
    toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione o assunto do atendimento.', life: 3000 });
    return;
  }
  isLoading.value = true;
  atendimento.value.responsavel = responsavelSelecionado.value ? responsavelSelecionado.value.id : null;

  const payload = {
    titulo: atendimento.value.titulo,
    descricao: atendimento.value.descricao,
    origem: atendimento.value.origem,
    municipe: atendimento.value.municipe,
    conta: atendimento.value.conta,
    responsavel: atendimento.value.responsavel,
    assunto_id: atendimento.value.assunto_id,
  };

  try {
    const { data } = isEditMode.value
      ? await apiClient.put(`/api/atendimentos/${atendimento.value.id}/`, payload)
      : await apiClient.post('/api/atendimentos/', payload);

    toast.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: isEditMode.value ? 'Atendimento atualizado!' : `Atendimento criado! Protocolo: ${data.protocolo}`,
      life: 3000,
    });
    router.push(authStore.isRecepcao ? '/' : `/atendimentos/${data.id}`);
  } catch (error) {
    const detalhe = error.response?.data?.assunto_id?.[0]
      || error.response?.data?.detail
      || 'Não foi possível salvar o atendimento.';
    toast.add({ severity: 'error', summary: 'Erro', detail: detalhe, life: 4000 });
  } finally {
    isLoading.value = false;
  }
};

const tituloPagina = computed(() => (isEditMode.value ? 'Editar Atendimento' : 'Novo Atendimento'));
</script>

<template>
  <div class="page-container">
    <Card>
      <template #title>
        <div class="card-title">
          <Button icon="pi pi-arrow-left" @click="router.push(isEditMode ? `/atendimentos/${route.params.id}` : '/')" text rounded />
          <h2 class="ml-2">{{ tituloPagina }}</h2>
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
            <small class="block text-color-secondary mb-2">
              Busque por nome, apelido, CPF ou matrícula RH (servidores).
            </small>
            <div class="p-inputgroup">
              <AutoComplete
                id="municipe"
                v-model="municipeSelecionado"
                :suggestions="sugestoesMunicipes"
                @complete="buscarMunicipes"
                field="nome_completo"
                placeholder="Nome, CPF ou matrícula RH..."
                forceSelection
                style="width: 100%;"
              >
                <template #item="slotProps">
                  <div class="flex flex-column align-items-start gap-1">
                    <div>
                      {{ slotProps.item.nome_completo }}
                      <i
                        v-if="slotProps.item.qualidade_dados === 'Baixo'"
                        class="pi pi-exclamation-triangle text-orange-500 ml-2"
                        v-tooltip.top="'Dados incompletos'"
                      />
                    </div>
                    <small v-if="slotProps.item.nome_de_guerra" class="text-sm text-primary-500 font-italic">
                      {{ slotProps.item.nome_de_guerra }}
                    </small>
                    <small v-if="slotProps.item.cpf" class="text-xs text-color-secondary">
                      CPF: {{ slotProps.item.cpf }}
                    </small>
                    <small v-if="slotProps.item.matricula_rh" class="text-xs text-color-secondary">
                      Matrícula RH: {{ slotProps.item.matricula_rh }}
                    </small>
                    <small v-if="slotProps.item.cargo" class="text-xs text-color-secondary">
                      {{ slotProps.item.cargo }}
                    </small>
                  </div>
                </template>
              </AutoComplete>
              <Button type="button" icon="pi pi-plus" @click="abrirModalNovoMunicipe" title="Novo Munícipe" :disabled="!atendimento.conta" />
              <Button type="button" icon="pi pi-pencil" @click="abrirModalEditarMunicipe" :disabled="!municipeSelecionado" title="Editar Selecionado" />
            </div>
          </div>

          <div class="field">
            <label for="origem">Origem do Atendimento*</label>
            <Dropdown id="origem" v-model="atendimento.origem" :options="opcoesOrigem" optionLabel="label" optionValue="value" placeholder="Selecione a origem" />
          </div>

          <div class="field">
            <label for="responsavel">Atribuir a Responsável (Opcional)</label>
            <Dropdown id="responsavel" v-model="responsavelSelecionado" :options="usuariosFiltrados" optionLabel="username" placeholder="Selecione um responsável" filter showClear :disabled="!atendimento.conta" />
          </div>

          <div class="field">
            <label for="assunto">Assunto*</label>
            <div class="flex flex-column gap-2">
              <div class="flex gap-2 align-items-center flex-wrap">
                <Dropdown
                  id="assunto"
                  v-model="atendimento.assunto_id"
                  :options="assuntos"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Selecione o assunto"
                  filter
                  showClear
                  class="flex-grow-1"
                  style="min-width: 14rem;"
                />
                <Button
                  type="button"
                  label="Sugerir (IA)"
                  icon="pi pi-sparkles"
                  severity="secondary"
                  outlined
                  :loading="isSugerindoAssunto"
                  @click="sugerirAssuntoIA"
                />
              </div>
              <small v-if="ultimaSugestaoAssunto?.justificativa" class="text-color-secondary">
                IA: {{ ultimaSugestaoAssunto.justificativa }}
              </small>
            </div>
          </div>

          <div class="field">
            <label for="titulo">Título*</label>
            <InputText id="titulo" type="text" v-model="atendimento.titulo" placeholder="Ex.: VISITA — NOME DO MUNÍCIPE" />
          </div>
          <div class="field">
            <label for="descricao">Descrição / Observação</label>
            <Textarea id="descricao" v-model="atendimento.descricao" rows="5" autoResize placeholder="Detalhes da demanda ou da visita" />
          </div>

          <Button type="submit" label="Salvar Atendimento" icon="pi pi-save" :loading="isLoading" class="mt-4" />
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
