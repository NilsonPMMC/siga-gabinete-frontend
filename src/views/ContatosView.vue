<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/api';
import contatosService from '@/services/contatos';
import { formatarPerfis } from '@/services/comum';
import { unwrapPaginatedResponse } from '@/utils/paginatedApi';
import { filtrarContatosEmGruposValidos } from '@/utils/duplicatasGrupos';
import { useToast } from "primevue/usetoast";
import { useAuthStore } from '@/stores/auth';
import { useDuplicatasStore } from '@/stores/duplicatas';
import { useConfirm } from "primevue/useconfirm";
import MultiSelect from 'primevue/multiselect';
import InputSwitch from 'primevue/inputswitch';
import { format, addDays, subDays, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// COMPONENTES REUTILIZÁVEIS
import MunicipeFormModal from '@/components/municipes/MunicipeFormModal.vue';
import MunicipeUnificarModal from '@/components/municipes/MunicipeUnificarModal.vue'; // <--- IMPORTANTE
import AiEnrichmentModal from '@/components/municipes/AiEnrichmentModal.vue';

// --- DECLARAÇÕES INICIAIS ---
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const duplicatasStore = useDuplicatasStore();
const confirm = useConfirm();

const podeVerDuplicatas = computed(() => (
  authStore.isSecretaria || authStore.isSuperuser || authStore.isMembro
));

const isOperadorCrmRestrito = computed(() => authStore.isUsuarioEstritamenteOperadorCrm);

const isLoading = ref(true);
const isExporting = ref(false);
const isExportingAniversariantes = ref(false);

const municipesNaTela = ref([]);
const totalRecords = ref(0);
const first = ref(0);
const page = ref(1);
const pageSize = ref(25);
const filtroTexto = ref('');
const filtroLetra = ref('');
const filtroCategorias = ref([]);
const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
const filtroOrdem = ref('nome');
const filtroApenasDuplicatas = ref(false);
const modoIA = ref(false);
const resultadosBuscaIA = ref([]);
const ordemOptions = ref([
    { label: 'Ordenar por Nome', value: 'nome' },
    { label: 'Ordenar por Órgão', value: 'orgao' }
]);
const municipesSelecionados = ref([]);
const categoriasContato = ref([]);
const contas = ref([]);
const contasUsuarioIds = computed(() => new Set(authStore.userContas || []));

// --- ESTADOS DO MODAL FORM ---
const showMunicipeModal = ref(false);
const municipeIdParaEditar = ref(null);

// --- ESTADOS DE UNIFICAÇÃO (NOVO) ---
const showUnificarModal = ref(false);
const duplicadoParaUnificacao = ref(null);

// --- ESTADOS DE ANIVERSARIANTES ---
const aniversariantes = ref([]);
const dialogoAniversariantesVisivel = ref(false);
const dataAniversariantesVisivel = ref(startOfToday());
const isLoadingAniversariantes = ref(false);

// --- ESTADOS DE ATUALIZAÇÃO EM LOTE ---
const dialogoCategoriaLoteVisivel = ref(false);
const novaCategoriaId = ref(null);
const isUpdatingCategoria = ref(false);

// --- CARREGAMENTO INICIAL DOS DADOS ---
onMounted(() => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  if (podeVerDuplicatas.value) {
    duplicatasStore.fetchContador();
  }
  carregarDadosIniciais();
  carregarAniversariantes(dataAniversariantesVisivel.value);
});

const montarParamsMunicipes = () => {
    const params = new URLSearchParams();
    if (filtroApenasDuplicatas.value) {
        params.append('tem_grupo_duplicado', 'true');
        if (filtroTexto.value) params.append('q', filtroTexto.value.trim());
        if (filtroCategorias.value?.length) {
            filtroCategorias.value.forEach((id) => params.append('categoria_id', id));
        }
        return params;
    }
    params.append('page', String(page.value));
    params.append('page_size', String(pageSize.value));
    params.append('ordenar_por', filtroOrdem.value);
    if (filtroTexto.value) params.append('q', filtroTexto.value.trim());
    if (filtroLetra.value) params.append('letra', filtroLetra.value);
    if (filtroCategorias.value?.length) {
        filtroCategorias.value.forEach((id) => params.append('categoria_id', id));
    }
    return params;
};

const carregarMunicipes = async () => {
    isLoading.value = true;
    try {
        const response = await apiClient.get('/api/municipes/', { params: montarParamsMunicipes() });
        const { results, count } = unwrapPaginatedResponse(response);
        if (filtroApenasDuplicatas.value) {
            const validos = filtrarContatosEmGruposValidos(results);
            municipesNaTela.value = validos;
            totalRecords.value = validos.length;
            first.value = 0;
        } else {
            municipesNaTela.value = results;
            totalRecords.value = count;
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os contatos.' });
    } finally {
        isLoading.value = false;
    }
};

const carregarDadosIniciais = async () => {
    try {
        const [categoriasRes, contasRes] = await Promise.all([
            apiClient.get('/api/contatos/categorias/'),
            apiClient.get('/api/contas/'),
        ]);
        categoriasContato.value = categoriasRes.data;
        contas.value = contasRes.data;
        await carregarMunicipes();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os contatos.' });
    }
};

const onPage = async (event) => {
    first.value = event.first;
    pageSize.value = event.rows;
    page.value = Math.floor(event.first / event.rows) + 1;
    await carregarMunicipes();
};

// --- FUNÇÕES DE FILTRO E BUSCA (MANTIDAS) ---
const isLoadingIA = ref(false);

const aplicarFiltros = async () => {
  if (filtroApenasDuplicatas.value) {
    modoIA.value = false;
    resultadosBuscaIA.value = [];
    first.value = 0;
    page.value = 1;
    await carregarMunicipes();
    return;
  }

  if (modoIA.value) {
    if (!filtroTexto.value.trim()) {
      toast.add({ severity: 'warn', summary: 'Busca IA', detail: 'Digite um termo para buscar.', life: 3000 });
      return;
    }
    isLoadingIA.value = true;
    resultadosBuscaIA.value = [];
    try {
      const dados = await contatosService.buscarComInteligencia(filtroTexto.value.trim());
      resultadosBuscaIA.value = dados || [];
      municipesNaTela.value = [];
    } catch (error) {
      toast.add({ severity: 'error', summary: 'Erro', detail: error.response?.data?.detail || 'Não foi possível consultar a IA.', life: 4000 });
      resultadosBuscaIA.value = [];
    } finally {
      isLoadingIA.value = false;
    }
    return;
  }

  resultadosBuscaIA.value = [];
  first.value = 0;
  page.value = 1;
  await carregarMunicipes();
};

const limparFiltros = async () => {
  filtroTexto.value = '';
  filtroLetra.value = '';
  filtroCategorias.value = [];
  filtroApenasDuplicatas.value = false;
  modoIA.value = false;
  resultadosBuscaIA.value = [];
  await carregarDadosIniciais();
};

const alternarFiltroDuplicatas = async () => {
  if (filtroApenasDuplicatas.value) {
    modoIA.value = false;
    resultadosBuscaIA.value = [];
    filtroLetra.value = '';
  }
  first.value = 0;
  page.value = 1;
  await aplicarFiltros();
};

const filtrarPorLetra = async (letra) => {
  filtroTexto.value = '';
  if (filtroLetra.value === letra) {
    filtroLetra.value = '';
  } else {
    filtroLetra.value = letra;
  }
  await aplicarFiltros();
};

// --- LÓGICA DO MODAL (CRUD) ---

const abrirDialogoParaCriacao = () => {
    municipeIdParaEditar.value = null;
    showMunicipeModal.value = true;
};

const abrirDialogoParaEdicao = (municipe) => {
    municipeIdParaEditar.value = municipe.id;
    showMunicipeModal.value = true;
};

const aoSalvarMunicipe = async (contatoSalvo) => {
    const indexNaTela = municipesNaTela.value.findIndex(m => m.id === contatoSalvo.id);
    if (indexNaTela !== -1) {
        municipesNaTela.value[indexNaTela] = contatoSalvo;
    } else {
        first.value = 0;
        page.value = 1;
        await carregarMunicipes();
    }
    showMunicipeModal.value = false;
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Lista atualizada.', life: 2000 });
};

const aoEnriquecimentoAplicado = ({ contactId, enrichedData, applyFields }) => {
  const flags = {
    emails: applyFields?.emails ?? true,
    telefones: applyFields?.telefones ?? true,
    endereco: applyFields?.endereco ?? true,
    cargo: applyFields?.cargo ?? true,
    orgao: applyFields?.orgao ?? true,
    etiqueta_mala_direta: applyFields?.etiqueta_mala_direta ?? true,
  };
  const patchContato = (contato) => {
    if (!contato || contato.id !== contactId) return contato;
    const emails = (enrichedData.emails || []).map((email) => ({ email }));
    const telefones = (enrichedData.telefones || []).map((numero) => ({ numero }));
    return {
      ...contato,
      emails: flags.emails ? emails : contato.emails,
      telefones: flags.telefones ? telefones : contato.telefones,
      endereco: flags.endereco ? { ...(contato.endereco || {}), texto_livre: enrichedData.endereco || '' } : contato.endereco,
      cargo: flags.cargo ? (enrichedData.cargo || '') : contato.cargo,
      orgao: flags.orgao ? (enrichedData.orgao || '') : contato.orgao,
      dados_etiqueta: flags.etiqueta_mala_direta ? (enrichedData.etiqueta_mala_direta || '') : contato.dados_etiqueta,
    };
  };

  municipesNaTela.value = municipesNaTela.value.map(patchContato);
};

// --- AÇÕES COM INTELIGÊNCIA DE FUSÃO ---
const tentarExcluirContato = async (contato) => {
    try {
        // 1. Verifica vínculos
        const res = await apiClient.get(`/api/municipes/${contato.id}/verificar-vinculos/`);
        const { tem_vinculos, total, detalhes } = res.data;

        if (tem_vinculos) {
            // Sugere Fusão
            confirm.require({
                header: 'Registro com Histórico',
                message: `Este contato possui ${total} vínculos (${detalhes.join(', ')}). Deseja unificá-lo com outro registro antes de excluir?`,
                icon: 'pi pi-info-circle',
                acceptLabel: 'Unificar',
                rejectLabel: 'Cancelar',
                acceptClass: 'p-button-warning',
                accept: () => {
                    duplicadoParaUnificacao.value = contato;
                    showUnificarModal.value = true;
                }
            });
        } else {
            // Exclusão Direta
            confirmarExclusaoReal(contato);
        }
    } catch (e) {
        // Fallback se a API falhar (exclui direto)
        confirmarExclusaoReal(contato);
    }
};

const confirmarExclusaoReal = (contato) => {
  confirm.require({
    message: `Você tem certeza que deseja excluir "${contato.nome_completo}"?`,
    header: 'Confirmar Exclusão',
    icon: 'pi pi-exclamation-triangle',
    acceptClassName: 'p-button-danger',
    acceptLabel: 'Sim, excluir',
    rejectLabel: 'Cancelar',
    accept: async () => {
      try {
        await apiClient.delete(`/api/municipes/${contato.id}/`);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Contato excluído.', life: 3000 });
        await carregarMunicipes();
      } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir o contato.', life: 3000 });
      }
    },
  });
};

const aoUnificar = async () => {
    await carregarDadosIniciais();
    if (podeVerDuplicatas.value) {
      await duplicatasStore.fetchContador();
    }
};

const irParaVisao360 = (id) => {
  if (isOperadorCrmRestrito.value) {
    abrirDialogoParaEdicao({ id });
    return;
  }
  router.push(`/municipes/${id}/historico`);
};

const copiarTexto = (texto) => {
  if (!texto) return;
  navigator.clipboard.writeText(texto).then(() => {
    toast.add({ severity: 'success', summary: 'Copiado', detail: `'${texto}' copiado.`, life: 2000 });
  });
};

const filtrarPerfisDoUsuario = (perfis = []) => {
  if (!Array.isArray(perfis)) return [];
  if (authStore.isSuperuser) return perfis;
  const ids = contasUsuarioIds.value;
  return perfis.filter((p) => ids.has(p?.conta?.id ?? p?.conta));
};

// --- FUNÇÕES DE ANIVERSARIANTES (MANTIDAS) ---
const carregarAniversariantes = async (dataParaBuscar) => {
    isLoadingAniversariantes.value = true;
    aniversariantes.value = [];
    try {
        const dataFormatada = format(dataParaBuscar, 'yyyy-MM-dd');
        const response = await apiClient.get('/api/municipes/aniversariantes-do-dia/', {
            params: { data: dataFormatada }
        });
        aniversariantes.value = response.data;
    } catch (error) {
        console.error(error);
    } finally {
        isLoadingAniversariantes.value = false;
    }
};

const buscarDiaAnterior = () => {
    const novaData = subDays(dataAniversariantesVisivel.value, 1);
    dataAniversariantesVisivel.value = novaData;
    carregarAniversariantes(novaData);
};

const buscarDiaSeguinte = () => {
    const novaData = addDays(dataAniversariantesVisivel.value, 1);
    dataAniversariantesVisivel.value = novaData;
    carregarAniversariantes(novaData);
};

const dataAniversariantesFormatada = computed(() => {
    return format(dataAniversariantesVisivel.value, 'dd/MM', { locale: ptBR });
});

const ehHoje = computed(() => {
    return format(dataAniversariantesVisivel.value, 'yyyy-MM-dd') === format(startOfToday(), 'yyyy-MM-dd');
});

const exportarAniversariantesPDF = async () => {
  isExportingAniversariantes.value = true;
  try {
    const dataFormatada = format(dataAniversariantesVisivel.value, 'yyyy-MM-dd');
    const response = await apiClient.get('/api/municipes/aniversariantes-do-dia/pdf/', {
      params: { data: dataFormatada },
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_aniversariantes_${dataFormatada.replaceAll('-', '')}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o PDF de aniversariantes.', life: 3000 });
  } finally {
    isExportingAniversariantes.value = false;
  }
};


// --- EXPORTAÇÕES (MANTIDAS) ---
const extrairErroExportacao = async (error, fallback) => {
  const data = error.response?.data;
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text());
      return json.detail || json.error || fallback;
    } catch {
      return fallback;
    }
  }
  return error.response?.data?.detail || error.response?.data?.error || fallback;
};

const exportarExcel = async () => {
  isExporting.value = true;
  try {
    const params = new URLSearchParams();
    if (filtroTexto.value) params.append('q', filtroTexto.value);
    if (filtroOrdem.value) params.append('ordenar_por', filtroOrdem.value);
    if (filtroCategorias.value && filtroCategorias.value.length > 0) {
      filtroCategorias.value.forEach(id => params.append('categoria_id', id));
    }

    const response = await apiClient.get('/api/municipes/export/excel/', { params: params, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'contatos.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    const detail = await extrairErroExportacao(error, 'Não foi possível gerar a planilha.');
    toast.add({ severity: 'error', summary: 'Erro', detail, life: 4000 });
  } finally {
    isExporting.value = false;
  }
};

const exportarPDF = async () => {
  isExporting.value = true;
  try {
    const params = new URLSearchParams();
    if (filtroTexto.value) params.append('q', filtroTexto.value);
    if (filtroOrdem.value) params.append('ordenar_por', filtroOrdem.value);
    if (filtroCategorias.value && filtroCategorias.value.length > 0) {
      filtroCategorias.value.forEach(id => params.append('categoria_id', id));
    }

    const response = await apiClient.get('/api/municipes/export/pdf/', { params: params, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_contatos_${new Date().getTime()}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    const detail = await extrairErroExportacao(error, 'Não foi possível gerar o PDF.');
    toast.add({ severity: 'error', summary: 'Erro', detail, life: 4000 });
  } finally {
    isExporting.value = false;
  }
};

// --- ATUALIZAÇÃO EM LOTE (MANTIDA) ---
const abrirDialogoCategoriaLote = () => {
    novaCategoriaId.value = null;
    dialogoCategoriaLoteVisivel.value = true;
};

const executarAtualizacaoCategoriaLote = async () => {
    if (!novaCategoriaId.value || !municipesSelecionados.value || municipesSelecionados.value.length === 0) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione uma categoria e pelo menos um contato.', life: 3000 });
        return;
    }

    const perfilIds = municipesSelecionados.value.flatMap(m => (m.perfis || []).map(p => p.id).filter(Boolean));
    if (!perfilIds.length) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Os contatos selecionados não possuem perfis (vínculos) para atualizar.', life: 3000 });
        return;
    }

    isUpdatingCategoria.value = true;
    const idsParaAtualizar = municipesSelecionados.value.map(m => m.id);

    try {
        const response = await apiClient.post('/api/municipes/atualizar-categoria-lote/', {
            perfil_ids: perfilIds,
            nova_categoria_id: novaCategoriaId.value
        });

        toast.add({ severity: 'success', summary: 'Sucesso', detail: response.data.message, life: 4000 });
        
        // Atualiza visualmente (categorias_nomes)
        const categoriaSelecionada = categoriasContato.value.find(c => c.id === novaCategoriaId.value);
        const nomeCategoria = categoriaSelecionada?.nome;
        if (nomeCategoria) {
             municipesNaTela.value.forEach(m => {
                 if (idsParaAtualizar.includes(m.id) && m.perfis) {
                     m.perfis.forEach(p => { if (perfilIds.includes(p.id)) p.categoria_nome = nomeCategoria; });
                     m.categorias_nomes = [nomeCategoria];
                 }
             });
        }

        municipesSelecionados.value = []; 
        dialogoCategoriaLoteVisivel.value = false;

    } catch (error) {
        const errorMsg = error.response?.data?.detail || 'Erro ao atualizar';
        toast.add({ severity: 'error', summary: 'Erro ao Atualizar', detail: errorMsg, life: 5000 });
    } finally {
        isUpdatingCategoria.value = false;
    }
};
</script>

<template>
  <div class="page-container">
    <ConfirmDialog />
    <Toast />
    
    <header class="page-header">
      <h1>Agenda de Contatos</h1>
      <div>
        <Button label="Novo Contato" icon="pi pi-plus" @click="abrirDialogoParaCriacao" class="p-button-success mr-2" />
        <Button 
            v-if="!isOperadorCrmRestrito"
            label="Alterar Categoria em Lote" 
            icon="pi pi-tags" 
            class="p-button-info" 
            @click="abrirDialogoCategoriaLote" 
            :disabled="!municipesSelecionados || municipesSelecionados.length === 0" 
        />
      </div>
    </header>

    <Card class="mb-4 summary-card bg-green-100 text-green-800 cursor-pointer">
        <template #content>
            <div class="flex align-items-center justify-content-between">
                <Button icon="pi pi-chevron-left" class="p-button-rounded p-button-text text-green-800" @click="buscarDiaAnterior" :disabled="isLoadingAniversariantes" />
                <div class="flex flex-row align-items-center">
                    <div class="font-medium">{{ dataAniversariantesFormatada }} <span v-if="ehHoje">(Hoje)</span></div>
                    <i class="pi pi-gift text-2xl ml-3"></i>
                    <div v-if="isLoadingAniversariantes" class="mt-2"><ProgressSpinner style="width: 20px; height: 20px" strokeWidth="8" /></div>
                    <div v-else>
                      <Button :label="`${aniversariantes.length} Aniversariante(s)`" class="p-button-link font-bold text-green-800" @click="dialogoAniversariantesVisivel = true" :disabled="aniversariantes.length === 0" />
                    </div>
                </div>
                <Button icon="pi pi-chevron-right" class="p-button-rounded p-button-text text-green-800" @click="buscarDiaSeguinte" :disabled="isLoadingAniversariantes" />
            </div>
        </template>
    </Card>

    <Card class="mb-4">
      <template #content>
        <div class="grid formgrid p-fluid gap-2">
          <div class="field col-6 p-0">
            <label>Buscar por Nome, CPF, Email...</label>
            <div class="flex align-items-center gap-3 flex-wrap">
              <InputText
                v-model="filtroTexto"
                @keyup.enter="aplicarFiltros"
                placeholder="Nome, CPF, matrícula RH, cargo, categoria ou órgão..."
                :class="{ 'busca-ia-ativa': modoIA }"
                class="flex-1 min-w-0"
              />
              <div v-if="!isOperadorCrmRestrito" class="flex align-items-center gap-2">
                <InputSwitch id="modoIA" v-model="modoIA" :disabled="filtroApenasDuplicatas" />
                <label for="modoIA" class="cursor-pointer flex align-items-center gap-1" :class="{ 'opacity-60': filtroApenasDuplicatas }">
                  <i class="pi pi-sparkles"></i>
                  <span>Busca Inteligente</span>
                </label>
              </div>
            </div>
          </div>
          <div class="field col-3 p-0">
            <label>Filtrar Categoria(s)</label>
            <MultiSelect v-model="filtroCategorias" :options="categoriasContato" optionLabel="nome" optionValue="id" placeholder="Filtrar por Categoria" display="chip" />
          </div>
          <div class="field col-2 p-0" v-if="podeVerDuplicatas">
            <label>Apenas duplicatas</label>
            <div class="flex align-items-center gap-2 h-full pt-1">
              <InputSwitch v-model="filtroApenasDuplicatas" @change="alternarFiltroDuplicatas" />
              <span class="text-sm text-color-secondary">
                {{ duplicatasStore.totalGrupos }} grupo(s)
              </span>
            </div>
          </div>
          <div class="field col-2 p-0" :class="{ 'col-3': !podeVerDuplicatas }">
            <label>Ordenar Relatório</label>
            <Dropdown v-model="filtroOrdem" :options="ordemOptions" optionLabel="label" optionValue="value" placeholder="Ordenar por" :disabled="filtroApenasDuplicatas" />
          </div>
        </div>
        <div class="grid formgrid gap-2">
            <Button label="Buscar" icon="pi pi-search" @click="aplicarFiltros" :loading="modoIA ? isLoadingIA : isLoading" />
            <Button label="Limpar" icon="pi pi-filter-slash" @click="limparFiltros" class="p-button-secondary" />
            <router-link v-if="podeVerDuplicatas && filtroApenasDuplicatas" to="/gestao-duplicatas">
              <Button label="Gerenciar duplicatas" icon="pi pi-copy" class="p-button-warning p-button-outlined" />
            </router-link>
            <Button label="Exportar Excel" icon="pi pi-file-excel" class="p-button-success" @click="exportarExcel" :loading="isExporting" />
            <Button label="Exportar PDF" icon="pi pi-file-pdf" class="p-button-danger" @click="exportarPDF" :loading="isExporting" />
        </div>
      </template>
    </Card>

    <div class="alphabet-filter my-4 flex flex-wrap justify-content-center gap-2" v-if="!filtroApenasDuplicatas">
      <Button 
        v-for="letra in alfabeto" :key="letra" :label="letra" 
        @click="filtrarPorLetra(letra)" 
        :class="['p-button-sm', { 'p-button-primary': filtroLetra === letra, 'p-button-secondary p-button-outlined': filtroLetra !== letra }]" 
      />
      <Button icon="pi pi-times-circle" @click="limparFiltros" v-if="filtroLetra" class="p-button-sm p-button-danger p-button-outlined" title="Limpar filtro" />
    </div>

    <main>
      <div v-if="modoIA && isLoadingIA" class="flex align-items-center gap-3 py-4 text-indigo-600">
        <ProgressSpinner style="width: 24px; height: 24px" strokeWidth="6" />
        <span>Consultando a IA...</span>
      </div>

      <div v-else-if="!modoIA" class="my-3 text-sm text-color-secondary">
        Exibindo {{ municipesNaTela.length }} de {{ totalRecords }} contato(s)<span v-if="filtroApenasDuplicatas"> em grupos de duplicata</span>.
      </div>
      <div v-else class="my-3 text-sm text-color-secondary">Exibindo {{ resultadosBuscaIA.length }} resultado(s) da busca inteligente.</div>

      <DataTable
        v-if="!modoIA"
        :value="municipesNaTela"
        v-model:selection="municipesSelecionados" dataKey="id"
        :loading="isLoading"
        paginator
        :lazy="!filtroApenasDuplicatas"
        :rows="pageSize"
        :first="first"
        :totalRecords="totalRecords"
        :rowsPerPageOptions="[10, 25, 50, 100]"
        @page="onPage"
        responsiveLayout="scroll" stripedRows size="small"
      >
        <Column selectionMode="multiple" headerStyle="width: 3em"></Column>
        <Column field="nome_completo" header="Nome" sortable>
          <template #body="slotProps">
            <div class="flex align-items-center gap-2 flex-wrap">
              <span v-if="!isOperadorCrmRestrito">{{ slotProps.data.nome_completo }}</span>
              <a v-else href="#" @click.prevent="irParaVisao360(slotProps.data.id)">{{ slotProps.data.nome_completo }}</a>
              <Tag
                v-if="slotProps.data.grupo_duplicado"
                value="Duplicata"
                severity="danger"
                v-tooltip="'Contato em grupo de possível duplicata'"
              />
              <Tag
                v-if="slotProps.data.tem_perfis_duplicados"
                value="Perfis duplicados"
                severity="warning"
                v-tooltip="'Este contato possui vínculos com o mesmo cargo e gabinete'"
              />
            </div>
          </template>
        </Column>
        <Column field="categorias_nomes" header="Categoria" sortable>
            <template #body="{ data }">{{ Array.isArray(data.categorias_nomes) ? data.categorias_nomes.join(', ') : (data.categoria_nome || '') }}</template>
        </Column>
        <Column header="Cargo(s) / Órgão(s)">
          <template #body="slotProps">
            {{ formatarPerfis(filtrarPerfisDoUsuario(slotProps.data.perfis), slotProps.data.cargo, slotProps.data.orgao) || '—' }}
          </template>
        </Column>
        <Column field="emails" header="Email Principal">
            <template #body="slotProps">
                <div class="flex align-items-center gap-2" v-if="slotProps.data.emails?.[0]?.email">
                    <span>{{ slotProps.data.emails[0].email }}</span>
                    <Button icon="pi pi-copy" text rounded size="small" @click="copiarTexto(slotProps.data.emails[0].email)" />
                </div>
            </template>
        </Column>
        <Column header="Telefone">
          <template #body="slotProps">
            <div class="flex align-items-center gap-2" v-if="slotProps.data.telefones?.[0]?.numero">
              <span>{{ slotProps.data.telefones[0].numero }}</span>
              <Button icon="pi pi-copy" text rounded size="small" @click="copiarTexto(slotProps.data.telefones[0].numero)" />
            </div>
          </template>
        </Column>
        <Column header="Qualidade" style="width: 10rem; text-align: center;">
          <template #body="slotProps">
            <Tag v-if="slotProps.data.qualidade_dados === 'Completo'" severity="success" value="Completo"></Tag>
            <Tag v-if="slotProps.data.qualidade_dados === 'Parcial'" severity="warning" value="Parcial"></Tag>
            <Tag v-if="slotProps.data.qualidade_dados === 'Baixo'" severity="danger" value="Baixo"></Tag>
          </template>
        </Column>
        <Column header="Ações" style="width: 10rem">
          <template #body="slotProps">
            <AiEnrichmentModal v-if="!isOperadorCrmRestrito" :contact="slotProps.data" @applied="aoEnriquecimentoAplicado" />
            <Button v-if="!isOperadorCrmRestrito" icon="pi pi-id-card" text rounded @click="irParaVisao360(slotProps.data.id)" title="Ver Histórico" />
            <Button icon="pi pi-pencil" text rounded severity="secondary" @click="abrirDialogoParaEdicao(slotProps.data)" :disabled="!slotProps.data.pode_editar" title="Editar" />
            <Button icon="pi pi-trash" text rounded severity="danger" @click="tentarExcluirContato(slotProps.data)" :disabled="!slotProps.data.pode_editar" title="Excluir" />
          </template>
        </Column>
        <template #empty>Nenhum munícipe encontrado.</template>
      </DataTable>

      <DataTable
        v-else
        :value="resultadosBuscaIA"
        :loading="false"
        responsiveLayout="scroll"
        stripedRows
        size="small"
      >
        <Column header="Relevância" style="width: 6rem">
          <template #body="slotProps">
            <Tag
              :value="`${(slotProps.data.score_match ?? 0).toFixed(1)}%`"
              :severity="(slotProps.data.score_match ?? 0) >= 90 ? 'success' : (slotProps.data.score_match ?? 0) >= 70 ? 'warning' : 'info'"
            />
          </template>
        </Column>
        <Column header="Nome">
          <template #body="slotProps">
            <div>
              <a href="#" @click.prevent="irParaVisao360(slotProps.data.id)">{{ slotProps.data.nome }}</a>
              <small v-if="slotProps.data.perfil_ia_texto" class="block text-color-secondary text-sm mt-1" :title="slotProps.data.perfil_ia_texto">{{ (slotProps.data.perfil_ia_texto || '').substring(0, 80) }}{{ (slotProps.data.perfil_ia_texto || '').length > 80 ? '...' : '' }}</small>
            </div>
          </template>
        </Column>
        <Column header="Cargo">
          <template #body="slotProps">{{ slotProps.data.cargo || '—' }}</template>
        </Column>
        <Column header="Telefone">
          <template #body="slotProps">
            <div class="flex align-items-center gap-2" v-if="slotProps.data.telefone">
              <span>{{ slotProps.data.telefone }}</span>
              <Button icon="pi pi-copy" text rounded size="small" @click="copiarTexto(slotProps.data.telefone)" />
            </div>
            <span v-else>—</span>
          </template>
        </Column>
        <Column header="Bairro">
          <template #body="slotProps">{{ slotProps.data.bairro || '—' }}</template>
        </Column>
        <Column header="Ações" style="width: 10rem">
          <template #body="slotProps">
            <Button icon="pi pi-id-card" text rounded @click="irParaVisao360(slotProps.data.id)" title="Ver Histórico" />
            <Button icon="pi pi-pencil" text rounded severity="secondary" @click="abrirDialogoParaEdicao({ id: slotProps.data.id, nome_completo: slotProps.data.nome, pode_editar: true })" title="Editar" />
            <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmarExclusaoReal({ id: slotProps.data.id, nome_completo: slotProps.data.nome })" title="Excluir" />
          </template>
        </Column>
        <template #empty>Nenhum resultado na busca inteligente. Digite um termo e clique em Buscar.</template>
      </DataTable>
    </main>

    <MunicipeFormModal 
        v-model:visible="showMunicipeModal" 
        :municipeId="municipeIdParaEditar" 
        @saved="aoSalvarMunicipe" 
    />

    <MunicipeUnificarModal 
        v-model:visible="showUnificarModal" 
        :duplicadoInicial="duplicadoParaUnificacao"
        @merged="aoUnificar"
    />

    <Dialog v-model:visible="dialogoAniversariantesVisivel" :header="`Aniversariantes do dia ${dataAniversariantesFormatada}`" modal :style="{ width: '1000px' }">
        <div class="flex justify-content-end mb-3">
            <Button
                label="Relatório PDF"
                icon="pi pi-file-pdf"
                class="p-button-danger p-button-sm"
                @click="exportarAniversariantesPDF"
                :loading="isExportingAniversariantes"
            />
        </div>
        <DataTable :value="aniversariantes" size="small" paginator :rows="10">
            <Column field="nome_completo" header="Nome" sortable></Column>
            <Column header="Cargo(s) / Órgão(s)">
                <template #body="{ data }">{{ formatarPerfis(filtrarPerfisDoUsuario(data.perfis), data.cargo, data.orgao) || '—' }}</template>
            </Column>
            <Column field="telefones" header="Telefone">
                <template #body="{ data }">{{ data.telefones?.[0]?.numero || 'N/D' }}</template>
            </Column>
            <Column field="emails" header="Email">
                <template #body="{ data }">{{ data.emails?.[0]?.email || 'N/D' }}</template>
            </Column>
        </DataTable>
    </Dialog>

    <Dialog v-model:visible="dialogoCategoriaLoteVisivel" modal header="Alterar Categoria em Lote" :style="{ width: '30vw' }" @hide="novaCategoriaId = null">
        <div class="p-fluid">
            <div class="field">
                <label>Selecione a nova Categoria para os {{ municipesSelecionados.length }} contato(s):</label>
                <Dropdown v-model="novaCategoriaId" :options="categoriasContato" optionLabel="nome" optionValue="id" placeholder="Selecione..." filter />
            </div>
        </div>
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="dialogoCategoriaLoteVisivel = false" />
            <Button label="Confirmar" icon="pi pi-check" @click="executarAtualizacaoCategoriaLote" :disabled="!novaCategoriaId || isUpdatingCategoria" :loading="isUpdatingCategoria" />
        </template>
    </Dialog>

  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
a { text-decoration: none; color: var(--p-primary-color); font-weight: 500; }
a:hover { text-decoration: underline; }

.busca-ia-ativa {
  border-color: #818cf8 !important;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}
</style>