<script setup>
import { ref, onMounted } from 'vue';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { useAuthStore } from '@/stores/auth';

const isLoading = ref(true);
const agendasDisponiveis = ref([]);
const toast = useToast();
const authStore = useAuthStore();

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  try {
    const response = await apiClient.get('/api/agendas-compartilhadas/');
    agendasDisponiveis.value = response.data;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar a lista de agendas.', life: 4000 });
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <h1>Agendas da Equipe</h1>
    </header>

    <main>
      <Card>
        <template #content>
          <div v-if="isLoading" class="text-center">
            <ProgressSpinner />
            <p>Carregando agendas disponíveis...</p>
          </div>

          <div v-else-if="agendasDisponiveis.length === 0">
            <Message :closable="false" severity="info">
              Você não tem permissão para visualizar nenhuma agenda compartilhada no momento.
            </Message>
          </div>

          <div v-else>
            <p class="mb-4">Selecione uma agenda para visualizar os compromissos.</p>
            <div class="grid">
              <div v-for="agenda in agendasDisponiveis" :key="agenda.id" class="col-12 md:col-6 lg:col-4">
                <router-link :to="`/agendas-compartilhadas/${agenda.id}`" class="no-underline">
                  <Card class="agenda-card hover:surface-100 transition-duration-150">
                    <template #title>
                      <div class="flex align-items-center gap-2">
                        <i class="pi pi-calendar text-2xl"></i>
                        <span>{{ agenda.nome }}</span>
                      </div>
                    </template>
                    <template #content>
                      <p>Clique para ver os compromissos desta agenda.</p>
                    </template>
                  </Card>
                </router-link>
              </div>
            </div>
          </div>
        </template>
      </Card>
    </main>
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { margin-bottom: 2rem; }
.agenda-card {
  border-left: 5px solid var(--primary-color);
}
.no-underline {
  text-decoration: none;
}
</style>