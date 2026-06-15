<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { RouterView, RouterLink, useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/api';
import { isPublicAuthRoute } from '@/utils/authSession';

import Button from 'primevue/button';
import OverlayPanel from 'primevue/overlaypanel';
import { useToast } from "primevue/usetoast";
import AppSidebar from '@/components/AppSidebar.vue';

import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const toast = useToast();

const showAuthenticatedShell = computed(() => (
  authStore.isAuthenticated && !isPublicAuthRoute(route)
));

const sidebarActive = ref(true);
const onMenuToggle = () => {
    sidebarActive.value = !sidebarActive.value;
};

watch(route, () => {
    if (window.innerWidth < 992) {
        sidebarActive.value = false;
    }
});

const notificacoes = ref([]);
const op = ref();
let pollingInterval = null;
let notificacoesAnteriores = 0;

const fetchNotificacoes = async () => {
  if (!authStore.isAuthenticated) return;
  try {
    const response = await apiClient.get('/api/notificacoes/');
    notificacoes.value = response.data;

    if (notificacoes.value.length > notificacoesAnteriores) {
        toast.add({ severity: 'info', summary: 'Nova Notificação', detail: 'Você tem um novo item para verificar.', sticky: true });
    }
    notificacoesAnteriores = notificacoes.value.length;
  } catch (error) {
    if (error?.message !== 'Sessão expirada') {
      console.error('Erro ao buscar notificações:', error);
    }
  }
};

const toggleNotificacoes = (event) => {
  fetchNotificacoes();
  op.value.toggle(event);
};

const handleNotificacaoClick = async (notificacao) => {
  op.value.hide();
  router.push(notificacao.link);
  try {
    await apiClient.post(`/api/notificacoes/${notificacao.id}/marcar-lida/`);
    notificacoes.value = notificacoes.value.filter(n => n.id !== notificacao.id);
  } catch (error) {
    if (error?.message !== 'Sessão expirada') {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  }
};

const iniciarPollingNotificacoes = () => {
  if (pollingInterval) return;
  fetchNotificacoes();
  pollingInterval = setInterval(fetchNotificacoes, 60000);
};

const pararPollingNotificacoes = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  notificacoes.value = [];
  notificacoesAnteriores = 0;
};

const validarSessaoAtual = async () => {
  if (isPublicAuthRoute(route)) return;
  if (!route.meta.requiresAuth) return;

  const ok = await authStore.ensureActiveSession();
  if (!ok) {
    authStore.handleSessionExpired();
  }
};

watch(
  () => showAuthenticatedShell.value,
  (visible, wasVisible) => {
    if (visible) {
      iniciarPollingNotificacoes();
      return;
    }

    pararPollingNotificacoes();

    if (wasVisible && route.meta.requiresAuth) {
      authStore.handleSessionExpired();
    }
  },
  { immediate: true }
);

const onVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    validarSessaoAtual();
  }
};

onMounted(() => {
  validarSessaoAtual();
  document.addEventListener('visibilitychange', onVisibilityChange);
});

onUnmounted(() => {
  pararPollingNotificacoes();
  document.removeEventListener('visibilitychange', onVisibilityChange);
});

const termoBuscaGlobal = ref('');

const executarBusca = () => {
    if (termoBuscaGlobal.value.trim()) {
        router.push({ name: 'busca', query: { q: termoBuscaGlobal.value } });
        termoBuscaGlobal.value = '';
    }
};
</script>

<template>
    <Toast />

    <div v-if="showAuthenticatedShell" :class="['layout-wrapper', { 'layout-sidebar-active': sidebarActive }]">

        <header class="main-header">
            <div class="logo-area">
                <Button icon="pi pi-bars" text rounded @click="onMenuToggle" class="mr-2" />
                <img src="@/assets/logo.png" alt="Logo SIGA" class="logo" @click="router.push('/')" />
            </div>

            <div class="actions-area">
                <div class="busca-container">
                <IconField iconPosition="left">
                    <InputIcon class="pi pi-search"></InputIcon>
                    <InputText v-model="termoBuscaGlobal" placeholder="Busca Rápida..." @keyup.enter="executarBusca" />
                </IconField>
                </div>

                <div class="user-actions">
                <Button icon="pi pi-bell" text rounded class="p-overlay-badge" @click="toggleNotificacoes" v-badge.danger="notificacoes.length" />

                <div class="user-info">
                    <span class="font-bold">{{ authStore.user?.username }}</span>
                    <small>{{ authStore.userGroups.join(', ') }}</small>
                </div>

                <RouterLink to="/configuracoes" v-if="authStore.isSecretaria || authStore.canManageEventos || authStore.user?.is_superuser">
                    <Button icon="pi pi-cog" text rounded severity="secondary" title="Configurações" />
                </RouterLink>

                <Button icon="pi pi-sign-out" text rounded severity="secondary" @click="authStore.logout(true, 'logged_out')" title="Sair" />
                </div>
            </div>
        </header>

        <aside class="layout-sidebar">
            <AppSidebar />
        </aside>

        <main class="layout-main-content">
            <RouterView />
        </main>

        <OverlayPanel ref="op">
            <div class="notificacao-panel">
                <div v-if="notificacoes.length > 0">
                    <div v-for="notificacao in notificacoes" :key="notificacao.id" class="notificacao-item" @click="handleNotificacaoClick(notificacao)">
                        <p>{{ notificacao.mensagem }}</p>
                        <small>{{ new Date(notificacao.data_criacao).toLocaleString('pt-BR') }}</small>
                    </div>
                </div>
                <div v-else class="p-3">
                    <p>Nenhuma nova notificação.</p>
                </div>
            </div>
        </OverlayPanel>
    </div>

    <div v-else class="public-shell">
        <RouterView />
    </div>
</template>

<style>
:root {
    --sidebar-width: 280px;
}

body {
    background-color: var(--surface-ground);
    color: var(--text-color);
}

.public-shell {
    min-height: 100vh;
}

.layout-wrapper {
    transition: margin-left 0.3s;
}

.layout-sidebar {
    position: fixed;
    width: var(--sidebar-width);
    height: 100vh;
    left: 0;
    top: 0;
    background: var(--surface-card);
    border-right: 1px solid var(--surface-border);
    transition: transform 0.3s;
    transform: translateX(-100%);
    z-index: 999;
    padding-top: 5rem;
}

.layout-main-content {
    padding: 2rem;
    transition: margin-left 0.3s;
    margin-left: 0;
}

.layout-wrapper.layout-sidebar-active .layout-sidebar {
    transform: translateX(0);
}

@media (min-width: 992px) {
    .layout-wrapper.layout-sidebar-active .layout-main-content {
        margin-left: var(--sidebar-width);
    }
}

.main-header {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 1000;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background-color: var(--surface-card);
    border-bottom: 1px solid var(--surface-border);
}
.logo-area { display: flex; align-items: center; }
.logo { height: 40px; margin-right: 1rem; cursor: pointer; }
.actions-area { display: flex; align-items: center; gap: 1rem; }
.user-actions { display: flex; align-items: center; gap: 0.5rem; }
.user-info { display: flex; flex-direction: column; text-align: right; line-height: 1.2; }
.user-info small { font-size: 0.75rem; color: var(--text-color-secondary); }
.layout-sidebar{ padding-left: 1rem; }
.p-menu{ border: none; }
.notificacao-panel { max-width: 400px; }
.notificacao-item {
  padding: 1rem;
  border-bottom: 1px solid #dee2e6;
  cursor: pointer;
  transition: background-color 0.2s;
}
.notificacao-item:hover { background-color: #f8f9fa; }
.notificacao-item p { margin: 0 0 0.25rem 0; }
.notificacao-item small { color: #6c757d; }
</style>
