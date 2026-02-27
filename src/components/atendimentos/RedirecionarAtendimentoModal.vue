<template>
  <Dialog 
    :visible="visible" 
    @update:visible="$emit('update:visible', $event)"
    modal 
    header="Redirecionar Atendimento" 
    :style="{ width: '500px' }"
    :closable="true"
  >
    <div class="p-fluid">
      <p class="text-color-secondary mb-3">
        Redirecione o atendimento para outro membro da equipe. O novo responsável receberá uma notificação e será o único responsável pela gestão.
      </p>
      <div class="field">
        <label for="novoResponsavel">Novo responsável *</label>
        <Dropdown 
          id="novoResponsavel" 
          v-model="formData.novo_responsavel_id" 
          :options="usuariosOptions" 
          optionLabel="label" 
          optionValue="value"
          placeholder="Selecione o membro da equipe"
          filter
          :loading="carregandoUsuarios"
          :class="{ 'p-invalid': errors.novo_responsavel_id }"
        />
        <small v-if="errors.novo_responsavel_id" class="p-error">{{ errors.novo_responsavel_id }}</small>
      </div>
      <div class="field">
        <label for="justificativa">Justificativa *</label>
        <Textarea 
          id="justificativa" 
          v-model="formData.justificativa" 
          rows="3" 
          placeholder="Informe o motivo do redirecionamento..."
          autoResize
          :class="{ 'p-invalid': errors.justificativa }"
        />
        <small v-if="errors.justificativa" class="p-error">{{ errors.justificativa }}</small>
      </div>
    </div>
    <template #footer>
      <Button label="Cancelar" icon="pi pi-times" @click="fechar" class="p-button-text" />
      <Button 
        label="Redirecionar" 
        icon="pi pi-arrow-right" 
        @click="salvar" 
        :loading="salvando"
        :disabled="!podeSalvar"
      />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';
import apiClient from '@/api';

const props = defineProps({
  visible: { type: Boolean, default: false },
  atendimentoId: { type: Number, required: true },
  contaId: { type: Number, required: true }
});

const emit = defineEmits(['update:visible', 'redirecionado']);

const toast = useToast();

const formData = ref({ novo_responsavel_id: null, justificativa: '' });
const errors = ref({});
const salvando = ref(false);
const carregandoUsuarios = ref(false);
const usuariosOptions = ref([]);

const podeSalvar = computed(() => 
  formData.value.novo_responsavel_id && formData.value.justificativa.trim()
);

watch(() => props.visible, async (isVisible) => {
  if (isVisible && props.contaId) {
    formData.value = { novo_responsavel_id: null, justificativa: '' };
    errors.value = {};
    await carregarUsuarios();
  }
});

const carregarUsuarios = async () => {
  if (!props.contaId) return;
  carregandoUsuarios.value = true;
  try {
    const res = await apiClient.get('/api/usuarios/', { params: { conta_id: props.contaId } });
    usuariosOptions.value = res.data.map(u => ({
      label: (u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.username) || u.username,
      value: u.id
    }));
  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
    toast.add({ severity: 'warn', summary: 'Aviso', detail: 'Não foi possível carregar os membros da equipe.', life: 3000 });
    usuariosOptions.value = [];
  } finally {
    carregandoUsuarios.value = false;
  }
};

const validar = () => {
  errors.value = {};
  if (!formData.value.novo_responsavel_id) {
    errors.value.novo_responsavel_id = 'Selecione o novo responsável';
    return false;
  }
  if (!formData.value.justificativa.trim()) {
    errors.value.justificativa = 'A justificativa é obrigatória';
    return false;
  }
  return true;
};

const salvar = async () => {
  if (!validar()) return;
  salvando.value = true;
  try {
    await apiClient.post(`/api/atendimentos/${props.atendimentoId}/redirecionar/`, {
      novo_responsavel_id: formData.value.novo_responsavel_id,
      justificativa: formData.value.justificativa.trim()
    });
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Atendimento redirecionado com sucesso!', life: 3000 });
    emit('redirecionado');
    fechar();
  } catch (error) {
    const msg = error.response?.data?.detail || 'Não foi possível redirecionar o atendimento';
    toast.add({ severity: 'error', summary: 'Erro', detail: msg, life: 5000 });
  } finally {
    salvando.value = false;
  }
};

const fechar = () => emit('update:visible', false);
</script>
