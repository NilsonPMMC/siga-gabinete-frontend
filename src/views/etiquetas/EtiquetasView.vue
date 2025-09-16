<template>
  <div class="page-container">
    <Toast />
    <header class="page-header">
      <h1>Geração de Etiquetas</h1>
    </header>

    <Card class="mb-4">
        <template #title>
            Passo 1: Selecione os Contatos
        </template>
        <template #content>
            <div class="grid formgrid p-fluid align-items-end gap-2 mb-4">
                <div class="field col">
                    <label for="filtroContatos">Buscar por Nome, CPF, Email...</label>
                    <InputText id="filtroContatos" v-model="buscaContatos" @keyup.enter="fetchContatos" placeholder="Digite para buscar..." />
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
            >
                <Column selectionMode="multiple" headerStyle="width: 3em"></Column>
                <Column field="nome_completo" header="Nome" sortable></Column>
                <Column field="categoria_nome" header="Categoria" sortable></Column>
                <Column field="cargo" header="Cargo"></Column>
                <Column field="orgao" header="Orgão"></Column>
                
                <template #empty>Nenhum contato encontrado.</template>
            </DataTable>
        </template>
    </Card>

    <Card class="mb-4" v-if="contatosSelecionados.length > 0">
      <template #title>Passo 2: Personalize os Dados e Configure a Impressão</template>
      <template #content>
        <DataTable :value="contatosSelecionados" responsiveLayout="scroll">
          <Column field="nome_completo" header="Nome"></Column>
          <Column field="dados_etiqueta" header="Texto da Etiqueta">
            <template #body="slotProps">
              <div v-if="slotProps.data.dados_etiqueta" style="white-space: pre-wrap;">{{ slotProps.data.dados_etiqueta }}</div>
              <Tag v-else severity="warning" value="Vazio"></Tag>
            </template>
          </Column>
          <Column header="Ações" style="width: 10rem">
            <template #body="slotProps">
              <Button icon="pi pi-pencil" label="Personalizar" class="p-button-sm" @click="abrirModalEdicao(slotProps.data)" />
            </template>
          </Column>
        </DataTable>

        <div class="grid p-fluid mt-4">
          <div class="field col-12 md:col-6">
            <label for="templateSelect">Selecione o Modelo de Folha</label>
            <Dropdown id="templateSelect" v-model="templateId" :options="templates" optionLabel="nome" optionValue="id" placeholder="Escolha um modelo..." />
          </div>
          <div class="field col-12 md:col-6">
            <label for="posicaoInicial">Posição de Início na Folha</label>
            <InputNumber id="posicaoInicial" v-model="posicaoInicial" :min="1" />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-content-end">
          <Button label="Gerar e Visualizar Etiquetas" icon="pi pi-print" @click="handleGerarEtiquetas" :loading="isGenerating" :disabled="!templateId" />
        </div>
      </template>
    </Card>

    <Dialog v-model:visible="modalVisivel" :style="{width: '500px'}" header="Personalizar Texto da Etiqueta" :modal="true" class="p-fluid">
      <div v-if="contatoEmEdicao">
        <p><strong>Contato:</strong> {{ contatoEmEdicao.nome_completo }}</p>
        <div class="field">
          <label for="texto-etiqueta">Texto para a etiqueta:</label>
          <Textarea id="texto-etiqueta" v-model="contatoEmEdicao.dados_etiqueta" rows="5" />
          <small>Use quebras de linha (Enter) para formatar o texto como desejar.</small>
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
import { ref, onMounted } from 'vue';
import { useToast } from "primevue/usetoast";
import apiClient from '@/api';
import { getMunicipesPaginado } from '@/services/comum';
import { fetchEtiquetaTemplates, gerarEtiquetas } from '@/services/etiquetas';

const toast = useToast();
const isLoading = ref(false);
const isGenerating = ref(false);
const isSaving = ref(false);

const buscaContatos = ref('');
const contatos = ref([]);
const contatosSelecionados = ref([]);
const templates = ref([]);
const templateId = ref(null);
const posicaoInicial = ref(1);

const modalVisivel = ref(false);
const contatoEmEdicao = ref(null);

const fetchContatos = async () => {
  isLoading.value = true;
  try {
    // Passa o termo de busca para a API
    const response = await getMunicipesPaginado({ q: buscaContatos.value });
    contatos.value = response.data;
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
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os modelos de etiqueta.' });
  }
};

const abrirModalEdicao = (contato) => {
  // Cria uma cópia para não alterar a lista principal antes de salvar
  contatoEmEdicao.value = { ...contato };
  modalVisivel.value = true;
};

const salvarDadosEtiqueta = async () => {
  isSaving.value = true;
  try {
    const payload = {
      dados_etiqueta: contatoEmEdicao.value.dados_etiqueta
    };
    // Faz a chamada PATCH para atualizar apenas o campo da etiqueta
    const response = await apiClient.patch(`/api/municipes/${contatoEmEdicao.value.id}/`, payload);
    
    // Atualiza a lista local para refletir a mudança instantaneamente
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
  // A lógica de geração continua a mesma
  isGenerating.value = true;
  try {
    const payload = {
      template_id: templateId.value,
      posicao_inicial: posicaoInicial.value,
      contatos: JSON.parse(JSON.stringify(contatosSelecionados.value)),
    };
    const response = await gerarEtiquetas(payload);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(response.data);
    printWindow.document.close();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Ocorreu um erro ao gerar as etiquetas.' });
  } finally {
    isGenerating.value = false;
  }
};

onMounted(() => {
  fetchContatos();
  fetchTemplates();
});
</script>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
</style>