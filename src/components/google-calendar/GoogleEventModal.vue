<template>
  <Dialog
    v-model:visible="visible"
    :header="isEditMode ? 'Editar Evento Google Calendar' : 'Novo Evento Google Calendar'"
    :modal="true"
    :closable="true"
    :style="{ width: '700px' }"
    :breakpoints="{ '960px': '75vw', '640px': '90vw' }"
  >
    <form @submit.prevent="submitEvent">
      <!-- Seletor de Conta Google -->
      <div class="field mb-4" v-if="!usaContaFixa">
        <GoogleAccountSelector
          v-model="eventData.conta_google_id"
          required
          @account-selected="onAccountSelected"
          @authorization-complete="onAuthorizationComplete"
        />
      </div>

      <!-- Informações Básicas do Evento -->
      <div class="grid">
        <div class="col-12">
          <div class="field">
            <label for="titulo" class="font-medium">
              Título do Evento
              <span class="text-red-500">*</span>
            </label>
            <InputText
              id="titulo"
              v-model="eventData.titulo"
              placeholder="Digite o título do evento"
              class="w-full"
              :class="{ 'p-invalid': errors.titulo }"
              required
            />
            <small class="p-error" v-if="errors.titulo">{{ errors.titulo }}</small>
          </div>
        </div>

        <div class="col-12">
          <div class="field">
            <label for="descricao" class="font-medium">Descrição</label>
            <Textarea
              id="descricao"
              v-model="eventData.descricao"
              placeholder="Digite uma descrição para o evento (opcional)"
              class="w-full"
              :rows="3"
              :autoResize="true"
            />
          </div>
        </div>
      </div>

      <!-- Data e Hora -->
      <div class="grid">
        <div class="col-6">
          <div class="field">
            <label for="dataInicio" class="font-medium">
              Data/Hora de Início
              <span class="text-red-500">*</span>
            </label>
            <Calendar
              id="dataInicio"
              v-model="eventData.data_inicio"
              showTime
              hourFormat="24"
              dateFormat="dd/mm/yy"
              placeholder="Selecione a data e hora"
              class="w-full"
              :class="{ 'p-invalid': errors.data_inicio }"
              required
            />
            <small class="p-error" v-if="errors.data_inicio">{{ errors.data_inicio }}</small>
          </div>
        </div>

        <div class="col-6">
          <div class="field">
            <label for="dataFim" class="font-medium">
              Data/Hora de Término
              <span class="text-red-500">*</span>
            </label>
            <Calendar
              id="dataFim"
              v-model="eventData.data_fim"
              showTime
              hourFormat="24"
              dateFormat="dd/mm/yy"
              placeholder="Selecione a data e hora"
              class="w-full"
              :class="{ 'p-invalid': errors.data_fim }"
              required
            />
            <small class="p-error" v-if="errors.data_fim">{{ errors.data_fim }}</small>
          </div>
        </div>
      </div>

      <!-- Localização -->
      <div class="field">
        <label for="localizacao" class="font-medium">Localização</label>
        <InputText
          id="localizacao"
          v-model="eventData.localizacao"
          placeholder="Ex: Gabinete da Prefeita, Sala de Reuniões"
          class="w-full"
        />
      </div>

      <!-- Opções Avançadas -->
      <Panel header="Opções Avançadas" :toggleable="true" :collapsed="true" class="mb-4">
        <div class="grid">
          <!-- Lembrete -->
          <div class="col-6">
            <div class="field">
              <label for="lembrete" class="font-medium">Lembrete</label>
              <Dropdown
                id="lembrete"
                v-model="eventData.lembrete_minutos"
                :options="lembreteOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Selecione um lembrete"
                class="w-full"
              />
            </div>
          </div>

          <!-- Visibilidade -->
          <div class="col-6">
            <div class="field">
              <label for="visibilidade" class="font-medium">Visibilidade</label>
              <Dropdown
                id="visibilidade"
                v-model="eventData.visibilidade"
                :options="visibilidadeOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Selecione a visibilidade"
                class="w-full"
              />
            </div>
          </div>

          <!-- Convidados -->
          <div class="col-12">
            <div class="field">
              <label for="convidados" class="font-medium">Convidados (E-mails)</label>
              <Chips
                id="convidados"
                v-model="eventData.convidados"
                placeholder="Digite e-mails dos convidados e pressione Enter"
                class="w-full"
                :addOnBlur="true"
              />
              <small class="text-500">
                Digite um e-mail e pressione Enter para adicionar. Use vírgula para separar múltiplos e-mails.
              </small>
            </div>
          </div>

          <!-- Evento de dia inteiro -->
          <div class="col-12">
            <div class="field-checkbox">
              <Checkbox
                id="diaInteiro"
                v-model="eventData.dia_inteiro"
                :binary="true"
                @change="onDiaInteiroChange"
              />
              <label for="diaInteiro" class="ml-2">Evento de dia inteiro</label>
            </div>
          </div>
        </div>
      </Panel>

      <!-- Status de Permissão -->
      <div v-if="selectedAccount && !canCreateEvents" class="p-3 surface-100 border-round mb-4">
        <div class="flex align-items-center">
          <i class="pi pi-exclamation-triangle text-orange-500 mr-2"></i>
          <span class="text-600">
            Você não tem permissão para criar eventos nesta conta Google.
            <PermissionBadge :permissions="selectedAccount.permissoes_usuario" size="small" class="ml-2" />
          </span>
        </div>
      </div>
    </form>

    <template #footer>
      <div class="flex justify-content-between w-full align-items-center">
        <div class="flex align-items-center gap-2" v-if="contaExibida">
          <GoogleAccountStatus :account="contaExibida" size="small" />
          <small class="text-500">{{ contaExibida.email_google }}</small>
        </div>

        <div class="flex gap-2">
          <Button
            v-if="isEditMode && podeExcluirEventos"
            label="Excluir"
            icon="pi pi-trash"
            severity="danger"
            outlined
            :disabled="loading"
            @click="confirmarExclusao"
          />
          <Button
            label="Cancelar"
            severity="secondary"
            @click="closeModal"
            :disabled="loading"
          />
          <Button
            v-if="canSalvarEvento"
            :label="isEditMode ? 'Atualizar Evento' : 'Criar Evento'"
            severity="primary"
            type="submit"
            @click="submitEvent"
            :loading="loading"
            :disabled="!isFormValid"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import apiClient from '@/api';
import GoogleAccountSelector from './GoogleAccountSelector.vue';
import GoogleAccountStatus from './GoogleAccountStatus.vue';
import PermissionBadge from './PermissionBadge.vue';

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  selectedAccount: {
    type: Object,
    default: null
  },
  selectedAccountId: {
    type: [String, Number],
    default: null
  },
  evento: {
    type: Object,
    default: null
  },
  atendimentoId: {
    type: [String, Number],
    default: null
  }
});

// Emits
const emit = defineEmits(['update:modelValue', 'event-created', 'event-updated', 'event-deleted']);

// Composables
const toast = useToast();
const confirm = useConfirm();

// State
const loading = ref(false);
const errors = ref({});
const selectedAccount = ref(null);

const eventData = ref({
  conta_google_id: null,
  titulo: '',
  descricao: '',
  data_inicio: null,
  data_fim: null,
  localizacao: '',
  convidados: [],
  lembrete_minutos: 10,
  visibilidade: 'default',
  dia_inteiro: false
});

// Options
const lembreteOptions = [
  { label: 'Sem lembrete', value: null },
  { label: '5 minutos antes', value: 5 },
  { label: '10 minutos antes', value: 10 },
  { label: '15 minutos antes', value: 15 },
  { label: '30 minutos antes', value: 30 },
  { label: '1 hora antes', value: 60 },
  { label: '2 horas antes', value: 120 },
  { label: '1 dia antes', value: 1440 }
];

const visibilidadeOptions = [
  { label: 'Padrão', value: 'default' },
  { label: 'Público', value: 'public' },
  { label: 'Privado', value: 'private' }
];

// Computed
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const isEditMode = computed(() => Boolean(props.evento?.id));

const resolveContaGoogleId = () => {
  if (props.selectedAccountId != null && props.selectedAccountId !== '') {
    return Number(props.selectedAccountId);
  }
  if (props.selectedAccount?.id != null) {
    return Number(props.selectedAccount.id);
  }
  if (props.evento?.conta_google_id != null) {
    return Number(props.evento.conta_google_id);
  }
  if (eventData.value.conta_google_id != null) {
    return Number(eventData.value.conta_google_id);
  }
  return null;
};

const usaContaFixa = computed(() =>
  Boolean(props.selectedAccountId || props.selectedAccount?.id)
);

const contaExibida = computed(() => props.selectedAccount || selectedAccount.value);

const canCreateEvents = computed(() => {
  const perms = contaExibida.value?.permissoes_usuario;
  return Boolean(perms?.pode_criar);
});

const canEditEvents = computed(() => {
  const perms = contaExibida.value?.permissoes_usuario;
  return Boolean(perms?.pode_editar);
});

const podeExcluirEventos = computed(() => {
  const perms = contaExibida.value?.permissoes_usuario;
  return Boolean(perms?.pode_excluir);
});

const canSalvarEvento = computed(() => {
  if (isEditMode.value) return canEditEvents.value;
  return canCreateEvents.value;
});

const isFormValid = computed(() => {
  return eventData.value.titulo?.trim() &&
         eventData.value.data_inicio &&
         eventData.value.data_fim &&
         resolveContaGoogleId();
});

// Methods
const resetForm = () => {
  eventData.value = {
    conta_google_id: resolveContaGoogleId(),
    titulo: '',
    descricao: '',
    data_inicio: null,
    data_fim: null,
    localizacao: '',
    convidados: [],
    lembrete_minutos: 10,
    visibilidade: 'default',
    dia_inteiro: false
  };
  errors.value = {};
  selectedAccount.value = props.selectedAccount || null;
};

const loadEventData = () => {
  if (props.evento) {
    eventData.value = {
      ...eventData.value,
      ...props.evento,
      data_inicio: props.evento.data_inicio ? new Date(props.evento.data_inicio) : null,
      data_fim: props.evento.data_fim ? new Date(props.evento.data_fim) : null,
      convidados: props.evento.convidados || []
    };
  }

  const contaId = resolveContaGoogleId();
  if (contaId) {
    eventData.value.conta_google_id = contaId;
  }
  if (props.selectedAccount) {
    selectedAccount.value = props.selectedAccount;
  }
};

const validateForm = () => {
  errors.value = {};
  
  if (!eventData.value.titulo?.trim()) {
    errors.value.titulo = 'Título é obrigatório';
  }
  
  if (!eventData.value.data_inicio) {
    errors.value.data_inicio = 'Data de início é obrigatória';
  }
  
  if (!eventData.value.data_fim) {
    errors.value.data_fim = 'Data de término é obrigatória';
  }
  
  if (eventData.value.data_inicio && eventData.value.data_fim) {
    if (eventData.value.data_fim <= eventData.value.data_inicio) {
      errors.value.data_fim = 'Data de término deve ser posterior à data de início';
    }
  }
  
  return Object.keys(errors.value).length === 0;
};

const submitEvent = async () => {
  if (!validateForm()) {
    toast.add({
      severity: 'warn',
      summary: 'Formulário Inválido',
      detail: 'Por favor, corrija os erros antes de continuar',
      life: 5000
    });
    return;
  }
  
  if (!canSalvarEvento.value) {
    toast.add({
      severity: 'error',
      summary: 'Sem Permissão',
      detail: isEditMode.value
        ? 'Você não tem permissão para editar eventos nesta conta Google'
        : 'Você não tem permissão para criar eventos nesta conta Google',
      life: 5000
    });
    return;
  }

  loading.value = true;
  
  try {
    const contaGoogleId = resolveContaGoogleId();
    if (!contaGoogleId) {
      toast.add({
        severity: 'error',
        summary: 'Conta não definida',
        detail: 'Selecione a conta Google Calendar antes de salvar.',
        life: 5000,
      });
      return;
    }

    const payload = {
      ...eventData.value,
      conta_google_id: contaGoogleId,
      atendimento_id: props.atendimentoId,
    };

    let response;
    if (isEditMode.value) {
      response = await apiClient.patch('/api/google-calendar/events/update_google_event/', {
        event_id: props.evento.id,
        conta_google_id: contaGoogleId,
        titulo: payload.titulo,
        descricao: payload.descricao,
        local: payload.localizacao,
        data_inicio: new Date(payload.data_inicio).toISOString(),
        data_fim: new Date(payload.data_fim).toISOString(),
      });
      emit('event-updated', response.data);
      toast.add({
        severity: 'success',
        summary: 'Evento Atualizado',
        detail: 'Evento do Google Calendar atualizado com sucesso!',
        life: 5000
      });
    } else {
      response = await apiClient.post('/api/google-calendar/events/create_event/', {
        conta_google_id: payload.conta_google_id,
        titulo: payload.titulo,
        descricao: payload.descricao,
        data_inicio: new Date(payload.data_inicio).toISOString(),
        data_fim: new Date(payload.data_fim).toISOString(),
        local: payload.localizacao,
      });
      emit('event-created', response.data);
      toast.add({
        severity: 'success',
        summary: 'Evento Criado',
        detail: 'Evento criado no Google Calendar com sucesso!',
        life: 5000
      });
    }
    
    closeModal();
  } catch (error) {
    console.error('Erro ao salvar evento:', error);
    
    let errorMessage = 'Não foi possível salvar o evento';
    if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail;
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }
    
    toast.add({
      severity: 'error',
      summary: 'Erro ao Salvar',
      detail: errorMessage,
      life: 7000
    });
  } finally {
    loading.value = false;
  }
};

const closeModal = () => {
  visible.value = false;
  nextTick(() => {
    resetForm();
  });
};

const onAccountSelected = (account) => {
  selectedAccount.value = account;
};

const confirmarExclusao = () => {
  const contaGoogleId = resolveContaGoogleId();
  if (!props.evento?.id || !contaGoogleId) return;

  confirm.require({
    message: `Deseja excluir o evento "${props.evento.titulo || 'sem título'}"?`,
    header: 'Confirmar exclusão',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Excluir',
    rejectLabel: 'Cancelar',
    acceptClass: 'p-button-danger',
    accept: async () => {
      loading.value = true;
      try {
        await apiClient.delete('/api/google-calendar/events/delete_google_event/', {
          data: {
            event_id: props.evento.id,
            conta_google_id: contaGoogleId,
          },
        });
        emit('event-deleted');
        toast.add({
          severity: 'success',
          summary: 'Evento excluído',
          detail: 'O evento foi removido do Google Calendar.',
          life: 4000,
        });
        closeModal();
      } catch (error) {
        const detail = error.response?.data?.error || error.response?.data?.detail || 'Não foi possível excluir o evento.';
        toast.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
      } finally {
        loading.value = false;
      }
    },
  });
};

const onAuthorizationComplete = (account) => {
  selectedAccount.value = account;
  toast.add({
    severity: 'info',
    summary: 'Autorização Completa',
    detail: 'Agora você pode criar eventos nesta conta Google',
    life: 3000
  });
};

const onDiaInteiroChange = () => {
  if (eventData.value.dia_inteiro) {
    // Se é evento de dia inteiro, ajustar horários
    if (eventData.value.data_inicio) {
      const inicio = new Date(eventData.value.data_inicio);
      inicio.setHours(0, 0, 0, 0);
      eventData.value.data_inicio = inicio;
    }
    
    if (eventData.value.data_fim) {
      const fim = new Date(eventData.value.data_fim);
      fim.setHours(23, 59, 59, 999);
      eventData.value.data_fim = fim;
    }
  }
};

// Watchers
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      loadEventData();
    }
  },
  { immediate: true }
);

watch(
  () => props.evento,
  () => {
    if (props.modelValue) {
      loadEventData();
    }
  },
  { deep: true }
);

watch(
  () => [props.selectedAccountId, props.selectedAccount?.id],
  () => {
    const contaId = resolveContaGoogleId();
    if (contaId) {
      eventData.value.conta_google_id = contaId;
    }
    if (props.selectedAccount) {
      selectedAccount.value = props.selectedAccount;
    }
  },
  { immediate: true }
);

watch(() => eventData.value.data_inicio, (novaData) => {
  // Auto-ajustar data de fim se não estiver definida ou for anterior à data de início
  if (novaData && (!eventData.value.data_fim || eventData.value.data_fim <= novaData)) {
    const novaDataFim = new Date(novaData);
    novaDataFim.setHours(novaDataFim.getHours() + 1); // 1 hora de duração padrão
    eventData.value.data_fim = novaDataFim;
  }
});
</script>

<style scoped>
.p-dialog .p-dialog-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.p-dialog .p-dialog-content {
  padding: 1.5rem;
}

.field {
  margin-bottom: 1rem;
}

.field-checkbox {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

/* Estilo para campos inválidos */
.p-invalid {
  border-color: #e24c4c;
}

.p-error {
  color: #e24c4c;
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

/* Animações suaves */
.p-dialog {
  transition: all 0.3s ease;
}

/* Responsividade adicional */
@media (max-width: 640px) {
  :deep(.p-dialog) {
    margin: 1rem;
  }
  
  .grid .col-6 {
    flex: 0 0 100%;
    max-width: 100%;
  }
}

/* Estilo do panel de opções avançadas */
:deep(.p-panel .p-panel-header) {
  background: var(--surface-50);
  border-bottom: 1px solid var(--surface-200);
}

:deep(.p-panel .p-panel-content) {
  background: var(--surface-0);
}
</style>