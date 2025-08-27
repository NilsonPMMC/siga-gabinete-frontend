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
                    <h1 class="mb-0">Gestão do Checklist do Evento</h1>
                    <p class="mt-1 text-color-secondary">{{ checklist.evento.nome }}</p>
                </div>
            </div>
            <div class="flex align-items-center gap-3">
                <Button 
                    label="Ver Link Público" 
                    icon="pi pi-link" 
                    class="p-button-outlined" 
                    @click="showLinkPanel = !showLinkPanel" 
                />
                <Button 
                    label="Gerar Relatório (PDF)" 
                    icon="pi pi-file-pdf" 
                    class="p-button-danger"
                    @click="baixarRelatorio"
                    :loading="downloadingPdf"
                />
            </div>
        </header>

        <div class="card mt-4">
            <div v-if="loading">
                <Skeleton height="2rem" width="20rem" class="mb-4"></Skeleton>
                <Skeleton height="20rem"></Skeleton>
            </div>

            <div v-else-if="error">
                <Message severity="error" :closable="false">{{ error }}</Message>
            </div>

            <div v-else>
                <Panel v-if="showLinkPanel" header="Link Público para Preenchimento Externo" class="mb-4" toggleable>
                     <p class="mt-0 mb-3">Envie este link para que uma pessoa fora do SIGA possa preencher o checklist.</p>
                    <div class="p-inputgroup mb-3">
                        <InputText :value="publicUrl" readonly />
                        <Button icon="pi pi-copy" @click="copyToClipboard" />
                    </div>
                    <Button 
                        label="Renovar Link (Invalida o link atual)" 
                        icon="pi pi-refresh" 
                        class="p-button-warning p-button-sm"
                        @click="confirmarRenovacao"
                    />
                </Panel>

                <DataTable :value="tabelaItens" v-model:selection="itensSelecionados" dataKey="master_id" responsiveLayout="scroll">
                    <Column selectionMode="multiple" headerStyle="width: 3.5em"></Column>
                    <Column field="nome" header="Item"></Column>
                    <Column header="Concluído" headerStyle="width: 8em; text-align: center" bodyStyle="text-align: center">
                        <template #body="slotProps">
                            <Checkbox v-model="slotProps.data.concluido" @change="salvarItem(slotProps.data)" :disabled="!isSelecionado(slotProps.data)" :binary="true" />
                        </template>
                    </Column>
                    <Column field="observacoes" header="Observações/Dados" style="width: 60%">
                        <template #body="slotProps">
                            <Textarea v-model="slotProps.data.observacoes" @blur="salvarItem(slotProps.data)" :disabled="!isSelecionado(slotProps.data)" placeholder="Selecione o item para editar" rows="2" class="w-full" />
                        </template>
                    </Column>
                </DataTable>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from "primevue/useconfirm";
import eventosService from '@/services/eventos';

import Skeleton from 'primevue/skeleton';
import Message from 'primevue/message';
import Button from 'primevue/button';
import Panel from 'primevue/panel';
import InputText from 'primevue/inputtext';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Checkbox from 'primevue/checkbox';
import Textarea from 'primevue/textarea';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';

const route = useRoute();
const toast = useToast();
const confirm = useConfirm();

const loading = ref(true);
const error = ref(null);
const checklist = ref(null);
const showLinkPanel = ref(false);
const tabelaItens = ref([]);
const itensSelecionados = ref([]);
const downloadingPdf = ref(false);
let isInternalChange = false;

const loadChecklistData = async (eventoId) => {
    loading.value = true;
    error.value = null;
    tabelaItens.value = [];
    itensSelecionados.value = [];

    try {
        const [checklistResponse, masterItemsResponse] = await Promise.all([
            eventosService.getChecklist(eventoId),
            eventosService.getMasterChecklistItems()
        ]);

        if (!checklistResponse.data || checklistResponse.data.length === 0) {
            throw new Error("Nenhum checklist foi encontrado para este evento.");
        }
        checklist.value = checklistResponse.data[0];
        
        const itensJaNoChecklist = checklist.value.itens_status || [];
        const novaTabelaItens = masterItemsResponse.data.map(itemMestre => {
            const itemExistente = itensJaNoChecklist.find(i => i.item_mestre.id === itemMestre.id);
            return {
                master_id: itemMestre.id,
                nome: itemMestre.nome,
                concluido: itemExistente ? !!itemExistente.concluido : false,
                observacoes: itemExistente ? itemExistente.observacoes : '',
                status_id: itemExistente ? itemExistente.id : null
            };
        });
        tabelaItens.value = novaTabelaItens;
        
        isInternalChange = true;
        itensSelecionados.value = tabelaItens.value.filter(item => item.status_id !== null);
        
    } catch (err) {
        console.error(`Erro ao carregar dados para o evento ${eventoId}:`, err);
        error.value = "Não foi possível carregar os dados. Verifique o console para mais detalhes.";
    } finally {
        loading.value = false;
        setTimeout(() => { isInternalChange = false; }, 100);
    }
};

watch(() => route.params.id, (newId) => {
    if (newId) {
        loadChecklistData(newId);
    }
}, { immediate: true });

watch(itensSelecionados, (novaSelecao, selecaoAntiga) => {
    if (loading.value || isInternalChange) return;

    const adicionados = novaSelecao.filter(itemNovo => !selecaoAntiga.some(itemAntigo => itemAntigo.master_id === itemNovo.master_id));
    const removidos = selecaoAntiga.filter(itemAntigo => !novaSelecao.some(itemNovo => itemNovo.master_id === itemAntigo.master_id));
    
    adicionados.forEach(item => criarItem(item));
    removidos.forEach(item => removerItem(item));
});

const criarItem = async (item) => {
    if (item.status_id) return;
    try {
        const payload = { evento_checklist: checklist.value.id, item_mestre_id: item.master_id };
        const response = await eventosService.addChecklistItem(payload);
        const itemNaTabela = tabelaItens.value.find(i => i.master_id === item.master_id);
        if (itemNaTabela) itemNaTabela.status_id = response.data.id;
        toast.add({ severity: 'success', summary: 'Item Adicionado', life: 2000 });
    } catch (err) { toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível adicionar o item.', life: 3000 }); }
};

const removerItem = async (item) => {
    if (!item.status_id) return;
    try {
        await eventosService.deleteChecklistItem(item.status_id);
        const itemNaTabela = tabelaItens.value.find(i => i.master_id === item.master_id);
        if (itemNaTabela) {
            itemNaTabela.status_id = null;
            itemNaTabela.concluido = false;
            itemNaTabela.observacoes = '';
        }
        toast.add({ severity: 'info', summary: 'Item Removido', life: 2000 });
    } catch (err) { toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível remover o item.', life: 3000 }); }
};

const salvarItem = async (item) => {
    if (!isSelecionado(item) || !item.status_id) return;
    try {
        const payload = { concluido: item.concluido, observacoes: item.observacoes };
        await eventosService.updateChecklistItem(item.status_id, payload);
        toast.add({ severity: 'success', summary: 'Salvo', life: 1500 });
    } catch (err) { toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar as alterações.', life: 3000 }); }
};

const isSelecionado = (item) => itensSelecionados.value.some(sel => sel.master_id === item.master_id);

const publicUrl = computed(() => {
    return checklist.value ? `${window.location.origin}/public/checklist/${checklist.value.token}` : '';
});

const copyToClipboard = () => {
    navigator.clipboard.writeText(publicUrl.value).then(() => {
        toast.add({ severity: 'success', summary: 'Link Copiado!', life: 3000 });
    });
};

const confirmarRenovacao = () => {
    confirm.require({
        message: 'Você tem certeza? O link antigo se tornará inválido e um novo será gerado. Os dados preenchidos anteriormente (se houver) serão limpos.',
        header: 'Confirmação para Renovar Link',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sim, renovar',
        rejectLabel: 'Cancelar',
        accept: () => {
            renovarToken();
        }
    });
};

const renovarToken = async () => {
    if (!checklist.value) return;
    try {
        const response = await eventosService.renewChecklistToken(checklist.value.id);
        checklist.value = response.data;
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'O link foi renovado. O link antigo não é mais válido.', life: 4000 });
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível renovar o link.', life: 3000 });
        console.error("Erro ao renovar token:", err);
    }
};

const baixarRelatorio = async () => {
    if (!checklist.value) return;
    downloadingPdf.value = true;
    try {
        const response = await eventosService.getChecklistReport(checklist.value.id);
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const contentDisposition = response.headers['content-disposition'];
        let fileName = `relatorio_checklist_${checklist.value.evento.id}.pdf`;
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
            if (fileNameMatch.length === 2)
                fileName = fileNameMatch[1];
        }
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o relatório.', life: 3000 });
        console.error("Erro ao baixar relatório:", err);
    } finally {
        downloadingPdf.value = false;
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