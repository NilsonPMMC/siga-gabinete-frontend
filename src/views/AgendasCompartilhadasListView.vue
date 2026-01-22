<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { useAuthStore } from '@/stores/auth';
import { format } from 'date-fns'; // Importação necessária para formatar as datas

const router = useRouter();
const isLoading = ref(true);
const agendasDisponiveis = ref([]);
const downloadingId = ref(null); 
const toast = useToast();
const authStore = useAuthStore();

// --- NOVOS ESTADOS PARA O DIALOG DE DATAS ---
const showDateDialog = ref(false);
const agendaSelecionada = ref(null);
const datasSelecionadas = ref(null); // Array [Inicio, Fim]
// ---------------------------------------------

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  
  await carregarAgendas();
});

const carregarAgendas = async () => {
  isLoading.value = true;
  try {
    const response = await apiClient.get('/api/agendas-compartilhadas/');
    agendasDisponiveis.value = response.data;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar a lista de agendas.', life: 4000 });
  } finally {
    isLoading.value = false;
  }
};

const navegarParaAgenda = (id) => {
    router.push(`/agendas-compartilhadas/${id}`);
};

// 1. Ao clicar no botão, ABRE O DIALOG (Não imprime direto)
const abrirDialogoImpressao = (agenda) => {
    agendaSelecionada.value = agenda;
    // Define padrão: Hoje até Hoje
    const hoje = new Date();
    datasSelecionadas.value = [hoje, hoje];
    showDateDialog.value = true;
};

// 2. Confirma e executa o download
const confirmarImpressao = async () => {
    if (!datasSelecionadas.value || !datasSelecionadas.value[0]) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione pelo menos uma data.', life: 3000 });
        return;
    }

    const agenda = agendaSelecionada.value;
    const dataInicio = datasSelecionadas.value[0];
    const dataFim = datasSelecionadas.value[1] ? datasSelecionadas.value[1] : dataInicio;

    showDateDialog.value = false; // Fecha modal
    downloadingId.value = agenda.id; // Ativa loading no botão específico
    
    toast.add({ severity: 'info', summary: 'Gerando PDF', detail: 'Processando relatório...', life: 2000 });

    try {
        const response = await apiClient.get('/api/relatorios/google-agenda/pdf/', {
            params: { 
                agenda_id: agenda.id,
                data_inicio: format(dataInicio, 'yyyy-MM-dd'),
                data_fim: format(dataFim, 'yyyy-MM-dd')
            },
            responseType: 'blob'
        });

        // Cria o link de download
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        
        // Nome do arquivo: Agenda_Nome_01-02_a_05-02.pdf
        const nomeArquivo = `Agenda_${agenda.nome.replace(/\s+/g, '_')}_${format(dataInicio, 'dd-MM')}_a_${format(dataFim, 'dd-MM')}.pdf`;
        link.setAttribute('download', nomeArquivo);
        
        document.body.appendChild(link);
        link.click();
        
        // Limpeza
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Download iniciado.', life: 3000 });

    } catch (error) {
        console.error(error);
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao gerar o PDF da agenda.', life: 4000 });
    } finally {
        downloadingId.value = null;
        agendaSelecionada.value = null;
    }
};
</script>

<template>
  <div class="page-container">
    <header class="page-header flex justify-content-between align-items-center">
      <h1 class="m-0">Agendas da Equipe</h1>
      <Button icon="pi pi-sync" text rounded @click="carregarAgendas" tooltip="Atualizar Lista" />
    </header>

    <main>
      <div v-if="isLoading" class="text-center p-6">
        <ProgressSpinner />
        <p class="mt-3 text-500">Sincronizando agendas...</p>
      </div>

      <div v-else-if="agendasDisponiveis.length === 0">
        <Message :closable="false" severity="info" icon="pi pi-info-circle">
          Nenhuma agenda compartilhada disponível para o seu perfil.
        </Message>
      </div>

      <div v-else class="grid">
        <div v-for="agenda in agendasDisponiveis" :key="agenda.id" class="col-12 md:col-6 lg:col-4">
            
            <Card class="agenda-card h-full shadow-2 hover:shadow-4 transition-duration-200">
                <template #title>
                    <div class="flex align-items-center gap-2 text-primary">
                        <i class="pi pi-calendar text-2xl"></i>
                        <span class="white-space-nowrap overflow-hidden text-overflow-ellipsis">{{ agenda.nome }}</span>
                    </div>
                </template>
                
                <template #content>
                    <p class="m-0 text-600 line-height-3">
                        Visualize os compromissos ou imprima a pauta do dia.
                    </p>
                </template>

                <template #footer>
                    <div class="flex gap-2 mt-2">
                        <Button 
                            label="Abrir" 
                            icon="pi pi-external-link" 
                            class="flex-1" 
                            outlined
                            @click="navegarParaAgenda(agenda.id)" 
                        />
                        
                        <Button 
                            label="Imprimir" 
                            icon="pi pi-print" 
                            class="flex-1" 
                            severity="secondary"
                            :loading="downloadingId === agenda.id"
                            @click="abrirDialogoImpressao(agenda)"
                            v-tooltip.bottom="'Baixar PDF (Filtrado)'"
                        />
                    </div>
                </template>
            </Card>

        </div>
      </div>
    </main>

    <Dialog v-model:visible="showDateDialog" header="Imprimir Agenda" :modal="true" :style="{ width: '450px' }">
        <div class="p-fluid">
            <div class="field">
                <label for="range">Selecione o Período</label>
                <Calendar 
                    id="range" 
                    v-model="datasSelecionadas" 
                    selectionMode="range" 
                    :manualInput="false" 
                    dateFormat="dd/mm/yy" 
                    placeholder="Início e Fim"
                    showIcon
                />
                <small class="block mt-2 text-500">
                    O relatório aplicará automaticamente os filtros de privacidade (ocultando 'Particular' se você não for gestor).
                </small>
            </div>
        </div>
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="showDateDialog = false" />
            <Button label="Baixar PDF" icon="pi pi-print" @click="confirmarImpressao" autofocus />
        </template>
    </Dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { margin-bottom: 2rem; }

.agenda-card {
  border-top: 4px solid var(--primary-color);
  border-radius: 8px;
}
</style>