<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <h5><i class="pi pi-bookmark"></i> Lembretes</h5>

                <Toolbar class="mb-4">
                    <template v-slot:start>
                        <div class="my-2">
                            <Button label="Novo Lembrete" icon="pi pi-plus" class="p-button-success" @click="router.push('/lembretes/novo')" />
                        </div>
                    </template>
                </Toolbar>

                <div class="p-fluid formgrid grid mb-4 align-items-end">
                    <div class="field col-12 md:col-5">
                        <label for="data_inicio">De:</label>
                        <Calendar v-model="filtros.data_inicio" dateFormat="dd/mm/yy" showIcon />
                    </div>
                    <div class="field col-12 md:col-5">
                        <label for="data_fim">Até:</label>
                        <Calendar v-model="filtros.data_fim" dateFormat="dd/mm/yy" showIcon />
                    </div>
                    <div class="field col-12 md:col-2">
                        <Button icon="pi pi-filter" label="Filtrar" class="p-button-primary w-100" @click="fetchLembretes" />
                    </div>
                </div>

                <DataView :value="lembretes" :layout="'grid'" :paginator="true" :rows="9" :loading="loading" dataKey="id">
                    <template #grid="slotProps">
                        <div class="col-12 md:col-6 lg:col-4 p-2">
                            <div class="card h-100 d-flex flex-column shadow-1">
                                <div class="card-header">
                                    <h6 class="mb-0 text-primary">{{ slotProps.data.titulo }}</h6>
                                </div>
                                <div class="card-body" style="flex-grow: 1;">
                                    <div class="text-muted mb-2 small">
                                        <div><i class="pi pi-building me-2"></i>{{ slotProps.data.conta_nome }}</div>
                                        <div><i class="pi pi-calendar me-2"></i>{{ formatarData(slotProps.data.data_criacao) }}</div>
                                    </div>
                                    <div class="card-text-resumo" v-html="resumirConteudo(slotProps.data.conteudo)"></div>
                                </div>
                                <div class="card-footer d-flex justify-content-end bg-light">
                                    <Button icon="pi pi-pencil" class="p-button-rounded p-button-info me-2" @click="router.push(`/lembretes/editar/${slotProps.data.id}`)" />
                                    <Button icon="pi pi-trash" class="p-button-rounded p-button-danger" @click="confirmarExclusao(slotProps.data.id)" />
                                </div>
                            </div>
                        </div>
                    </template>
                    <template #empty>
                        <div class="text-center p-4">Nenhum lembrete encontrado para o período selecionado.</div>
                    </template>
                </DataView>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '@/api';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

const lembretes = ref([]);
const loading = ref(true);
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

const hoje = new Date();
const filtros = ref({
    data_inicio: hoje,
    data_fim: hoje
});

const formatarDataParaAPI = (data) => {
    if (!data) return null;
    try {
        const dt = new Date(data);
        if (isNaN(dt.getTime())) return null; // Retorna nulo se a data for inválida
        const ano = dt.getFullYear();
        const mes = (dt.getMonth() + 1).toString().padStart(2, '0');
        const dia = dt.getDate().toString().padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    } catch (e) {
        return null;
    }
};

const fetchLembretes = async () => {
    loading.value = true;
    try {
        const params = {
            data_inicio: formatarDataParaAPI(filtros.value.data_inicio),
            data_fim: formatarDataParaAPI(filtros.value.data_fim)
        };

        // Remove parâmetros nulos para não enviar à API
        Object.keys(params).forEach(key => params[key] === null && delete params[key]);

        const response = await api.get('/lembretes/', { params });
        // O backend agora retorna uma lista direta, então não precisamos mais de ".results"
        lembretes.value = Array.isArray(response.data) ? response.data : [];
    } catch (error) {
        console.error("Erro ao buscar lembretes:", error);
        toast.add({ severity: 'error', summary: 'Erro de Rede', detail: 'Não foi possível carregar os lembretes.', life: 3000 });
        lembretes.value = []; // Garante que a lista fique vazia em caso de erro
    } finally {
        loading.value = false;
    }
};

const confirmarExclusao = (id) => {
    confirm.require({
        message: 'Tem certeza que deseja excluir este lembrete?',
        header: 'Confirmação de Exclusão',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sim',
        rejectLabel: 'Não',
        acceptClass: 'p-button-danger',
        accept: () => {
            deleteLembrete(id);
        }
    });
};

const deleteLembrete = async (id) => {
    try {
        await api.delete(`/lembretes/${id}/`);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Lembrete excluído!', life: 3000 });
        fetchLembretes();
    } catch (error) {
        console.error("Erro ao excluir lembrete:", error);
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao excluir o lembrete.', life: 3000 });
    }
};

const formatarData = (dataISO) => {
    if (!dataISO) return '';
    const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dataISO).toLocaleDateString('pt-BR', options);
};

const resumirConteudo = (html) => {
    if (typeof html !== 'string' || !html) {
        return '<i>(sem conteúdo)</i>';
    }
    const texto = html.replace(/<[^>]+>/g, '').trim();
    if (!texto) return '<i>(sem conteúdo)</i>';
    return texto.length > 120 ? texto.substring(0, 120) + '...' : texto;
};

onMounted(fetchLembretes);
</script>

<style scoped>
.card-text-resumo {
    height: 100px;
    overflow-y: auto;
    font-size: 0.9rem;
    color: var(--text-color-secondary);
    line-height: 1.4;
    white-space: pre-wrap;
    word-wrap: break-word;
}
</style>