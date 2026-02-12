<script setup>
import { ref, onMounted } from 'vue';
import apiClient from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from "primevue/usetoast";

// Importando todos os componentes que usaremos
import Card from 'primevue/card';
import ProgressSpinner from 'primevue/progressspinner';
import Button from 'primevue/button';
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';

// Importando nossos 3 componentes de gráfico
import GraficoAtendimentosStatus from '@/components/GraficoAtendimentosStatus.vue';
import GraficoAtendimentosConta from '@/components/GraficoAtendimentosConta.vue';
import GraficoAtendimentosCategoria from '@/components/GraficoAtendimentosCategoria.vue';

const authStore = useAuthStore();
const toast = useToast();
const podeVerRelatorioAgenda = authStore.isSecretaria || authStore.user?.is_superuser;

// Estado para os dados dos relatórios
const relatorioStatus = ref([]);
const relatorioConta = ref([]);
const relatorioCategoria = ref([]);
const isLoading = ref(true);
const isExporting = ref(false);

// --- Estado para os nossos filtros ---
const dataInicio = ref(null);
const dataFim = ref(null);
const filtroConta = ref(null);
const filtroStatus = ref(null);

// Opções para os dropdowns de filtro
const contasOptions = ref([]);
const statusOptions = ref([
    { label: 'Todos', value: null },
    { label: 'Aberto', value: 'ABERTO' },
    { label: 'Em Análise', value: 'EM_ANALISE' },
    { label: 'Encaminhado', value: 'ENCAMINHADO' },
    { label: 'Concluído', value: 'CONCLUIDO' },
    { label: 'Arquivado', value: 'ARQUIVADO' },
]);

// Função auxiliar para converter data do Calendar para formato YYYY-MM-DD
const formatarDataParaAPI = (data) => {
  if (!data) return null;
  if (data instanceof Date) {
    return data.toISOString().slice(0, 10);
  }
  // Se for string, tenta converter
  try {
    const dataObj = new Date(data);
    return dataObj.toISOString().slice(0, 10);
  } catch {
    return null;
  }
};

// Função que busca automaticamente quando ambas as datas são selecionadas
const buscarAoSelecionarData = () => {
  // Só busca automaticamente se ambas as datas estiverem preenchidas
  if (dataInicio.value && dataFim.value) {
    fetchReportsData();
  }
};

// Função central que busca os dados, aplicando os filtros
const fetchReportsData = async () => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  const params = {};
  
  // Converter datas corretamente - Calendar retorna Date object
  const dataInicioFormatada = formatarDataParaAPI(dataInicio.value);
  const dataFimFormatada = formatarDataParaAPI(dataFim.value);
  
  if (dataInicioFormatada) params.data_inicio = dataInicioFormatada;
  if (dataFimFormatada) params.data_fim = dataFimFormatada;
  if (filtroConta.value) params.conta_id = filtroConta.value;
  if (filtroStatus.value) params.status = filtroStatus.value;

  try {
    const [resStatus, resConta, resCategoria] = await Promise.all([
      apiClient.get('/api/relatorios/atendimentos-por-status/', { params }),
      apiClient.get('/api/relatorios/atendimentos-por-conta/', { params }),
      apiClient.get('/api/relatorios/atendimentos-por-categoria/', { params })
    ]);
    relatorioStatus.value = resStatus.data;
    relatorioConta.value = resConta.data;
    relatorioCategoria.value = resCategoria.data;
  } catch (error) {
    console.error('Erro ao buscar relatórios:', error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os relatórios.' });
  } finally {
    isLoading.value = false;
  }
};

// Função para exportar o PDF com os filtros atuais
const exportarPDF = async () => {
    isExporting.value = true;
    const params = {};
    const dataInicioFormatada = formatarDataParaAPI(dataInicio.value);
    const dataFimFormatada = formatarDataParaAPI(dataFim.value);
    if (dataInicioFormatada) params.data_inicio = dataInicioFormatada;
    if (dataFimFormatada) params.data_fim = dataFimFormatada;
    if (filtroConta.value) params.conta_id = filtroConta.value;
    if (filtroStatus.value) params.status = filtroStatus.value;

    try {
        const response = await apiClient.get('/api/relatorios/atendimentos/pdf/', {
            params: params,
            responseType: 'blob', 
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `relatorio_atendimentos_${new Date().getTime()}.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o PDF.' });
    } finally {
        isExporting.value = false;
    }
};

// Busca os dados iniciais e as opções do dropdown de contas
onMounted(async () => {
    fetchReportsData(); // Busca os dados dos gráficos
    if (authStore.user?.is_superuser || authStore.isRecepcao) {
        try {
            const resContas = await apiClient.get('/api/contas/');
            contasOptions.value = resContas.data.map(c => ({ label: c.nome, value: c.id }));
        } catch (error) {
            console.error("Erro ao buscar contas para o filtro:", error);
        }
    }
});

</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <h1>Relatórios Gerenciais</h1>
    </header>

    <Card class="mb-4">
        <template #title>Filtros</template>
        <template #content>
            <div class="grid formgrid p-fluid align-items-end gap-3">
                <div class="field col">
                    <label for="dataInicio">Data de Início</label>
                    <Calendar id="dataInicio" v-model="dataInicio" dateFormat="dd/mm/yy" appendTo="body" showIcon @date-select="buscarAoSelecionarData" />
                </div>
                <div class="field col">
                    <label for="dataFim">Data de Fim</label>
                    <Calendar id="dataFim" v-model="dataFim" dateFormat="dd/mm/yy" appendTo="body" showIcon @date-select="buscarAoSelecionarData" />
                </div>
                <div class="field col" v-if="authStore.user?.is_superuser || authStore.isRecepcao">
                  <label for="filtroConta">Gabinete</label>
                  <Dropdown id="filtroConta" v-model="filtroConta" :options="contasOptions" optionLabel="label" optionValue="value" placeholder="Todos" showClear />
                </div>
                <div class="field col">
                    <label for="filtroStatus">Status</label>
                    <Dropdown id="filtroStatus" v-model="filtroStatus" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Todos" showClear />
                </div>
                <div class="field col flex gap-2">
                    <Button label="Aplicar Filtros" icon="pi pi-filter" @click="fetchReportsData" :loading="isLoading" />
                    <Button label="Exportar PDF" icon="pi pi-file-pdf" class="p-button-secondary" @click="exportarPDF" :loading="isExporting" />
                </div>
            </div>
        </template>
    </Card>

    <main>
      <div v-if="isLoading" class="loading-container">
        <ProgressSpinner />
      </div>
      <div v-else class="grid mt-4">
        <div class="col-12 md:col-6 lg:col-4">
          <Card>
            <template #title>Atendimentos por Status</template>
            <template #content>
              <div class="chart-container">
                <GraficoAtendimentosStatus v-if="relatorioStatus.length" :chartData="relatorioStatus" />
                <p v-else>Não há dados para exibir no período selecionado.</p>
              </div>
            </template>
          </Card>
        </div>

        <div class="col-12 md:col-6 lg:col-4">
          <Card>
            <template #title>Atendimentos por Gabinete</template>
            <template #content>
              <div class="chart-container">
                <GraficoAtendimentosConta v-if="relatorioConta.length" :chartData="relatorioConta" />
                <p v-else>Não há dados para exibir no período selecionado.</p>
              </div>
            </template>
          </Card>
        </div>

        <div class="col-12 md:col-6 lg:col-4">
          <Card>
            <template #title>Atendimentos por Categoria</template>
            <template #content>
              <div class="chart-container">
                <GraficoAtendimentosCategoria v-if="relatorioCategoria.length" :chartData="relatorioCategoria" />
                <p v-else>Não há dados para exibir no período selecionado.</p>
              </div>
            </template>
          </Card>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { margin-bottom: 2rem; }
.chart-container { position: relative; height: 400px; }
.loading-container { display: flex; justify-content: center; padding: 5rem; }
.field { flex-grow: 1; }
label { font-weight: bold; margin-bottom: .5rem; display: block;}
</style>