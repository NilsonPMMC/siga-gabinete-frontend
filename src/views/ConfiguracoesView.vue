<script setup>
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import Button from 'primevue/button';
import Card from 'primevue/card';
import { useAuthStore } from '@/stores/auth';

const toast = useToast();
const authStore = useAuthStore();

const iniciarAutorizacaoGoogle = async () => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  try {
    // Agora o NOSSO CÓDIGO faz a chamada autenticada
    const response = await apiClient.get('/api/google/auth/initiate/');

    // Pegamos a URL que o backend nos deu
    const authUrl = response.data.authorization_url;

    if (authUrl) {
      // E AGORA mandamos o navegador para a página do Google
      window.location.href = authUrl;
    } else {
      toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível obter a URL de autorização.' });
    }
  } catch (error) {
    console.error("Erro ao iniciar autorização com Google:", error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao iniciar o processo de autorização.' });
  }
};
</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <h1>Configurações do Sistema</h1>
    </header>
    <main>
      <Card>
        <template #title>Integração com Google Agenda</template>
        <template #content>
          <p>Para que o sistema possa criar eventos na sua agenda, você precisa autorizar o acesso uma única vez.</p>
          <p>Clique no botão abaixo para ser redirecionado para a página de autorização do Google.</p>

          <Button 
            label="Autorizar Acesso ao Google Agenda" 
            icon="pi pi-google" 
            class="mt-4 p-button-success" 
            @click="iniciarAutorizacaoGoogle" 
          />

        </template>
      </Card>
    </main>
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { margin-bottom: 2rem; }
</style>