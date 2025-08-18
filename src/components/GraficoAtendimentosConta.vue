<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js';

const authStore = useAuthStore();

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const showChartPorGabinete = computed(() => {
    // Superusuário sempre vê o gráfico
    if (authStore.user?.is_superuser) {
        return true;
    }
    // Para outros usuários, mostra apenas se eles tiverem mais de uma conta vinculada
    return authStore.user?.perfil?.contas?.length > 1;
});

const props = defineProps({
  chartData: { type: Array, required: true }
});

const formattedChartData = computed(() => {
  const labels = props.chartData.map(item => item.conta__nome);
  const data = props.chartData.map(item => item.total);

  return {
    labels: labels,
    datasets: [
      {
        label: 'Total de Atendimentos',
        backgroundColor: '#42A5F5',
        data: data
      }
    ]
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y', // Deixa as barras na horizontal, bom para nomes longos
};
</script>

<template>
  <Bar :data="formattedChartData" :options="chartOptions" />
</template>
