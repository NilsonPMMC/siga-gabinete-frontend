<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/api';
import { useToast } from 'primevue/usetoast';

// Importando componentes
import Button from 'primevue/button';
import Card from 'primevue/card';
import FloatLabel from 'primevue/floatlabel';
import Password from 'primevue/password';

const route = useRoute();
const router = useRouter();
const toast = useToast();

// Variáveis para os campos de senha
const new_password1 = ref('');
const new_password2 = ref('');
const isLoading = ref(false);

// Variáveis para guardar os tokens da URL
const uid = ref('');
const token = ref('');

// Pega o 'uid' e o 'token' da URL quando a página carrega
onMounted(() => {
  uid.value = route.params.uid;
  token.value = route.params.token;
});

const definirNovaSenha = async () => {
  // Validação simples
  if (new_password1.value !== new_password2.value) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'As senhas não coincidem.', life: 3000 });
    return;
  }
  if (!new_password1.value) {
    toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Por favor, digite uma nova senha.', life: 3000 });
    return;
  }

  isLoading.value = true;
  try {
    const payload = {
      uid: uid.value,
      token: token.value,
      new_password1: new_password1.value,
      new_password2: new_password2.value,
    };

    // Esta é a URL padrão do Django para confirmar a redefinição
    // O DRF irá interceptar e processar
    await apiClient.post('/api/password_reset/confirm/', payload);

    toast.add({ severity: 'success', summary: 'Sucesso!', detail: 'Sua senha foi redefinida. Você já pode fazer o login com a nova senha.', life: 6000 });

    // Redireciona para a tela de login após o sucesso
    router.push('/login');

  } catch (error) {
    console.error("Erro ao redefinir senha:", error.response?.data);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Este link de redefinição é inválido ou já foi usado.', life: 4000 });
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="form-container flex align-items-center justify-content-center">
    <Card class="form-card">
      <template #header>
        <div class="logo-container">
          <img src="@/assets/logo.png" alt="Logo SIGA" />
        </div>
      </template>
      <template #title>Definir Nova Senha</template>
      <template #content>
        <p class="mb-4"><strong>Use uma senha forte:</strong> combine letras maiúscula e minúscula, números e caracteres especiais (@#$%).</p>
        <form @submit.prevent="definirNovaSenha" class="p-fluid">
          <div class="field">
            <FloatLabel>
              <Password id="new_password1" v-model="new_password1" toggleMask :feedback="true" />
              <label for="new_password1">Digite a nova senha</label>
            </FloatLabel>
          </div>
          <div class="field">
            <FloatLabel>
              <Password id="new_password2" v-model="new_password2" toggleMask :feedback="true" />
              <label for="new_password2">Confirme a nova senha</label>
            </FloatLabel>
          </div>
          <Button type="submit" label="Salvar Nova Senha" class="w-full" :loading="isLoading" />
        </form>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.form-container {
  min-height: 90vh;
  background-color: #f8f9fa;
}
.form-card {
  width: 100%;
  max-width: 450px;
}
.field {
  margin-bottom: 2rem;
}
.logo-container {
  text-align: center;
  padding: 2rem 0 1rem 0;
}
.logo-container img {
  height: 60px;
}
</style>