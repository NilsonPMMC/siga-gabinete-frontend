<template>
  <div class="page-container">
    <Toast />
    <Card>
      <template #title>
        <div class="card-title">
          <Button icon="pi pi-arrow-left" severity="secondary" text rounded @click="voltarParaLista" />
          <h2 class="ml-2">{{ pageTitle }}</h2>
        </div>
      </template>
      <template #content>
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
              <label for="destinatario_cargo">Cargo</label>
              <InputText id="destinatario_cargo" v-model="oficio.destinatario_cargo" />
            </div>
            <div class="field">
              <label for="destinatario_orgao">Órgão/Empresa</label>
              <InputText id="destinatario_orgao" v-model="oficio.destinatario_orgao" />
            </div>
          </div>

          <div class="col-12 md:col-7 flex flex-column">            
              <div class="field h-full flex flex-column">
                  <label>Corpo do Ofício*</label>
                  <div v-if="editor" class="tiptap-toolbar">
                    <Button 
                      label="B" 
                      @click="editor.chain().focus().toggleBold().run()" 
                      :class="{ 'p-button-secondary': editor.isActive('bold') }" 
                      text 
                      class="p-button-sm font-bold"
                      title="Negrito"/>
                    <Button 
                      label="I" 
                      @click="editor.chain().focus().toggleItalic().run()" 
                      :class="{ 'p-button-secondary': editor.isActive('italic') }" 
                      text 
                      class="p-button-sm"
                      style="font-style: italic;"
                      title="Itálico"/>
                    <Button 
                      icon="pi pi-list" 
                      @click="editor.chain().focus().toggleBulletList().run()" 
                      :class="{ 'p-button-secondary': editor.isActive('bulletList') }" 
                      text 
                      rounded 
                      title="Lista"/>
                    <Button 
                      icon="pi pi-undo" 
                      @click="editor.chain().focus().undo().run()" 
                      text 
                      rounded 
                      title="Desfazer"/>
                    <Button 
                      icon="pi pi-refresh" 
                      @click="editor.chain().focus().redo().run()" 
                      text 
                      rounded 
                      title="Refazer"/>
                  </div>
                  <EditorContent :editor="editor" class="tiptap-editor"/>
              </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex align-items-center gap-1">
          <Button label="Cancelar" severity="secondary" outlined @click="voltarParaLista" />
          <Button label="Salvar Ofício" icon="pi pi-check" @click="salvarOficio" :loading="isSaving" />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/stores/auth';
import { getOficio, createOficio, updateOficio, gerarTextoComIA } from '@/services/oficios.js';
import { getContas } from '@/services/comum.js';

// Imports do TipTap
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const authStore = useAuthStore();

const props = defineProps({
  id: {
    type: String,
    default: null
  }
});

// Estado do componente
const oficio = ref({
  data_documento: new Date(),
  corpo: '' // Importante inicializar
});
const contas = ref([]);
const isLoading = ref(false);
const isSaving = ref(false);
const isIaLoading = ref(false);

const isEditMode = computed(() => !!props.id);
const pageTitle = computed(() => isEditMode.value ? 'Editar Ofício' : 'Novo Ofício');

// --- CONFIGURAÇÃO DO TIPTAP ---
const editor = useEditor({
  extensions: [
    StarterKit, // Habilita as funcionalidades básicas (negrito, itálico, listas, etc.)
  ],
  content: oficio.value.corpo, // Conteúdo inicial
  // Esta função é a chave para a "mágica" do v-model
  onUpdate: ({ editor }) => {
    oficio.value.corpo = editor.getHTML();
  },
});

// Este Watcher resolve o problema de popular os dados da API e da IA no editor!
watch(() => oficio.value.corpo, (newContent) => {
  if (editor.value) {
    // Compara o conteúdo atual do editor com o novo conteúdo
    const isSame = editor.value.getHTML() === newContent;
    // Se for diferente, atualiza o editor (evitando um loop infinito)
    if (!isSame) {
      editor.value.commands.setContent(newContent, false); // 'false' para não disparar o 'onUpdate' novamente
    }
  }
});

// Destruir a instância do editor ao sair do componente para evitar vazamento de memória
onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy();
  }
});
// --- FIM DA CONFIGURAÇÃO DO TIPTAP ---

async function carregarDadosIniciais() {
  isLoading.value = true;
  try {
    if (authStore.isSuperuser) {
      const contasResponse = await getContas();
      contas.value = contasResponse.data;
    }
    if (isEditMode.value) {
      const response = await getOficio(props.id);
      response.data.data_documento = new Date(response.data.data_documento + 'T00:00:00');
      // Apenas atualiza o 'oficio'. O watcher do TipTap fará o resto.
      oficio.value = response.data;
    } else {
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

async function salvarOficio() {
  isSaving.value = true;
  try {
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
    oficio.value.data_documento = new Date(oficio.value.data_documento + 'T00:00:00');
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao salvar o ofício. Verifique os campos.' });
  } finally {
    isSaving.value = false;
  }
}

function voltarParaLista() {
  router.push({ name: 'oficios-lista' });
}
</script>

<style>
/* Adicione este CSS ao seu componente ou a um arquivo de estilo global */

.tiptap-toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid #ced4da;
  border-bottom: 0;
  padding: 0.5rem;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  background-color: #f8f9fa;
}

.tiptap-editor {
  border: 1px solid #ced4da;
  padding: 0.75rem;
  min-height: 380px;
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  background-color: #ffffff;
  outline: none;
}

.tiptap-editor:focus {
    border-color: #80bdff;
    box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

/* Estilos para o conteúdo dentro do editor */
.tiptap-editor .ProseMirror {
    height: 100%;
    outline: none;
}

.tiptap-editor .ProseMirror p {
  margin: 0 0 1rem 0;
}

.tiptap-editor .ProseMirror ul {
  margin: 0 0 1rem 0;
  padding-left: 1.5rem;
}
.p-button-sm{
  width: auto;
}
.page-container { padding: 2rem; }
.field { margin-bottom: 1.5rem; }
.card-title { display: flex; align-items: center; }
label { margin-bottom: 0.25rem; display: block; }
</style>