<template>
  <div class="google-accounts-dashboard">
    <!-- Header -->
    <div class="flex justify-content-between align-items-center mb-4">
      <div>
        <h3 class="m-0 text-900">Contas Google Calendar</h3>
        <p class="text-600 mt-1 mb-0">Gerencie suas contas e permissões do Google Calendar</p>
      </div>
      <Button
        label="Atualizar"
        icon="pi pi-refresh"
        severity="secondary"
        @click="loadData"
        :loading="loading"
        size="small"
      />
    </div>

    <!-- Cards de Status Geral -->
    <div class="grid mb-4">
      <div class="col-12 md:col-3">
        <Card class="text-center">
          <template #content>
            <div class="text-2xl font-bold text-blue-600 mb-2">{{ totalAccounts }}</div>
            <div class="text-600">Total de Contas</div>
          </template>
        </Card>
      </div>
      <div class="col-12 md:col-3">
        <Card class="text-center">
          <template #content>
            <div class="text-2xl font-bold text-green-600 mb-2">{{ connectedAccounts }}</div>
            <div class="text-600">Conectadas</div>
          </template>
        </Card>
      </div>
      <div class="col-12 md:col-3">
        <Card class="text-center">
          <template #content>
            <div class="text-2xl font-bold text-orange-600 mb-2">{{ expiringAccounts }}</div>
            <div class="text-600">Expirando</div>
          </template>
        </Card>
      </div>
      <div class="col-12 md:col-3">
        <Card class="text-center">
          <template #content>
            <div class="text-2xl font-bold text-red-600 mb-2">{{ disconnectedAccounts }}</div>
            <div class="text-600">Desconectadas</div>
          </template>
        </Card>
      </div>
    </div>

    <!-- Filtros e Pesquisa -->
    <div class="flex flex-column md:flex-row gap-3 mb-4">
      <div class="flex-auto">
        <IconField iconPosition="left">
          <InputIcon class="pi pi-search" />
          <InputText
            v-model="searchTerm"
            placeholder="Pesquisar contas..."
            class="w-full"
          />
        </IconField>
      </div>
      
      <Dropdown
        v-model="statusFilter"
        :options="statusFilterOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Filtrar por status"
        class="w-full md:w-auto"
      />
      
      <Dropdown
        v-model="permissionFilter"
        :options="permissionFilterOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Filtrar por permissão"
        class="w-full md:w-auto"
      />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center p-6">
      <ProgressSpinner />
      <p class="text-600 mt-3">Carregando contas Google Calendar...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!filteredAccounts.length && !loading" class="text-center p-6">
      <i class="pi pi-inbox text-4xl text-400 mb-4"></i>
      <h4 class="text-600 mb-3">Nenhuma conta encontrada</h4>
      <p class="text-500 mb-4">
        {{ searchTerm || statusFilter || permissionFilter 
           ? 'Nenhuma conta corresponde aos filtros aplicados.' 
           : 'Não há contas Google Calendar configuradas.' }}
      </p>
      <Button
        v-if="!searchTerm && !statusFilter && !permissionFilter"
        label="Configurar no Django Admin"
        icon="pi pi-external-link"
        severity="secondary"
        @click="openDjangoAdmin"
      />
    </div>

    <!-- Lista de Contas -->
    <div v-else class="grid">
      <div
        v-for="account in filteredAccounts"
        :key="account.id"
        class="col-12 lg:col-6 xl:col-4"
      >
        <Card class="h-full account-card" :class="{ 'default-account': account.eh_padrao }">
          <template #header>
            <div class="p-3 pb-0">
              <div class="flex justify-content-between align-items-start">
                <div class="flex-1">
                  <div class="flex align-items-center mb-2">
                    <h4 class="m-0 mr-2">{{ account.nome }}</h4>
                    <Tag v-if="account.eh_padrao" severity="info" value="Padrão" />
                  </div>
                  <p class="text-500 text-sm mb-0">{{ account.email_google }}</p>
                  <small v-if="account.descricao" class="text-400">{{ account.descricao }}</small>
                </div>
                <div class="flex gap-2 align-items-center flex-shrink-0">
                  <GoogleAccountStatus :account="account" iconOnly size="small" />
                  <PermissionBadge
                    :permissions="account.permissoes_usuario"
                    iconOnly
                    size="small"
                  />
                </div>
              </div>
            </div>
          </template>

          <template #content>
            <div class="px-3 pb-3">
              <!-- Informações do Token -->
              <div class="mb-3" v-if="account.token_status">
                <label class="text-sm font-medium text-600 mb-2 block">Status do Token:</label>
                <div class="text-sm text-500">
                  <div class="flex justify-content-between mb-1">
                    <span>Válido:</span>
                    <span :class="account.token_status.has_valid_token ? 'text-green-600' : 'text-red-600'">
                      {{ account.token_status.has_valid_token ? 'Sim' : 'Não' }}
                    </span>
                  </div>
                  <div v-if="account.token_status.expires_at" class="flex justify-content-between">
                    <span>Expira:</span>
                    <span :class="account.token_status.expires_soon ? 'text-orange-600' : 'text-green-600'">
                      {{ formatExpiryDate(account.token_status.expires_at) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Estatísticas -->
              <div class="mb-3">
                <label class="text-sm font-medium text-600 mb-2 block">Informações:</label>
                <div class="grid text-center">
                  <div class="col-6">
                    <div class="text-lg font-bold text-blue-600">{{ account.total_usuarios || 0 }}</div>
                    <div class="text-xs text-500">Usuários</div>
                  </div>
                  <div class="col-6">
                    <div class="text-lg font-bold text-purple-600">{{ account.calendar_id ? 'Sim' : 'Não' }}</div>
                    <div class="text-xs text-500">Calendar ID</div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template #footer>
            <div class="p-3 pt-0">
              <div class="flex gap-2">
                <!-- Botão de Autorização SIMPLIFICADO -->
                <Button
                  v-if="needsAuthorization(account)"
                  label="Autorizar"
                  icon="pi pi-key"
                  severity="warning"
                  size="small"
                  class="flex-1"
                  @click="startOAuth(account)"
                  :loading="authorizingAccount === account.id"
                />

                <!-- Botão de Renovar Token -->
                <Button
                  v-else-if="tokenExpiring(account)"
                  label="Renovar"
                  icon="pi pi-refresh"
                  severity="info"
                  size="small"
                  class="flex-1"
                  @click="renewToken(account)"
                  :loading="renewingAccount === account.id"
                />

                <!-- Botão de Teste (para contas conectadas) -->
                <Button
                  v-else-if="account.token_status?.has_valid_token && canCreateEvents(account)"
                  label="Criar Teste"
                  icon="pi pi-plus"
                  severity="success"
                  size="small"
                  class="flex-1"
                  @click="createTestEvent(account)"
                  :loading="testingAccount === account.id"
                />

                <!-- Botão de Detalhes -->
                <Button
                  icon="pi pi-info-circle"
                  severity="secondary"
                  size="small"
                  @click="showAccountDetails(account)"
                  v-tooltip="'Ver detalhes'"
                />
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- Modal de Detalhes -->
    <Dialog
      v-model:visible="showDetailsModal"
      :header="`Detalhes - ${selectedAccountDetails?.nome}`"
      :modal="true"
      :style="{ width: '600px' }"
    >
      <div v-if="selectedAccountDetails">
        <!-- Informações básicas -->
        <div class="grid mb-4">
          <div class="col-6">
            <label class="font-medium text-sm text-600">Nome:</label>
            <p class="mt-1 mb-2">{{ selectedAccountDetails.nome }}</p>
          </div>
          <div class="col-6">
            <label class="font-medium text-sm text-600">Email:</label>
            <p class="mt-1 mb-2">{{ selectedAccountDetails.email_google }}</p>
          </div>
          <div class="col-6">
            <label class="font-medium text-sm text-600">Calendar ID:</label>
            <p class="mt-1 mb-2 font-mono text-sm">{{ selectedAccountDetails.calendar_id || 'Não configurado' }}</p>
          </div>
          <div class="col-6">
            <label class="font-medium text-sm text-600">Conta Padrão:</label>
            <p class="mt-1 mb-2">
              <Tag :value="selectedAccountDetails.eh_padrao ? 'Sim' : 'Não'" 
                   :severity="selectedAccountDetails.eh_padrao ? 'success' : 'secondary'" />
            </p>
          </div>
        </div>

        <!-- Status completo -->
        <div class="mb-4">
          <label class="font-medium text-sm text-600 mb-3 block">Status de Conexão:</label>
          <GoogleAccountStatus :account="selectedAccountDetails" showTooltip />
        </div>

        <!-- Permissões detalhadas -->
        <div class="mb-4">
          <label class="font-medium text-sm text-600 mb-3 block">Permissões Detalhadas:</label>
          <PermissionBadge :permissions="selectedAccountDetails.permissoes_usuario" showDetails showTooltip />
        </div>

        <!-- JSON Raw (para debug) -->
        <Panel header="Dados Técnicos" :toggleable="true" :collapsed="true">
          <pre class="text-xs bg-gray-100 p-2 border-round overflow-auto">{{ JSON.stringify(selectedAccountDetails, null, 2) }}</pre>
        </Panel>
      </div>
    </Dialog>

    <!-- Modal de OAuth -->
    <Dialog
      v-model:visible="showOAuthModal"
      header="Autorização Google Calendar"
      :modal="true"
      :closable="false"
      :style="{ width: '400px' }"
    >
      <div class="text-center p-4">
        <i class="pi pi-google text-6xl text-blue-500 mb-4"></i>
        <h3 class="mb-3">Aguardando autorização...</h3>
        <p class="text-600 mb-4">Complete a autorização na janela aberta e retorne aqui.</p>
        <ProgressSpinner />
      </div>
      
      <template #footer>
        <Button label="Cancelar" severity="secondary" @click="cancelOAuth" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import apiClient from '@/api';
import GoogleAccountStatus from './GoogleAccountStatus.vue';
import PermissionBadge from './PermissionBadge.vue';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  extractGoogleAccountsPayload,
  normalizeGoogleAccounts,
} from '@/utils/googleCalendarAccount';

// Composables
const toast = useToast();

// State
const accounts = ref([]);
const loading = ref(false);
const searchTerm = ref('');
const statusFilter = ref('');
const permissionFilter = ref('');
const authorizingAccount = ref(null);
const renewingAccount = ref(null);
const testingAccount = ref(null);
const showDetailsModal = ref(false);
const selectedAccountDetails = ref(null);
const showOAuthModal = ref(false);
const oauthWindow = ref(null);
const oauthCheckInterval = ref(null);
const currentOAuthAccount = ref(null);

// Filter Options
const statusFilterOptions = [
  { label: 'Todos os Status', value: '' },
  { label: 'Conectadas', value: 'connected' },
  { label: 'Desconectadas', value: 'disconnected' },
  { label: 'Expirando', value: 'expiring' }
];

const permissionFilterOptions = [
  { label: 'Todas as Permissões', value: '' },
  { label: 'Administrador', value: 'admin' },
  { label: 'Editor', value: 'editor' },
  { label: 'Criador', value: 'creator' },
  { label: 'Leitor', value: 'reader' },
  { label: 'Sem Acesso', value: 'none' }
];

// Computed
const totalAccounts = computed(() => accounts.value.length);

const connectedAccounts = computed(() => 
  accounts.value.filter(acc => acc.token_status?.has_valid_token && !acc.token_status?.expires_soon).length
);

const expiringAccounts = computed(() => 
  accounts.value.filter(acc => acc.token_status?.expires_soon).length
);

const disconnectedAccounts = computed(() => 
  accounts.value.filter(acc => !acc.token_status?.has_valid_token).length
);

const filteredAccounts = computed(() => {
  let filtered = accounts.value;
  
  // Filtro de pesquisa
  if (searchTerm.value) {
    const search = searchTerm.value.toLowerCase();
    filtered = filtered.filter(acc => 
      acc.nome.toLowerCase().includes(search) ||
      acc.email_google.toLowerCase().includes(search) ||
      (acc.descricao && acc.descricao.toLowerCase().includes(search))
    );
  }
  
  // Filtro de status
  if (statusFilter.value) {
    filtered = filtered.filter(acc => {
      switch (statusFilter.value) {
        case 'connected':
          return acc.token_status?.has_valid_token && !acc.token_status?.expires_soon;
        case 'disconnected':
          return !acc.token_status?.has_valid_token;
        case 'expiring':
          return acc.token_status?.expires_soon;
        default:
          return true;
      }
    });
  }
  
  // Filtro de permissão
  if (permissionFilter.value) {
    filtered = filtered.filter(acc => {
      const perms = acc.permissoes_usuario;
      if (!perms) return permissionFilter.value === 'none';
      
      switch (permissionFilter.value) {
        case 'admin':
          return perms.pode_visualizar && perms.pode_criar && perms.pode_editar && perms.pode_excluir;
        case 'editor':
          return perms.pode_visualizar && perms.pode_criar && perms.pode_editar && !perms.pode_excluir;
        case 'creator':
          return perms.pode_visualizar && perms.pode_criar && !perms.pode_editar && !perms.pode_excluir;
        case 'reader':
          return perms.pode_visualizar && !perms.pode_criar && !perms.pode_editar && !perms.pode_excluir;
        case 'none':
          return !perms.pode_visualizar && !perms.pode_criar && !perms.pode_editar && !perms.pode_excluir;
        default:
          return true;
      }
    });
  }
  
  return filtered;
});

// Methods
const loadData = async () => {
  loading.value = true;
  try {
    const response = await apiClient.get('/api/contas-google/status/');
    accounts.value = normalizeGoogleAccounts(
      extractGoogleAccountsPayload(response.data)
    );
  } catch (error) {
    console.error('Erro ao carregar contas:', error);
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

const needsAuthorization = (account) => {
  return Boolean(account.token_status?.precisa_autorizacao);
};

const tokenExpiring = (account) => {
  return account.token_status?.has_valid_token && account.token_status?.expires_soon;
};

const canCreateEvents = (account) => {
  return account.permissoes_usuario?.pode_criar === true;
};

const canUserAuthorize = (account) => {
  if (!account.permissoes_usuario) return false;
  const perms = account.permissoes_usuario;
  // Usuário pode autorizar se tem permissão de editar ou é admin
  return perms.pode_editar || (perms.pode_visualizar && perms.pode_criar && perms.pode_excluir);
};

const startOAuth = async (account) => {
  authorizingAccount.value = account.id;
  currentOAuthAccount.value = account;
  
  try {
    // Mapear Client IDs por conta (hardcoded como fallback)
    const clientIdMap = {
      1: '665750686651-f5m7bjam5hs53i3jjdeqkomee2jgk4f1.apps.googleusercontent.com', // Agenda Principal
      2: '385184975578-qrqhhlm48mno1khmmgof5t5pp3imi1gh.apps.googleusercontent.com'  // Agenda Privada
    };
    
    // Tentar usar client_id da API, senão usar o mapeamento
    let clientId = account?.client_id;
    
    if (!clientId) {
      clientId = clientIdMap[account.id];
      console.warn(`Client ID não encontrado na API, usando fallback para conta ${account.id}`);
    }
    
    if (!clientId) {
      toast.add({
        severity: 'error',
        summary: 'Erro de Configuração',
        detail: `Client ID não configurado para a conta ${account.id}`,
        life: 5000
      });
      return;
    }
    
    const redirectUri = encodeURIComponent(`https://gabinete.mogidascruzes.sp.gov.br/api/google-calendar/auth/${account.id}/callback/`);
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events');
    
    const authUrl = `https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&access_type=offline&prompt=consent`;
    
    oauthWindow.value = window.open(
      authUrl,
      'google-oauth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );
    
    showOAuthModal.value = true;
    oauthCheckInterval.value = setInterval(checkOAuthCompletion, 1000);
    
  } catch (error) {
    console.error('Erro ao iniciar OAuth:', error);
    toast.add({
      severity: 'error',
      summary: 'Erro de Autorização',
      detail: 'Não foi possível iniciar o processo de autorização',
      life: 5000
    });
    authorizingAccount.value = null;
  }
};

const checkOAuthCompletion = async () => {
  if (!oauthWindow.value || oauthWindow.value.closed) {
    clearInterval(oauthCheckInterval.value);
    showOAuthModal.value = false;
    authorizingAccount.value = null;
    
    // Recarregar dados para verificar se a autorização foi bem-sucedida
    await loadData();
    
    if (currentOAuthAccount.value) {
      const updatedAccount = accounts.value.find(acc => acc.id === currentOAuthAccount.value.id);
      if (updatedAccount?.token_status?.has_valid_token) {
        toast.add({
          severity: 'success',
          summary: 'Autorização Concluída',
          detail: `Conta "${updatedAccount.nome}" autorizada com sucesso!`,
          life: 5000
        });
      }
    }
    
    currentOAuthAccount.value = null;
  }
};

const cancelOAuth = () => {
  if (oauthWindow.value) {
    oauthWindow.value.close();
  }
  clearInterval(oauthCheckInterval.value);
  showOAuthModal.value = false;
  authorizingAccount.value = null;
  currentOAuthAccount.value = null;
};

const renewToken = async (account) => {
  renewingAccount.value = account.id;
  try {
    await apiClient.post('/api/google-calendar/auth/refresh/', {
      conta_google_id: account.id
    });
    
    await loadData();
    
    toast.add({
      severity: 'success',
      summary: 'Token Renovado',
      detail: `Token da conta "${account.nome}" renovado com sucesso!`,
      life: 3000
    });
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    toast.add({
      severity: 'error',
      summary: 'Erro na Renovação',
      detail: `Não foi possível renovar o token da conta "${account.nome}"`,
      life: 5000
    });
  } finally {
    renewingAccount.value = null;
  }
};

const createTestEvent = async (account) => {
  testingAccount.value = account.id;
  try {
    const now = new Date();
    const endTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hora depois
    
    await apiClient.post('/api/google-calendar/events/create_event/', {
      conta_google_id: account.id,
      titulo: 'Evento de Teste - SIGA',
      descricao: 'Este é um evento de teste criado pelo sistema SIGA para verificar a conexão.',
      data_inicio: now.toISOString(),
      data_fim: endTime.toISOString(),
      localizacao: 'Teste - Sistema SIGA'
    });
    
    toast.add({
      severity: 'success',
      summary: 'Evento de Teste Criado',
      detail: `Evento criado com sucesso na conta "${account.nome}"!`,
      life: 5000
    });
  } catch (error) {
    console.error('Erro ao criar evento de teste:', error);
    toast.add({
      severity: 'error',
      summary: 'Erro no Teste',
      detail: `Não foi possível criar evento de teste na conta "${account.nome}"`,
      life: 5000
    });
  } finally {
    testingAccount.value = null;
  }
};

const showAccountDetails = (account) => {
  selectedAccountDetails.value = account;
  showDetailsModal.value = true;
};

const openDjangoAdmin = () => {
  const adminUrl = '/admin/atendimentos/contagooglecalendar/';
  window.open(adminUrl, '_blank');
};

const formatExpiryDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const expiryDate = parseISO(dateString);
    const days = differenceInDays(expiryDate, new Date());
    
    if (days === 0) {
      return 'Hoje';
    } else if (days === 1) {
      return 'Amanhã';
    } else if (days > 1) {
      return `${days} dias`;
    } else {
      return 'Expirado';
    }
  } catch {
    return 'Data inválida';
  }
};

// Lifecycle
onMounted(() => {
  loadData();
});
</script>

<style scoped>
.google-accounts-dashboard {
  padding: 1rem;
}

.account-card {
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.account-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.account-card.default-account {
  border-color: var(--primary-color);
}

.account-card.default-account::before {
  content: '⭐';
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  font-size: 1.2rem;
  z-index: 1;
}

/* Animações para os cards de estatísticas */
:deep(.p-card-content) {
  padding: 1rem;
}

/* Estilo do filtro */
.p-iconfield {
  position: relative;
}

/* Grid responsivo personalizado */
@media (max-width: 768px) {
  .grid .col-12.md\:col-3 {
    flex: 0 0 50%;
    max-width: 50%;
  }
  
  .grid .col-12.lg\:col-6.xl\:col-4 {
    flex: 0 0 100%;
    max-width: 100%;
  }
}

@media (max-width: 480px) {
  .grid .col-12.md\:col-3 {
    flex: 0 0 100%;
    max-width: 100%;
  }
}

/* Cores personalizadas para os números dos cards */
.text-blue-600 { color: #2563eb !important; }
.text-green-600 { color: #16a34a !important; }
.text-orange-600 { color: #ea580c !important; }
.text-red-600 { color: #dc2626 !important; }
.text-purple-600 { color: #9333ea !important; }

/* Estilo do código JSON */
pre {
  max-height: 300px;
  font-family: 'Courier New', monospace;
}

/* Loading spinner personalizado */
:deep(.p-progress-spinner) {
  width: 2rem;
  height: 2rem;
}
</style>