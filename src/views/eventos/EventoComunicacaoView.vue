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
                        :disabled="destinatarios.length === 0"
                        v-tooltip.bottom="destinatarios.length === 0 ? 'Adicione destinatários antes de enviar' : ''"
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
                    <TabView>
                        <TabPanel header="Destinatários">
                            <Toolbar class="mb-4">
                                <template #start>
                                    <Button label="Adicionar Destinatário" icon="pi pi-plus" class="p-button-success mr-2" @click="abrirDialogoAdicionar" />
                                    <div class="flex gap-2">
                                        <Button label="Adicionar por Categoria" icon="pi pi-users" class="p-button-info p-button-sm" @click="abrirDialogoCategoria" />
                                        <Button label="Adicionar por Mailing" icon="pi pi-envelope" class="p-button-secondary p-button-sm" @click="abrirDialogoMailing" />
                                    </div>
                                </template>
                            </Toolbar>
                            <DataTable :value="destinatarios" :loading="loading" responsiveLayout="scroll">
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
                            <DataTable :value="logs" :loading="loading" responsiveLayout="scroll">
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

        <Dialog v-model:visible="dialogoCategoriaVisivel" header="Adicionar por Categoria" :modal="true" :style="{ width: '500px' }">
            <div class="field">
                <label for="categoria-dropdown">Selecione a Categoria</label>
                <Dropdown id="categoria-dropdown" v-model="categoriaSelecionada" :options="categorias" optionLabel="nome" placeholder="Selecione..." class="w-full" :loading="loadingCategorias" />
            </div>
            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="dialogoCategoriaVisivel = false" />
                <Button label="Adicionar" icon="pi pi-check" @click="adicionarPorCategoria" :disabled="!categoriaSelecionada" />
            </template>
        </Dialog>

        <Dialog v-model:visible="dialogoMailingVisivel" header="Adicionar por Lista de Mailing" :modal="true" :style="{ width: '500px' }">
            <div class="field">
                <label for="mailing-list-dropdown">Selecione a Lista de Mailing</label>
                <Dropdown id="mailing-list-dropdown" v-model="selectedMailingList" :options="mailingLists" optionLabel="nome" placeholder="Selecione..." class="w-full" :loading="loadingMailings" />
            </div>
            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="dialogoMailingVisivel = false" />
                <Button label="Adicionar" icon="pi pi-check" @click="adicionarPorMailingList" :disabled="!selectedMailingList" />
            </template>
        </Dialog>

    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import apiClient from '@/api';
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
import Dropdown from 'primevue/dropdown';
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
const enviando = ref(false);
const evento = ref({});
const comunicacao = ref({});
const destinatarios = ref([]);
const logs = ref([]);

// --- Refs para os Modals (lógica transplantada) ---
const dialogoAdicionarVisivel = ref(false);
const dialogoCategoriaVisivel = ref(false);
const dialogoMailingVisivel = ref(false);

const municipeSelecionado = ref(null);
const sugestoesMunicipes = ref([]);
let searchTimeout = null;
const categorias = ref([]);
const categoriaSelecionada = ref(null);
const loadingCategorias = ref(false);
const loadingMailings = ref(false);
const mailingLists = ref([]);
const selectedMailingList = ref(null);

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

        // Agora busca 3 coisas ao mesmo tempo
        const [eventoRes, destinatariosRes, logsRes] = await Promise.all([
            eventosService.getEvento(eventoId.value),
            eventosService.getDestinatarios(comunicacaoId.value),
            eventosService.getLogsDeEnvio(comunicacaoId.value)
        ]);
        
        destinatarios.value = destinatariosRes.data;
        evento.value = eventoRes.data;
        logs.value = logsRes.data;

    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar dados da página.' });
    } finally {
        loading.value = false;
    }
};

onMounted(carregarDados);

const confirmarEnvio = () => {
    confirm.require({
        message: `Você está prestes a enviar esta comunicação para ${destinatarios.value.length} destinatário(s). Esta ação não pode ser desfeita. Deseja continuar?`,
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
    dialogoCategoriaVisivel.value = true;
    try {
        const response = await eventosService.getCategorias();
        categorias.value = Array.isArray(response.data) ? response.data : response.data.results;
        categoriaSelecionada.value = null;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar as categorias.', life: 3000 });
        dialogoCategoriaVisivel.value = false;
    } finally {
        loadingCategorias.value = false;
    }
};

const adicionarPorCategoria = async () => {
    if (!categoriaSelecionada.value) return;
    try {
        const response = await eventosService.addDestinatariosPorCategoria(comunicacaoId.value, categoriaSelecionada.value.id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: response.data.status, life: 3000 });
        dialogoCategoriaVisivel.value = false;
        carregarDados();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao adicionar destinatários.', life: 3000 });
    }
};

const abrirDialogoMailing = async () => {
    loadingMailings.value = true;
    dialogoMailingVisivel.value = true;
    try {
        const response = await eventosService.getMailingLists();
        mailingLists.value = response.data;
        selectedMailingList.value = null;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar as listas de mailing.', life: 3000 });
        dialogoMailingVisivel.value = false;
    } finally {
        loadingMailings.value = false;
    }
};

const adicionarPorMailingList = async () => {
    if (!selectedMailingList.value) return;
    try {
        const response = await eventosService.addDestinatariosPorMailingList(comunicacaoId.value, selectedMailingList.value.id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: response.data.status, life: 4000 });
        dialogoMailingVisivel.value = false;
        await carregarDados(); // Alterado para carregar todos os dados para consistência
    } catch (error) {
        const errorMsg = error.response?.data?.error || 'Não foi possível adicionar os contatos da lista.';
        toast.add({ severity: 'error', summary: 'Erro', detail: errorMsg, life: 3000 });
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
</script>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
</style>