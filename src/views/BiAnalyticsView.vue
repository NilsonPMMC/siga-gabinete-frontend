<script setup>
import { ref, onMounted, watch } from 'vue';
import apiClient from '@/api';
import { useAuthStore } from '@/stores/auth';
import Chart from 'primevue/chart';
import Calendar from 'primevue/calendar';
import Dropdown from 'primevue/dropdown';
import Checkbox from 'primevue/checkbox';

const authStore = useAuthStore();
const isLoading = ref(false);
const isDownloading = ref(false);

const filtros = ref({
    data_inicio: null,
    data_fim: null,
    conta: null,
    apenas_meus: false,
    usuario_id: null
});

const contasDisponiveis = ref([]);
const usuariosDisponiveis = ref([]);

// --- Dados dos Gráficos ---
const chartProdutividadeData = ref(null);
const chartEvolucaoData = ref(null);
const chartSolicitantesData = ref(null);
const chartStatusData = ref(null);

// --- Opções Visuais dos Gráficos (Chart.js) ---
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#495057' } } }
};

const horizontalOptions = { ...commonOptions, indexAxis: 'y' };

const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: 'right', labels: { color: '#495057' } }
    }
};

async function carregarUsuarios() {
    try {
        // CORREÇÃO: O endpoint correto no seu sistema é '/api/usuarios/'
        const res = await apiClient.get('/api/usuarios/');
        
        // Opcional: Ordenar alfabeticamente para facilitar a busca
        usuariosDisponiveis.value = res.data.sort((a, b) => {
            const nomeA = a.first_name || a.username;
            const nomeB = b.first_name || b.username;
            return nomeA.localeCompare(nomeB);
        });

    } catch (error) {
        console.error("Erro ao carregar usuários:", error);
    }
}

onMounted(async () => {
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    filtros.value.data_inicio = trintaDiasAtras;
    filtros.value.data_fim = hoje;
    
    // Carrega usuários se for Superuser
    if (authStore.user?.is_superuser) {
        await carregarUsuarios();
    }

    carregarDashboards();
});

watch(filtros, () => { setTimeout(carregarDashboards, 500); }, { deep: true });

// --- FUNÇÃO DE CARREGAMENTO (Atualizada) ---
async function carregarDashboards() {
    isLoading.value = true;    
    const params = {
        data_inicio: filtros.value.data_inicio?.toISOString().split('T')[0],
        data_fim: filtros.value.data_fim?.toISOString().split('T')[0],
        conta_id: filtros.value.conta,
        apenas_meus: filtros.value.apenas_meus,
        usuario_id: filtros.value.usuario_id // <--- ENVIA O ID SELECIONADO
    };

    try {
        const [resProd, resEvol, resTop, resStatus] = await Promise.all([
            apiClient.get('/api/bi/produtividade-equipe/', { params }),
            apiClient.get('/api/bi/evolucao-temporal/', { params }),
            apiClient.get('/api/bi/top-solicitantes/', { params }),
            apiClient.get('/api/bi/status-distribuicao/', { params })
        ]);

        montarGraficoProdutividade(resProd.data);
        montarGraficoEvolucao(resEvol.data);
        montarGraficoSolicitantes(resTop.data);
        montarGraficoStatus(resStatus.data);

    } catch (error) {
        console.error("Erro ao carregar BI:", error);
    } finally {
        isLoading.value = false;
    }
}

// --- FUNÇÃO PARA BAIXAR PDF ---
async function baixarRelatorioPdf() {
    isDownloading.value = true;
    const params = {
        data_inicio: filtros.value.data_inicio?.toISOString().split('T')[0],
        data_fim: filtros.value.data_fim?.toISOString().split('T')[0],
        conta_id: filtros.value.conta,
        apenas_meus: filtros.value.apenas_meus,
        usuario_id: filtros.value.usuario_id // <--- ENVIA O ID AQUI TAMBÉM
    };

    // ... resto da função igual ...
    try {
        const response = await apiClient.get('/api/bi/relatorio-pdf/', {
            params: params,
            responseType: 'blob'
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
        console.error("Erro PDF:", error);
        alert("Erro ao gerar relatório.");
    } finally {
        isDownloading.value = false;
    }
}

// --- Montadores de Gráficos (Helpers) ---
function montarGraficoProdutividade(data) {
    chartProdutividadeData.value = {
        labels: data.map(item => item.nome_responsavel),
        datasets: [{
            label: 'Atendimentos Realizados',
            backgroundColor: '#42A5F5',
            data: data.map(item => item.total)
        }]
    };
}

function montarGraficoEvolucao(data) {
    chartEvolucaoData.value = {
        labels: data.map(item => {
            const d = new Date(item.data_ref);
            return `${d.getMonth()+1}/${d.getFullYear()}`; // Ex: 01/2025
        }),
        datasets: [{
            label: 'Volume Mensal',
            data: data.map(item => item.total),
            fill: true,
            borderColor: '#FFA726',
            backgroundColor: 'rgba(255, 167, 38, 0.2)',
            tension: 0.4
        }]
    };
}

function montarGraficoSolicitantes(data) {
    chartSolicitantesData.value = {
        labels: data.map(item => item.nome), // Nome do munícipe
        datasets: [{
            label: 'Total de Pedidos',
            backgroundColor: '#66BB6A',
            data: data.map(item => item.total)
        }]
    };
}

function montarGraficoStatus(data) {
    const colorMap = {
        'CONCLUIDO': '#22C55E',   // Verde
        'ABERTO': '#3B82F6',      // Azul
        'EM_ANALISE': '#F59E0B',  // Laranja/Amarelo
        'ENCAMINHADO': '#A855F7', // Roxo
        'ARQUIVADO': '#64748B'    // Cinza
    };

    const backgroundColors = data.map(item => colorMap[item.status_code] || '#9CA3AF');

    chartStatusData.value = {
        labels: data.map(item => item.label),
        datasets: [{
            data: data.map(item => item.total),
            backgroundColor: backgroundColors,
            hoverBackgroundColor: backgroundColors
        }]
    };
}
</script>

<template>
    <div class="page-container">
        <div class="header-container mb-4">
            <h1 class="page-title text-3xl font-bold text-900">Painel de Inteligência (BI)</h1>
            <p class="text-600">Análise estratégica de dados do Gabinete.</p>
        </div>

        <div class="card mb-4 p-4 surface-card border-round shadow-2">
            <div class="flex flex-column md:flex-row gap-4 align-items-end flex-wrap">
                
                <div class="field mb-0">
                    <label class="block text-900 font-medium mb-1">Período De</label>
                    <Calendar v-model="filtros.data_inicio" dateFormat="dd/mm/yy" showIcon />
                </div>
                <div class="field mb-0">
                    <label class="block text-900 font-medium mb-1">Até</label>
                    <Calendar v-model="filtros.data_fim" dateFormat="dd/mm/yy" showIcon />
                </div>

                <div class="field mb-0 flex align-items-center h-full pb-2">
                    
                    <div v-if="authStore.user?.is_superuser" class="flex flex-column">
                        <label class="text-xs text-600 mb-1">Filtrar por Responsável</label>
                        <Dropdown 
                            v-model="filtros.usuario_id" 
                            :options="usuariosDisponiveis" 
                            optionValue="id" 
                            placeholder="Todos os usuários" 
                            showClear
                            filter 
                            class="w-15rem"
                        >
                            <template #value="slotProps">
                                <div v-if="slotProps.value">
                                    {{ usuariosDisponiveis.find(u => u.id === slotProps.value)?.first_name || 
                                    usuariosDisponiveis.find(u => u.id === slotProps.value)?.username }}
                                </div>
                                <span v-else>
                                    {{ slotProps.placeholder }}
                                </span>
                            </template>

                            <template #option="slotProps">
                                <div class="flex flex-column">
                                    <span class="font-bold">{{ slotProps.option.first_name || slotProps.option.username }}</span>
                                    <small v-if="slotProps.option.first_name" class="text-xs text-500">({{ slotProps.option.username }})</small>
                                </div>
                            </template>
                        </Dropdown>
                    </div>

                    <div v-else class="flex align-items-center">
                        <Checkbox v-model="filtros.apenas_meus" :binary="true" inputId="meus" />
                        <label for="meus" class="m-0 ml-2 cursor-pointer select-none">Apenas meus números</label>
                    </div>

                </div>

                <div class="field mb-0 ml-auto flex gap-2">
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
            </div>
        </div>

        <div class="grid">
            
            <div class="col-12 lg:col-4">
                <div class="card h-full shadow-2 border-round p-4 surface-card">
                    <h3 class="text-xl font-medium text-900 mb-3">Status dos Atendimentos</h3>
                    <div style="height: 300px;" class="flex align-items-center justify-content-center">
                        <Chart type="doughnut" :data="chartStatusData" :options="pieOptions" class="w-full" />
                    </div>
                </div>
            </div>

            <div class="col-12 lg:col-8">
                <div class="card h-full shadow-2 border-round p-4 surface-card">
                    <h3 class="text-xl font-medium text-900 mb-3">Evolução Temporal</h3>
                    <div style="height: 300px;">
                        <Chart type="line" :data="chartEvolucaoData" :options="commonOptions" class="h-full" />
                    </div>
                </div>
            </div>

            <div class="col-12 lg:col-6">
                <div class="card h-full shadow-2 border-round p-4 surface-card">
                    <h3 class="text-xl font-medium text-900 mb-3">Produtividade da Equipe</h3>
                    <div style="height: 350px;">
                        <Chart type="bar" :data="chartProdutividadeData" :options="horizontalOptions" class="h-full" />
                    </div>
                </div>
            </div>

            <div class="col-12 lg:col-6">
                <div class="card h-full shadow-2 border-round p-4 surface-card">
                    <h3 class="text-xl font-medium text-900 mb-3">Top 10 Solicitantes</h3>
                    <div style="height: 350px;">
                        <Chart type="bar" :data="chartSolicitantesData" :options="commonOptions" class="h-full" />
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
.page-container { padding: 2rem; background-color: var(--surface-ground); min-height: 100vh; }
/* Ajustes finos de layout se não usar PrimeFlex */
.grid { display: flex; flex-wrap: wrap; margin-right: -1rem; margin-left: -1rem; margin-top: -1rem; }
.col-12 { flex: 0 0 auto; padding: 1rem; width: 100%; }
.lg\:col-8 { flex: 0 0 auto; padding: 1rem; width: 100%; }
.lg\:col-4 { flex: 0 0 auto; padding: 1rem; width: 100%; }

@media (min-width: 992px) {
    .lg\:col-8 { width: 66.66667%; }
    .lg\:col-4 { width: 33.33333%; }
}
</style>