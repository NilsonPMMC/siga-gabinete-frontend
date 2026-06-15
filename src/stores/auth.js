import { defineStore } from 'pinia'
import { jwtDecode } from 'jwt-decode'
import apiClient from '@/api'
import router from '@/router'
import { hasRecoverableSession, isTokenExpired } from '@/utils/authSession'

export { isTokenExpired } from '@/utils/authSession'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: localStorage.getItem('access_token') || null,
    refresh: localStorage.getItem('refresh_token') || null,
    userGroups: JSON.parse(localStorage.getItem('user_groups')) || [],
    user: localStorage.getItem('access_token') ? jwtDecode(localStorage.getItem('access_token')) : null
  }),

  getters: {
    isAuthenticated: (state) => hasRecoverableSession(state.accessToken, state.refresh) && !!state.user,
    isSuperuser: (state) => state.user?.is_superuser === true,
    userContas: (state) => { return state.user?.perfil?.contas || []; },
    isRecepcao: (state) => state.userGroups.includes('Recepção'),
    isMembro: (state) => state.userGroups.includes('Membro do Gabinete'),
    isSecretaria: (state) => state.userGroups.includes('Secretária'),
    isOperadorCrm: (state) => state.userGroups.includes('Operador CRM'),
    userCategoriasContato: (state) => state.user?.perfil?.categorias_contato || [],
    isUsuarioEstritamenteOperadorCrm: (state) => {
      const user = state.user;
      if (!user) return false;

      const groups = user.groups || state.userGroups || [];
      const temOperador = groups.includes('Operador CRM');
      const temOutroPapel = groups.some((g) => (
        ['Recepção', 'Membro do Gabinete', 'Secretária', 'Gestor de Eventos', 'Gestor de Escalas'].includes(g)
      )) || user.is_superuser;

      return temOperador && !temOutroPapel;
    },
    isUsuarioEstritamenteEscalas: (state) => {
      const user = state.user;
      if (!user) return false;

      const groups = user.groups || [];

      const temEscalas = groups.includes('Escalas');
      const ehChefe = groups.includes('Gestor de Escalas') ||
                      groups.includes('Membro do Gabinete') ||
                      groups.includes('Secretária') ||
                      user.is_superuser;

      return temEscalas && !ehChefe;
    },
    canManageEventos: (state) => {
      if (!state.user) {
        return false;
      }
      if (state.user.is_superuser) {
        return true;
      }
      const groups = state.user.groups || state.userGroups || [];
      if (groups.includes('Gestor de Eventos')) {
        return true;
      }
      if (state.user.user_permissions && state.user.user_permissions.includes('eventos.pode_gerenciar_eventos')) {
        return true;
      }
      return false;
    },
    canManageOficios: (state) => {
      if (!state.user) return false;
      if (state.user.is_superuser) return true;
      return state.user.user_permissions?.includes('oficios.pode_gerenciar_oficios') || false;
    },
    canViewEscalas: (state) => {
      const user = state.user;
      if (!user) return false;

      return user.is_superuser ||
             user.groups.includes('Gestor de Escalas') ||
             user.groups.includes('Escalas');
    },
    canViewRelatoriosAtendimentos: (state) => (
      state.user?.is_superuser
      || state.userGroups.includes('Secretária')
      || state.userGroups.includes('Membro do Gabinete')
      || state.userGroups.includes('Recepção')
    ),
    canViewRelatoriosCheckins: (state) => (
      state.user?.is_superuser || state.userGroups.includes('Recepção')
    ),
    canViewRelatoriosAgendas: (state) => (
      state.user?.is_superuser || state.userGroups.includes('Secretária')
    ),
    canViewSecaoAnalise: (_, getters) => (
      getters.canViewRelatoriosAtendimentos
      || getters.canViewRelatoriosCheckins
      || getters.canViewRelatoriosAgendas
    ),
  },

  actions: {
    clearSession() {
      this.accessToken = null;
      this.refresh = null;
      this.userGroups = [];
      this.user = null;
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_groups');
    },

    handleSessionExpired() {
      const onLogin = router.currentRoute.value.path === '/login';
      this.clearSession();
      if (!onLogin) {
        router.replace({ path: '/login', query: { reason: 'expired' } });
      }
    },

    async login(username, password) {
      try {
        const response = await apiClient.post('/api/token/', { username, password });
        const { access, refresh } = response.data;
        const decodedToken = jwtDecode(access);

        this.accessToken = access;
        this.refresh = refresh;
        this.user = decodedToken;
        this.userGroups = decodedToken.groups || [];

        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        localStorage.setItem('user_groups', JSON.stringify(this.userGroups));

        if (this.isUsuarioEstritamenteOperadorCrm) {
          router.push('/contatos');
        } else {
          router.push('/');
        }
        return true;
      } catch (error) {
        this.clearSession();
        return false;
      }
    },

    logout(redirectToLogin = true, reason = null) {
      this.clearSession();
      if (redirectToLogin && router.currentRoute.value.path !== '/login') {
        const target = reason ? { path: '/login', query: { reason } } : { path: '/login' };
        router.replace(target);
      }
    },

    async refreshTokenAction() {
      if (!this.refresh || isTokenExpired(this.refresh)) {
        throw new Error('Refresh token ausente ou expirado.');
      }

      const response = await apiClient.post('/api/token/refresh/', {
        refresh: this.refresh
      }, {
        _skipAuthRefresh: true,
      });
      this.accessToken = response.data.access;
      this.user = jwtDecode(this.accessToken);
      this.userGroups = this.user?.groups || [];
      localStorage.setItem('access_token', this.accessToken);
      localStorage.setItem('user_groups', JSON.stringify(this.userGroups));
    },

    async ensureActiveSession() {
      if (!this.accessToken && !this.refresh) {
        this.clearSession();
        return false;
      }

      if (this.accessToken && !isTokenExpired(this.accessToken)) {
        if (!this.user) {
          try {
            this.user = jwtDecode(this.accessToken);
            this.userGroups = this.user?.groups || [];
          } catch {
            this.clearSession();
            return false;
          }
        }
        return true;
      }

      if (!this.refresh || isTokenExpired(this.refresh)) {
        this.clearSession();
        return false;
      }

      try {
        await this.refreshTokenAction();
        return true;
      } catch {
        this.clearSession();
        return false;
      }
    }
  }
})
