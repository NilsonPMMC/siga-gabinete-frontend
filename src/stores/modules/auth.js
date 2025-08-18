// src/store/modules/auth.js (exemplo)

const state = {
    user: null, // Supondo que o objeto do usuário (com 'is_superuser' e 'user_permissions') é salvo aqui
  };
  
  // ... mutations, actions ...
  
  const getters = {
    // ... outros getters
    isAuthenticated: state => !!state.user,
    
    // NOSSO NOVO GETTER MÁGICO:
    canManageEventos: state => {
      if (!state.user) return false;
      
      // Superusuários sempre podem
      if (state.user.is_superuser) return true;
      
      // Verifica se a permissão específica existe na lista de permissões do usuário
      if (state.user.user_permissions && state.user.user_permissions.includes('eventos.pode_gerenciar_eventos')) {
          return true;
      }
      
      return false;
    }
  };
  
  export default {
    state,
    // ...
    getters
  };