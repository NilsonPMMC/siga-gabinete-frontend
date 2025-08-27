<template>
    <div class="page-container">
        <Toast />
        <ConfirmDialog></ConfirmDialog>

        <header class="page-header">
            <div class="flex align-items-center gap-3">
                <router-link to="/mailings">
                    <Button icon="pi pi-arrow-left" severity="secondary" text rounded />
                </router-link>
                <div v-if="mailingList.nome">
                    <h1 class="mb-0">Gerenciar Contatos</h1>
                    <p class="mt-1 text-color-secondary">{{ mailingList.nome }}</p>
                </div>
            </div>
            <div class="flex align-items-center gap-2">
                <Button label="Adicionar por Categoria" icon="pi pi-users" class="p-button-info" @click="abrirDialogoCategoria" />
                <Button label="Adicionar Contato" icon="pi pi-plus" class="p-button-success" @click="abrirDialogoAdicionar" />
            </div>
        </header>

        <main>
            <DataTable :value="municipes" :loading="loading" responsiveLayout="scroll">
                <template #empty>Nenhum contato nesta lista.</template>
                <Column field="nome_completo" header="Nome" :sortable="true"></Column>
                <Column field="cargo" header="Cargo"></Column>
                <Column header="E-mail Principal">
                    <template #body="slotProps">
                        {{ getEmailPrincipal(slotProps.data.emails) }}
                    </template>
                </Column>
                <Column header="Ações" bodyClass="text-center" style="width: 8rem">
                    <template #body="slotProps">
                        <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmarDelete(slotProps.data)" title="Remover da Lista" />
                    </template>
                </Column>
            </DataTable>
        </main>

        <Dialog v-model:visible="dialogoAdicionarVisivel" header="Adicionar Contato à Lista" :modal="true" :style="{ width: '600px' }">
            <div class="field">
                <label for="municipe">Buscar Munícipe (deve ter e-mail)</label>
                <AutoComplete
                    id="municipe"
                    v-model="municipeSelecionado"
                    :suggestions="sugestoesMunicipes"
                    @complete="buscarMunicipes"
                    field="nome_completo"
                    placeholder="Digite para buscar..."
                    forceSelection
                    style="width: 100%;"
                >
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
            </div>
            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="dialogoAdicionarVisivel = false" />
                <Button label="Adicionar" icon="pi pi-check" @click="adicionarContato" :disabled="!municipeSelecionado" />
            </template>
        </Dialog>

        <Dialog v-model:visible="dialogoCategoriaVisivel" header="Adicionar Contatos por Categoria" :modal="true" :style="{ width: '500px' }">
            <div class="field">
                <label for="categoria-dropdown">Selecione a Categoria de Contato</label>
                <Dropdown
                    id="categoria-dropdown"
                    v-model="categoriaSelecionada"
                    :options="categorias"
                    optionLabel="nome"
                    placeholder="Selecione uma categoria"
                    class="w-full"
                    :loading="loadingCategorias"
                />
            </div>
            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="dialogoCategoriaVisivel = false" />
                <Button label="Adicionar Contatos" icon="pi pi-check" @click="adicionarPorCategoria" :disabled="!categoriaSelecionada" />
            </template>
        </Dialog>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import eventosService from '@/services/eventos';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import AutoComplete from 'primevue/autocomplete';
import Dropdown from 'primevue/dropdown';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';

const route = useRoute();
const toast = useToast();
const confirm = useConfirm();
const listId = route.params.id;

const mailingList = ref({});
const municipes = ref([]);
const loading = ref(true);
const dialogoAdicionarVisivel = ref(false);
const municipeSelecionado = ref(null);
const sugestoesMunicipes = ref([]);
let searchTimeout = null;

// Variáveis para o novo modal de categoria
const dialogoCategoriaVisivel = ref(false);
const categorias = ref([]);
const categoriaSelecionada = ref(null);
const loadingCategorias = ref(false);

const carregarDados = async () => {
    loading.value = true;
    try {
        const [listRes, municipesRes] = await Promise.all([
            eventosService.getMailingListDetail(listId),
            eventosService.getMunicipesOfMailingList(listId)
        ]);
        mailingList.value = listRes.data;
        municipes.value = municipesRes.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar dados da lista.' });
    } finally {
        loading.value = false;
    }
};

onMounted(carregarDados);

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
                const response = await eventosService.searchMunicipes(event.query);
                sugestoesMunicipes.value = response.data;
            } catch (error) { console.error("Erro ao buscar munícipes:", error); }
        }
    }, 300);
};

const adicionarContato = async () => {
    if (!municipeSelecionado.value) return;
    try {
        await eventosService.addMunicipeToMailingList(listId, municipeSelecionado.value.id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Contato adicionado!', life: 3000 });
        dialogoAdicionarVisivel.value = false;
        carregarDados();
    } catch (error) {
        const errorMsg = error.response?.data?.error || 'Não foi possível adicionar o contato.';
        toast.add({ severity: 'error', summary: 'Erro', detail: errorMsg, life: 3000 });
    }
};

const confirmarDelete = (municipe) => {
    confirm.require({
        message: `Tem certeza que deseja remover "${municipe.nome_completo}" desta lista?`,
        header: 'Confirmar Remoção',
        accept: () => deletarContato(municipe.id),
    });
};

const deletarContato = async (municipeId) => {
    try {
        await eventosService.removeMunicipeFromMailingList(listId, municipeId);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Contato removido.', life: 3000 });
        carregarDados();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível remover o contato.', life: 3000 });
    }
};

// --- NOVAS FUNÇÕES PARA ADICIONAR POR CATEGORIA ---
const abrirDialogoCategoria = async () => {
    loadingCategorias.value = true;
    try {
        const response = await eventosService.getCategorias();
        categorias.value = Array.isArray(response.data) ? response.data : response.data.results;
        categoriaSelecionada.value = null;
        dialogoCategoriaVisivel.value = true;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar as categorias.', life: 3000 });
    } finally {
        loadingCategorias.value = false;
    }
};

const adicionarPorCategoria = async () => {
    if (!categoriaSelecionada.value) return;
    try {
        const response = await eventosService.addMunicipesToMailingListByCategory(listId, categoriaSelecionada.value.id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: response.data.status, life: 4000 });
        dialogoCategoriaVisivel.value = false;
        carregarDados(); // Atualiza a lista de contatos na tela
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao adicionar contatos.', life: 3000 });
    }
};

const getEmailPrincipal = (emails) => {
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return 'N/A';
    }
    const principal = emails.find(e => e.tipo === 'principal');
    return principal ? principal.email : emails[0].email;
};
</script>

<style scoped>
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
