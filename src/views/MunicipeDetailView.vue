<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/api';
import { useAuthStore } from '@/stores/auth';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const municipeData = ref(null);
const isLoading = ref(true);

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  const municipeId = route.params.id;
  try {
    const response = await apiClient.get(`/api/municipes/${municipeId}/historico/`);
    municipeData.value = response.data;
  } catch (error) {
    console.error("Erro ao buscar histórico do munícipe:", error);
  } finally {
    isLoading.value = false;
  }
});

// Funções para navegar para os detalhes dos itens
const verAtendimento = (id) => router.push(`/atendimentos/${id}`);
const verAgenda = (id) => router.push(`/agendas/editar/${id}`); // Ou para uma futura tela de detalhes da agenda

const podeVerDetalhesAtendimento = () => {
  // Apenas não mostra para a Recepção
  return !authStore.isRecepcao;
};

const podeGerenciarAgenda = () => {
  // Apenas não mostra para Recepção e Membro
  return !authStore.isRecepcao && !authStore.isMembro;
};
</script>

<template>
  <div class="page-container">
    <div v-if="isLoading" class="loading-container">
      <ProgressSpinner />
    </div>

    <div v-else-if="municipeData">
      <div class="header-container">
        <Button label="Voltar aos Contatos" icon="pi pi-arrow-left" @click="router.push('/contatos')" text class="p-button-secondary" />
        <h2 class="page-title">{{ municipeData.nome_completo }}</h2>
      </div>

      <Card class="mb-4">
        <template #title>Dados do Munícipe</template>
        <template #content>
          <div class="grid">
            <div class="col-12 md:col-6"><p><strong>CPF:</strong> {{ municipeData.cpf || 'Não informado' }}</p></div>
            <div class="col-12 md:col-6"><p><strong>Email:</strong> {{ municipeData.email || 'Não informado' }}</p></div>
            <div class="col-12 md:col-6"><p><strong>Cargo/Órgão:</strong> {{ municipeData.cargo_orgao || 'Não informado' }}</p></div>
            <div class="col-12 md:col-6"><p><strong>Telefone:</strong> {{ municipeData.telefones[0]?.numero || 'Não informado' }}</p></div>
          </div>
        </template>
      </Card>

      <TabView>
        <TabPanel header="Histórico de Atendimentos">
            <DataTable :value="municipeData.atendimentos" paginator :rows="5" :loading="isLoading" emptyMessage="Nenhum atendimento encontrado.">
                <Column field="protocolo" header="Protocolo" sortable></Column>
                <Column field="titulo" header="Título" style="width: 50%"></Column>
                <Column field="nome_conta" header="Gabinete"></Column>
                <Column field="status" header="Status" sortable></Column>
                <Column header="Ações">
                  <template #body="slotProps">
                    <Button v-if="podeVerDetalhesAtendimento()" icon="pi pi-eye" text rounded @click="verAtendimento(slotProps.data.id)" title="Ver Detalhes do Atendimento" />
                  </template>
                </Column>
            </DataTable>
        </TabPanel>
        <TabPanel header="Histórico de Agendas">
            <DataTable :value="municipeData.solicitacoes_agenda" paginator :rows="5" :loading="isLoading" emptyMessage="Nenhuma solicitação de agenda encontrada.">
                <Column field="assunto" header="Assunto" style="width: 50%"></Column>
                <Column field="conta_nome" header="Gabinete"></Column>
                <Column field="status" header="Status" sortable></Column>
                <Column header="Ações">
                  <template #body="slotProps">
                    <Button v-if="authStore.isSecretaria || authStore.user?.is_superuser" icon="pi pi-pencil" text rounded severity="secondary" @click="verAgenda(slotProps.data.id)" title="Gerenciar Solicitação" />
                  </template>
                </Column>
            </DataTable>
        </TabPanel>
      </TabView>

    </div>

    <div v-else>
      <p>Munícipe não encontrado.</p>
    </div>
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
</style>