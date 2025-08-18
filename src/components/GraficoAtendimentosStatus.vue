<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { Doughnut } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement, CategoryScale } from 'chart.js';

const authStore = useAuthStore();

ChartJS.register(Title, Tooltip, Legend, ArcElement, CategoryScale);

const showChartPorGabinete = computed(() => {
    // Superusuário sempre vê o gráfico
    if (authStore.user?.is_superuser) {
        return true;
    }
    // Para outros usuários, mostra apenas se eles tiverem mais de uma conta vinculada
    return authStore.user?.perfil?.contas?.length > 1;
});

// Este componente recebe os dados como uma "propriedade"
const props = defineProps({
  chartData: {
    type: Array,
    required: true
  }
});

// Esta função transforma os dados da nossa API no formato que o Chart.js entende
const formattedChartData = computed(() => {
  const labels = props.chartData.map(item => item.status.replace('_', ' '));
  const data = props.chartData.map(item => item.total);

  return {
    labels: labels,
    datasets: [
      {
        backgroundColor: ['#42A5F5', '#FFA726', '#66BB6A', '#8D6E63', '#BDBDBD'],
        data: data
      }
    ]
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false
};
</script>

<template>
  <Doughnut :data="formattedChartData" :options="chartOptions" />
</template>
