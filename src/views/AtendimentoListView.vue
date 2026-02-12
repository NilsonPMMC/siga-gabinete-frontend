<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/api';
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";

const authStore = useAuthStore();
const router = useRouter();
const confirm = useConfirm();
const toast = useToast();

const isLoading = ref(true);
const todosAtendimentos = ref([]);
const atendimentosNaTela = ref([]);
const filtroTexto = ref('');
const filtroStatus = ref(null);
const filtroConta = ref(null);
const contasOptions = ref([]);
const statusOptions = ref([
    { label: 'Todos', value: null },
    { label: 'Aberto', value: 'ABERTO' },
    { label: 'Em Análise', value: 'EM_ANALISE' },
    { label: 'Encaminhado', value: 'ENCAMINHADO' },
    { label: 'Concluído', value: 'CONCLUIDO' },
    { label: 'Arquivado', value: 'ARQUIVADO' },
]);

onMounted(async () => {
    if (!authStore.isAuthenticated) return;
    isLoading.value = true;
    try {
        const [atendimentosRes, contasRes] = await Promise.all([
            apiClient.get('/api/atendimentos/'),
            apiClient.get('/api/contas/')
        ]);
        todosAtendimentos.value = atendimentosRes.data;
        atendimentosNaTela.value = atendimentosRes.data;
        contasOptions.value = contasRes.data.map(conta => ({ label: conta.nome, value: conta.id }));
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os atendimentos.' });
    } finally {
        isLoading.value = false;
    }
});

const getStatusSeverity = (status) => {
    const map = { 
        'ABERTO': 'info', 
        'EM_ANALISE': 'warning', 
        'ENCAMINHADO': 'warning',
        'CONCLUIDO': 'success', 
        'ARQUIVADO': 'secondary' 
    };
    return map[status] || 'secondary';
};

const aplicarFiltros = async () => {
    isLoading.value = true;
    try {
        const params = {};
        if (filtroTexto.value) params.q = filtroTexto.value;
        if (filtroStatus.value) params.status = filtroStatus.value;
        if (filtroConta.value) params.conta_id = filtroConta.value;

        const response = await apiClient.get('/api/atendimentos/', { params });
        atendimentosNaTela.value = response.data;
        todosAtendimentos.value = response.data; // Atualiza também a lista completa
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível aplicar os filtros.' });
    } finally {
        isLoading.value = false;
    }
};

const limparFiltros = async () => {
    filtroTexto.value = '';
    filtroStatus.value = null;
    filtroConta.value = null;
    isLoading.value = true;
    try {
        const response = await apiClient.get('/api/atendimentos/');
        todosAtendimentos.value = response.data;
        atendimentosNaTela.value = response.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível recarregar os atendimentos.' });
    } finally {
        isLoading.value = false;
    }
};

const verDetalhes = (id) => router.push(`/atendimentos/${id}`);
const editarAtendimento = (id) => router.push(`/atendimentos/editar/${id}`);
const irParaNovoAtendimento = () => router.push('/atendimentos/novo');

const confirmarExclusao = (atendimento) => {
    confirm.require({
        message: `Tem certeza que deseja excluir o protocolo ${atendimento.protocolo}?`,
        header: 'Confirmação de Exclusão',
        icon: 'pi pi-exclamation-triangle',
        acceptClassName: 'p-button-danger',
        accept: () => {
            apiClient.delete(`/api/atendimentos/${atendimento.id}/`)
                .then(() => {
                    todosAtendimentos.value = todosAtendimentos.value.filter(a => a.id !== atendimento.id);
                    atendimentosNaTela.value = atendimentosNaTela.value.filter(a => a.id !== atendimento.id);
                    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Atendimento excluído!', life: 3000 });
                })
                .catch(error => {
                    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir o atendimento.', life: 4000 });
                });
        },
    });
};

const podeVerDetalhes = () => !authStore.isRecepcao;
const podeEditarOuExcluirAtendimento = (atendimento) => authStore.user?.is_superuser || !authStore.isRecepcao || (authStore.isRecepcao && atendimento.status === 'ABERTO');
</script>

<template>
  <ConfirmDialog></ConfirmDialog>
  <Toast />
  <div class="page-container">
    <header class="page-header">
      <h1>Atendimentos</h1>
      <Button label="Novo Atendimento" icon="pi pi-plus" @click="irParaNovoAtendimento" class="p-button-success" />
    </header>

    <Card class="mb-4">
      <template #title>Filtros de Busca</template>
      <template #content>
        <div class="grid formgrid p-fluid align-items-end">
          <div class="field col-12 md:col-5">
            <label for="filtroTexto">Buscar por Protocolo, Título, Nome do Munícipe ou Nome Fantasia</label>
            <InputText id="filtroTexto" v-model="filtroTexto" placeholder="Digite aqui..." @keyup.enter="aplicarFiltros" />
          </div>
          <div class="field col-12 md:col-3">
            <label for="filtroStatus">Status</label>
            <Dropdown id="filtroStatus" v-model="filtroStatus" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Todos" showClear @change="aplicarFiltros" />
          </div>
          <div class="field col-12 md:col-3" v-if="authStore.user?.is_superuser || authStore.isRecepcao">
            <label for="filtroConta">Gabinete</label>
            <Dropdown id="filtroConta" v-model="filtroConta" :options="contasOptions" optionLabel="label" optionValue="value" placeholder="Todos" showClear @change="aplicarFiltros" />
          </div>
          <div class="field col-12 md:col-4 flex justify-content-start gap-2">
            <Button label="Filtrar" icon="pi pi-filter" @click="aplicarFiltros" />
            <Button label="Limpar" icon="pi pi-times" @click="limparFiltros" class="p-button-secondary" />
          </div>
        </div>
      </template>
    </Card>

    <main>
      <DataTable :value="atendimentosNaTela" :loading="isLoading" paginator :rows="15" responsiveLayout="scroll">
        <Column field="protocolo" header="Protocolo" sortable></Column>
        <Column field="data_criacao" header="Data" sortable>
          <template #body="slotProps">
            <div v-if="slotProps.data.data_criacao" class="data-formatada">
              <span>{{ new Date(slotProps.data.data_criacao).toLocaleDateString('pt-BR') }}</span>
              <small>{{ new Date(slotProps.data.data_criacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}</small>
            </div>
          </template>
        </Column>
        <Column field="titulo" header="Título" style="width: 40%"></Column>
        <Column field="nome_conta" header="Gabinete" sortable v-if="authStore.isRecepcao || authStore.user?.is_superuser"></Column>
        <Column field="nome_municipe" header="Munícipe" sortable>
          <template #body="slotProps">
            <RouterLink :to="`/municipes/${slotProps.data.municipe}/historico`">
              {{ slotProps.data.nome_municipe }}
            </RouterLink>
          </template>
        </Column>
        <Column field="status" header="Status" sortable>
          <template #body="slotProps">
            <Tag :value="slotProps.data.status.replace(/_/g, ' ')" :severity="getStatusSeverity(slotProps.data.status)" />
          </template>
        </Column>
        <Column header="Ações" style="width: 8rem; text-align: center; display:flex; justify-content: center;">
          <template #body="slotProps">
              <Button v-if="podeVerDetalhes()" icon="pi pi-eye" text rounded @click="verDetalhes(slotProps.data.id)" title="Ver Detalhes" />
              <Button v-if="podeEditarOuExcluirAtendimento(slotProps.data)" icon="pi pi-pencil" text rounded severity="secondary" @click="editarAtendimento(slotProps.data.id)" title="Editar" />
              <Button v-if="podeEditarOuExcluirAtendimento(slotProps.data)" icon="pi pi-trash" text rounded severity="danger" @click="confirmarExclusao(slotProps.data)" title="Excluir" />
          </template>
        </Column>
        <template #empty> Nenhum atendimento encontrado. </template>
      </DataTable>
    </main>
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.data-formatada {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  font-size: 0.9rem;
}
.data-formatada small {
  font-size: 0.8rem;
  color: #6c757d;
}
</style>