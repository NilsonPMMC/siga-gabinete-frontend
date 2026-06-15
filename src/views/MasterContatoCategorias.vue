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
                    <h1 class="mb-0">Categorias de Contatos</h1>
                    <p class="mt-1 text-color-secondary">Gerencie aqui as categorias dos contatos.</p>
                </div>
            </div>
            <div class="flex align-items-center gap-3">
                <div class="flex flex-column gap-2">
                    <MultiSelect
                        v-model="categoriasSelecionadasIds"
                        :options="categorias"
                        optionLabel="nome"
                        optionValue="id"
                        display="chip"
                        filter
                        :maxSelectedLabels="2"
                        selectedItemsLabel="{0} categorias"
                        placeholder="Categorias no relatório"
                        class="w-20rem"
                    />
                    <div class="flex gap-1">
                        <Button
                            label="Selecionar todas"
                            icon="pi pi-check-square"
                            class="p-button-text p-button-sm"
                            @click="selecionarTodasCategorias"
                            :disabled="!categorias.length || categoriasSelecionadasIds.length === categorias.length"
                        />
                        <Button
                            label="Limpar"
                            icon="pi pi-times"
                            class="p-button-text p-button-sm p-button-secondary"
                            @click="limparSelecaoCategorias"
                            :disabled="!categoriasSelecionadasIds.length"
                        />
                    </div>
                </div>
                <Button
                    label="Relatório CSV"
                    icon="pi pi-file-excel"
                    class="p-button-success p-button-outlined"
                    @click="exportarRelatorioCategoriasCsv"
                    :loading="isExportingCsv"
                />
                <Button
                    label="Relatório PDF"
                    icon="pi pi-file-pdf"
                    class="p-button-danger p-button-outlined"
                    @click="exportarRelatorioCategoriasPdf"
                    :loading="isExportingPdf"
                />
                <Button label="Adicionar Novo Item" icon="pi pi-plus" @click="abrirModalNovo" />
            </div>
        </header>

        <DataTable :value="categorias" :loading="loading" paginator :rows="25" responsiveLayout="scroll">
            <Column field="nome" header="Categoria">
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
                <label for="nomeItem">Categoria</label>
                <InputText id="nomeItem" v-model.trim="categoriaEditada.nome" :class="{'p-invalid': submetido && !categoriaEditada.nome}" style="width: 100%; display: block" />
                <small v-if="submetido && !categoriaEditada.nome" class="p-error">O nome da categoria é obrigatório.</small>
            </div>

            <template #footer>
                <Button v-if="categoriaEditada.id" label="Excluir" icon="pi pi-trash" class="p-button-danger" @click="confirmarExclusao(categoriaEditada)" />
                <Button label="Cancelar" icon="pi pi-times" class="p-button-text" @click="fecharModal" />
                <Button label="Salvar" icon="pi pi-check" @click="salvarCategoria" />
            </template>
        </Dialog>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
// Importe o serviço correto que criamos
import contatosService from '@/services/contatos'; 

// (Componentes PrimeVue já importados no seu código original)

const toast = useToast();
const confirm = useConfirm();

// CORREÇÃO 3: Padronização dos nomes das variáveis para maior clareza
const categorias = ref([]);
const loading = ref(true);
const modalVisivel = ref(false);
const categoriaEditada = ref({});
const submetido = ref(false);
const categoriasSelecionadasIds = ref([]);
const isExportingCsv = ref(false);
const isExportingPdf = ref(false);

const modalTitulo = computed(() => {
    return categoriaEditada.value.id ? 'Editar Categoria' : 'Adicionar Nova Categoria';
});

const carregarCategorias = async () => {
    loading.value = true;
    try {
        const response = await contatosService.getCategorias();
        categorias.value = response.data;
        if (!categoriasSelecionadasIds.value.length) {
            categoriasSelecionadasIds.value = categorias.value.map((c) => c.id);
        }
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar as categorias.', life: 3000 });
    } finally {
        loading.value = false;
    }
};

onMounted(carregarCategorias);

const abrirModalNovo = () => {
    // CORREÇÃO 4: Inicializar o objeto com as propriedades que o template espera
    categoriaEditada.value = { nome: '' }; 
    submetido.value = false;
    modalVisivel.value = true;
};

const abrirModalEdicao = (categoria) => {
    categoriaEditada.value = { ...categoria };
    submetido.value = false;
    modalVisivel.value = true;
};

const fecharModal = () => {
    modalVisivel.value = false;
};

const salvarCategoria = async () => {
    submetido.value = true;
    if (!categoriaEditada.value.nome || !categoriaEditada.value.nome.trim()) {
        return;
    }

    try {
        if (categoriaEditada.value.id) {
            await contatosService.updateCategoria(categoriaEditada.value.id, categoriaEditada.value);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Categoria atualizada!', life: 3000 });
        } else {
            await contatosService.createCategoria(categoriaEditada.value);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Categoria criada!', life: 3000 });
        }
        fecharModal();
        carregarCategorias();
    } catch (err) {
        const errorMsg = err.response?.data?.nome?.[0] || 'Não foi possível salvar a categoria.';
        toast.add({ severity: 'error', summary: 'Erro', detail: errorMsg, life: 4000 });
    }
};

const confirmarExclusao = (categoria) => {
    confirm.require({
        message: `Tem certeza que deseja excluir a categoria "${categoria.nome}"?`,
        header: 'Confirmação de Exclusão',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sim, excluir',
        rejectLabel: 'Cancelar',
        accept: async () => {
            try {
                await contatosService.deleteCategoria(categoria.id);
                toast.add({ severity: 'info', summary: 'Excluído', detail: 'Categoria excluída com sucesso.', life: 3000 });
                fecharModal();
                carregarCategorias();
            } catch (err) {
                toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir. A categoria pode estar em uso.', life: 4000 });
            }
        }
    });
};

const baixarBlob = (response, fallbackName) => {
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const cd = response.headers?.['content-disposition'];
    let fileName = fallbackName;
    if (cd) {
        const match = cd.match(/filename=\"?([^"]+)\"?/i);
        if (match?.[1]) fileName = match[1];
    }
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

const exportarRelatorioCategoriasCsv = async () => {
    isExportingCsv.value = true;
    try {
        const response = await contatosService.exportarRelatorioCategoriasCsv(categoriasSelecionadasIds.value);
        baixarBlob(response, 'relatorio_categorias_contatos.csv');
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o CSV.', life: 3500 });
    } finally {
        isExportingCsv.value = false;
    }
};

const exportarRelatorioCategoriasPdf = async () => {
    isExportingPdf.value = true;
    try {
        const response = await contatosService.exportarRelatorioCategoriasPdf(categoriasSelecionadasIds.value);
        baixarBlob(response, 'relatorio_categorias_contatos.pdf');
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o PDF.', life: 3500 });
    } finally {
        isExportingPdf.value = false;
    }
};

const selecionarTodasCategorias = () => {
    categoriasSelecionadasIds.value = categorias.value.map((c) => c.id);
};

const limparSelecaoCategorias = () => {
    categoriasSelecionadasIds.value = [];
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