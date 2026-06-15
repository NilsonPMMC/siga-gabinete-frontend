<script setup>
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const props = defineProps({
  chartData: {
    type: Array,
    required: true,
  },
});

const formattedChartData = computed(() => {
  const labels = props.chartData.map((item) => item.nome || 'SEM ASSUNTO');
  const data = props.chartData.map((item) => item.total);

  return {
    labels,
    datasets: [
      {
        label: 'Atendimentos',
        backgroundColor: '#7c3aed',
        data,
      },
    ],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: { display: false },
  },
};
</script>

<template>
  <Bar :data="formattedChartData" :options="chartOptions" />
</template>
