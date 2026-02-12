<template>
  <Dialog 
    :visible="visible" 
    @update:visible="$emit('update:visible', $event)"
    modal 
    :header="'Alterar Status do Atendimento'" 
    :style="{ width: '600px' }"
    :closable="true"
  >
    <div class="p-fluid">
      <!-- Status Atual -->
      <div class="field mb-4">
        <label>Status Atual</label>
        <Tag :value="statusAtualDisplay" :severity="getStatusSeverity(statusAtual)" />
      </div>

      <!-- Novo Status -->
      <div class="field">
        <label for="novoStatus">Novo Status *</label>
        <Dropdown 
          id="novoStatus" 
          v-model="formData.status_novo" 
          :options="statusOptions" 
          optionLabel="name" 
          optionValue="code" 
          placeholder="Selecione o novo status"
          :class="{ 'p-invalid': errors.status_novo }"
        />
        <small v-if="errors.status_novo" class="p-error">{{ errors.status_novo }}</small>
      </div>

      <!-- Despacho/Tramitação -->
      <div class="field">
        <label for="despacho">Despacho / Nota de Progresso *</label>
        <Textarea 
          id="despacho" 
          v-model="formData.despacho" 
          rows="4" 
          placeholder="Descreva o motivo da mudança de status..."
          autoResize
          :class="{ 'p-invalid': errors.despacho }"
        />
        <small v-if="errors.despacho" class="p-error">{{ errors.despacho }}</small>
      </div>

      <!-- Encaminhamento (se status = ENCAMINHADO) -->
      <div v-if="formData.status_novo === 'ENCAMINHADO'" class="field">
        <label for="encaminhamento">Encaminhar para *</label>
        <Dropdown 
          id="encaminhamento" 
          v-model="formData.encaminhado_para_sinapse_id" 
          :options="secretariasOptions" 
          optionLabel="label" 
          optionValue="value"
          placeholder="Selecione a secretaria/órgão"
          filter
          :loading="carregandoSecretarias"
          :class="{ 'p-invalid': errors.encaminhado_para_sinapse_id }"
        >
          <template #option="slotProps">
            <div>
              <div>{{ slotProps.option.label }}</div>
              <small class="text-color-secondary">{{ slotProps.option.tipo }}</small>
            </div>
          </template>
        </Dropdown>
        <small v-if="errors.encaminhado_para_sinapse_id" class="p-error">{{ errors.encaminhado_para_sinapse_id }}</small>
        <small v-if="formData.status_novo === 'ENCAMINHADO'" class="p-text-secondary">
          Selecione para onde o atendimento está sendo encaminhado.
        </small>
      </div>

      <!-- Notificar Munícipe -->
      <div class="field">
        <div class="flex align-items-center">
          <Checkbox 
            id="notificarMunicipe" 
            v-model="formData.notificar_municipe" 
            binary 
          />
          <label for="notificarMunicipe" class="ml-2">Notificar o munícipe por e-mail</label>
        </div>
      </div>
    </div>

    <template #footer>
      <Button 
        label="Cancelar" 
        icon="pi pi-times" 
        @click="fechar" 
        class="p-button-text" 
      />
      <Button 
        label="Alterar Status" 
        icon="pi pi-check" 
        @click="salvar" 
        :loading="salvando"
        :disabled="!podeSalvar"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Checkbox from 'primevue/checkbox';
import apiClient from '@/api';
import { buscarSecretarias, formatarSecretariasParaDropdown } from '@/services/sinapse';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  atendimentoId: {
    type: Number,
    required: true
  },
  statusAtual: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['update:visible', 'status-alterado']);

const toast = useToast();

const formData = ref({
  status_novo: null,
  despacho: '',
  encaminhado_para_sinapse_id: null,
  encaminhado_para_nome: null,
  encaminhado_para_tipo: null,
  notificar_municipe: false
});

const errors = ref({});
const salvando = ref(false);
const carregandoSecretarias = ref(false);
const secretariasOptions = ref([]);

const statusOptions = ref([
  { name: 'Aberto', code: 'ABERTO' },
  { name: 'Em Análise', code: 'EM_ANALISE' },
  { name: 'Encaminhado', code: 'ENCAMINHADO' },
  { name: 'Concluído', code: 'CONCLUIDO' },
  { name: 'Arquivado', code: 'ARQUIVADO' },
]);

const statusAtualDisplay = computed(() => {
  const status = statusOptions.value.find(s => s.code === props.statusAtual);
  return status ? status.name : props.statusAtual;
});

const getStatusSeverity = (status) => {
  const map = { 
    'ABERTO': 'info', 
    'EM_ANALISE': 'warning', 
    'ENCAMINHADO': 'warning',
    'CONCLUIDO': 'success',
    'ARQUIVADO': 'secondary' 
  };
  return map[status] || 'secondary';
};

const podeSalvar = computed(() => {
  return formData.value.status_novo && 
         formData.value.despacho.trim() &&
         (formData.value.status_novo !== 'ENCAMINHADO' || formData.value.encaminhado_para_sinapse_id);
});

// Carregar secretarias quando modal abrir e status for ENCAMINHADO
watch(() => props.visible, async (isVisible) => {
  if (isVisible) {
    // Resetar formulário
    formData.value = {
      status_novo: null,
      despacho: '',
      encaminhado_para_sinapse_id: null,
      encaminhado_para_nome: null,
      encaminhado_para_tipo: null,
      notificar_municipe: false
    };
    errors.value = {};
    
    // Carregar secretarias
    await carregarSecretarias();
  }
});

// Quando selecionar encaminhamento, preencher nome e tipo
watch(() => formData.value.encaminhado_para_sinapse_id, (sinapseId) => {
  if (sinapseId) {
    const secretaria = secretariasOptions.value.find(s => s.value === sinapseId);
    if (secretaria) {
      formData.value.encaminhado_para_nome = secretaria.nome;
      formData.value.encaminhado_para_tipo = secretaria.tipo;
    }
  } else {
    formData.value.encaminhado_para_nome = null;
    formData.value.encaminhado_para_tipo = null;
  }
});

const carregarSecretarias = async () => {
  if (secretariasOptions.value.length > 0) return; // Já carregadas
  
  carregandoSecretarias.value = true;
  try {
    const secretarias = await buscarSecretarias();
    secretariasOptions.value = formatarSecretariasParaDropdown(secretarias);
  } catch (error) {
    console.error('Erro ao carregar secretarias:', error);
    toast.add({ 
      severity: 'warn', 
      summary: 'Aviso', 
      detail: 'Não foi possível carregar a lista de secretarias. Verifique sua conexão.', 
      life: 3000 
    });
  } finally {
    carregandoSecretarias.value = false;
  }
};

const validar = () => {
  errors.value = {};
  
  if (!formData.value.status_novo) {
    errors.value.status_novo = 'Selecione o novo status';
    return false;
  }
  
  if (formData.value.status_novo === props.statusAtual) {
    errors.value.status_novo = 'O novo status deve ser diferente do atual';
    return false;
  }
  
  if (!formData.value.despacho.trim()) {
    errors.value.despacho = 'O despacho é obrigatório';
    return false;
  }
  
  if (formData.value.status_novo === 'ENCAMINHADO' && !formData.value.encaminhado_para_sinapse_id) {
    errors.value.encaminhado_para_sinapse_id = 'Selecione para onde o atendimento será encaminhado';
    return false;
  }
  
  return true;
};

const salvar = async () => {
  if (!validar()) return;
  
  salvando.value = true;
  try {
    const payload = {
      status_novo: formData.value.status_novo,
      despacho: formData.value.despacho,
      notificar_municipe: formData.value.notificar_municipe
    };
    
    // Adicionar dados de encaminhamento se necessário
    if (formData.value.status_novo === 'ENCAMINHADO') {
      payload.encaminhado_para_sinapse_id = formData.value.encaminhado_para_sinapse_id;
      payload.encaminhado_para_nome = formData.value.encaminhado_para_nome;
      payload.encaminhado_para_tipo = formData.value.encaminhado_para_tipo;
    }
    
    await apiClient.post(`/api/atendimentos/${props.atendimentoId}/alterar-status/`, payload);
    
    toast.add({ 
      severity: 'success', 
      summary: 'Sucesso', 
      detail: 'Status alterado com sucesso!', 
      life: 3000 
    });
    
    emit('status-alterado');
    fechar();
    
  } catch (error) {
    console.error('Erro ao alterar status:', error);
    const mensagem = error.response?.data?.detail || 'Não foi possível alterar o status';
    toast.add({ 
      severity: 'error', 
      summary: 'Erro', 
      detail: mensagem, 
      life: 5000 
    });
  } finally {
    salvando.value = false;
  }
};

const fechar = () => {
  emit('update:visible', false);
};

onMounted(() => {
  carregarSecretarias();
});
</script>

<style scoped>
.p-fluid .field {
  margin-bottom: 1.5rem;
}
</style>
