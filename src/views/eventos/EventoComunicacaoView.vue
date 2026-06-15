<template>
    <div class="page-container">
        <Toast />
        <ConfirmDialog />

        <header class="page-header">
            <div class="flex align-items-center gap-3">
                <router-link :to="`/eventos/${evento.id}/comunicacoes`" v-if="evento.id">
                    <Button icon="pi pi-arrow-left" severity="secondary" text rounded />
                </router-link>
                <div>
                    <h1 class="mb-0">Gerenciar Comunicação</h1>
                    <p v-if="!loading" class="mt-1 text-color-secondary">{{ evento.nome }}</p>
                </div>
            </div>
        </header>

        <main class="grid">
            <div class="col-12 md:col-5 lg:col-4">
                <div class="card">
                    <h5>Ações Principais</h5>
                    <Button 
                        label="Enviar Comunicação" 
                        icon="pi pi-send" 
                        class="p-button-success w-full mb-4" 
                        @click="confirmarEnvio" 
                        :loading="enviando" 
                        :disabled="destinatariosTotal === 0"
                        v-tooltip.bottom="destinatariosTotal === 0 ? 'Adicione destinatários antes de enviar' : ''"
                    />

                    <h5 class="mt-4">Pré-Visualização</h5>
                    <div class="p-3 border-1 surface-border border-round">
                        <p><strong>Assunto:</strong> {{ comunicacao.titulo }}</p>
                        <Divider />
                        <p><strong>Corpo do E-mail:</strong></p>
                        <div class="p-2 border-1 surface-border border-round" style="min-height: 200px; max-height: 400px; overflow-y: auto;" v-html="comunicacao.descricao"></div>
                        <div v-if="comunicacao.arte">
                            <p><strong>Imagem:</strong></p>
                            <img :src="comunicacao.arte" alt="Preview da Imagem" style="max-width: 100%;" />
                        </div>
                        <div v-if="comunicacao.anexo">
                            <p><strong>Anexo:</strong></p>
                            <a :href="comunicacao.anexo" target="_blank">
                                <Button label="Ver/Baixar Anexo" icon="pi pi-file-pdf" severity="secondary" outlined size="small" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-12 md:col-7 lg:col-8">
                <div class="card">
                    <TabView v-model:activeIndex="abaAtiva" @tab-change="onTabChange">
                        <TabPanel header="Destinatários">
                            <Toolbar class="mb-4">
                                <template #start>
                                    <Button label="Adicionar Destinatário" icon="pi pi-plus" class="p-button-success mr-2" @click="abrirDialogoAdicionar" />
                                    <div class="flex gap-2">
                                        <Button label="Adicionar por Categoria" icon="pi pi-users" class="p-button-info p-button-sm" @click="abrirDialogoCategoria" />
                                        <Button label="Adicionar por Mailing" icon="pi pi-envelope" class="p-button-secondary p-button-sm" @click="abrirDialogoMailing" />
                                    </div>
                                    <Button 
                                        label="Gerar PDF" 
                                        icon="pi pi-file-pdf" 
                                        class="p-button-outlined p-button-sm ml-2" 
                                        @click="gerarRelatorioPdf" 
                                        :loading="gerandoPdf"
                                        v-tooltip.bottom="'Baixar relatório com lista de destinatários e resumo da comunicação'"
                                    />
                                </template>
                            </Toolbar>
                            <DataTable
                                :value="destinatarios"
                                :loading="loadingDestinatarios"
                                responsiveLayout="scroll"
                                paginator
                                lazy
                                :rows="destinatariosPageSize"
                                :first="destinatariosFirst"
                                :totalRecords="destinatariosTotal"
                                :rowsPerPageOptions="[50, 100, 200, 500]"
                                @page="onDestinatariosPage"
                            >
                                <template #empty>Nenhum destinatário adicionado.</template>
                                <Column header="Nome" :sortable="true" sortField="municipe.nome_completo">
                                    <template #body="slotProps">
                                        <div class="flex flex-column">
                                            <span class="font-bold">{{ slotProps.data.municipe.nome_completo }}</span>
                                            <small v-if="slotProps.data.municipe.nome_de_guerra" class="text-primary-500">{{ slotProps.data.municipe.nome_de_guerra }}</small>
                                        </div>
                                    </template>
                                </Column>
                                <Column field="municipe.cargo" header="Cargo"></Column>
                                <Column header="Email Principal">
                                    <template #body="slotProps">
                                        {{ getEmailPrincipal(slotProps.data.municipe.emails) }}
                                    </template>
                                </Column>
                                <Column header="Ações">
                                    <template #body="slotProps">
                                        <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmarDeleteDestinatario(slotProps.data)" title="Remover" />
                                    </template>
                                </Column>
                            </DataTable>
                        </TabPanel>
                        <TabPanel header="Logs de Envio">
                            <div class="mb-3 flex align-items-center gap-2">
                                <Button
                                    label="Carregar logs"
                                    icon="pi pi-refresh"
                                    size="small"
                                    outlined
                                    :loading="loadingLogs"
                                    @click="carregarLogs()"
                                />
                                <small class="text-color-secondary">
                                    Carregamento sob demanda para evitar travamentos com alto volume.
                                </small>
                            </div>
                            <DataTable
                                :value="logs"
                                :loading="loadingLogs"
                                responsiveLayout="scroll"
                                paginator
                                lazy
                                :rows="logsPageSize"
                                :first="logsFirst"
                                :totalRecords="logsTotal"
                                :rowsPerPageOptions="[50, 100, 200, 500]"
                                @page="onLogsPage"
                            >
                                <template #empty>Nenhum log de envio encontrado para esta comunicação.</template>
                                <Column field="destinatario_nome" header="Destinatário" :sortable="true"></Column>
                                <Column field="status" header="Status" :sortable="true">
                                    <template #body="slotProps">
                                        <Tag :value="slotProps.data.status" :severity="slotProps.data.status === 'sucesso' ? 'success' : 'danger'" />
                                    </template>
                                </Column>
                                <Column field="data_envio" header="Data" :sortable="true">
                                    <template #body="slotProps">
                                        {{ new Date(slotProps.data.data_envio).toLocaleString('pt-BR') }}
                                    </template>
                                </Column>
                                <Column field="detalhe_erro" header="Detalhe do Erro"></Column>
                            </DataTable>
                        </TabPanel>
                    </TabView>
                </div>
            </div>
        </main>
        
        <Dialog v-model:visible="dialogoAdicionarVisivel" header="Adicionar Destinatário" :modal="true" :style="{ width: '600px' }">
            <div class="field">
                <label for="municipe">Munícipe*</label>
                <div class="p-inputgroup">
                    <AutoComplete id="municipe" v-model="municipeSelecionado" :suggestions="sugestoesMunicipes" @complete="buscarMunicipes" field="nome_completo" placeholder="Digite para buscar..." forceSelection style="width: 100%;">
                    <template #item="slotProps">
                        <div class="flex flex-column align-items-start">
                            <div>{{ slotProps.item.nome_completo }}</div>
                            <small v-if="slotProps.item.nome_de_guerra" class="text-sm text-primary-500 font-italic">
                                {{ slotProps.item.nome_de_guerra }}
                            </small>
                            <small v-if="slotProps.item.cargo" class="text-sm text-color-secondary">{{ slotProps.item.cargo }}</small>
                        </div>
                    </template>
                    </AutoComplete>
                    <Button type="button" icon="pi pi-plus" @click="abrirDialogoNovoMunicipe" title="Adicionar Novo Munícipe" />
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="dialogoAdicionarVisivel = false" />
                <Button label="Adicionar" icon="pi pi-check" @click="adicionarDestinatario" :disabled="!municipeSelecionado" />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="dialogoCategoriaVisivel"
            header="Adicionar por categoria"
            :modal="true"
            :style="{ width: 'min(100vw - 2rem, 560px)' }"
            :breakpoints="{ '768px': '95vw' }"
        >
            <p class="text-sm text-color-secondary mt-0 mb-3 line-height-3">
                Escolha uma ou mais categorias. Contatos que já estão na lista não serão duplicados.
            </p>
            <div class="field mb-0">
                <label for="categoria-multiselect" class="font-medium">Categorias</label>
                <MultiSelect
                    id="categoria-multiselect"
                    v-model="categoriasSelecionadas"
                    :options="categorias"
                    optionLabel="nome"
                    placeholder="Busque e selecione…"
                    display="chip"
                    filter
                    :filterPlaceholder="'Filtrar…'"
                    class="w-full"
                    :loading="loadingCategorias"
                    :maxSelectedLabels="3"
                    selectedItemsLabel="{0} categorias"
                    :showToggleAll="true"
                />
            </div>
            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="dialogoCategoriaVisivel = false" :disabled="salvandoPorCategoria" />
                <Button
                    label="Adicionar à lista"
                    icon="pi pi-check"
                    @click="adicionarPorCategoria"
                    :disabled="!categoriasSelecionadas?.length"
                    :loading="salvandoPorCategoria"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="dialogoMailingVisivel"
            header="Adicionar por lista de mailing"
            :modal="true"
            :style="{ width: 'min(100vw - 2rem, 560px)' }"
            :breakpoints="{ '768px': '95vw' }"
        >
            <p class="text-sm text-color-secondary mt-0 mb-3 line-height-3">
                Listas da mesma conta do evento. Selecione uma ou mais listas; contatos já incluídos não se repetem.
            </p>
            <div class="field mb-0">
                <label for="mailing-multiselect" class="font-medium">Listas de mailing</label>
                <small
                    v-if="!loadingMailings && !mailingListsContaEvento.length"
                    class="block mt-2 text-color-secondary"
                >
                    Nenhuma lista de mailing cadastrada para a conta deste evento.
                </small>
                <MultiSelect
                    id="mailing-multiselect"
                    v-model="mailingListsSelecionadas"
                    :options="mailingListsContaEvento"
                    optionLabel="nome"
                    placeholder="Busque e selecione…"
                    display="chip"
                    filter
                    :filterPlaceholder="'Filtrar…'"
                    class="w-full"
                    :loading="loadingMailings"
                    :maxSelectedLabels="3"
                    selectedItemsLabel="{0} listas"
                    :showToggleAll="true"
                >
                    <template #option="slotProps">
                        <div class="flex flex-column gap-1 py-1">
                            <span class="font-medium">{{ slotProps.option.nome }}</span>
                            <small v-if="slotProps.option.total_municipes != null" class="text-color-secondary">
                                {{ slotProps.option.total_municipes }} contato(s)
                            </small>
                        </div>
                    </template>
                </MultiSelect>
            </div>
            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="dialogoMailingVisivel = false" :disabled="salvandoPorMailing" />
                <Button
                    label="Adicionar à lista"
                    icon="pi pi-check"
                    @click="adicionarPorMailingList"
                    :disabled="!mailingListsSelecionadas?.length"
                    :loading="salvandoPorMailing"
                />
            </template>
        </Dialog>

    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import eventosService from '@/services/eventos';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useAuthStore } from '@/stores/auth';

// Imports de todos os componentes PrimeVue que vamos usar
import AutoComplete from 'primevue/autocomplete';
import Toolbar from 'primevue/toolbar';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputMask from 'primevue/inputmask';
import Calendar from 'primevue/calendar';
import Textarea from 'primevue/textarea';
import Tag from 'primevue/tag';
import MultiSelect from 'primevue/multiselect';
import Divider from 'primevue/divider';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const authStore = useAuthStore();

const comunicacaoId = ref(route.params.id);
const eventoId = ref(null);

const loading = ref(true);
const loadingDestinatarios = ref(false);
const enviando = ref(false);
const gerandoPdf = ref(false);
const evento = ref({});
const comunicacao = ref({});
const destinatarios = ref([]);
const logs = ref([]);
const abaAtiva = ref(0);
const loadingLogs = ref(false);
const logsCarregados = ref(false);
const destinatariosTotal = ref(0);
const destinatariosFirst = ref(0);
const destinatariosPage = ref(1);
const destinatariosPageSize = ref(100);
const logsTotal = ref(0);
const logsFirst = ref(0);
const logsPage = ref(1);
const logsPageSize = ref(100);

// --- Refs para os Modals (lógica transplantada) ---
const dialogoAdicionarVisivel = ref(false);
const dialogoCategoriaVisivel = ref(false);
const dialogoMailingVisivel = ref(false);

const municipeSelecionado = ref(null);
const sugestoesMunicipes = ref([]);
let searchTimeout = null;
const categorias = ref([]);
const categoriasSelecionadas = ref([]);
const loadingCategorias = ref(false);
const salvandoPorCategoria = ref(false);
const loadingMailings = ref(false);
const mailingLists = ref([]);
const mailingListsSelecionadas = ref([]);
const salvandoPorMailing = ref(false);

const mailingListsContaEvento = computed(() => {
    const cid = evento.value?.conta;
    const listas = mailingLists.value || [];
    if (cid == null || cid === '') {
        return listas;
    }
    const n = Number(cid);
    return listas.filter((m) => Number(m.conta) === n);
});

const normalizarLista = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
};

const atualizarListaPaginada = (responseData, targetRef, totalRef) => {
    const lista = normalizarLista(responseData);
    targetRef.value = lista;
    if (responseData && typeof responseData?.count === 'number') {
        totalRef.value = responseData.count;
    } else {
        totalRef.value = lista.length;
    }
};

const carregarDestinatarios = async () => {
    loadingDestinatarios.value = true;
    try {
        const destinatariosRes = await eventosService.getDestinatarios(comunicacaoId.value, {
            page: destinatariosPage.value,
            page_size: destinatariosPageSize.value,
        });
        atualizarListaPaginada(destinatariosRes?.data, destinatarios, destinatariosTotal);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar destinatários.', life: 3000 });
    } finally {
        loadingDestinatarios.value = false;
    }
};

const carregarLogs = async (force = false) => {
    if (!force && (loadingLogs.value || logsCarregados.value)) return;
    loadingLogs.value = true;
    try {
        const logsRes = await eventosService.getLogsDeEnvio(comunicacaoId.value, {
            page: logsPage.value,
            page_size: logsPageSize.value,
        });
        atualizarListaPaginada(logsRes?.data, logs, logsTotal);
        logsCarregados.value = true;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar logs de envio.', life: 3000 });
    } finally {
        loadingLogs.value = false;
    }
};

const onTabChange = async (event) => {
    if (event?.index === 1) {
        await carregarLogs();
    }
};

const onDestinatariosPage = async (event) => {
    destinatariosFirst.value = event.first;
    destinatariosPageSize.value = event.rows;
    destinatariosPage.value = Math.floor(event.first / event.rows) + 1;
    await carregarDestinatarios();
};

const onLogsPage = async (event) => {
    logsFirst.value = event.first;
    logsPageSize.value = event.rows;
    logsPage.value = Math.floor(event.first / event.rows) + 1;
    await carregarLogs(true);
};

// --- FUNÇÃO DE CARREGAMENTO PRINCIPAL ---
// Dentro do <script setup>

const carregarDados = async () => {
    if (!authStore.isAuthenticated) {
        loading.value = false;
        return;
    }
    loading.value = true;
    try {
        const comunicacaoRes = await eventosService.getComunicacao(comunicacaoId.value);
        comunicacao.value = comunicacaoRes.data;
        eventoId.value = comunicacao.value.evento.id;        

        // Carrega só dados essenciais no primeiro paint.
        const [eventoRes] = await Promise.all([
            eventosService.getEvento(eventoId.value),
        ]);
        
        evento.value = eventoRes.data;
        await carregarDestinatarios();
        logs.value = [];
        logsCarregados.value = false;
        logsTotal.value = 0;

    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar dados da página.' });
    } finally {
        loading.value = false;
    }
};

onMounted(carregarDados);

const confirmarEnvio = () => {
    confirm.require({
        message: `Você está prestes a enviar esta comunicação para ${destinatariosTotal.value} destinatário(s). Esta ação não pode ser desfeita. Deseja continuar?`,
        header: 'Confirmar Envio em Massa',
        icon: 'pi pi-send',
        acceptLabel: 'Sim, enviar',
        rejectLabel: 'Cancelar',
        accept: () => enviar()
    });
};

const enviar = async () => {
    enviando.value = true;
    try {
        const response = await eventosService.enviarComunicacao(comunicacaoId.value);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: response.data.status || 'Comunicação enviada para a fila de processamento!', life: 3000 });
        carregarDados();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível iniciar o envio.', life: 3000 });
    } finally {
        enviando.value = false;
    }
}

const abrirDialogoAdicionar = () => {
    municipeSelecionado.value = null;
    sugestoesMunicipes.value = [];
    dialogoAdicionarVisivel.value = true;
};

const buscarMunicipes = (event) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        if (event.query.trim()) {
            try {
                sugestoesMunicipes.value = (await eventosService.searchMunicipes(event.query)).data;
            } catch (error) { console.error("Erro ao buscar munícipes:", error); }
        }
    }, 300);
};

const adicionarDestinatario = async () => {
    if (!municipeSelecionado.value) return;

    if (!municipeSelecionado.value.emails || municipeSelecionado.value.emails.length === 0 || !municipeSelecionado.value.emails[0].email) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Este contato não possui um e-mail cadastrado e não pode ser adicionado.', life: 3000 });
        return;
    }

    try {
        const payload = {
            comunicacao: comunicacaoId.value, 
            municipe_id: municipeSelecionado.value.id
        };
        await eventosService.addDestinatario(payload);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Destinatário adicionado!', life: 3000 });
        dialogoAdicionarVisivel.value = false;
        carregarDados();
    } catch (error) {
        const errorMsg = error.response?.data?.non_field_errors?.[0] || 'Este contato já está na lista.';
        toast.add({ severity: 'error', summary: 'Erro', detail: errorMsg, life: 3000 });
    }
};

const abrirDialogoCategoria = async () => {
    loadingCategorias.value = true;
    categoriasSelecionadas.value = [];
    dialogoCategoriaVisivel.value = true;
    try {
        const response = await eventosService.getCategorias();
        categorias.value = Array.isArray(response.data) ? response.data : response.data.results;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar as categorias.', life: 3000 });
        dialogoCategoriaVisivel.value = false;
    } finally {
        loadingCategorias.value = false;
    }
};

const adicionarPorCategoria = async () => {
    if (!categoriasSelecionadas.value?.length) return;
    salvandoPorCategoria.value = true;
    try {
        const ids = categoriasSelecionadas.value.map((c) => c.id);
        const response = await eventosService.addDestinatariosPorCategorias(comunicacaoId.value, ids);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: response.data.status, life: 4000 });
        dialogoCategoriaVisivel.value = false;
        carregarDados();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao adicionar destinatários.', life: 3000 });
    } finally {
        salvandoPorCategoria.value = false;
    }
};

const abrirDialogoMailing = async () => {
    loadingMailings.value = true;
    mailingListsSelecionadas.value = [];
    dialogoMailingVisivel.value = true;
    try {
        const response = await eventosService.getMailingLists();
        const raw = response.data;
        mailingLists.value = Array.isArray(raw) ? raw : raw?.results ?? [];
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar as listas de mailing.', life: 3000 });
        dialogoMailingVisivel.value = false;
    } finally {
        loadingMailings.value = false;
    }
};

const adicionarPorMailingList = async () => {
    if (!mailingListsSelecionadas.value?.length) return;
    salvandoPorMailing.value = true;
    try {
        const ids = mailingListsSelecionadas.value.map((m) => m.id);
        const response = await eventosService.addDestinatariosPorMailingLists(comunicacaoId.value, ids);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: response.data.status, life: 4000 });
        dialogoMailingVisivel.value = false;
        await carregarDados();
    } catch (error) {
        const errorMsg = error.response?.data?.error || 'Não foi possível adicionar os contatos da lista.';
        toast.add({ severity: 'error', summary: 'Erro', detail: errorMsg, life: 3000 });
    } finally {
        salvandoPorMailing.value = false;
    }
};

const confirmarDeleteDestinatario = (destinatario) => {
    confirm.require({
        message: `Tem certeza que deseja remover "${destinatario.municipe.nome_completo}" da lista de destinatários?`,
        header: 'Confirmar Remoção',
        accept: () => deletarDestinatario(destinatario.id),
    });
};

const deletarDestinatario = async (id) => {
    try {
        await eventosService.deleteDestinatario(id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Destinatário removido.', life: 3000 });
        carregarDados();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível remover.', life: 3000 });
    }
};

const getEmailPrincipal = (emails) => {
    if (!emails || emails.length === 0) return 'Nenhum e-mail';
    const principal = emails.find(e => e.tipo === 'principal');
    return principal ? principal.email : emails[0].email;
};

const gerarRelatorioPdf = async () => {
    gerandoPdf.value = true;
    try {
        const response = await eventosService.getRelatorioComunicacaoPdf(comunicacaoId.value);
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `relatorio_comunicacao_${comunicacao.value.titulo?.replace(/[^a-z0-9]/gi, '_') || 'comunicacao'}.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Relatório gerado com sucesso!', life: 3000 });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o relatório PDF.', life: 3000 });
    } finally {
        gerandoPdf.value = false;
    }
};
</script>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
</style>