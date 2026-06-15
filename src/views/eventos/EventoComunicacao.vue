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
                    <h1 class="mb-0">Comunicações do Evento</h1>
                    <p class="mt-1 text-color-secondary">{{ evento.nome }}</p>
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
                <Column header="Saúde de Envio" style="min-width: 11rem">
                    <template #body="slotProps">
                        <Tag
                            v-if="slotProps.data._diagnostico"
                            :value="`Falhas ${slotProps.data._diagnostico.taxa_falha_pct}%`"
                            :severity="severityFalha(slotProps.data._diagnostico.taxa_falha_pct)"
                        />
                        <Tag
                            v-else-if="slotProps.data.status === 'enviado'"
                            value="Analisando..."
                            severity="secondary"
                        />
                        <span v-else class="text-color-secondary text-sm">—</span>
                    </template>
                </Column>
                <Column header="E-mails Suprimidos" style="min-width: 10rem">
                    <template #body="slotProps">
                        <Tag
                            v-if="slotProps.data.emails_suprimidos_count > 0"
                            :value="`${slotProps.data.emails_suprimidos_count} bloqueado${slotProps.data.emails_suprimidos_count > 1 ? 's' : ''}`"
                            severity="warning"
                            icon="pi pi-ban"
                        />
                        <span v-else class="text-color-secondary text-sm">—</span>
                    </template>
                </Column>
                <Column field="data_criacao" header="Data de Criação">
                        <template #body="slotProps">
                        {{ new Date(slotProps.data.data_criacao).toLocaleString('pt-BR') }}
                    </template>
                </Column>
                <Column header="Grupos incluídos" style="min-width: 12rem">
                    <template #body="slotProps">
                        <span v-if="!slotProps.data.grupos_inclusao?.length" class="text-color-secondary text-sm">—</span>
                        <div v-else class="flex flex-wrap gap-1 align-items-center">
                            <Tag
                                v-for="(g, idx) in slotProps.data.grupos_inclusao"
                                :key="idx"
                                :value="rotuloGrupoInclusao(g)"
                                :severity="g.tipo === 'categoria' ? 'info' : 'secondary'"
                                class="text-sm mb-0"
                                style="max-width: 100%; white-space: normal; height: auto;"
                            />
                        </div>
                    </template>
                </Column>
                <Column header="Ações">
                    <template #body="slotProps">
                        <Button icon="pi pi-chart-bar" text rounded severity="help" @click="abrirDiagnostico(slotProps.data)" title="Diagnóstico de envio" />
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

        <Dialog v-model:visible="diagnosticoVisivel" :style="{ width: '760px' }" header="Diagnóstico de Envio" :modal="true">
            <div v-if="diagnosticoLoading" class="text-center py-4">
                <i class="pi pi-spin pi-spinner mr-2"></i>
                Carregando análise dos logs...
            </div>
            <div v-else-if="diagnosticoAtual">
                <div class="grid">
                    <div class="col-12 md:col-3">
                        <Card class="metric-card metric-total">
                            <template #content>
                                <div class="metric-label">Total logs</div>
                                <div class="metric-value">{{ diagnosticoAtual.total_logs }}</div>
                            </template>
                        </Card>
                    </div>
                    <div class="col-12 md:col-3">
                        <Card class="metric-card metric-success">
                            <template #content>
                                <div class="metric-label">Sucessos</div>
                                <div class="metric-value">{{ diagnosticoAtual.sucessos }}</div>
                            </template>
                        </Card>
                    </div>
                    <div class="col-12 md:col-3">
                        <Card class="metric-card metric-failure">
                            <template #content>
                                <div class="metric-label">Falhas</div>
                                <div class="metric-value">{{ diagnosticoAtual.falhas }}</div>
                            </template>
                        </Card>
                    </div>
                    <div class="col-12 md:col-3">
                        <Card class="metric-card" :class="classeTaxaFalha(diagnosticoAtual.taxa_falha_pct)">
                            <template #content>
                                <div class="metric-label">Taxa falha</div>
                                <div class="metric-value">{{ diagnosticoAtual.taxa_falha_pct }}%</div>
                            </template>
                        </Card>
                    </div>
                </div>
                <Divider />
                <p class="mb-2"><strong>Principais falhas:</strong></p>
                <ul class="m-0 pl-3">
                    <li class="text-orange-600">
                        {{ diagnosticoAtual.falhas_sem_email }}: “Munícipe não possui e-mail cadastrado.”
                    </li>
                    <li class="text-red-600">
                        {{ diagnosticoAtual.falhas_email_malformado }}: e-mails malformados (Invalid address ...)
                    </li>
                </ul>
                <div v-if="diagnosticoAtual.top_erros_gerais?.length" class="mt-3">
                    <p class="mb-2"><strong>Top erros gerais:</strong></p>
                    <ul class="m-0 pl-3">
                        <li v-for="(item, idx) in diagnosticoAtual.top_erros_gerais" :key="idx">
                            {{ item.total }}x — {{ item.erro }}
                        </li>
                    </ul>
                </div>
            </div>
            <div v-else class="text-color-secondary">Sem dados de diagnóstico para esta comunicação.</div>
            <template #footer>
                <Button label="Fechar" icon="pi pi-times" text @click="diagnosticoVisivel = false" />
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
const diagnosticoVisivel = ref(false);
const diagnosticoLoading = ref(false);
const diagnosticoAtual = ref(null);
const cacheDiagnostico = ref({});

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

const abrirDiagnostico = async (comunicacao) => {
    diagnosticoVisivel.value = true;
    diagnosticoAtual.value = null;
    const id = comunicacao?.id;
    if (!id) return;

    if (cacheDiagnostico.value[id]) {
        diagnosticoAtual.value = cacheDiagnostico.value[id];
        return;
    }

    diagnosticoLoading.value = true;
    try {
        const response = await eventosService.getResumoLogsDeEnvio(id);
        const diagnostico = response?.data || null;
        cacheDiagnostico.value[id] = diagnostico;
        diagnosticoAtual.value = diagnostico;
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Erro',
            detail: 'Não foi possível carregar o diagnóstico de envio.',
            life: 3000,
        });
    } finally {
        diagnosticoLoading.value = false;
    }
};

const severityFalha = (taxa) => {
    const n = Number(taxa || 0);
    if (n >= 10) return 'danger';
    if (n >= 3) return 'warning';
    return 'success';
};

const classeTaxaFalha = (taxa) => {
    const n = Number(taxa || 0);
    if (n >= 10) return 'metric-failure';
    if (n >= 3) return 'metric-warning';
    return 'metric-success';
};

const carregarResumoDiagnostico = async () => {
    const enviadas = (comunicacoes.value || []).filter((c) => c?.status === 'enviado');
    for (const comunicacao of enviadas) {
        try {
            const response = await eventosService.getResumoLogsDeEnvio(comunicacao.id);
            const diagnostico = response?.data || null;
            cacheDiagnostico.value[comunicacao.id] = diagnostico;
            comunicacao._diagnostico = diagnostico;
        } catch (_) {
            comunicacao._diagnostico = null;
        }
    }
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
        await carregarResumoDiagnostico();
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
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Comunicação atualizada!', life: 3000 });
        }
        dialogoVisivel.value = false;
        carregarDados();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar a comunicação.', life: 3000 });
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

const rotuloGrupoInclusao = (g) => {
    if (!g) return '';
    const prefixo = g.tipo === 'categoria' ? 'Categoria' : g.tipo === 'mailing' ? 'Mailing' : 'Grupo';
    const qtd = g.qtd_novos != null ? ` +${g.qtd_novos}` : '';
    return `${prefixo}: ${g.nome || '—'}${qtd}`;
};

const deletarComunicacao = async (id) => {
    try {
        await eventosService.deleteComunicacao(id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Comunicação deletada.', life: 3000 });
        carregarDados();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível deletar.', life: 3000 });
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

.metric-card {
    border-radius: 12px;
}
.metric-label {
    font-size: 0.85rem;
    color: #64748b;
}
.metric-value {
    font-size: 1.4rem;
    font-weight: 700;
}
.metric-total {
    border-left: 5px solid #64748b;
}
.metric-success {
    border-left: 5px solid #16a34a;
}
.metric-warning {
    border-left: 5px solid #f59e0b;
}
.metric-failure {
    border-left: 5px solid #dc2626;
}
</style>