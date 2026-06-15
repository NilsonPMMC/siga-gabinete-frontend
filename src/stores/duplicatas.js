import { defineStore } from 'pinia';
import apiClient from '@/api';

export const useDuplicatasStore = defineStore('duplicatas', {
  state: () => ({
    totalGrupos: 0,
    totalContatos: 0,
    loading: false,
  }),

  actions: {
    async fetchContador() {
      this.loading = true;
      try {
        const res = await apiClient.get('/api/municipes/duplicatas/contador/');
        this.totalGrupos = res.data.total_grupos ?? 0;
        this.totalContatos = res.data.total_contatos ?? 0;
      } catch {
        this.totalGrupos = 0;
        this.totalContatos = 0;
      } finally {
        this.loading = false;
      }
    },

    setContador({ totalGrupos = 0, totalContatos = 0 } = {}) {
      this.totalGrupos = totalGrupos;
      this.totalContatos = totalContatos;
    },
  },
});
