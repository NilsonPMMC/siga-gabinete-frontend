<script setup>
import { ref, onMounted, computed } from 'vue';
import apiClient from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from "primevue/usetoast";
import Card from 'primevue/card';
import ProgressSpinner from 'primevue/progressspinner';
import Button from 'primevue/button';
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';
import MultiSelect from 'primevue/multiselect';
import GraficoAtendimentosStatus from '@/components/GraficoAtendimentosStatus.vue';
import GraficoAtendimentosConta from '@/components/GraficoAtendimentosConta.vue';
import GraficoAtendimentosAssunto from '@/components/GraficoAtendimentosAssunto.vue';
import PainelSlaAtendimentos from '@/components/PainelSlaAtendimentos.vue';
import { montarParamsRelatorioAtendimentos } from '@/utils/relatorioParams';

const authStore = useAuthStore();
const toast = useToast();

const relatorioStatus = ref([]);
const relatorioConta = ref([]);
const relatorioAssunto = ref([]);
const relatorioSla = ref(null);
const isLoading = ref(true);
const isExporting = ref(false);
const isExportingCsv = ref(false);

const dataInicio = ref(null);
const dataFim = ref(null);
const filtroConta = ref(null);
const filtroStatus = ref(null);
const filtroMembros = ref([]);
const filtroCategorias = ref([]);
const filtroCargos = ref([]);

const contasOptions = ref([]);
const membrosOptions = ref([]);
const categoriasOptions = ref([]);
const cargosOptions = ref([]);
const statusOptions = ref([
    { label: 'Todos', value: null },
    { label: 'Aberto', value: 'ABERTO' },
    { label: 'Em Análise', value: 'EM_ANALISE' },
    { label: 'Encaminhado', value: 'ENCAMINHADO' },
    { label: 'Concluído', value: 'CONCLUIDO' },
    { label: 'Arquivado', value: 'ARQUIVADO' },
]);

const PALETA_ASSUNTO = [
    '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#64748b',
];

const totalPeriodo = computed(() =>
    relatorioAssunto.value.reduce((s, i) => s + (i.total || 0), 0)
);

const formatarDataParaAPI = (data) => {
  if (!data) return null;
  if (data instanceof Date) {
    return data.toISOString().slice(0, 10);
  }
  try {
    const dataObj = new Date(data);
    return dataObj.toISOString().slice(0, 10);
  } catch {
    return null;
  }
};

const buscarAoSelecionarData = () => {
  if (dataInicio.value && dataFim.value) {
    fetchReportsData();
  }
};

const fetchReportsData = async () => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  const params = montarParamsRelatorioAtendimentos({
    dataInicio: dataInicio.value,
    dataFim: dataFim.value,
    contaId: filtroConta.value,
    status: filtroStatus.value,
    responsavelIds: filtroMembros.value,
    categoriaIds: filtroCategorias.value,
    cargos: filtroCargos.value,
    formatarData: formatarDataParaAPI,
  });

  try {
    const [resStatus, resConta, resAssunto, resSla] = await Promise.all([
      apiClient.get('/api/relatorios/atendimentos-por-status/', { params }),
      apiClient.get('/api/relatorios/atendimentos-por-conta/', { params }),
      apiClient.get('/api/relatorios/atendimentos-por-assunto/', { params }),
      apiClient.get('/api/relatorios/sla/', { params }),
    ]);
    relatorioStatus.value = resStatus.data;
    relatorioConta.value = resConta.data;
    relatorioAssunto.value = resAssunto.data;
    relatorioSla.value = resSla.data;
  } catch (error) {
    console.error('Erro ao buscar relatórios:', error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os relatórios.' });
  } finally {
    isLoading.value = false;
  }
};

const montarParamsExportacao = () => montarParamsRelatorioAtendimentos({
  dataInicio: dataInicio.value,
  dataFim: dataFim.value,
  contaId: filtroConta.value,
  status: filtroStatus.value,
  responsavelIds: filtroMembros.value,
  categoriaIds: filtroCategorias.value,
  cargos: filtroCargos.value,
  formatarData: formatarDataParaAPI,
});

const exportarPDF = async () => {
    isExporting.value = true;
    try {
        const response = await apiClient.get('/api/relatorios/atendimentos/pdf/', {
            params: montarParamsExportacao(),
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

const exportarCSV = async () => {
    isExportingCsv.value = true;
    try {
        const response = await apiClient.get('/api/relatorios/atendimentos/csv/', {
            params: montarParamsExportacao(),
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `relatorio_atendimentos_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o CSV.' });
    } finally {
        isExportingCsv.value = false;
    }
};

const buscarMembrosDaConta = async (contaId) => {
    if (!contaId || !authStore.user?.is_superuser) {
        membrosOptions.value = [];
        filtroMembros.value = [];
        return;
    }
    try {
        const resMembros = await apiClient.get('/api/usuarios/', { params: { conta_id: contaId } });
        membrosOptions.value = resMembros.data.map(u => ({
            label: u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username,
            value: u.id,
        }));
    } catch (error) {
        console.error('Erro ao buscar membros:', error);
        membrosOptions.value = [];
    }
};

const aoSelecionarConta = () => {
    if (filtroConta.value) {
        buscarMembrosDaConta(filtroConta.value);
    } else {
        membrosOptions.value = [];
        filtroMembros.value = [];
    }
};

function estiloCardAssunto(index) {
    const cor = PALETA_ASSUNTO[index % PALETA_ASSUNTO.length];
    return {
        borderLeft: `4px solid ${cor}`,
        background: `linear-gradient(135deg, ${cor}18 0%, var(--surface-card) 60%)`,
    };
}

onMounted(async () => {
    if (!authStore.canViewRelatoriosAtendimentos) {
        isLoading.value = false;
        return;
    }
    fetchReportsData();
    try {
        const [resFiltros] = await Promise.all([
            apiClient.get('/api/relatorios/filtros-perfil/'),
        ]);
        categoriasOptions.value = (resFiltros.data.categorias || []).map(c => ({
            label: c.nome,
            value: c.id,
        }));
        cargosOptions.value = (resFiltros.data.cargos || []).map(c => ({
            label: c,
            value: c,
        }));
    } catch (error) {
        console.error('Erro ao buscar opções de filtro:', error);
    }
    if (authStore.user?.is_superuser || authStore.isRecepcao) {
        try {
            const resContas = await apiClient.get('/api/contas/');
            contasOptions.value = resContas.data.map(c => ({ label: c.nome, value: c.id }));
        } catch (error) {
            console.error('Erro ao buscar contas:', error);
        }
    }
});
</script>

<template>
  <div class="rel-page">
    <header class="rel-header">
      <div>
        <h1>Relatórios Gerenciais</h1>
        <p class="rel-subtitle">Visão consolidada de atendimentos por status, gabinete, assunto e cumprimento de SLA.</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <Button
          label="Exportar CSV"
          icon="pi pi-file-excel"
          severity="success"
          outlined
          @click="exportarCSV"
          :loading="isExportingCsv"
          :disabled="isLoading"
        />
        <Button
          label="Exportar PDF"
          icon="pi pi-file-pdf"
          severity="danger"
          outlined
          @click="exportarPDF"
          :loading="isExporting"
          :disabled="isLoading"
        />
      </div>
    </header>

    <Card class="rel-filtros mb-4">
        <template #title><i class="pi pi-filter mr-2" />Filtros</template>
        <template #content>
            <div class="grid formgrid p-fluid align-items-end gap-3">
                <div class="field col-12 md:col-6 lg:col-3">
                    <label for="dataInicio">Data de início</label>
                    <Calendar id="dataInicio" v-model="dataInicio" dateFormat="dd/mm/yy" appendTo="body" showIcon @date-select="buscarAoSelecionarData" />
                </div>
                <div class="field col-12 md:col-6 lg:col-3">
                    <label for="dataFim">Data de fim</label>
                    <Calendar id="dataFim" v-model="dataFim" dateFormat="dd/mm/yy" appendTo="body" showIcon @date-select="buscarAoSelecionarData" />
                </div>
                <div class="field col-12 md:col-6 lg:col-3" v-if="authStore.user?.is_superuser || authStore.isRecepcao">
                  <label for="filtroConta">Gabinete</label>
                  <Dropdown id="filtroConta" v-model="filtroConta" :options="contasOptions" optionLabel="label" optionValue="value" placeholder="Todos" showClear @change="aoSelecionarConta" />
                </div>
                <div class="field col-12 md:col-6 lg:col-3" v-if="authStore.user?.is_superuser && filtroConta">
                    <label for="filtroMembros">Membros</label>
                    <MultiSelect id="filtroMembros" v-model="filtroMembros" :options="membrosOptions" optionLabel="label" optionValue="value" placeholder="Todos" display="chip" :filter="true" />
                </div>
                <div class="field col-12 md:col-6 lg:col-3">
                    <label for="filtroStatus">Status</label>
                    <Dropdown id="filtroStatus" v-model="filtroStatus" :options="statusOptions" optionLabel="label" optionValue="value" placeholder="Todos" showClear />
                </div>
                <div class="field col-12 md:col-6 lg:col-3">
                    <label for="filtroCategorias">Categoria do contato</label>
                    <MultiSelect
                      id="filtroCategorias"
                      v-model="filtroCategorias"
                      :options="categoriasOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Todas"
                      display="chip"
                      filter
                    />
                </div>
                <div class="field col-12 md:col-6 lg:col-3">
                    <label for="filtroCargos">Cargo do munícipe</label>
                    <MultiSelect
                      id="filtroCargos"
                      v-model="filtroCargos"
                      :options="cargosOptions"
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Todos"
                      display="chip"
                      filter
                    />
                    <small class="text-color-secondary">Combina com categoria (regra E).</small>
                </div>
                <div class="field col-12 md:col-6 lg:col-3 flex align-items-end">
                    <Button label="Aplicar filtros" icon="pi pi-search" @click="fetchReportsData" :loading="isLoading" class="w-full" />
                </div>
            </div>
        </template>
    </Card>

    <main>
      <div v-if="isLoading" class="rel-loading">
        <ProgressSpinner />
      </div>

      <div v-else-if="!relatorioAssunto.length && !relatorioStatus.length && !(relatorioSla?.resumo?.com_sla)" class="rel-empty">
        <i class="pi pi-chart-bar" />
        <p>Nenhum dado no período. Ajuste os filtros e tente novamente.</p>
      </div>

      <template v-else>
        <PainelSlaAtendimentos :sla-data="relatorioSla" />

        <section v-if="relatorioAssunto.length" class="rel-section">
          <div class="rel-section-head">
            <h2><i class="pi pi-tags" /> Por assunto</h2>
            <span v-if="totalPeriodo" class="rel-badge">{{ totalPeriodo }} atendimentos no período</span>
          </div>
          <div class="rel-assunto-grid">
            <div
              v-for="(item, idx) in relatorioAssunto"
              :key="item.nome"
              class="rel-assunto-card"
              :style="estiloCardAssunto(idx)"
            >
              <span class="rel-assunto-card__valor">{{ item.total }}</span>
              <span class="rel-assunto-card__nome">{{ item.nome }}</span>
            </div>
          </div>
        </section>

        <section class="rel-section">
          <h2 class="rel-section-head-only"><i class="pi pi-chart-pie" /> Gráficos detalhados</h2>
          <div class="rel-charts-grid">
            <Card class="rel-chart-card rel-chart-card--featured">
              <template #title>Atendimentos por assunto</template>
              <template #content>
                <div class="chart-container">
                  <GraficoAtendimentosAssunto v-if="relatorioAssunto.length" :chartData="relatorioAssunto" />
                  <p v-else class="rel-chart-empty">Sem dados no período.</p>
                </div>
              </template>
            </Card>

            <Card class="rel-chart-card">
              <template #title>Por status</template>
              <template #content>
                <div class="chart-container">
                  <GraficoAtendimentosStatus v-if="relatorioStatus.length" :chartData="relatorioStatus" />
                  <p v-else class="rel-chart-empty">Sem dados.</p>
                </div>
              </template>
            </Card>

            <Card class="rel-chart-card">
              <template #title>Por gabinete</template>
              <template #content>
                <div class="chart-container">
                  <GraficoAtendimentosConta v-if="relatorioConta.length" :chartData="relatorioConta" />
                  <p v-else class="rel-chart-empty">Sem dados.</p>
                </div>
              </template>
            </Card>

          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.rel-page {
  padding: 2rem;
  background: var(--surface-ground);
  min-height: 100vh;
}
.rel-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.rel-header h1 {
  margin: 0 0 0.25rem;
  font-size: 1.75rem;
  font-weight: 700;
}
.rel-subtitle {
  margin: 0;
  color: var(--text-color-secondary);
  font-size: 0.95rem;
}
.rel-filtros :deep(.p-card-title) {
  font-weight: 600;
}
.rel-loading {
  display: flex;
  justify-content: center;
  padding: 4rem;
}
.rel-empty {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-color-secondary);
}
.rel-empty .pi {
  font-size: 3rem;
  opacity: 0.4;
  display: block;
  margin-bottom: 1rem;
}
.rel-section {
  margin-bottom: 2rem;
}
.rel-section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.rel-section-head h2,
.rel-section-head-only {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.rel-badge {
  font-size: 0.8rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: var(--primary-50, #eff6ff);
  color: var(--primary-700, #1d4ed8);
  font-weight: 600;
}
.rel-assunto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
}
.rel-assunto-card {
  padding: 1rem;
  border-radius: 10px;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.rel-assunto-card__valor {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.2;
}
.rel-assunto-card__nome {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-color-secondary);
  line-height: 1.35;
  margin-top: 0.25rem;
  display: block;
}
.rel-charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.25rem;
}
.rel-chart-card--featured {
  grid-column: 1 / -1;
}
@media (min-width: 1200px) {
  .rel-chart-card--featured {
    grid-column: span 2;
  }
  .rel-charts-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.rel-chart-card :deep(.p-card-title) {
  font-size: 1rem;
  font-weight: 600;
}
.chart-container {
  position: relative;
  height: 380px;
}
.rel-chart-card--featured .chart-container {
  height: 420px;
}
.rel-chart-empty {
  text-align: center;
  color: var(--text-color-secondary);
  padding: 3rem 1rem;
}
.field label {
  font-weight: 600;
  margin-bottom: 0.5rem;
  display: block;
  font-size: 0.875rem;
}
</style>
