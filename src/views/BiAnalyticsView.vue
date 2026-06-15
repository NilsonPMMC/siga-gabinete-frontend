<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import apiClient from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from 'primevue/usetoast';
import Chart from 'primevue/chart';
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';
import MultiSelect from 'primevue/multiselect';
import { montarParamsRelatorioAtendimentos } from '@/utils/relatorioParams';
import PainelSlaAtendimentos from '@/components/PainelSlaAtendimentos.vue';

const authStore = useAuthStore();
const toast = useToast();
const isLoading = ref(false);
const isDownloading = ref(false);

const filtros = ref({
    data_inicio: null,
    data_fim: null,
    conta: null,
    apenas_meus: false,
    usuario_id: null,
    categoria_contato_id: [],
    cargo: [],
});

const usuariosDisponiveis = ref([]);
const categoriasOptions = ref([]);
const cargosOptions = ref([]);

const chartProdutividadeData = ref(null);
const chartEvolucaoData = ref(null);
const chartSolicitantesData = ref(null);
const chartStatusData = ref(null);
const chartAssuntoData = ref(null);
const dadosAssunto = ref([]);
const dadosStatus = ref([]);
const dadosSla = ref(null);

const PALETA_ASSUNTO = [
    '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9',
    '#3b82f6', '#64748b',
];

const kpis = computed(() => {
    const total = dadosStatus.value.reduce((s, i) => s + (i.total || 0), 0);
    const concluidos = dadosStatus.value.find(i => i.status_code === 'CONCLUIDO')?.total || 0;
    const abertos = dadosStatus.value.find(i => i.status_code === 'ABERTO')?.total || 0;
    const emAnalise = dadosStatus.value.find(i => i.status_code === 'EM_ANALISE')?.total || 0;
    const topAssunto = dadosAssunto.value[0];
    const sla = dadosSla.value?.resumo;
    return {
        total,
        concluidos,
        abertos,
        emAnalise,
        topAssunto,
        slaVencidos: sla?.totais?.VENCIDO ?? 0,
        slaEmRisco: sla?.totais?.EM_RISCO ?? 0,
        slaPctNoPrazo: sla?.pct_no_prazo ?? null,
    };
});

const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { labels: { color: '#495057', font: { size: 11 } } },
    },
};

const horizontalOptions = {
    ...commonOptions,
    indexAxis: 'y',
    plugins: { legend: { display: false } },
};

const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: 'right', labels: { color: '#495057', boxWidth: 12 } },
    },
};

const assuntoBarOptions = {
    ...horizontalOptions,
    scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
    },
};

async function carregarUsuarios() {
    try {
        const res = await apiClient.get('/api/usuarios/');
        usuariosDisponiveis.value = res.data.sort((a, b) => {
            const nomeA = a.first_name || a.username;
            const nomeB = b.first_name || b.username;
            return nomeA.localeCompare(nomeB);
        });
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

onMounted(async () => {
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    filtros.value.data_inicio = trintaDiasAtras;
    filtros.value.data_fim = hoje;

    if (authStore.user?.is_superuser) {
        await carregarUsuarios();
    }
    try {
        const resFiltros = await apiClient.get('/api/relatorios/filtros-perfil/');
        categoriasOptions.value = (resFiltros.data.categorias || []).map(c => ({
            label: c.nome,
            value: c.id,
        }));
        cargosOptions.value = (resFiltros.data.cargos || []).map(c => ({
            label: c,
            value: c,
        }));
    } catch (error) {
        console.error('Erro ao carregar filtros de perfil:', error);
    }
    carregarDashboards();
});

watch(filtros, () => { setTimeout(carregarDashboards, 500); }, { deep: true });

function paramsBi() {
    return montarParamsRelatorioAtendimentos({
        dataInicio: filtros.value.data_inicio,
        dataFim: filtros.value.data_fim,
        contaId: filtros.value.conta,
        categoriaIds: filtros.value.categoria_contato_id,
        cargos: filtros.value.cargo,
        formatarData: (d) => (d ? d.toISOString().split('T')[0] : null),
    });
}

async function carregarDashboards() {
    isLoading.value = true;
    const params = {
        ...paramsBi(),
        apenas_meus: filtros.value.apenas_meus,
        usuario_id: filtros.value.usuario_id,
    };

    try {
        const [resProd, resEvol, resTop, resStatus, resAssunto, resSla] = await Promise.all([
            apiClient.get('/api/bi/produtividade-equipe/', { params }),
            apiClient.get('/api/bi/evolucao-temporal/', { params }),
            apiClient.get('/api/bi/top-solicitantes/', { params }),
            apiClient.get('/api/bi/status-distribuicao/', { params }),
            apiClient.get('/api/bi/atendimentos-por-assunto/', { params }),
            apiClient.get('/api/bi/sla/', { params }),
        ]);

        montarGraficoProdutividade(resProd.data);
        montarGraficoEvolucao(resEvol.data);
        montarGraficoSolicitantes(resTop.data);
        dadosStatus.value = resStatus.data;
        montarGraficoStatus(resStatus.data);
        dadosAssunto.value = resAssunto.data;
        montarGraficoAssunto(resAssunto.data);
        dadosSla.value = resSla.data;
    } catch (error) {
        console.error('Erro ao carregar BI:', error);
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar o painel.', life: 4000 });
    } finally {
        isLoading.value = false;
    }
}

async function baixarRelatorioPdf() {
    isDownloading.value = true;
    const params = {
        ...paramsBi(),
        apenas_meus: filtros.value.apenas_meus,
        usuario_id: filtros.value.usuario_id,
    };

    try {
        const response = await apiClient.get('/api/bi/relatorio-pdf/', {
            params,
            responseType: 'blob',
        });
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Relatorio_BI.pdf');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Erro PDF:', error);
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o PDF.', life: 4000 });
    } finally {
        isDownloading.value = false;
    }
}

function montarGraficoProdutividade(data) {
    chartProdutividadeData.value = {
        labels: data.map(item => item.nome_responsavel),
        datasets: [{
            label: 'Atendimentos',
            backgroundColor: '#3b82f6',
            borderRadius: 4,
            data: data.map(item => item.total),
        }],
    };
}

function montarGraficoEvolucao(data) {
    chartEvolucaoData.value = {
        labels: data.map(item => {
            const d = new Date(item.data_ref);
            return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }),
        datasets: [{
            label: 'Volume mensal',
            data: data.map(item => item.total),
            fill: true,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            tension: 0.35,
        }],
    };
}

function montarGraficoSolicitantes(data) {
    chartSolicitantesData.value = {
        labels: data.map(item => item.nome),
        datasets: [{
            label: 'Demandas',
            backgroundColor: '#10b981',
            borderRadius: 4,
            data: data.map(item => item.total),
        }],
    };
}

function montarGraficoStatus(data) {
    const colorMap = {
        CONCLUIDO: '#22c55e',
        ABERTO: '#3b82f6',
        EM_ANALISE: '#f59e0b',
        ENCAMINHADO: '#a855f7',
        ARQUIVADO: '#64748b',
    };
    const backgroundColors = data.map(item => colorMap[item.status_code] || '#9ca3af');
    chartStatusData.value = {
        labels: data.map(item => item.label),
        datasets: [{
            data: data.map(item => item.total),
            backgroundColor: backgroundColors,
            hoverBackgroundColor: backgroundColors,
        }],
    };
}

function montarGraficoAssunto(data) {
    const cores = data.map((_, i) => PALETA_ASSUNTO[i % PALETA_ASSUNTO.length]);
    chartAssuntoData.value = {
        labels: data.map(item => item.nome),
        datasets: [{
            label: 'Atendimentos',
            backgroundColor: cores,
            borderRadius: 4,
            data: data.map(item => item.total),
        }],
    };
}

function corAssuntoCard(index) {
    const hex = PALETA_ASSUNTO[index % PALETA_ASSUNTO.length];
    return { borderLeft: `4px solid ${hex}`, background: `${hex}14` };
}
</script>

<template>
    <div class="bi-page">
        <header class="bi-header">
            <div>
                <h1 class="bi-title">Painel de Inteligência</h1>
                <p class="bi-subtitle">Indicadores de atendimentos do gabinete, incluindo distribuição por assunto e SLA.</p>
            </div>
            <div class="bi-header-actions">
                <Button icon="pi pi-refresh" label="Atualizar" @click="carregarDashboards" :loading="isLoading" />
                <Button
                    icon="pi pi-file-pdf"
                    label="Exportar PDF"
                    severity="danger"
                    outlined
                    @click="baixarRelatorioPdf"
                    :loading="isDownloading"
                />
            </div>
        </header>

        <Card class="bi-filtros mb-4">
            <template #content>
                <div class="flex flex-column md:flex-row gap-4 align-items-end flex-wrap">
                    <div class="field mb-0">
                        <label class="block text-900 font-medium mb-1">Período — de</label>
                        <Calendar v-model="filtros.data_inicio" dateFormat="dd/mm/yy" showIcon />
                    </div>
                    <div class="field mb-0">
                        <label class="block text-900 font-medium mb-1">Até</label>
                        <Calendar v-model="filtros.data_fim" dateFormat="dd/mm/yy" showIcon />
                    </div>
                    <div v-if="authStore.user?.is_superuser" class="field mb-0">
                        <label class="text-xs text-600 mb-1 block">Responsável</label>
                        <Dropdown
                            v-model="filtros.usuario_id"
                            :options="usuariosDisponiveis"
                            optionValue="id"
                            placeholder="Todos"
                            showClear
                            filter
                            class="w-15rem"
                        >
                            <template #value="slotProps">
                                <span v-if="slotProps.value">
                                    {{ usuariosDisponiveis.find(u => u.id === slotProps.value)?.first_name
                                        || usuariosDisponiveis.find(u => u.id === slotProps.value)?.username }}
                                </span>
                                <span v-else>{{ slotProps.placeholder }}</span>
                            </template>
                            <template #option="slotProps">
                                <span>{{ slotProps.option.first_name || slotProps.option.username }}</span>
                            </template>
                        </Dropdown>
                    </div>
                    <div v-else class="field mb-0 flex align-items-center pb-2">
                        <Checkbox v-model="filtros.apenas_meus" :binary="true" inputId="meus" />
                        <label for="meus" class="m-0 ml-2 cursor-pointer">Apenas meus atendimentos</label>
                    </div>
                    <div class="field mb-0">
                        <label class="block text-900 font-medium mb-1">Categoria do contato</label>
                        <MultiSelect
                            v-model="filtros.categoria_contato_id"
                            :options="categoriasOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Todas"
                            display="chip"
                            filter
                            class="w-15rem"
                        />
                    </div>
                    <div class="field mb-0">
                        <label class="block text-900 font-medium mb-1">Cargo do munícipe</label>
                        <MultiSelect
                            v-model="filtros.cargo"
                            :options="cargosOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Todos"
                            display="chip"
                            filter
                            class="w-15rem"
                        />
                    </div>
                </div>
            </template>
        </Card>

        <div v-if="isLoading" class="bi-loading">
            <ProgressSpinner />
        </div>

        <template v-else>
            <section class="bi-kpi-row">
                <div class="bi-kpi">
                    <i class="pi pi-inbox bi-kpi-icon" style="color: #3b82f6" />
                    <div>
                        <span class="bi-kpi-value">{{ kpis.total }}</span>
                        <span class="bi-kpi-label">Total no período</span>
                    </div>
                </div>
                <div class="bi-kpi">
                    <i class="pi pi-check-circle bi-kpi-icon" style="color: #22c55e" />
                    <div>
                        <span class="bi-kpi-value">{{ kpis.concluidos }}</span>
                        <span class="bi-kpi-label">Concluídos</span>
                    </div>
                </div>
                <div class="bi-kpi">
                    <i class="pi pi-clock bi-kpi-icon" style="color: #f59e0b" />
                    <div>
                        <span class="bi-kpi-value">{{ kpis.abertos }}</span>
                        <span class="bi-kpi-label">Em aberto</span>
                    </div>
                </div>
                <div class="bi-kpi">
                    <i class="pi pi-search bi-kpi-icon" style="color: #a855f7" />
                    <div>
                        <span class="bi-kpi-value">{{ kpis.emAnalise }}</span>
                        <span class="bi-kpi-label">Em análise</span>
                    </div>
                </div>
                <div v-if="kpis.slaPctNoPrazo !== null && dadosSla?.resumo?.com_sla" class="bi-kpi">
                    <i class="pi pi-stopwatch bi-kpi-icon" style="color: #22c55e" />
                    <div>
                        <span class="bi-kpi-value">{{ kpis.slaPctNoPrazo }}%</span>
                        <span class="bi-kpi-label">SLA no prazo</span>
                    </div>
                </div>
                <div v-if="dadosSla?.resumo?.com_sla" class="bi-kpi">
                    <i class="pi pi-exclamation-triangle bi-kpi-icon" style="color: #ef4444" />
                    <div>
                        <span class="bi-kpi-value">{{ kpis.slaVencidos }}</span>
                        <span class="bi-kpi-label">SLA vencidos</span>
                    </div>
                </div>
                <div v-if="dadosSla?.resumo?.com_sla" class="bi-kpi">
                    <i class="pi pi-hourglass bi-kpi-icon" style="color: #f59e0b" />
                    <div>
                        <span class="bi-kpi-value">{{ kpis.slaEmRisco }}</span>
                        <span class="bi-kpi-label">SLA em risco</span>
                    </div>
                </div>
                <div v-if="kpis.topAssunto" class="bi-kpi bi-kpi--destaque">
                    <i class="pi pi-tags bi-kpi-icon" style="color: #7c3aed" />
                    <div>
                        <span class="bi-kpi-value">{{ kpis.topAssunto.total }}</span>
                        <span class="bi-kpi-label">Principal assunto: {{ kpis.topAssunto.nome }}</span>
                    </div>
                </div>
            </section>

            <PainelSlaAtendimentos :sla-data="dadosSla" />

            <section v-if="dadosAssunto.length" class="mb-4">
                <h2 class="bi-section-title"><i class="pi pi-tags mr-2" />Por assunto</h2>
                <div class="bi-assunto-cards">
                    <div
                        v-for="(item, idx) in dadosAssunto"
                        :key="item.nome"
                        class="bi-assunto-card"
                        :style="corAssuntoCard(idx)"
                    >
                        <span class="bi-assunto-card__total">{{ item.total }}</span>
                        <span class="bi-assunto-card__nome">{{ item.nome }}</span>
                    </div>
                </div>
            </section>

            <div class="grid">
                <div class="col-12 lg:col-5">
                    <Card class="bi-chart-card h-full">
                        <template #title>
                            <span class="bi-chart-title">Distribuição por assunto</span>
                        </template>
                        <template #content>
                            <div class="bi-chart-wrap bi-chart-wrap--tall">
                                <Chart
                                    v-if="chartAssuntoData"
                                    type="bar"
                                    :data="chartAssuntoData"
                                    :options="assuntoBarOptions"
                                    class="h-full w-full"
                                />
                                <p v-else class="text-center text-500 p-4">Sem dados no período.</p>
                            </div>
                        </template>
                    </Card>
                </div>

                <div class="col-12 lg:col-3">
                    <Card class="bi-chart-card h-full">
                        <template #title><span class="bi-chart-title">Por status</span></template>
                        <template #content>
                            <div class="bi-chart-wrap">
                                <Chart v-if="chartStatusData" type="doughnut" :data="chartStatusData" :options="pieOptions" class="w-full" />
                            </div>
                        </template>
                    </Card>
                </div>

                <div class="col-12 lg:col-4">
                    <Card class="bi-chart-card h-full">
                        <template #title><span class="bi-chart-title">Evolução mensal</span></template>
                        <template #content>
                            <div class="bi-chart-wrap">
                                <Chart v-if="chartEvolucaoData" type="line" :data="chartEvolucaoData" :options="commonOptions" class="h-full w-full" />
                            </div>
                        </template>
                    </Card>
                </div>

                <div class="col-12 lg:col-6">
                    <Card class="bi-chart-card h-full">
                        <template #title><span class="bi-chart-title">Produtividade da equipe</span></template>
                        <template #content>
                            <div class="bi-chart-wrap bi-chart-wrap--tall">
                                <Chart v-if="chartProdutividadeData" type="bar" :data="chartProdutividadeData" :options="horizontalOptions" class="h-full w-full" />
                            </div>
                        </template>
                    </Card>
                </div>

                <div class="col-12 lg:col-6">
                    <Card class="bi-chart-card h-full">
                        <template #title><span class="bi-chart-title">Top 10 solicitantes</span></template>
                        <template #content>
                            <div class="bi-chart-wrap bi-chart-wrap--tall">
                                <Chart v-if="chartSolicitantesData" type="bar" :data="chartSolicitantesData" :options="commonOptions" class="h-full w-full" />
                            </div>
                        </template>
                    </Card>
                </div>
            </div>
        </template>
    </div>
</template>

<style scoped>
.bi-page {
    padding: 2rem;
    background: var(--surface-ground);
    min-height: 100vh;
}
.bi-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
}
.bi-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 0.25rem;
}
.bi-subtitle {
    margin: 0;
    color: var(--text-color-secondary);
    font-size: 0.95rem;
}
.bi-header-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}
.bi-filtros :deep(.p-card-body) {
    padding: 1rem 1.25rem;
}
.bi-loading {
    display: flex;
    justify-content: center;
    padding: 4rem;
}
.bi-kpi-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
}
.bi-kpi {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.15rem;
    background: var(--surface-card);
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    border: 1px solid var(--surface-border);
}
.bi-kpi--destaque {
    grid-column: span 1;
    min-width: 200px;
}
.bi-kpi-icon {
    font-size: 1.5rem;
}
.bi-kpi-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
}
.bi-kpi-label {
    font-size: 0.75rem;
    color: var(--text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.02em;
}
.bi-section-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0 0 0.75rem;
    color: var(--text-color);
    display: flex;
    align-items: center;
}
.bi-assunto-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 0.75rem;
}
.bi-assunto-card {
    padding: 0.85rem 1rem;
    border-radius: 8px;
    text-align: center;
}
.bi-assunto-card__total {
    display: block;
    font-size: 1.75rem;
    font-weight: 700;
    line-height: 1.2;
}
.bi-assunto-card__nome {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-color-secondary);
    line-height: 1.3;
}
.bi-chart-card :deep(.p-card-title) {
    padding-bottom: 0;
}
.bi-chart-title {
    font-size: 1rem;
    font-weight: 600;
}
.bi-chart-wrap {
    height: 280px;
    position: relative;
}
.bi-chart-wrap--tall {
    height: 320px;
}
.grid {
    display: flex;
    flex-wrap: wrap;
    margin: -0.5rem;
}
.col-12 {
    flex: 0 0 auto;
    padding: 0.5rem;
    width: 100%;
}
@media (min-width: 992px) {
    .lg\:col-3 { width: 25%; }
    .lg\:col-4 { width: 33.333%; }
    .lg\:col-5 { width: 41.666%; }
    .lg\:col-6 { width: 50%; }
}
</style>
