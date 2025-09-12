<template>
  <div class="page-container">
    <Toast />
    <div class="card">
      <header class="page-header">
        <Button icon="pi pi-arrow-left" severity="secondary" text rounded @click="voltarParaLista" />
        <h1 class="page-title">{{ pageTitle }}</h1>
      </header>

      <div v-if="isLoading" class="text-center p-4">
        <ProgressSpinner />
        <p>Carregando dados do ofício...</p>
      </div>

      <div v-else class="form-container grid p-fluid">
        <div class="col-12 md:col-5">
          <div class="field">
            <label for="assunto">Assunto*</label>
            <InputText id="assunto" v-model="oficio.assunto" />
          </div>

          <div v-if="authStore.isSuperuser" class="field">
            <label for="conta">Secretaria/Gabinete*</label>
            <Dropdown id="conta" v-model="oficio.conta" :options="contas" optionLabel="nome" optionValue="id" placeholder="Selecione uma conta" />
          </div>

          <div class="field">
            <label for="data_documento">Data do Documento*</label>
            <Calendar id="data_documento" v-model="oficio.data_documento" dateFormat="dd/mm/yy" />
          </div>

          <Divider />

          <h3 class="mb-3">Destinatário</h3>
          <div class="field">
            <label for="destinatario_tratamento">Tratamento*</label>
            <InputText id="destinatario_tratamento" v-model="oficio.destinatario_tratamento" />
          </div>
          <div class="field">
            <label for="destinatario_nome">Nome*</label>
            <InputText id="destinatario_nome" v-model="oficio.destinatario_nome" />
          </div>
          <div class="field">
            <label for="destinatario_cargo">Cargo*</label>
            <InputText id="destinatario_cargo" v-model="oficio.destinatario_cargo" />
          </div>
          <div class="field">
            <label for="destinatario_orgao">Órgão/Empresa*</label>
            <InputText id="destinatario_orgao" v-model="oficio.destinatario_orgao" />
          </div>
        </div>

        <div class="field">
          <label for="diretrizes-ia">Diretrizes para o Assistente de IA</label>
          <Textarea id="diretrizes-ia" v-model="diretrizesIA" rows="3" placeholder="Ex: Solicitar informações sobre o andamento da obra X, com prazo de 15 dias." />
          <div class="flex gap-2 mt-2">
            <Button label="Gerar Rascunho" icon="pi pi-sparkles" @click="chamarIA(false)" :loading="isIaLoading" />
            <Button label="Aprimorar Texto" icon="pi pi-magic" outlined @click="chamarIA(true)" :loading="isIaLoading" title="Usa as diretrizes para melhorar o texto que já está no editor."/>
          </div>
        </div>
        
        <div class="field h-full flex flex-column">
          <label for="corpo">Corpo do Ofício*</label>
          <Editor ref="editorRef" v-model="oficio.corpo" editorStyle="height: 380px" class="flex-grow-1" />
        </div>
      </div>
      
      <div class="form-actions">
        <Button label="Cancelar" severity="secondary" outlined @click="voltarParaLista" />
        <Button label="Salvar Ofício" icon="pi pi-check" @click="salvarOficio" :loading="isSaving" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/stores/auth';
import { getOficio, createOficio, updateOficio, gerarTextoComIA } from '@/services/oficios.js';
import { getContas } from '@/services/comum.js';
import Editor from 'primevue/editor';

// Inicialização
const router = useRouter();
const route = useRoute();
const toast = useToast();
const authStore = useAuthStore();

// Props da rota (para edição)
const props = defineProps({
  id: {
    type: String,
    default: null
  }
});

// Estado do componente
const oficio = ref({
  data_documento: new Date() // Inicia com a data atual
});
const contas = ref([]);
const isLoading = ref(false);
const isSaving = ref(false);
const editorRef = ref(null);
const diretrizesIA = ref('');
const isIaLoading = ref(false);

// Lógica de Título e Modo (Criação vs. Edição)
const isEditMode = computed(() => !!props.id);
const pageTitle = computed(() => isEditMode.value ? 'Editar Ofício' : 'Novo Ofício');

// Carregamento de dados
async function carregarDadosIniciais() {
  isLoading.value = true;
  try {
    // Carrega a lista de contas para o dropdown (se for superuser)
    if (authStore.isSuperuser) {
      const contasResponse = await getContas();
      contas.value = contasResponse.data;
    }

    // Se estiver em modo de edição, busca os dados do ofício
    if (isEditMode.value) {
      const response = await getOficio(props.id);
      // Converte a string de data da API para um objeto Date para o Calendar
      response.data.data_documento = new Date(response.data.data_documento + 'T00:00:00');
      oficio.value = response.data;
    } else {
      // Se estiver criando, define a conta padrão para não-superusuários
      if (!authStore.isSuperuser && authStore.userContas.length > 0) {
        oficio.value.conta = authStore.userContas[0];
      }
    }
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os dados necessários.' });
    router.push({ name: 'oficios-lista' });
  } finally {
    isLoading.value = false;
  }
}

onMounted(carregarDadosIniciais);

// Ações do formulário
async function salvarOficio() {
  isSaving.value = true;
  try {
    // Converte a data de volta para o formato YYYY-MM-DD para a API
    if (oficio.value.data_documento instanceof Date) {
      const data = oficio.value.data_documento;
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const dia = String(data.getDate()).padStart(2, '0');
      oficio.value.data_documento = `${ano}-${mes}-${dia}`;
    }

    if (isEditMode.value) {
      await updateOficio(props.id, oficio.value);
      toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Ofício atualizado!' });
    } else {
      await createOficio(oficio.value);
      toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Ofício criado!' });
    }
    router.push({ name: 'oficios-lista' });
  } catch (error) {
    console.error("Erro ao salvar ofício:", error);
    // Reconverte a data para objeto Date em caso de erro para o usuário não perder a seleção
    oficio.value.data_documento = new Date(oficio.value.data_documento + 'T00:00:00');
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao salvar o ofício. Verifique os campos.' });
  } finally {
    isSaving.value = false;
  }
}

function voltarParaLista() {
  router.push({ name: 'oficios-lista' });
}

// Watcher para carregar o conteúdo no Editor, usando o padrão que já validamos
watch(isLoading, (loadingStatus) => {
  // Quando o carregamento TERMINA (loadingStatus se torna 'false') E estamos em modo de edição
  if (loadingStatus === false && isEditMode.value) {
    // Usamos setTimeout para garantir que o DOM do editor esteja 100% pronto
    setTimeout(() => {
      if (editorRef.value && editorRef.value.quill) {
        // Acessamos a instância interna do Quill.js e definimos o conteúdo HTML diretamente
        editorRef.value.quill.root.innerHTML = oficio.value.corpo || '';
      }
    }, 100); // Um pequeno delay para garantir a renderização
  }
});

async function chamarIA(aprimorar) {
  if (!diretrizesIA.value.trim()) {
    toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Por favor, forneça as diretrizes para a IA.' });
    return;
  }
  
  isIaLoading.value = true;
  try {
    const texto_existente = aprimorar ? (editorRef.value?.quill.root.innerHTML || '') : '';
    const response = await gerarTextoComIA(diretrizesIA.value, texto_existente);
    
    // --- CORREÇÃO COM SETTIMEOUT ---
    // Adicionamos um pequeno delay para garantir que o editor esteja pronto
    setTimeout(() => {
      if (editorRef.value && editorRef.value.quill) {
        // Insere o novo conteúdo HTML gerado pela IA
        editorRef.value.quill.root.innerHTML = response.data.texto_gerado;
        
        // Sincroniza o v-model (oficio.corpo) com o novo conteúdo do editor
        oficio.value.corpo = response.data.texto_gerado;
      }
    }, 100); // 100ms é suficiente para o DOM atualizar

    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Texto gerado pela IA!' });
  } catch (error) {
    console.error("Erro ao chamar IA:", error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o texto com a IA.' });
  } finally {
    isIaLoading.value = false;
  }
}
</script>

<style scoped>
.page-container {
  padding: 2rem;
}
.page-header-form {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.page-title {
  margin: 0;
  font-size: 1.75rem;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.5rem;
}
</style>