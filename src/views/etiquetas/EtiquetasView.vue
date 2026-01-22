<template>
  <div class="page-container">
    <Toast />
    <header class="page-header">
      <h1>Geração de Etiquetas e Envelopes</h1>
    </header>

    <div class="flex justify-content-center mb-4">
        <SelectButton v-model="modoImpressao" :options="opcoesModo" optionLabel="label" optionValue="value" />
    </div>

    <Card class="mb-4" v-if="modoImpressao === 'MALA_DIRETA'">
        <template #title>
            Passo 1: Selecione os Contatos
        </template>
        <template #content>
            <div class="grid formgrid p-fluid align-items-end gap-2 mb-4">
                
                <div class="field col-12 md:col-6">
                    <label for="filtroContatos">Buscar por Nome, CPF, Email...</label>
                    <InputText id="filtroContatos" v-model="buscaContatos" @keyup.enter="fetchContatos" placeholder="Digite para buscar..." />
                </div>

                <div class="field col-12 md:col-3">
                    <label for="filtroCategoria">Filtrar por Categoria</label>
                    <Dropdown 
                        id="filtroCategoria" 
                        v-model="categoriaSelecionada" 
                        :options="categorias" 
                        optionLabel="nome" 
                        optionValue="id" 
                        showClear 
                        placeholder="Todas as Categorias"
                        @change="fetchContatos"
                    />
                </div>

                <div class="field col-fixed flex gap-2">
                    <Button label="Buscar" icon="pi pi-search" @click="fetchContatos" :loading="isLoading" />
                </div>
            </div>

            <DataTable 
                :value="contatos" 
                :loading="isLoading" 
                responsiveLayout="scroll"
                v-model:selection="contatosSelecionados"
                dataKey="id"
                paginator :rows="20" :rowsPerPageOptions="[10,20,50,100,200]"
                paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords}"
            >
                <Column selectionMode="multiple" headerStyle="width: 3em"></Column>
                <Column field="nome_completo" header="Nome" sortable></Column>
                <Column field="categoria_nome" header="Categoria" sortable></Column>
                <Column field="cargo" header="Cargo"></Column>
                <Column field="orgao" header="Orgão/Instituição"></Column>
                
                <template #empty>Nenhum contato encontrado.</template>
            </DataTable>
        </template>
    </Card>

    <Card class="mb-4" v-if="podeMostrarConfiguracao">
      <template #title>Passo 2: Configuração de Impressão</template>
      <template #content>
        
        <div v-if="modoImpressao === 'MALA_DIRETA'" class="mb-4">
            <div class="flex justify-content-between align-items-center">
                <h4>Contatos Selecionados: {{ contatosSelecionados.length }}</h4>
                <Button label="Limpar Seleção" icon="pi pi-times" class="p-button-text p-button-sm p-button-danger" @click="contatosSelecionados = []" v-if="contatosSelecionados.length > 0" />
            </div>
            
            <DataTable :value="contatosSelecionados" responsiveLayout="scroll" scrollHeight="300px" scrollable class="p-datatable-sm">
                <Column field="nome_completo" header="Nome"></Column>
                <Column field="dados_etiqueta" header="Texto da Etiqueta">
                    <template #body="slotProps">
                    <div v-if="slotProps.data.dados_etiqueta" style="white-space: pre-wrap; font-size: 0.9em;">{{ slotProps.data.dados_etiqueta }}</div>
                    <Tag v-else severity="warning" value="Padrão (Endereço)"></Tag>
                    </template>
                </Column>
                <Column header="Ações" style="width: 8rem">
                    <template #body="slotProps">
                    <Button icon="pi pi-pencil" class="p-button-rounded p-button-text p-button-sm" @click="abrirModalEdicao(slotProps.data)" v-tooltip.top="'Editar texto da etiqueta'" />
                    </template>
                </Column>
            </DataTable>
        </div>

        <Divider />

        <div class="grid p-fluid mt-4">
          <div class="field col-12 md:col-6">
            <label for="templateSelect">Modelo de Folha / Envelope</label>
            <Dropdown id="templateSelect" v-model="templateId" :options="templates" optionLabel="nome" optionValue="id" placeholder="Escolha um modelo..." />
          </div>

          <div class="field col-12 md:col-3" v-if="modoImpressao === 'MALA_DIRETA'">
            <label for="posicaoInicial">Posição de Início</label>
            <InputNumber id="posicaoInicial" v-model="posicaoInicial" :min="1" tooltip="Para folhas de etiquetas parcialmente usadas" />
          </div>

          <div class="field col-12 md:col-3" v-if="modoImpressao === 'ESTOQUE'">
            <label for="qtdEstoque">Quantidade de Cópias</label>
            <InputNumber id="qtdEstoque" v-model="quantidadeEstoque" :min="1" showButtons />
          </div>

          <div class="field col-12 md:col-3 mt-4">
             <div class="field-checkbox h-full flex align-items-center">
                <Checkbox v-model="imprimirRemetente" :binary="true" inputId="checkRemetente" />
                <label for="checkRemetente" class="ml-2 cursor-pointer">Imprimir Remetente?</label>
             </div>
          </div>
        </div>

      </template>
      <template #footer>
        <div class="flex justify-content-end">
          <Button 
            :label="labelBotaoGerar" 
            icon="pi pi-print" 
            @click="handleGerarEtiquetas" 
            :loading="isGenerating" 
            :disabled="!templateId" 
            severity="success"
          />
        </div>
      </template>
    </Card>

    <Dialog v-model:visible="modalVisivel" :style="{width: '500px'}" header="Personalizar Texto da Etiqueta" :modal="true" class="p-fluid">
      <div v-if="contatoEmEdicao">
        <p><strong>Contato:</strong> {{ contatoEmEdicao.nome_completo }}</p>
        <div class="field">
          <label for="texto-etiqueta">Texto para a etiqueta:</label>
          <Textarea id="texto-etiqueta" v-model="contatoEmEdicao.dados_etiqueta" rows="5" />
          <small>Use quebras de linha (Enter) para formatar.</small>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" icon="pi pi-times" text @click="modalVisivel = false" />
        <Button label="Salvar" icon="pi pi-check" @click="salvarDadosEtiqueta" :loading="isSaving" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from "primevue/usetoast";
import apiClient from '@/api';
// Imports de serviços
import { getMunicipesPaginado } from '@/services/comum';
import contatosService from '@/services/contatos'; // Importamos o serviço de contatos para pegar categorias
import { fetchEtiquetaTemplates, gerarEtiquetas } from '@/services/etiquetas';

// Import componentes PrimeVue caso necessário localmente
import Checkbox from 'primevue/checkbox'; 

const toast = useToast();
const isLoading = ref(false);
const isGenerating = ref(false);
const isSaving = ref(false);

// ESTADOS GERAIS
const modoImpressao = ref('MALA_DIRETA');
const imprimirRemetente = ref(false);
const quantidadeEstoque = ref(10);

const opcoesModo = [
    { label: 'Mala Direta (Com Destinatário)', value: 'MALA_DIRETA' },
    { label: 'Estoque / Avulso (Só Remetente)', value: 'ESTOQUE' }
];

// DADOS
const buscaContatos = ref('');
const categorias = ref([]); // Lista de categorias para o dropdown
const categoriaSelecionada = ref(null); // ID da categoria selecionada

const contatos = ref([]);
const contatosSelecionados = ref([]);
const templates = ref([]);
const templateId = ref(null);
const posicaoInicial = ref(1);

const modalVisivel = ref(false);
const contatoEmEdicao = ref(null);

const podeMostrarConfiguracao = computed(() => {
    if (modoImpressao.value === 'ESTOQUE') return true;
    return contatosSelecionados.value.length > 0;
});

const labelBotaoGerar = computed(() => {
    if (modoImpressao.value === 'ESTOQUE') return 'Gerar Envelopes/Etiquetas Vazias';
    return `Gerar ${contatosSelecionados.value.length} Etiquetas`;
});

// --- FETCHS ---

const fetchCategorias = async () => {
    try {
        const response = await contatosService.getCategorias();
        categorias.value = response.data;
    } catch (error) {
        console.error("Erro ao carregar categorias", error);
    }
};

const fetchContatos = async () => {
  isLoading.value = true;
  try {
    // Monta os parâmetros de busca
    const params = { 
        q: buscaContatos.value 
    };
    
    // Se tiver categoria selecionada, adiciona ao filtro
    if (categoriaSelecionada.value) {
        params.categoria = categoriaSelecionada.value;
    }

    const response = await getMunicipesPaginado(params);
    contatos.value = response.data.results ? response.data.results : response.data; // Suporte a paginação padrão DRF
    
    // Se a API retornar paginação completa, ajuste aqui conforme seu backend
    // Se seu backend retorna direto a lista, contatos.value = response.data é suficiente.
    // O código acima tenta ser híbrido.
    
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os contatos.' });
  } finally {
    isLoading.value = false;
  }
};

const fetchTemplates = async () => {
  try {
    const response = await fetchEtiquetaTemplates();
    templates.value = response.data;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os modelos.' });
  }
};

// --- AÇÕES ---

const abrirModalEdicao = (contato) => {
  contatoEmEdicao.value = { ...contato };
  modalVisivel.value = true;
};

const salvarDadosEtiqueta = async () => {
  isSaving.value = true;
  try {
    const payload = {
      dados_etiqueta: contatoEmEdicao.value.dados_etiqueta
    };
    const response = await apiClient.patch(`/api/municipes/${contatoEmEdicao.value.id}/`, payload);
    
    const index = contatosSelecionados.value.findIndex(c => c.id === response.data.id);
    if (index !== -1) {
      contatosSelecionados.value[index] = response.data;
    }
    
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Texto da etiqueta salvo!' });
    modalVisivel.value = false;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar os dados.' });
  } finally {
    isSaving.value = false;
  }
};

const handleGerarEtiquetas = async () => {
  isGenerating.value = true;
  try {
    const payload = {
      template_id: templateId.value,
      posicao_inicial: posicaoInicial.value,
      imprimir_remetente: imprimirRemetente.value,
      contatos: [],
      quantidade_avulsa: 0
    };

    if (modoImpressao.value === 'MALA_DIRETA') {
        payload.contatos = JSON.parse(JSON.stringify(contatosSelecionados.value));
    } else {
        payload.quantidade_avulsa = quantidadeEstoque.value;
    }

    const response = await gerarEtiquetas(payload);
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(response.data);
        printWindow.document.close();
    } else {
        toast.add({ severity: 'warn', summary: 'Pop-up Bloqueado', detail: 'Permita pop-ups para visualizar a impressão.' });
    }

  } catch (error) {
    console.error(error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Ocorreu um erro ao gerar as etiquetas.' });
  } finally {
    isGenerating.value = false;
  }
};

onMounted(() => {
  fetchCategorias(); // Carrega as categorias ao iniciar
  fetchContatos();
  fetchTemplates();
});
</script>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
</style>