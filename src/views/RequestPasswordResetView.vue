<script setup>
import { ref } from 'vue';
import apiClient from '@/api';
import { useToast } from 'primevue/usetoast';

const email = ref('');
const isLoading = ref(false);
const toast = useToast();

const solicitarReset = async () => {
  if (!email.value.trim()) {
    toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Por favor, digite um endereço de e-mail.' });
    return;
  }
  isLoading.value = true;
  try {
    await apiClient.post('/api/password_reset/', { email: email.value });
    // Se a chamada for bem-sucedida, mostramos a mensagem padrão.
    toast.add({ severity: 'success', summary: 'Verifique seu E-mail', detail: 'Se uma conta com este e-mail existir, um link de redefinição foi enviado.', life: 6000 });
  } catch (error) {
    // Se o backend retornar um erro (como e-mail não encontrado), mostramos a mensagem de erro.
    const errorMsg = error.response?.data?.email?.[0] || 'Ocorreu um erro ao processar sua solicitação.';
    toast.add({ severity: 'error', summary: 'Erro', detail: errorMsg, life: 4000 });
  } finally {
    isLoading.value = false;
  }
};
</script>
<template>
  <div class="form-container">
    <Card>
      <template #header>
        <div class="logo-container">
          <img src="@/assets/logo.png" alt="Logo SIGA" />
        </div>
      </template>
      <template #title>Recuperar Senha</template>
      <template #content>
        <p class="mb-4">Digite seu e-mail cadastrado e enviaremos um link para você redefinir sua senha.</p>
        <form @submit.prevent="solicitarReset" class="p-fluid">
          <div class="field">
            <FloatLabel>
              <InputText id="email" v-model="email" type="email" />
              <label for="email">E-mail</label>
            </FloatLabel>
          </div>
          <Button type="submit" label="Enviar Link de Redefinição" :loading="isLoading" />
        </form>
      </template>
    </Card>
  </div>
</template>
<style scoped>
.form-container { display: flex; align-items: center; justify-content: center; min-height: 80vh; }
.logo-container {
  text-align: center;
  padding: 2rem 0 1rem 0;
}
.logo-container img {
  height: 60px;
}
</style>
