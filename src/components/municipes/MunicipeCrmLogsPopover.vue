<template>
  <span v-if="authStore.canViewCrmLogs">
    <Button
      icon="pi pi-history"
      text
      rounded
      size="small"
      severity="secondary"
      title="Auditoria CRM"
      :loading="loading"
      @click="abrir($event)"
    />
    <OverlayPanel ref="panel" class="crm-logs-popover" :dismissable="true">
      <div class="font-semibold mb-2">Alterações recentes</div>
      <div v-if="loading" class="text-sm text-color-secondary">Carregando...</div>
      <ul v-else-if="logs.length" class="m-0 p-0 list-none">
        <li
          v-for="log in logs"
          :key="log.id"
          class="mb-2 pb-2 border-bottom-1 surface-border text-sm"
        >
          <div class="font-medium">{{ formatarTimestampCrm(log.timestamp) }}</div>
          <div>{{ log.usuario_nome || 'Sistema' }} — {{ log.acao_display || log.acao }}</div>
          <div v-if="log.detalhes" class="text-color-secondary text-xs mt-1">{{ log.detalhes }}</div>
        </li>
      </ul>
      <div v-else class="text-sm text-color-secondary">Nenhum registro encontrado.</div>
    </OverlayPanel>
  </span>
</template>

<script setup>
import { ref } from 'vue';
import Button from 'primevue/button';
import OverlayPanel from 'primevue/overlaypanel';
import { useAuthStore } from '@/stores/auth';
import contatosService from '@/services/contatos';
import { unwrapPaginatedResponse } from '@/utils/paginatedApi';
import { formatarTimestampCrm } from '@/utils/crmLogs';

const props = defineProps({
  municipeId: { type: [Number, String], required: true },
  pageSize: { type: Number, default: 6 },
});

const authStore = useAuthStore();
const panel = ref(null);
const logs = ref([]);
const loading = ref(false);

const abrir = async (event) => {
  panel.value.toggle(event);
  loading.value = true;
  try {
    const response = await contatosService.getCrmLogs({
      municipeId: props.municipeId,
      pageSize: props.pageSize,
    });
    const { results } = unwrapPaginatedResponse(response);
    logs.value = results;
  } catch (err) {
    console.error('Erro ao carregar logs CRM:', err);
    logs.value = [];
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
:deep(.crm-logs-popover) {
  min-width: 20rem;
  max-width: 28rem;
}
</style>
