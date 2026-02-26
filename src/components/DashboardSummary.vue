<script setup>
import { ref, onMounted, computed } from 'vue';
import apiClient from '@/api';
import Card from 'primevue/card';
import ProgressSpinner from 'primevue/progressspinner';
import { useAuthStore } from '@/stores/auth';

const props = defineProps({
  summaryDataProp: { type: Object, default: null },
  fetchInParent: { type: Boolean, default: false }
});

const authStore = useAuthStore();
const summaryDataLocal = ref(null);
const isLoading = ref(true);

const summaryData = computed(() => props.summaryDataProp ?? summaryDataLocal.value);
const showLoading = computed(() => {
  if (props.fetchInParent) return !props.summaryDataProp;
  return isLoading.value;
});

onMounted(async () => {
  if (!authStore.isAuthenticated) return;
  if (props.fetchInParent) {
    return;
  }
  try {
    const response = await apiClient.get('/api/dashboard/summary/');
    summaryDataLocal.value = response.data;
  } catch (error) {
    console.error("Erro ao buscar resumo do dashboard:", error);
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div v-if="showLoading" class="text-center p-4">
    <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="8" />
  </div>

  <div v-else-if="summaryData" class="grid">

    <div v-if="summaryData.triagens_do_dia !== undefined" class="col-12 md:col-6 lg:col-3">
      <Card class="summary-card" :style="{ backgroundColor: '#EFF6FF', color: '#1E40AF' }">
        <template #title><div class="text-4xl">{{ summaryData.triagens_do_dia }}</div></template>
        <template #content><span class="font-bold">Triagens Realizadas Hoje</span></template>
      </Card>
    </div>
    <div v-if="summaryData.checkins_do_dia !== undefined" class="col-12 md:col-6 lg:col-3">
      <Card class="summary-card" :style="{ backgroundColor: '#F0F9FF', color: '#0369A1' }">
        <template #title><div class="text-4xl">{{ summaryData.checkins_do_dia }}</div></template>
        <template #content><span class="font-bold">Check-ins Realizados Hoje</span></template>
      </Card>
    </div>

    <div v-if="summaryData.novos_atendimentos !== undefined" class="col-12 md:col-6 lg:col-3">
      <Card class="summary-card" :style="{ backgroundColor: '#FFF7ED', color: '#9A3412' }">
        <template #title><div class="text-4xl">{{ summaryData.novos_atendimentos }}</div></template>
        <template #content><span class="font-bold">Novos Atendimentos para Você</span></template>
      </Card>
    </div>
    <div v-if="summaryData.atendimentos_em_analise !== undefined" class="col-12 md:col-6 lg:col-3">
      <Card class="summary-card" :style="{ backgroundColor: '#ECFEFF', color: '#0E7490' }">
        <template #title><div class="text-4xl">{{ summaryData.atendimentos_em_analise }}</div></template>
        <template #content><span class="font-bold">Atendimentos em Análise</span></template>
      </Card>
    </div>

    <div v-if="summaryData.agendas_em_aberto !== undefined" class="col-12 md:col-6 lg:col-3">
      <Card class="summary-card" :style="{ backgroundColor: '#F5F3FF', color: '#6D28D9' }">
        <template #title><div class="text-4xl">{{ summaryData.agendas_em_aberto }}</div></template>
        <template #content><span class="font-bold">Agendas a Confirmar</span></template>
      </Card>
    </div>
    <div v-if="summaryData.agendas_em_analise !== undefined" class="col-12 md:col-6 lg:col-3">
      <Card class="summary-card" :style="{ backgroundColor: '#FCE7F3', color: '#BE185D' }">
        <template #title><div class="text-4xl">{{ summaryData.agendas_em_analise }}</div></template>
        <template #content><span class="font-bold">Agendas em Análise</span></template>
      </Card>
    </div>

  </div>
</template>