<template>
  <div class="page-container">
    <Toast />
    <ConfirmDialog></ConfirmDialog>

    <header class="page-header">
      <h1>Gestão de Ofícios</h1>
      <Button label="Novo Ofício" icon="pi pi-plus" @click="novoOficio" class="p-button-success" />
    </header>

    <main>
      <DataTable :value="oficios" :loading="isLoading" responsiveLayout="scroll" paginator :rows="10">
        <template #empty> Nenhum ofício encontrado. </template>
        
        <Column field="numero" header="Número" :sortable="true"></Column>
        <Column field="assunto" header="Assunto" :sortable="true" style="min-width: 300px"></Column>
        <Column field="destinatario_nome" header="Destinatário" :sortable="true"></Column>
        <Column field="data_documento" header="Data" :sortable="true">
          <template #body="slotProps">
            {{ new Date(slotProps.data.data_documento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) }}
          </template>
        </Column>
        <Column field="criado_por_nome" header="Criado por" :sortable="true"></Column>

        <Column header="Ações" style="width: 10rem">
          <template #body="slotProps">
            <Button icon="pi pi-pencil" text rounded severity="primary" @click="editarOficio(slotProps.data)" title="Editar" />
            <Button icon="pi pi-file-pdf" text rounded severity="secondary" @click="baixarPdf(slotProps.data)" title="Baixar PDF" />
            <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmarExclusao(slotProps.data)" title="Excluir" />
          </template>
        </Column>
      </DataTable>
    </main>
  </div>
</template>

<script setup>
import apiClient from '@/api';
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { getOficios, deleteOficio, gerarPdfOficio } from '@/services/oficios.js';

// Inicialização
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

// Estado do componente
const oficios = ref([]);
const isLoading = ref(true);

// Carregamento de dados
async function carregarOficios() {
  isLoading.value = true;
  try {
    const response = await getOficios();
    oficios.value = response.data.results || response.data;
  } catch (error) {
    console.error("Erro ao carregar ofícios:", error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar a lista de ofícios.' });
  } finally {
    isLoading.value = false;
  }
}

onMounted(carregarOficios);

// Funções de Ação
function novoOficio() {
  // Navega para a rota de criação que definimos
  router.push({ name: 'oficios-novo' });
}

function editarOficio(oficio) {
  // Navega para a rota de edição, passando o ID do ofício como parâmetro
  router.push({ name: 'oficios-editar', params: { id: oficio.id } });
}

async function baixarPdf(oficio) {
  toast.add({ severity: 'info', summary: 'Download', detail: 'Preparando PDF do ofício...' });
  try {
    const response = await gerarPdfOficio(oficio.id);
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `oficio_${oficio.numero.replace(/[/\\?%*:|"<>]/g, '-')}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error("Erro ao baixar PDF:", error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o PDF.' });
  }
}

function confirmarExclusao(oficio) {
  confirm.require({
    message: `Tem certeza que deseja excluir o ofício nº ${oficio.numero}?`,
    header: 'Confirmação de Exclusão',
    icon: 'pi pi-info-circle',
    acceptLabel: 'Excluir',
    rejectLabel: 'Cancelar',
    accept: async () => {
      try {
        await deleteOficio(oficio.id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Ofício excluído!' });
        carregarOficios(); // Recarrega a lista
      } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao excluir o ofício.' });
      }
    }
  });
}
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