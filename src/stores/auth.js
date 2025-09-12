import { defineStore } from 'pinia'
import { jwtDecode } from 'jwt-decode'
import apiClient from '@/api'
import router from '@/router'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: localStorage.getItem('access_token') || null,
    refresh: localStorage.getItem('refresh_token') || null,
    userGroups: JSON.parse(localStorage.getItem('user_groups')) || [],
    user: localStorage.getItem('access_token') ? jwtDecode(localStorage.getItem('access_token')) : null
  }),

  getters: {
    isAuthenticated: (state) => !!state.accessToken,
    isSuperuser: (state) => state.user?.is_superuser === true,
    userContas: (state) => { return state.user?.perfil?.contas || []; },
    isRecepcao: (state) => state.userGroups.includes('Recepção'),
    isMembro: (state) => state.userGroups.includes('Membro do Gabinete'),
    isSecretaria: (state) => state.userGroups.includes('Secretária'),
    canManageEventos: (state) => {
      if (!state.user) {
        return false;
      }
      // Superusuários sempre podem
      if (state.user.is_superuser) {
        return true;
      }
      // Verifica se a permissão específica existe na lista de permissões do usuário
      if (state.user.user_permissions && state.user.user_permissions.includes('eventos.pode_gerenciar_eventos')) {
        return true;
      }
      return false;
    },
    canManageOficios: (state) => {
      if (!state.user) return false;
      // Superusuários sempre podem
      if (state.user.is_superuser) return true;
      // Verifica se a permissão específica existe na lista de permissões do usuário
      return state.user.user_permissions?.includes('oficios.pode_gerenciar_oficios') || false;
    },
  },

  actions: {
    async login(username, password) {
      try {
        const response = await apiClient.post('/api/token/', { username, password });
        const { access, refresh } = response.data;
        const decodedToken = jwtDecode(access);

        // Atualiza todo o estado da store
        this.accessToken = access;
        this.refresh = refresh;
        this.user = decodedToken;
        this.userGroups = decodedToken.groups || [];

        // Salva tudo no localStorage para persistência
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        localStorage.setItem('user_groups', JSON.stringify(this.userGroups));

        router.push('/');
        return true;
      } catch (error) {
        this.logout(); // Limpa tudo em caso de falha
        return false;
      }
    },
    logout() {
      this.accessToken = null;
      this.refresh = null;
      this.userGroups = [];
      this.user = null; // Garante que o objeto user seja limpo no logout
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_groups');
      router.push('/login');
    },
    // A ação de refreshTokenAction não precisa de mudanças
    async refreshTokenAction() {
      const response = await apiClient.post('/api/token/refresh/', {
          refresh: this.refresh
      });
      this.accessToken = response.data.access;
      localStorage.setItem('access_token', this.accessToken);
    }
  }
})