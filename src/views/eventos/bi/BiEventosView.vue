<script setup>
import { ref, onMounted, watch } from 'vue';
import apiClient from '@/api';
import Chart from 'primevue/chart';
import Dropdown from 'primevue/dropdown';
import Calendar from 'primevue/calendar';

const eventosList = ref([]);
const categoriasList = ref([]);
const dashboardData = ref(null);
const isLoading = ref(false);

const eventoSelecionado = ref(null);
const datasFiltro = ref(null);
const categoriaSelecionada = ref(null);

const chartPerfilData = ref(null);
const chartFunilData = ref(null);

const chartOptions = ref({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
});

const horizontalOptions = ref({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } }
});

onMounted(async () => {
    carregarListasAuxiliares();
    carregarDashboard();
});

async function carregarListasAuxiliares() {
    try {
        const [resEventos, resCats] = await Promise.all([
            apiClient.get('/api/eventos/'),
            apiClient.get('/api/contatos/categorias/')
        ]);
        eventosList.value = resEventos.data;
        categoriasList.value = resCats.data;
    } catch (e) { console.error("Erro loading lists", e); }
}

watch([eventoSelecionado, datasFiltro, categoriaSelecionada], () => {
    carregarDashboard();
});

async function carregarDashboard() {
    isLoading.value = true;
    dashboardData.value = null;
    chartPerfilData.value = null;
    chartFunilData.value = null;

    const params = {};
    if (eventoSelecionado.value) params.evento_id = eventoSelecionado.value.id;
    if (categoriaSelecionada.value) params.categoria_id = categoriaSelecionada.value;
    
    if (datasFiltro.value && datasFiltro.value[0]) {
        params.data_inicio = datasFiltro.value[0].toISOString().split('T')[0];
        if (datasFiltro.value[1]) {
            params.data_fim = datasFiltro.value[1].toISOString().split('T')[0];
        }
    }

    try {
        const { data } = await apiClient.get('/api/eventos/bi/analytics/', { params });
        dashboardData.value = data;
        
        if (data.tipo === 'detalhe') montarGraficosDetalhe(data);
        if (data.tipo === 'global') montarGraficosGlobal(data);

    } catch (e) {
        console.error("Erro BI", e);
    } finally {
        isLoading.value = false;
    }
}

function montarGraficosDetalhe(dados) {
    // FUNIL SIMPLIFICADO (2 BARRAS)
    chartFunilData.value = {
        labels: ['Convidados VIP (Total)', 'Público (QR Code)'],
        datasets: [{
            label: 'Pessoas',
            data: [
                dados.kpis.vip, 
                dados.kpis.publico
            ],
            backgroundColor: ['#3b82f6', '#f59e0b']
        }]
    };
    
    const labels = dados.perfil.map(c => c.municipe__categoria__nome || 'Sem Categoria');
    const valores = dados.perfil.map(c => c.qtd);
    
    chartPerfilData.value = {
        labels: labels.length ? labels : ['Sem dados'],
        datasets: [{
            data: valores.length ? valores : [1], 
            backgroundColor: valores.length ? ['#3b82f6', '#ef4444', '#eab308', '#22c55e', '#a855f7'] : ['#e2e8f0']
        }]
    };
}

function montarGraficosGlobal(dados) {
    const labels = dados.top_perfis.map(c => c.municipe__categoria__nome || 'Sem Categoria');
    const valores = dados.top_perfis.map(c => c.qtd);

    chartPerfilData.value = {
        labels: labels.length ? labels : ['Sem dados'],
        datasets: [{
            label: 'Total',
            data: valores.length ? valores : [0],
            backgroundColor: '#3b82f6'
        }]
    };
}


const isExporting = ref(false);

const exportarPDF = async () => {
    isExporting.value = true;
    try {
        const params = new URLSearchParams();
        if (eventoSelecionado.value) params.append('evento_id', eventoSelecionado.value.id);
        if (categoriaSelecionada.value) params.append('categoria_id', categoriaSelecionada.value);
        
        // Passar nome da categoria para ficar bonito no titulo do PDF
        if (categoriaSelecionada.value) {
            const catObj = categoriasList.value.find(c => c.id === categoriaSelecionada.value);
            if(catObj) params.append('categoria_nome', catObj.nome);
        }

        if (datasFiltro.value && datasFiltro.value[0]) {
            params.append('data_inicio', datasFiltro.value[0].toISOString().split('T')[0]);
            if (datasFiltro.value[1]) {
                params.append('data_fim', datasFiltro.value[1].toISOString().split('T')[0]);
            }
        }

        const response = await apiClient.get('/api/eventos/bi/analytics/pdf/', {
            params: params,
            responseType: 'blob'
        });
        
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Relatorio_Eventos.pdf');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error(e);
        // toast.add(...) use seu toast aqui
    } finally {
        isExporting.value = false;
    }
};
</script>

<template>
    <div class="page-container">
        <div class="card mb-4 p-4 surface-card border-round shadow-2">
            <div class="flex flex-column md:flex-row gap-4 align-items-end flex-wrap">
                <div class="field mb-0">
                    <label class="block text-sm font-medium mb-1">Evento Específico</label>
                    <Dropdown v-model="eventoSelecionado" :options="eventosList" optionLabel="nome" showClear placeholder="Todos (Visão Global)" class="w-full" filter />
                </div>
                <div class="field mb-0">
                    <label class="block text-sm font-medium mb-1">Período</label>
                    <Calendar v-model="datasFiltro" selectionMode="range" :manualInput="false" placeholder="Selecione as datas" dateFormat="dd/mm/yy" showIcon class="w-full" />
                </div>
                <div class="field mb-0">
                    <label class="block text-sm font-medium mb-1">Categoria</label>
                    <Dropdown v-model="categoriaSelecionada" :options="categoriasList" optionLabel="nome" optionValue="id" showClear placeholder="Todas" class="w-full" />
                </div>
                <Button icon="pi pi-filter-slash" class="p-button-secondary p-button-outlined" @click="{ eventoSelecionado=null; datasFiltro=null; categoriaSelecionada=null; }" v-tooltip="'Limpar Filtros'" />
                <Button icon="pi pi-file-pdf" label="PDF" class="p-button-danger" @click="exportarPDF" :loading="isExporting" />
            </div>
        </div>

        <div v-if="isLoading" class="flex justify-content-center p-6"><ProgressSpinner /></div>

        <div v-else-if="dashboardData">

            <div v-if="dashboardData.tipo === 'detalhe'" class="grid">
                 <div class="col-12 text-center mb-3">
                    <h2 class="text-2xl font-bold m-0">{{ dashboardData.evento.nome }}</h2>
                    <span class="text-500 text-sm">
                        <i class="pi pi-calendar mr-1"></i>{{ new Date(dashboardData.evento.data).toLocaleDateString('pt-BR') }} 
                        <span class="mx-2">|</span> 
                        <i class="pi pi-map-marker mr-1"></i>{{ dashboardData.evento.local }}
                    </span>
                 </div>
                 
                 <div class="col-12 md:col-6">
                    <div class="card p-3 border-left-3 border-blue-500 shadow-1 surface-card text-center h-full">
                        <span class="text-500 font-medium">Lista VIP</span>
                        <div class="text-4xl font-bold text-900 mt-2">{{ dashboardData.kpis.vip }}</div>
                        <span class="text-xs text-500">Convidados (Total)</span>
                    </div>
                 </div>
                 <div class="col-12 md:col-6">
                    <div class="card p-3 border-left-3 border-orange-500 shadow-1 surface-card text-center h-full">
                        <span class="text-500 font-medium">Força Popular</span>
                        <div class="text-4xl font-bold text-900 mt-2">{{ dashboardData.kpis.publico }}</div>
                        <span class="text-xs text-500">QR Code (Espontâneo)</span>
                    </div>
                 </div>

                 <div class="col-12 md:col-6">
                    <div class="card h-full shadow-2 border-round p-4 surface-card">
                        <h3 class="font-bold mb-3 text-lg">Comparativo de Volume</h3>
                        <div class="h-20rem">
                            <Chart type="bar" :data="chartFunilData" :options="horizontalOptions" />
                        </div>
                    </div>
                 </div>
                 <div class="col-12 md:col-6">
                    <div class="card h-full shadow-2 border-round p-4 surface-card">
                        <h3 class="font-bold mb-3 text-lg">Perfil do Público (Geral)</h3>
                        <div class="flex justify-content-center h-20rem">
                            <Chart type="doughnut" :data="chartPerfilData" :options="chartOptions" />
                        </div>
                    </div>
                 </div>
            </div>

            <div v-else class="grid">
                
                <div class="col-12 md:col-3">
                    <div class="card p-3 border-left-3 border-purple-500 shadow-1 surface-card text-center h-full">
                        <span class="text-500 font-medium">Eventos</span>
                        <div class="text-4xl font-bold text-900 mt-2">{{ dashboardData.qtd_eventos }}</div>
                        <span class="text-xs text-500">Realizados no período</span>
                    </div>
                </div>

                <div class="col-12 md:col-3">
                    <div class="card p-3 border-left-3 border-blue-500 shadow-1 surface-card text-center h-full">
                        <span class="text-500 font-medium">Lista VIP</span>
                        <div class="text-4xl font-bold text-900 mt-2">{{ dashboardData.totais.vip }}</div>
                        <span class="text-xs text-500">Total em Listas</span>
                    </div>
                </div>
                <div class="col-12 md:col-3">
                    <div class="card p-3 border-left-3 border-orange-500 shadow-1 surface-card text-center h-full">
                        <span class="text-500 font-medium">Força Popular</span>
                        <div class="text-4xl font-bold text-900 mt-2">{{ dashboardData.totais.publico }}</div>
                        <span class="text-xs text-500">Check-ins QR Code</span>
                    </div>
                </div>
                <div class="col-12 md:col-3">
                    <div class="card p-3 border-left-3 border-green-500 shadow-1 surface-card text-center h-full">
                        <span class="text-500 font-medium">Total Geral</span>
                        <div class="text-4xl font-bold text-900 mt-2">{{ dashboardData.totais.geral }}</div>
                        <span class="text-xs text-500">Movimentação Acumulada</span>
                    </div>
                </div>

                <div class="col-12">
                    <div class="card h-full shadow-2 border-round p-4 surface-card">
                        <div class="flex align-items-center justify-content-between mb-3">
                            <h3 class="font-bold m-0 text-lg">Top 10 Eventos (Mais Cheios)</h3>
                            <small class="text-500">VIP + Público</small>
                        </div>
                        <DataTable :value="dashboardData.top_eventos" size="small" stripedRows responsiveLayout="scroll">
                            <Column field="nome" header="Evento"></Column>
                            <Column header="Data" style="width: 120px">
                                <template #body="{data}">{{ new Date(data.data).toLocaleDateString('pt-BR') }}</template>
                            </Column>
                            <Column field="total" header="Total" class="text-right font-bold" style="width: 100px"></Column>
                        </DataTable>
                    </div>
                </div>

                <div class="col-12 md:col-6">
                    <div class="card h-full shadow-2 border-round p-4 surface-card">
                        <div class="flex align-items-center justify-content-between mb-3">
                            <h3 class="font-bold m-0 text-lg">Top Convidados (VIP)</h3>
                            <small class="text-500">Frequência em Listas</small>
                        </div>
                        <DataTable :value="dashboardData.top_convidados" size="small" stripedRows responsiveLayout="scroll">
                            <Column field="perfil__municipe__nome_completo" header="Nome"></Column>
                            <Column header="Categoria">
                                <template #body="{data}"><Tag :value="data.perfil__categoria__nome || data.municipe__categoria__nome || 'Geral'" severity="info" class="text-xs" /></template>
                            </Column>
                            <Column field="frequencia" header="Vezes" class="text-right font-bold" style="width: 60px"></Column>
                        </DataTable>
                    </div>
                </div>

                <div class="col-12 md:col-6">
                    <div class="card h-full shadow-2 border-round p-4 surface-card">
                        <div class="flex align-items-center justify-content-between mb-3">
                            <h3 class="font-bold m-0 text-lg">Top Público (QR Code)</h3>
                            <small class="text-500">Mais Participativos</small>
                        </div>
                        <DataTable :value="dashboardData.top_publico" size="small" stripedRows responsiveLayout="scroll">
                            <Column field="municipe__nome_completo" header="Nome"></Column>
                            <Column header="Categoria">
                                <template #body="{data}"><Tag :value="data.municipe__perfis__categoria__nome || data.municipe__categoria__nome || 'Público'" severity="warning" class="text-xs" /></template>
                            </Column>
                            <Column field="frequencia" header="Vezes" class="text-right font-bold" style="width: 60px"></Column>
                        </DataTable>
                    </div>
                </div>

                <div class="col-12">
                    <div class="card h-full shadow-2 border-round p-4 surface-card">
                        <h3 class="font-bold mb-3 text-lg">Perfil Político Unificado</h3>
                        <div class="h-15rem w-full" v-if="chartPerfilData">
                            <Chart type="bar" :data="chartPerfilData" :options="horizontalOptions" />
                        </div>
                        <div v-else class="text-center p-4">Sem dados de perfil para o período.</div>
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
</style>