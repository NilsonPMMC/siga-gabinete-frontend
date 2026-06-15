<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useToast } from 'primevue/usetoast';
import { useRoute, useRouter } from 'vue-router';

const authStore = useAuthStore();
const toast = useToast();
const route = useRoute();
const router = useRouter();
const username = ref('');
const password = ref('');
const isLoading = ref(false);

const handleLogin = async () => {
  isLoading.value = true;
  const success = await authStore.login(username.value, password.value);
  if (!success) {
    toast.add({ severity: 'error', summary: 'Falha no Login', detail: 'Usuário ou senha incorretos.', life: 3000 });
  }
  isLoading.value = false;
};

onMounted(() => {
  if (route.query.reason === 'expired') {
    toast.add({
      severity: 'warn',
      summary: 'Sessão expirada',
      detail: 'Sua sessão expirou. Faça login novamente.',
      life: 4000
    });
    router.replace({ path: '/login' });
    return;
  }

  if (route.query.reason === 'logged_out') {
    toast.add({
      severity: 'success',
      summary: 'Logout realizado',
      detail: 'Você saiu da sessão com sucesso.',
      life: 3000
    });
    router.replace({ path: '/login' });
  }
});
</script>

<template>
  <div class="login-container flex align-items-center justify-content-center">
    <Card class="login-card">
      <template #header>
        <div class="logo-container">
          <img src="@/assets/logo.png" alt="Logo SIGA" />
        </div>
      </template>
      <template #title>
        <div class="text-center">Bem-vindo</div>
      </template>
      <template #subtitle>
        <div class="text-center">Por favor, entre com suas credenciais.</div>
        <br>
      </template>
      <template #content>
        <form @submit.prevent="handleLogin" class="p-fluid">
          <div class="field">
            <FloatLabel>
              <InputText id="username" v-model="username" />
              <label for="username">Usuário</label>
            </FloatLabel>
          </div>
          <div class="field">
            <FloatLabel>
              <Password id="password" v-model="password" :feedback="false" toggleMask :pt="{ input: { style: 'width: 100%' } }" />
              <label for="password">Senha</label>
            </FloatLabel>
          </div>
          <div class="forgot-password">
            <RouterLink to="/recuperar-senha">
              <Button label="Esqueceu a senha?" text class="p-button-sm p-button-secondary" />
            </RouterLink>
          </div>
          <Button type="submit" label="Entrar" class="w-full mt-4" :loading="isLoading" />
        </form>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  background-color: #f8f9fa;
}
.login-card {
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}
.logo-container {
  text-align: center;
  padding: 2rem 0 1rem 0;
}
.logo-container img {
  height: 60px;
}
.field {
  margin-bottom: 2rem;
}
.forgot-password {
  text-align: right;
  margin-top: -1rem;
}
</style>