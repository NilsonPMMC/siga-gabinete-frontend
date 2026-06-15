<template>
  <div class="google-account-status">
    <span
      v-if="iconOnly"
      v-tooltip.top="statusLabel"
      class="status-icon-only"
      :class="[`status-icon-only--${statusSeverity}`, size]"
      role="img"
      :aria-label="statusLabel"
    >
      <i :class="statusIcon"></i>
    </span>

    <Tag
      v-else
      :value="statusLabel"
      :severity="statusSeverity"
      :class="`status-tag ${size}`"
    >
      <template #default>
        <i :class="statusIcon" class="mr-1"></i>
        {{ statusLabel }}
      </template>
    </Tag>

    <div v-if="!iconOnly && size !== 'small' && showTooltip" class="status-details mt-2">
      <div class="text-sm text-600">
        <div class="flex justify-content-between mb-1">
          <span>Status do Token:</span>
          <span class="font-medium" :class="tokenStatusClass">{{ tokenStatusText }}</span>
        </div>

        <div v-if="tokenStatus.expires_at" class="flex justify-content-between mb-1">
          <span>Expira em:</span>
          <span class="font-medium">{{ formatExpiryDate() }}</span>
        </div>

        <div v-if="tokenStatus.last_updated" class="flex justify-content-between">
          <span>Última atualização:</span>
          <span class="font-medium">{{ formatLastUpdate() }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { normalizeGoogleAccount } from '@/utils/googleCalendarAccount';

const props = defineProps({
  account: {
    type: Object,
    required: true,
  },
  size: {
    type: String,
    default: 'normal',
    validator: (value) => ['small', 'normal', 'large'].includes(value),
  },
  showTooltip: {
    type: Boolean,
    default: false,
  },
  iconOnly: {
    type: Boolean,
    default: false,
  },
});

const normalizedAccount = computed(() => normalizeGoogleAccount(props.account));

const tokenStatus = computed(() => normalizedAccount.value?.token_status || {});

const statusSeverity = computed(() => {
  if (!tokenStatus.value.has_valid_token) return 'danger';
  if (tokenStatus.value.expires_soon) return 'warning';
  return 'success';
});

const statusLabel = computed(() => {
  if (!tokenStatus.value.has_valid_token) {
    if (tokenStatus.value.somente_leitura_siga) {
      return 'Aguardando conexão da Secretaria';
    }
    return 'Não autorizada';
  }
  if (tokenStatus.value.usa_token_delegado && tokenStatus.value.somente_leitura_siga) {
    return 'Leitura via SIGA';
  }
  if (tokenStatus.value.usa_token_delegado) {
    return 'Conectada (agenda compartilhada)';
  }
  if (tokenStatus.value.expires_soon) {
    const days = getDaysUntilExpiry();
    return days > 0 ? `Expira em ${days} dia(s)` : 'Expirando hoje';
  }
  return 'Conectada';
});

const statusIcon = computed(() => {
  if (!tokenStatus.value.has_valid_token) return 'pi pi-times-circle';
  if (tokenStatus.value.expires_soon) return 'pi pi-exclamation-triangle';
  return 'pi pi-check-circle';
});

const tokenStatusText = computed(() => {
  if (!tokenStatus.value.has_valid_token) return 'Desconectado';
  if (tokenStatus.value.expires_soon) return 'Expirando';
  return 'Válido';
});

const tokenStatusClass = computed(() => {
  if (!tokenStatus.value.has_valid_token) return 'text-red-500';
  if (tokenStatus.value.expires_soon) return 'text-orange-500';
  return 'text-green-500';
});

const getDaysUntilExpiry = () => {
  if (!tokenStatus.value.expires_at) return 0;
  try {
    const expiryDate = parseISO(tokenStatus.value.expires_at);
    return Math.max(0, differenceInDays(expiryDate, new Date()));
  } catch {
    return 0;
  }
};

const formatExpiryDate = () => {
  if (!tokenStatus.value.expires_at) return 'N/A';
  try {
    const expiryDate = parseISO(tokenStatus.value.expires_at);
    const days = differenceInDays(expiryDate, new Date());
    if (days === 0) return 'Hoje';
    if (days === 1) return 'Amanhã';
    if (days > 1) return `${days} dias`;
    return 'Expirado';
  } catch {
    return 'Data inválida';
  }
};

const formatLastUpdate = () => {
  if (!tokenStatus.value.last_updated) return 'N/A';
  try {
    return format(parseISO(tokenStatus.value.last_updated), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  } catch {
    return 'Data inválida';
  }
};
</script>

<style scoped>
.google-account-status {
  display: inline-block;
}

.status-icon-only {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  cursor: default;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.status-icon-only.small {
  width: 1.5rem;
  height: 1.5rem;
  font-size: 0.75rem;
}

.status-icon-only.large {
  width: 2rem;
  height: 2rem;
  font-size: 1rem;
}

.status-icon-only:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.status-icon-only--success {
  background: #10b981;
  color: #fff;
}

.status-icon-only--warning {
  background: #f59e0b;
  color: #fff;
}

.status-icon-only--danger {
  background: #ef4444;
  color: #fff;
}

.status-tag {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-weight: 600;
  letter-spacing: 0.025em;
  transition: all 0.2s ease;
}

.status-tag.small {
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
}

.status-tag.large {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
}

.status-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.status-details {
  background: var(--surface-ground);
  border: 1px solid var(--surface-border);
  border-radius: 0.375rem;
  padding: 0.75rem;
  margin-top: 0.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

:deep(.p-tag.p-tag-success) {
  background: #10b981;
  color: white;
}

:deep(.p-tag.p-tag-warning) {
  background: #f59e0b;
  color: white;
}

:deep(.p-tag.p-tag-danger) {
  background: #ef4444;
  color: white;
}
</style>
