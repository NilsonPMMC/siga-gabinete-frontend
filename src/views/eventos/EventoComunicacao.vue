<template>
    <div class="page-container">
        <Toast />
        <ConfirmDialog></ConfirmDialog>

        <header class="page-header">
            <div class="flex align-items-center mb-4">
                <router-link to="/eventos">
                    <Button icon="pi pi-arrow-left" severity="secondary" text rounded />
                </router-link>
                <div v-if="!loading" class="ml-2">
                    <h1 class="mb-0">{{ evento.nome }}</h1>
                    <p class="mt-1 text-color-secondary">Comunicações do Evento</p>
                </div>
            </div>
            <div class="flex align-items-center gap-3">
                <Button label="Nova Comunicação" icon="pi pi-plus" class="p-button-success" @click="abrirDialogoNovaComunicacao" />
            </div>
        </header>
        <main>
            <DataTable :value="comunicacoes" :loading="loading" responsiveLayout="scroll">
                <template #empty>Nenhuma comunicação criada para este evento.</template>
                <Column field="titulo" header="Título" :sortable="true"></Column>
                <Column field="status" header="Status">
                    <template #body="slotProps">
                        <Tag :value="slotProps.data.status" />
                    </template>
                </Column>
                <Column field="data_criacao" header="Data de Criação">
                        <template #body="slotProps">
                        {{ new Date(slotProps.data.data_criacao).toLocaleString('pt-BR') }}
                    </template>
                </Column>
                <Column header="Ações">
                    <template #body="slotProps">
                        <Button icon="pi pi-eye" text rounded @click="verDetalhes(slotProps.data)" title="Ver Detalhes" />
                        <Button icon="pi pi-pencil" text rounded severity="secondary" @click="abrirDialogoEdicao(slotProps.data)" title="Editar" />
                        <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmarDelete(slotProps.data)" title="Excluir" />
                    </template>
                </Column>
            </DataTable>
        </main>

        <Dialog v-model:visible="dialogoVisivel" :style="{width: '800px'}" :header="tituloDialogo" :modal="true" class="p-fluid">
            <div class="field">
                <label for="titulo">Título*</label>
                <InputText id="titulo" v-model="comunicacaoEmEdicao.titulo" />
            </div>
            
            <div class="field">
                <label for="descricao">Descrição (Corpo do E-mail)*</label>                
                <Editor 
                    ref="editorRef"
                    v-model="comunicacaoEmEdicao.descricao" 
                    editorStyle="height: 320px" 
                />
                <small v-pre>Use placeholders como {{ nome_completo }} para personalizar.</small>
            </div>
            
            <div class="grid">
                <div class="field col-12 md:col-6">
                    <label for="arte">Arte (Imagem)</label>
                    <div v-if="comunicacaoEmEdicao.arte && typeof comunicacaoEmEdicao.arte === 'string'" class="mb-2">
                        <a :href="comunicacaoEmEdicao.arte" target="_blank">Ver imagem atual</a>
                        <Button icon="pi pi-times" class="p-button-danger p-button-text ml-2" @click="removerArquivo('arte')" title="Remover Imagem" />
                    </div>
                    <FileUpload name="arte" @select="onFileSelect($event, 'arte')" :show-upload-button="false" :show-cancel-button="false" accept="image/*" chooseLabel="Selecionar Nova Imagem" />
                </div>
                <div class="field col-12 md:col-6">
                    <label for="anexo">Anexo (Documento)</label>
                    <div v-if="comunicacaoEmEdicao.anexo && typeof comunicacaoEmEdicao.anexo === 'string'" class="mb-2">
                        <a :href="comunicacaoEmEdicao.anexo" target="_blank">Ver anexo atual</a>
                        <Button icon="pi pi-times" class="p-button-danger p-button-text ml-2" @click="removerArquivo('anexo')" title="Remover Anexo" />
                    </div>
                    <FileUpload name="anexo" @select="onFileSelect($event, 'anexo')" :show-upload-button="false" :show-cancel-button="false" accept=".pdf,.doc,.docx" chooseLabel="Selecionar Novo Anexo"/>
                </div>
            </div>
            
            <div class="field">
                <label for="status">Status</label>
                <Dropdown id="status" v-model="comunicacaoEmEdicao.status" :options="statusOptions" optionLabel="label" optionValue="value" />
            </div>

            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="dialogoVisivel = false" />
                <Button label="Salvar" icon="pi pi-check" @click="salvarComunicacao" />
            </template>
        </Dialog>
    </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import eventosService from '@/services/eventos';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import Toolbar from 'primevue/toolbar';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Dropdown from 'primevue/dropdown';
import FileUpload from 'primevue/fileupload';
import Editor from 'primevue/editor';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import { useAuthStore } from '@/stores/auth';

const router = useRouter(); 
const route = useRoute();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();
const eventoId = route.params.id;

const loading = ref(true);
const evento = ref({});
const comunicacoes = ref([]);
const dialogoVisivel = ref(false);
const comunicacaoEmEdicao = ref({});
const editorRef = ref(null);

const statusOptions = ref([
    { label: 'Criado', value: 'criado' },
    { label: 'Enviado', value: 'enviado' },
    { label: 'Cancelado', value: 'cancelado' },
]);

const tituloDialogo = computed(() => comunicacaoEmEdicao.value.id ? 'Editar Comunicação' : 'Nova Comunicação');
const isNew = computed(() => !comunicacaoEmEdicao.value.id);

const verDetalhes = (comunicacao) => {
    router.push({ name: 'evento-comunicacao-detalhes', params: { id: comunicacao.id } });
};

const carregarDados = async () => {
    if (!authStore.isAuthenticated) {
        loading.value = false;
        return;
    }
    loading.value = true;
    try {
        const [eventoRes, comunicacoesRes] = await Promise.all([
            eventosService.getEvento(eventoId),
            eventosService.getComunicacoes(eventoId)
        ]);
        evento.value = eventoRes.data;
        comunicacoes.value = comunicacoesRes.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar dados da página.' });
    } finally {
        loading.value = false;
    }
};

onMounted(carregarDados);

const abrirDialogoNovaComunicacao = () => {
    comunicacaoEmEdicao.value = {
        evento_id: eventoId,
        status: 'criado'
    };
    dialogoVisivel.value = true;
};

const abrirDialogoEdicao = async (comunicacaoDaLista) => {
    try {
        const response = await eventosService.getComunicacao(comunicacaoDaLista.id);
        
        // Apenas preenche os dados. O 'watch' fará o resto.
        comunicacaoEmEdicao.value = { ...response.data };
        if (!comunicacaoEmEdicao.value.descricao) {
            comunicacaoEmEdicao.value.descricao = '';
        }
        
        dialogoVisivel.value = true;
    } catch (error) {
        console.error("Erro ao buscar detalhes da comunicação:", error);
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os dados para edição.' });
    }
};

watch(dialogoVisivel, (isVisible) => {
    // Quando o diálogo se torna visível E estamos em modo de edição
    if (isVisible && comunicacaoEmEdicao.value.id) {
        // Usamos setTimeout para garantir que o DOM do editor esteja 100% pronto
        setTimeout(() => {
            if (editorRef.value) {
                // Acessamos a instância interna do Quill.js e definimos o conteúdo HTML diretamente
                editorRef.value.quill.root.innerHTML = comunicacaoEmEdicao.value.descricao;
            }
        }, 100); // Um pequeno delay para garantir a renderização
    }
});

const removerArquivo = (fieldName) => {
    // Limpa o campo no frontend
    comunicacaoEmEdicao.value[fieldName] = null;
    // Adiciona uma flag para o backend saber que deve deletar o arquivo
    comunicacaoEmEdicao.value[`remover_${fieldName}`] = true;
    toast.add({ severity: 'info', summary: 'Atenção', detail: 'O arquivo será removido ao salvar.', life: 3000 });
};

const onFileSelect = (event, fieldName) => {
    // Guarda o objeto do arquivo para enviar no FormData
    comunicacaoEmEdicao.value[fieldName] = event.files[0];
};

const salvarComunicacao = async () => {
    if (!comunicacaoEmEdicao.value.titulo || !comunicacaoEmEdicao.value.descricao) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Título e Descrição são obrigatórios.' });
        return;
    }
    
    try {
        if (isNew.value) {
            await eventosService.createComunicacao(comunicacaoEmEdicao.value);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Comunicação criada!' });
        } else {
            // Enviamos o objeto completo, incluindo as flags de remoção
            await eventosService.updateComunicacao(comunicacaoEmEdicao.value.id, comunicacaoEmEdicao.value);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Comunicação atualizada!' });
        }
        dialogoVisivel.value = false;
        carregarDados();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar a comunicação.' });
    }
};

const confirmarDelete = (comunicacao) => {
    confirm.require({
        message: `Tem certeza que deseja deletar a comunicação "${comunicacao.titulo}"?`,
        header: 'Confirmar Exclusão',
        icon: 'pi pi-info-circle',
        acceptClass: 'p-button-danger',
        accept: () => deletarComunicacao(comunicacao.id),
    });
};

const deletarComunicacao = async (id) => {
    try {
        await eventosService.deleteComunicacao(id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Comunicação deletada.' });
        carregarDados();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível deletar.' });
    }
};
</script>

<style scoped>
/* Estilos para o container da página e o cabeçalho */
.page-container {
    padding: 2rem;
}
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
}
</style>