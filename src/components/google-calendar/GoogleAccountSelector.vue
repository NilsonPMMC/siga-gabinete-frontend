<template>
  <div class="google-account-selector">
    <!-- Seletor Principal -->
    <div>
      
      <Dropdown
        id="googleAccount"
        v-model="selectedAccount"
        :options="availableAccounts"
        optionLabel="displayName"
        optionValue="id"
        placeholder="Selecione uma conta Google"
        :loading="loading"
        class="w-full"
        @change="onAccountChange"
      >
        <template #value="slotProps">
          <div v-if="slotProps.value" class="flex align-items-center">
            <div class="flex flex-column">
              <span class="font-medium">{{ getAccountById(slotProps.value)?.nome }}</span>
              <small class="text-500">{{ getAccountById(slotProps.value)?.email_google }}</small>
            </div>
            <div class="ml-auto">
              <GoogleAccountStatus :account="getAccountById(slotProps.value)" size="small" />
            </div>
          </div>
          <span v-else class="text-500">Selecione uma conta Google</span>
        </template>
        
        <template #option="slotProps">
          <div class="flex align-items-center justify-content-between w-full">
            <div class="flex flex-column">
              <div class="flex align-items-center">
                <span class="font-medium">{{ slotProps.option.nome }}</span>
                <Tag v-if="slotProps.option.eh_padrao" severity="info" value="Padrão" class="ml-2 text-xs" />
              </div>
              <small class="text-500">{{ slotProps.option.email_google }}</small>
              <small class="text-400" v-if="slotProps.option.descricao">{{ slotProps.option.descricao }}</small>
            </div>
            <div class="flex flex-column align-items-end">
              <GoogleAccountStatus :account="slotProps.option" size="small" />
              <PermissionBadge 
                :permissions="slotProps.option.permissoes_usuario" 
                size="small" 
                class="mt-1" 
              />
            </div>
          </div>
        </template>
        
        <template #empty>
          <div class="text-center p-3">
            <i class="pi pi-exclamation-triangle text-yellow-500 text-2xl mb-2"></i>
            <p class="text-600 mb-2">Nenhuma conta Google Calendar disponível</p>
            <small class="text-500">
              {{ hasPermissionToManage ? 'Configure contas no Django Admin' : 'Entre em contato com o administrador' }}
            </small>
          </div>
        </template>
      </Dropdown>
    </div>

    <!-- Botões de Ação -->
    <div class="flex gap-2 mt-3" v-if="selectedAccountData && props.showActions">
      <!-- Botão de Autorização SIMPLIFICADO -->
      <Button
        v-if="needsAuthorization"
        @click="startOAuthFlow"
        severity="warning"
        size="small"
        :loading="authorizing"
      >
        <i class="pi pi-key mr-2"></i>
        Autorizar Acesso Google
      </Button>
      
      <!-- Mensagem explicativa simples -->
      <small v-if="needsAuthorization" class="text-500 mt-1 block">
        Clique para conectar sua conta Google e sincronizar eventos
      </small>

      <!-- Botão de Renovar Token (se expirado) -->
      <Button
        v-if="tokenExpired && !needsAuthorization && !isReadOnlyAccount"
        @click="renewToken"
        severity="info"
        size="small"
        :loading="renewing"
      >
        <i class="pi pi-refresh mr-2"></i>
        Renovar Token
      </Button>

      <!-- Informação da Última Sincronização -->
      <div class="flex align-items-center text-sm text-500 ml-auto" v-if="selectedAccountData.token_status">
        <i class="pi pi-clock mr-1"></i>
        <span>Última sinc: {{ formatDate(selectedAccountData.token_status.last_updated) }}</span>
      </div>
    </div>

    <!-- Modal de Autorização -->
    <Dialog
      v-model:visible="showOAuthModal"
      header="Autorização Google Calendar"
      :modal="true"
      :closable="false"
      :style="{ width: '500px' }"
    >
      <div class="text-center p-4">
        <i class="pi pi-google text-6xl text-blue-500 mb-4"></i>
        <h3 class="mb-3">Aguardando autorização...</h3>
        <p class="text-600 mb-4">
          Uma nova janela foi aberta para autorizar o acesso ao Google Calendar.
          Complete a autorização e retorne a esta tela.
        </p>
        <ProgressSpinner />
      </div>
      
      <template #footer>
        <Button
          label="Cancelar"
          severity="secondary"
          @click="cancelOAuth"
        />
        <Button
          label="Tentar Novamente"
          severity="primary"
          @click="retryOAuth"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/api';
import GoogleAccountStatus from './GoogleAccountStatus.vue';
import PermissionBadge from './PermissionBadge.vue';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  extractGoogleAccountsPayload,
  normalizeGoogleAccount,
  normalizeGoogleAccounts,
  podeAutorizarGoogle,
  isSomenteLeituraSiga,
} from '@/utils/googleCalendarAccount';

// Props
const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: null
  },
  required: {
    type: Boolean,
    default: false
  },
  autoSelectDefault: {
    type: Boolean,
    default: true
  },
  showActions: {
    type: Boolean,
    default: true
  }
});

// Emits
const emit = defineEmits(['update:modelValue', 'account-selected', 'authorization-complete']);

// Composables
const toast = useToast();
const authStore = useAuthStore();

// State
const availableAccounts = ref([]);
const loading = ref(false);
const authorizing = ref(false);
const renewing = ref(false);
const showOAuthModal = ref(false);
const oauthWindow = ref(null);
const oauthCheckInterval = ref(null);

// Computed
const selectedAccount = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const selectedAccountData = computed(() => {
  if (!selectedAccount.value) return null;
  const account = availableAccounts.value.find(acc => acc.id === selectedAccount.value);
  return account ? normalizeGoogleAccount(account) : null;
});

const needsAuthorization = computed(() => {
  const account = selectedAccountData.value;
  if (!account || !podeAutorizarGoogle(account)) return false;
  return Boolean(account.token_status?.precisa_autorizacao);
});

const tokenExpired = computed(() => {
  const status = selectedAccountData.value?.token_status;
  return Boolean(status?.has_valid_token && status?.expires_soon);
});

const isReadOnlyAccount = computed(() => {
  return selectedAccountData.value ? isSomenteLeituraSiga(selectedAccountData.value) : false;
});

const canAuthorize = computed(() => {
  if (!selectedAccountData.value?.permissoes_usuario) return false;
  const perms = selectedAccountData.value.permissoes_usuario;
  // Usuário pode autorizar se tem permissão de editar ou é admin
  return perms.pode_editar || (perms.pode_visualizar && perms.pode_criar && perms.pode_excluir);
});

const hasPermissionToManage = computed(() => {
  // Verificar se o usuário tem permissão para gerenciar contas (baseado no perfil/grupos)
  return true; // Por enquanto sempre true, implementar lógica específica
});

// Methods
const waitForAuthToken = async (timeoutMs = 5000) => {
  const step = 50;
  let waited = 0;
  while (!authStore.accessToken && waited < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, step));
    waited += step;
  }
  return Boolean(authStore.accessToken);
};

const loadAccounts = async () => {
  if (!(await waitForAuthToken())) {
    return;
  }

  loading.value = true;
  try {
    const response = await apiClient.get('/api/contas-google/');
    availableAccounts.value = normalizeGoogleAccounts(
      extractGoogleAccountsPayload(response.data)
    );

    if (props.autoSelectDefault && !selectedAccount.value && availableAccounts.value.length > 0) {
      const defaultAccount = availableAccounts.value.find(acc => acc.eh_padrao)
        || availableAccounts.value[0];
      if (defaultAccount) {
        selectedAccount.value = defaultAccount.id;
        emit('account-selected', normalizeGoogleAccount(defaultAccount));
      }
    }
  } catch (error) {
    console.error('Erro ao carregar contas Google:', error);
    toast.add({
      severity: 'error',
      summary: 'Erro',
      detail: 'Não foi possível carregar as contas Google Calendar',
      life: 5000
    });
  } finally {
    loading.value = false;
  }
};

const getAccountById = (id) => {
  const account = availableAccounts.value.find(acc => acc.id === id);
  return account ? normalizeGoogleAccount(account) : null;
};

const onAccountChange = () => {
  emit('account-selected', selectedAccountData.value);
};

const startOAuthFlow = async () => {
  if (!selectedAccountData.value) return;
  
  authorizing.value = true;
  try {
    // Mapear Client IDs por conta (hardcoded como fallback)
    const clientIdMap = {
      1: '665750686651-f5m7bjam5hs53i3jjdeqkomee2jgk4f1.apps.googleusercontent.com', // Agenda Principal
      2: '385184975578-qrqhhlm48mno1khmmgof5t5pp3imi1gh.apps.googleusercontent.com'  // Agenda Privada
    };
    
    // Tentar usar client_id da API, senão usar o mapeamento
    let clientId = selectedAccountData.value?.client_id;
    
    if (!clientId) {
      clientId = clientIdMap[selectedAccountData.value.id];
      console.warn(`Client ID não encontrado na API, usando fallback para conta ${selectedAccountData.value.id}`);
    }
    
    if (!clientId) {
      toast.add({
        severity: 'error',
        summary: 'Erro de Configuração',
        detail: `Client ID não configurado para a conta ${selectedAccountData.value.id}`,
        life: 5000
      });
      return;
    }
    
    const redirectUri = encodeURIComponent(`https://gabinete.mogidascruzes.sp.gov.br/api/google-calendar/auth/${selectedAccountData.value.id}/callback/`);
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');
    
    const authUrl = `https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&access_type=offline&prompt=consent`;
    
    // Abrir janela popup para OAuth
    oauthWindow.value = window.open(
      authUrl,
      'google-oauth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );
    
    showOAuthModal.value = true;
    
    // Monitorar o fechamento da janela
    oauthCheckInterval.value = setInterval(checkOAuthCompletion, 1000);
    
  } catch (error) {
    console.error('Erro ao iniciar OAuth:', error);
    toast.add({
      severity: 'error',
      summary: 'Erro de Autorização',
      detail: 'Não foi possível iniciar o processo de autorização',
      life: 5000
    });
    authorizing.value = false;
  }
};

const checkOAuthCompletion = async () => {
  if (!oauthWindow.value || oauthWindow.value.closed) {
    clearInterval(oauthCheckInterval.value);
    showOAuthModal.value = false;
    authorizing.value = false;
    
    // Recarregar dados da conta para verificar se a autorização foi bem-sucedida
    await loadAccounts();
    
    if (selectedAccountData.value?.token_status?.has_valid_token) {
      toast.add({
        severity: 'success',
        summary: 'Autorização Concluída',
        detail: 'Conta Google Calendar autorizada com sucesso!',
        life: 5000
      });
      emit('authorization-complete', selectedAccountData.value);
    }
  }
};

const cancelOAuth = () => {
  if (oauthWindow.value) {
    oauthWindow.value.close();
  }
  clearInterval(oauthCheckInterval.value);
  showOAuthModal.value = false;
  authorizing.value = false;
};

const retryOAuth = () => {
  cancelOAuth();
  setTimeout(() => startOAuthFlow(), 500);
};

const renewToken = async () => {
  if (!selectedAccountData.value) return;
  
  renewing.value = true;
  try {
    await apiClient.post(`/api/google-calendar/auth/refresh/`, {
      conta_google_id: selectedAccountData.value.id
    });
    
    await loadAccounts();
    
    toast.add({
      severity: 'success',
      summary: 'Token Renovado',
      detail: 'Token de acesso renovado com sucesso!',
      life: 3000
    });
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    toast.add({
      severity: 'error',
      summary: 'Erro na Renovação',
      detail: 'Não foi possível renovar o token de acesso',
      life: 5000
    });
  } finally {
    renewing.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'Nunca';
  try {
    return format(parseISO(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  } catch {
    return 'Data inválida';
  }
};

// Lifecycle
onMounted(() => {
  void loadAccounts();
});

watch(
  () => authStore.accessToken,
  (token) => {
    if (token && !loading.value && availableAccounts.value.length === 0) {
      void loadAccounts();
    }
  }
);

watch(
  () => props.modelValue,
  (id) => {
    if (!id || !availableAccounts.value.length) return;
    const account = availableAccounts.value.find((acc) => acc.id === id);
    if (account) {
      emit('account-selected', normalizeGoogleAccount(account));
    }
  }
);

// Watchers — apenas @change do Dropdown dispara account-selected (evita duplicata)
</script>

<style scoped>
.google-account-selector {
  width: 100%;
}

.p-dropdown .p-dropdown-trigger {
  width: 3rem;
}

/* Customizações para o status de conexão */
:deep(.p-dropdown-item) {
  padding: 0.75rem 1rem;
}

/* Animação suave para mudanças de estado */
.field {
  transition: all 0.3s ease;
}

.google-account-selector:deep(.p-dropdown) {
  transition: border-color 0.3s ease;
}

.google-account-selector:deep(.p-dropdown:hover) {
  border-color: var(--primary-color);
}
</style>