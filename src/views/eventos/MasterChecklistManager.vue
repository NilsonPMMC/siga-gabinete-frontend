<template>
    <div class="page-container">
        <Toast />
        <ConfirmDialog></ConfirmDialog>

        <header class="page-header">
            <div class="flex align-items-center mb-4">
                <router-link to="/configuracoes">
                    <Button icon="pi pi-arrow-left" severity="secondary" text rounded />
                </router-link>
                <div v-if="!loading" class="ml-2">
                    <h1 class="mb-0">Itens Mestres de Checklist</h1>
                    <p class="mt-1 text-color-secondary">Gerencie aqui a lista global de itens que podem ser selecionados nos checklists dos eventos.</p>
                </div>
            </div>
            <div class="flex align-items-center gap-3">
                <Button label="Adicionar Novo Item" icon="pi pi-plus" @click="abrirModalNovo" />
            </div>
        </header>

        <DataTable :value="itens" :loading="loading"  paginator :rows="25" responsiveLayout="scroll">
            <Column field="nome" header="Nome do Item">
                <template #body="slotProps">
                    <Button :label="slotProps.data.nome" class="p-button-text p-button-plain text-left" @click="abrirModalEdicao(slotProps.data)" />
                </template>
            </Column>
            <Column headerStyle="width: 10rem; text-align: center" bodyStyle="text-align: center">
                <template #body="slotProps">
                    <Button icon="pi pi-pencil" text rounded severity="primary" @click="abrirModalEdicao(slotProps.data)" title="Editar" />
                    <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmarExclusao(slotProps.data)" title="Excluir" />
                </template>
            </Column>
        </DataTable>

        <Dialog v-model:visible="modalVisivel" :header="modalTitulo" :modal="true" style="width: 800px">
            <div class="field">
                <label for="nomeItem">Nome do Item</label>
                <InputText id="nomeItem" v-model.trim="itemEditado.nome" :class="{'p-invalid': submetido && !itemEditado.nome}" style="width: 100%; display: block" />
                <small v-if="submetido && !itemEditado.nome" class="p-error">O nome é obrigatório.</small>
            </div>

            <template #footer>
                <Button v-if="itemEditado.id" label="Excluir" icon="pi pi-trash" class="p-button-danger" @click="confirmarExclusao(itemEditado)" />
                <Button label="Cancelar" icon="pi pi-times" class="p-button-text" @click="fecharModal" />
                <Button label="Salvar" icon="pi pi-check" @click="salvarItem" />
            </template>
        </Dialog>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import eventosService from '@/services/eventos';

import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';

const toast = useToast();
const confirm = useConfirm();

const itens = ref([]);
const loading = ref(true);
const modalVisivel = ref(false);
const modalTitulo = ref('');
const itemEditado = ref({});
const submetido = ref(false);

const carregarItens = async () => {
    loading.value = true;
    try {
        const response = await eventosService.getMasterChecklistItems();
        itens.value = response.data;
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os itens.', life: 3000 });
    } finally {
        loading.value = false;
    }
};

onMounted(carregarItens);

const abrirModalNovo = () => {
    itemEditado.value = {};
    submetido.value = false;
    modalTitulo.value = 'Adicionar Novo Item Mestre';
    modalVisivel.value = true;
};

const abrirModalEdicao = (item) => {
    itemEditado.value = { ...item };
    submetido.value = false;
    modalTitulo.value = 'Editar Item Mestre';
    modalVisivel.value = true;
};

const fecharModal = () => {
    modalVisivel.value = false;
};

const salvarItem = async () => {
    submetido.value = true;
    if (!itemEditado.value.nome) {
        return;
    }

    try {
        if (itemEditado.value.id) {
            // Atualizar
            await eventosService.updateMasterChecklistItem(itemEditado.value.id, { nome: itemEditado.value.nome });
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Item atualizado!', life: 3000 });
        } else {
            // Criar
            await eventosService.createMasterChecklistItem({ nome: itemEditado.value.nome });
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Item criado!', life: 3000 });
        }
        fecharModal();
        carregarItens(); // Recarrega a lista
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar o item.', life: 3000 });
    }
};

const confirmarExclusao = (item) => {
    confirm.require({
        message: `Tem certeza que deseja excluir o item "${item.nome}"? Esta ação não pode ser desfeita.`,
        header: 'Confirmação de Exclusão',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sim, excluir',
        rejectLabel: 'Cancelar',
        accept: async () => {
            try {
                await eventosService.deleteMasterChecklistItem(item.id);
                toast.add({ severity: 'info', summary: 'Excluído', detail: 'Item excluído com sucesso.', life: 3000 });
                fecharModal();
                carregarItens();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir o item. Ele pode estar em uso em algum checklist.', life: 4000 });
            }
        }
    });
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