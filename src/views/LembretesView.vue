<template>
  <Toast />
  <ConfirmDialog></ConfirmDialog>

  <div class="page-container">
    <header class="page-header">
      <h1>Lembretes</h1>
      <Button label="Novo Lembrete" icon="pi pi-plus" @click="abrirModalNovo" class="p-button-success" />
    </header>

    <Card class="mb-4">
      <template #title>Filtrar por período</template>
      <template #content>
        <div class="flex align-items-center gap-2 flex-wrap">
        <div class="p-inputgroup w-auto flex-1">
          <span class="p-inputgroup-addon">De</span>
          <Calendar v-model="filtroDataInicio" dateFormat="dd/mm/yy" placeholder="Data Início" />
        </div>
        <div class="p-inputgroup w-auto flex-1">
          <span class="p-inputgroup-addon">Até</span>
          <Calendar v-model="filtroDataFim" dateFormat="dd/mm/yy" placeholder="Data Fim" />
        </div>
        <Button icon="pi pi-filter" label="Filtrar" @click="carregarLembretes" />
        <Button icon="pi pi-filter-slash" label="Limpar" @click="limparFiltro" class="p-button-outlined" />
        <Button icon="pi pi-file-pdf" label="Gerar PDF" @click="gerarRelatorioPDF" class="p-button-danger" :loading="pdfLoading" />
      </div>
      </template>
    </Card>

    <main>
      <div v-if="isLoading" class="text-center">
        <ProgressSpinner />
        <p>Carregando lembretes...</p>
      </div>
      <div v-else-if="lembretes.length === 0" class="text-center text-gray-500">
        <i class="pi pi-inbox" style="font-size: 2rem"></i>
        <p>Nenhum lembrete encontrado para o período selecionado.</p>
      </div>

      <div v-else class="grid">
        <div v-for="lembrete in lembretes" :key="lembrete.id" class="col-12 md:col-6 lg:col-4 xl:col-3">
          <Card class="h-full flex flex-column">
            <template #title>{{ lembrete.titulo }}</template>
            <template #subtitle><i><small>Criado por {{ lembrete.usuario_nome }} em {{ new Date(lembrete.data_criacao).toLocaleDateString('pt-BR') }}</small></i></template>
            <!-- <template #subtitle>
              {{ lembrete.conta_nome }}
            </template> -->
            <template #content>
              <div v-html="lembrete.conteudo" class="content-body dados_lembrete"></div>
            </template>
            <template #footer>
              <div class="mt-auto text-right">
                <Button icon="pi pi-pencil" text rounded severity="primary" @click="abrirModalEdicao(lembrete)" title="Editar" />
                <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmarExclusao(lembrete)" title="Excluir" />
              </div>
            </template>
          </Card>
        </div>
      </div>
    </main>

    <Dialog v-model:visible="lembreteDialog" :style="{ width: '800px' }" :header="modalTitle" :modal="true" class="p-fluid">
      <div v-if="authStore.isSuperuser" class="field">
        <label for="conta">Conta/Gabinete</label>
        <Dropdown id="conta" v-model="lembreteEditado.conta" :options="contas" optionLabel="nome" optionValue="id" placeholder="Selecione uma conta" required />
      </div>
      <div class="field">
        <label for="titulo">Título</label>
        <InputText id="titulo" v-model="lembreteEditado.titulo" required autofocus />
      </div>
      <div class="field">
        <label for="conteudo">Conteúdo</label>
        <Editor 
          ref="editorRef"
          v-model="lembreteEditado.conteudo" 
          required 
          editorStyle="height: 320px" 
        />
      </div>
      <template #footer>
        <Button label="Cancelar" icon="pi pi-times" class="p-button-text" @click="fecharModal" />
        <Button label="Salvar" icon="pi pi-check" @click="salvarLembrete" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { useAuthStore } from '@/stores/auth';
import { getLembretes, createLembrete, updateLembrete, deleteLembrete, gerarPdfLembretes } from '@/services/lembretes.js';
import { getContas } from '@/services/comum.js';
import Editor from 'primevue/editor';
import Card from 'primevue/card';
import ProgressSpinner from 'primevue/progressspinner';
import Calendar from 'primevue/calendar';

// Inicialização de serviços
const confirm = useConfirm();
const toast = useToast();
const authStore = useAuthStore();

// Estado do componente
const lembretes = ref([]);
const contas = ref([]);
const lembreteEditado = ref({});
const editorRef = ref(null);
const lembreteDialog = ref(false);
const isLoading = ref(true);
const modalTitle = ref('');
const pdfLoading = ref(false);

// Inicializa com a data de hoje para o filtro padrão
const filtroDataInicio = ref(new Date());
const filtroDataFim = ref(new Date());

// Função para formatar a data para o formato que a API espera (YYYY-MM-DD)
const formatarDataParaAPI = (data) => {
  if (!data) return null;
  
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0'); // getMonth() é 0-indexado
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

// Funções de Carregamento 
async function carregarLembretes() {
  isLoading.value = true;

  const params = {
    data_inicio: formatarDataParaAPI(filtroDataInicio.value),
    data_fim: formatarDataParaAPI(filtroDataFim.value)
  };

  try {
    const response = await getLembretes(params);
    lembretes.value = response.data.results || response.data;
  } catch (error) {
    console.error('Erro ao buscar lembretes:', error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os lembretes.', life: 3000 });
  } finally {
    isLoading.value = false;
  }
}

async function carregarContas() {
  try {
    const response = await getContas();
    contas.value = response.data;
  } catch (error) {
    console.error('Erro ao buscar contas:', error);
  }
}

function limparFiltro() {
  filtroDataInicio.value = null;
  filtroDataFim.value = null;
  carregarLembretes(); // Carrega todos os lembretes (sem filtro de data)
}

onMounted(() => {
  carregarLembretes();
  carregarContas();
});

// Funções para o Modal (CRUD)
function abrirModalNovo() {
  lembreteEditado.value = { titulo: '', conteudo: '' }; // Garante que o v-model não seja nulo
  
  if (!authStore.isSuperuser) {
    if (authStore.userContas.length > 0) {
      lembreteEditado.value.conta = authStore.userContas[0];
    } else {
      toast.add({ severity: 'error', summary: 'Erro', detail: 'Seu usuário não está vinculado a nenhuma conta para criar lembretes.', life: 4000 });
      return; 
    }
  }

  modalTitle.value = 'Novo Lembrete';
  lembreteDialog.value = true;
}

function abrirModalEdicao(lembrete) {
  lembreteEditado.value = { ...lembrete };
  if (!lembreteEditado.value.conteudo) {
    lembreteEditado.value.conteudo = ''; // Garante que o v-model não seja nulo
  }
  modalTitle.value = 'Editar Lembrete';
  lembreteDialog.value = true;
}

function fecharModal() {
  lembreteDialog.value = false;
  lembreteEditado.value = {};
}

async function salvarLembrete() {
  if (authStore.isSuperuser && !lembreteEditado.value.conta) {
      toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Por favor, selecione uma conta.', life: 3000 });
      return;
  }
  if (!lembreteEditado.value.titulo || lembreteEditado.value.titulo.trim() === '') {
      toast.add({ severity: 'warn', summary: 'Atenção', detail: 'O campo Título é obrigatório.', life: 3000 });
      return;
  }

  try {
    if (lembreteEditado.value.id) {
      await updateLembrete(lembreteEditado.value.id, lembreteEditado.value);
      toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Lembrete atualizado!', life: 3000 });
    } else {
      await createLembrete(lembreteEditado.value);
      toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Lembrete criado!', life: 3000 });
    }
    
    fecharModal();
    carregarLembretes();
  } catch (error) {
    console.error('Erro ao salvar lembrete:', error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao salvar o lembrete.', life: 3000 });
  }
}

// Função de Exclusão (sem alterações)
function confirmarExclusao(lembrete) {
  confirm.require({
    message: `Tem certeza que deseja excluir o lembrete "${lembrete.titulo}"?`,
    header: 'Confirmação de Exclusão',
    icon: 'pi pi-info-circle',
    acceptLabel: 'Excluir',
    rejectLabel: 'Cancelar',
    accept: async () => {
      try {
        await deleteLembrete(lembrete.id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Lembrete excluído!', life: 3000 });
        carregarLembretes();
      } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao excluir o lembrete.', life: 3000 });
      }
    }
  });
}

// <--- PASSO 4: Adicionar o 'watch' exatamente como no seu exemplo funcional
watch(lembreteDialog, (isVisible) => {
  // Quando o diálogo se torna visível E estamos em modo de edição
  if (isVisible && lembreteEditado.value.id) {
    // Usamos setTimeout para garantir que o DOM do editor esteja 100% pronto
    setTimeout(() => {
      if (editorRef.value && editorRef.value.quill) {
        // Acessamos a instância interna do Quill.js e definimos o conteúdo HTML diretamente
        editorRef.value.quill.root.innerHTML = lembreteEditado.value.conteudo;
      }
    }, 100); // Um pequeno delay para garantir a renderização
  }
});

async function gerarRelatorioPDF() {
  pdfLoading.value = true;
  toast.add({ severity: 'info', summary: 'Gerando Relatório', detail: 'Seu relatório em PDF está sendo preparado...', life: 5000 });

  const params = {
    data_inicio: formatarDataParaAPI(filtroDataInicio.value),
    data_fim: formatarDataParaAPI(filtroDataFim.value)
  };

  try {
    const response = await gerarPdfLembretes(params);
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const hoje = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `relatorio_lembretes_${hoje}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o relatório.', life: 3000 });
  } finally {
    pdfLoading.value = false;
  }
}
</script>

<style scoped>
.page-container {
  padding: 1rem;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}
.content-body {
  /* Garante que o conteúdo do card não quebre o layout */
  overflow-wrap: break-word;
  word-wrap: break-word;
  hyphens: auto;
  max-height: 200px; /* Limita a altura do conteúdo para não esticar demais o card */
  overflow-y: auto; /* Adiciona scroll se o conteúdo for muito grande */
}

/* Força o footer do card a ficar na parte de baixo */
:deep(.p-card-footer) {
    margin-top: auto;
}
.dados_lembrete{
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
}
</style>