<template>
    <div class="page-container">
        <Toast />
        <ConfirmDialog></ConfirmDialog>

        <header class="page-header">
            <h1 class="mb-0">Gestão de Listas de Mailing</h1>
            <Button label="Criar Nova Lista" icon="pi pi-plus" class="p-button-success" @click="abrirModalNovaLista" />
        </header>

        <main>
            <DataTable :value="mailingLists" :loading="loading" responsiveLayout="scroll">
                <template #empty>Nenhuma lista de mailing criada.</template>
                
                <Column field="nome" header="Nome da Lista" :sortable="true"></Column>
                <Column field="total_municipes" header="Nº de Contatos" :sortable="true" style="width: 12rem"></Column>
                
                <Column header="Ações" bodyClass="text-center" style="width: 10rem">
                    <template #body="slotProps">
                        <Button icon="pi pi-users" text rounded @click="gerenciarContatos(slotProps.data)" title="Gerenciar Contatos" />
                        <Button icon="pi pi-pencil" text rounded severity="secondary" @click="abrirModalEdicao(slotProps.data)" title="Editar Nome" />
                        <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmarDelete(slotProps.data)" title="Excluir Lista" />
                    </template>
                </Column>
            </DataTable>
        </main>

        <Dialog v-model:visible="dialogoListaVisivel" :header="modalTitle" :modal="true" :style="{ width: '500px' }">
            <div class="p-fluid">
                <div class="field">
                    <label for="nomeLista">Nome da Lista</label>
                    <InputText id="nomeLista" v-model.trim="listaEmEdicao.nome" :class="{'p-invalid': submetido && !listaEmEdicao.nome}" />
                    <small v-if="submetido && !listaEmEdicao.nome" class="p-error">O nome é obrigatório.</small>
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="dialogoListaVisivel = false" />
                <Button label="Salvar" icon="pi pi-check" @click="salvarLista" />
            </template>
        </Dialog>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import eventosService from '@/services/eventos';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';

const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

const mailingLists = ref([]);
const loading = ref(true);
const dialogoListaVisivel = ref(false);
const modalTitle = ref('');
const listaEmEdicao = ref({});
const submetido = ref(false);

const carregarListas = async () => {
    loading.value = true;
    try {
        const response = await eventosService.getMailingLists();
        mailingLists.value = response.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar as listas de mailing.' });
    } finally {
        loading.value = false;
    }
};

onMounted(carregarListas);

const abrirModalNovaLista = () => {
    listaEmEdicao.value = {};
    submetido.value = false;
    modalTitle.value = 'Criar Nova Lista de Mailing';
    dialogoListaVisivel.value = true;
};

const abrirModalEdicao = (lista) => {
    listaEmEdicao.value = { ...lista };
    submetido.value = false;
    modalTitle.value = 'Editar Nome da Lista';
    dialogoListaVisivel.value = true;
};

const salvarLista = async () => {
    submetido.value = true;
    if (!listaEmEdicao.value.nome) return;

    try {
        if (listaEmEdicao.value.id) {
            await eventosService.updateMailingList(listaEmEdicao.value.id, { nome: listaEmEdicao.value.nome });
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Lista atualizada!', life: 3000 });
        } else {
            await eventosService.createMailingList({ nome: listaEmEdicao.value.nome });
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Lista criada!', life: 3000 });
        }
        dialogoListaVisivel.value = false;
        carregarListas();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar a lista.', life: 3000 });
    }
};

const confirmarDelete = (lista) => {
    confirm.require({
        message: `Tem certeza que deseja excluir a lista "${lista.nome}"?`,
        header: 'Confirmar Exclusão',
        icon: 'pi pi-exclamation-triangle',
        accept: () => deletarLista(lista.id),
    });
};

const deletarLista = async (id) => {
    try {
        await eventosService.deleteMailingList(id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Lista excluída.', life: 3000 });
        carregarListas();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir a lista.', life: 3000 });
    }
};

const gerenciarContatos = (lista) => {
    router.push({ name: 'mailing-list-detail', params: { id: lista.id } });
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