<template>
    <div class="page-container">
        <Toast />
        <header class="page-header">
            <div class="flex align-items-center gap-3">
                <router-link to="/eventos">
                    <Button icon="pi pi-arrow-left" severity="secondary" text rounded />
                </router-link>
                <div>
                    <h1 class="mb-0">Lista de Presença</h1>
                    <p v-if="!loading" class="mt-1 text-color-secondary">{{ evento.nome }}</p>
                </div>
            </div>
        </header>

        <main>
            <div class="grid">
                <div class="col-12 md:col-6 lg:col-3">
                    <div class="surface-0 shadow-1 p-3 border-1 border-50 border-round">
                        <div class="flex justify-content-between mb-3">
                            <div>
                                <span class="block text-500 font-medium mb-3">Total de Presentes</span>
                                <div class="text-900 font-medium text-xl">{{ totalPresentes }}</div>
                            </div>
                            <div class="flex align-items-center justify-content-center bg-blue-100 border-round" style="width:2.5rem;height:2.5rem">
                                <i class="pi pi-users text-blue-500 text-xl"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mt-4">
                <DataTable :value="presentesFiltrados" :loading="loading" responsiveLayout="scroll">
                    <template #header>
                        <div class="flex justify-content-between align-items-center">
                            <span class="p-input-icon-left flex  align-items-center gap-3">
                                <i class="pi pi-search" />
                                <InputText v-model="filtroNome" placeholder="Filtrar por nome..." />
                            </span>
                            <Button label="Exportar (Excel)" icon="pi pi-file-excel" class="p-button-success" @click="exportar" :loading="exportando" />
                        </div>
                    </template>
                    <template #empty>Nenhuma presença registrada para este evento.</template>
                    
                    <Column field="nome_completo" header="Nome" sortable>
                        <template #body="slotProps">
                            <RouterLink :to="`/contatos/editar/${slotProps.data.municipe_id}`">
                            {{ slotProps.data.nome_completo }}
                            </RouterLink>
                        </template>
                    </Column>
                    <Column field="telefone" header="Telefone"></Column>
                    <Column field="email" header="E-mail"></Column>
                    <Column field="instituicao_orgao" header="Instituição/Órgão"></Column>
                    <Column field="data_registro" header="Data do Registro" :sortable="true">
                        <template #body="slotProps">
                            {{ new Date(slotProps.data.data_registro).toLocaleString('pt-BR') }}
                        </template>
                    </Column>
                </DataTable>
            </div>
        </main>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import eventosService from '@/services/eventos';
import { useToast } from "primevue/usetoast";
import { useAuthStore } from '@/stores/auth';

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

const route = useRoute();
const router = useRouter();
const toast = useToast();
const eventoId = route.params.id;
const authStore = useAuthStore();

const loading = ref(true);
const exportando = ref(false);
const evento = ref({});
const listaDePresenca = ref([]);
const filtroNome = ref('');

const totalPresentes = computed(() => listaDePresenca.value.length);

const presentesFiltrados = computed(() => {
    if (!filtroNome.value) {
        return listaDePresenca.value;
    }
    return listaDePresenca.value.filter(p => 
        p.nome_completo.toLowerCase().includes(filtroNome.value.toLowerCase())
    );
});

const carregarDados = async () => {
    if (!authStore.isAuthenticated) {
        loading.value = false;
        return;
    }
    loading.value = true;
    try {
        const [eventoRes, presencaRes] = await Promise.all([
            eventosService.getEvento(eventoId),
            eventosService.getListaDePresenca(eventoId)
        ]);
        evento.value = eventoRes.data;
        listaDePresenca.value = presencaRes.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar dados.' });
    } finally {
        loading.value = false;
    }
};

onMounted(carregarDados);

const exportar = async () => {
    exportando.value = true;
    try {
        const response = await eventosService.exportarListaDePresenca(eventoId, filtroNome.value);
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `presenca_${evento.value.nome}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar a planilha.', life: 3000 });
    } finally {
        exportando.value = false;
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