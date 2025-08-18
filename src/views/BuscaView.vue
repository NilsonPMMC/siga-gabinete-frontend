<script setup>
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/api';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const resultados = ref([]);
const isLoading = ref(false);
const termoBusca = ref(route.query.q || '');
const authStore = useAuthStore();

const buscar = async (termo) => {
  if (!termo || termo.length < 3) {
    resultados.value = [];
    return;
  }
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  try {
    const response = await apiClient.get('/api/busca/', { params: { q: termo } });
    resultados.value = response.data;
  } catch (error) {
    console.error("Erro ao realizar busca:", error);
  } finally {
    isLoading.value = false;
  }
};

// Observa mudanças no parâmetro de busca da URL e busca novamente
watch(() => route.query.q, (novoTermo) => {
  termoBusca.value = novoTermo || '';
  buscar(novoTermo);
}, { immediate: true });

const irParaResultado = (resultado) => {
    router.push(resultado.url);
};
</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <h1>Resultados da Busca para: "{{ termoBusca }}"</h1>
    </header>
    <main>
      <div v-if="isLoading">
        <p>Buscando...</p>
      </div>
      <div v-else-if="resultados.length > 0">
        <div v-for="item in resultados" :key="`${item.tipo}-${item.id}`" class="result-item" @click="irParaResultado(item)">
            <i v-if="item.tipo === 'atendimento'" class="pi pi-file text-xl mr-3"></i>
            <i v-if="item.tipo === 'municipe'" class="pi pi-user text-xl mr-3"></i>
            <div>
                <div class="font-bold">{{ item.texto_principal }}</div>
                <div class="text-sm text-gray-500">{{ item.texto_secundario }}</div>
            </div>
        </div>
      </div>
      <div v-else>
        <p>Nenhum resultado encontrado para "{{ termoBusca }}".</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { margin-bottom: 2rem; }
.result-item {
    display: flex;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    transition: background-color 0.2s;
}
.result-item:hover {
    background-color: #f8f9fa;
}
</style>
