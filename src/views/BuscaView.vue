<script setup>
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from 'primevue/usetoast';
import InputSwitch from 'primevue/inputswitch';
import Tag from 'primevue/tag';
import Message from 'primevue/message';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const resultados = ref([]);
const isLoading = ref(false);
const termoBusca = ref(route.query.q || '');
const usaBuscaIA = ref(route.query.ia === '1' || route.query.ia === 'true');
const modoBuscaAtual = ref('textual');
const iaFallback = ref(false);
const authStore = useAuthStore();

const atualizarUrl = (termo) => {
  const query = { q: termo };
  if (usaBuscaIA.value) query.ia = '1';
  router.replace({ name: 'busca', query });
};

const buscar = async (termo) => {
  if (!termo || termo.length < 3) {
    resultados.value = [];
    modoBuscaAtual.value = 'textual';
    iaFallback.value = false;
    return;
  }
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  iaFallback.value = false;

  try {
    const params = { q: termo };
    if (usaBuscaIA.value) params.ia = '1';

    const response = await apiClient.get('/api/busca/', { params });

    if (Array.isArray(response.data)) {
      resultados.value = response.data;
      modoBuscaAtual.value = 'textual';
    } else {
      resultados.value = response.data.resultados || [];
      modoBuscaAtual.value = response.data.modo_busca || 'textual';
      iaFallback.value = !!response.data.ia_fallback;
      if (usaBuscaIA.value && iaFallback.value) {
        toast.add({
          severity: 'warn',
          summary: 'Busca Inteligente',
          detail: 'IA indisponível ou sem resultados. Exibindo busca textual.',
          life: 4000,
        });
      }
    }
  } catch (error) {
    console.error('Erro ao realizar busca:', error);
    resultados.value = [];
    toast.add({
      severity: 'error',
      summary: 'Erro na busca',
      detail: error.response?.data?.detail || 'Não foi possível realizar a busca.',
      life: 4000,
    });
  } finally {
    isLoading.value = false;
  }
};

watch(
  () => [route.query.q, route.query.ia],
  ([novoTermo, novoIa]) => {
    termoBusca.value = novoTermo || '';
    usaBuscaIA.value = novoIa === '1' || novoIa === 'true';
    buscar(novoTermo);
  },
  { immediate: true }
);

const onToggleIA = () => {
  const termo = (termoBusca.value || '').trim();
  if (termo.length >= 3) {
    atualizarUrl(termo);
    buscar(termo);
  }
};

const irParaResultado = (resultado) => {
  router.push(resultado.url);
};

const scoreSeverity = (score) => {
  if (score >= 90) return 'success';
  if (score >= 70) return 'warning';
  return 'info';
};
</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <div class="flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h1>Resultados da Busca para: "{{ termoBusca }}"</h1>
          <p class="mt-2 text-color-secondary text-sm">
            Busca tolerante a acentos e ordem de nomes. Inclui protocolo, título, munícipe (nome, CPF, matrícula, perfil).
          </p>
        </div>
        <div class="flex align-items-center gap-2">
          <InputSwitch id="usaBuscaIA" v-model="usaBuscaIA" @update:model-value="onToggleIA" />
          <label for="usaBuscaIA" class="cursor-pointer flex align-items-center gap-1">
            <i class="pi pi-sparkles"></i>
            <span>Busca Inteligente</span>
          </label>
        </div>
      </div>
    </header>

    <Message
      v-if="modoBuscaAtual === 'ia' && !iaFallback"
      severity="info"
      :closable="false"
      class="mb-3"
    >
      Resultados ranqueados por relevância semântica (IA).
    </Message>

    <main>
      <div v-if="isLoading">
        <p>Buscando...</p>
      </div>
      <div v-else-if="resultados.length > 0">
        <div
          v-for="item in resultados"
          :key="`${item.tipo}-${item.id}`"
          class="result-item"
          @click="irParaResultado(item)"
        >
          <i v-if="item.tipo === 'atendimento'" class="pi pi-file text-xl mr-3"></i>
          <i v-if="item.tipo === 'municipe'" class="pi pi-user text-xl mr-3"></i>
          <div class="flex-1 min-w-0">
            <div class="font-bold">{{ item.texto_principal }}</div>
            <div class="text-sm text-gray-500">{{ item.texto_secundario }}</div>
          </div>
          <Tag
            v-if="item.score_match != null"
            :value="`${Number(item.score_match).toFixed(1)}%`"
            :severity="scoreSeverity(item.score_match)"
            class="ml-2"
          />
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
