<template>
  <Dialog 
    :visible="visible" 
    @update:visible="$emit('update:visible', $event)"
    modal 
    header="Compartilhar Atendimento" 
    :style="{ width: '500px' }"
    :closable="true"
  >
    <div class="p-fluid">
      <p class="text-color-secondary mb-3">
        Adicione outro membro da equipe como co-responsável. Ambos poderão gerir o atendimento.
      </p>
      <div class="field">
        <label for="usuario">Membro a adicionar *</label>
        <Dropdown 
          id="usuario" 
          v-model="formData.usuario_id" 
          :options="usuariosFiltrados" 
          optionLabel="label" 
          optionValue="value"
          placeholder="Selecione o membro da equipe"
          filter
          :loading="carregandoUsuarios"
          :class="{ 'p-invalid': errors.usuario_id }"
        />
        <small v-if="errors.usuario_id" class="p-error">{{ errors.usuario_id }}</small>
      </div>
      <div class="field">
        <label for="justificativa">Justificativa *</label>
        <Textarea 
          id="justificativa" 
          v-model="formData.justificativa" 
          rows="3" 
          placeholder="Informe o motivo do compartilhamento..."
          autoResize
          :class="{ 'p-invalid': errors.justificativa }"
        />
        <small v-if="errors.justificativa" class="p-error">{{ errors.justificativa }}</small>
      </div>
    </div>
    <template #footer>
      <Button label="Cancelar" icon="pi pi-times" @click="fechar" class="p-button-text" />
      <Button 
        label="Compartilhar" 
        icon="pi pi-users" 
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
  contaId: { type: Number, required: true },
  usuarioLogadoId: { type: Number, default: null },
  responsavelId: { type: Number, default: null },
  responsaveisCompartilhadosIds: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:visible', 'compartilhado']);

const toast = useToast();

const formData = ref({ usuario_id: null, justificativa: '' });
const errors = ref({});
const salvando = ref(false);
const carregandoUsuarios = ref(false);
const usuariosOptions = ref([]);

const idsJaResponsaveis = computed(() => {
  const ids = new Set(props.responsaveisCompartilhadosIds || []);
  if (props.responsavelId) ids.add(props.responsavelId);
  if (props.usuarioLogadoId) ids.add(props.usuarioLogadoId);
  return ids;
});

const usuariosFiltrados = computed(() => {
  return usuariosOptions.value.filter(u => !idsJaResponsaveis.value.has(u.value));
});

const podeSalvar = computed(() => 
  formData.value.usuario_id && formData.value.justificativa.trim()
);

watch(() => props.visible, async (isVisible) => {
  if (isVisible && props.contaId) {
    formData.value = { usuario_id: null, justificativa: '' };
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
  if (!formData.value.usuario_id) {
    errors.value.usuario_id = 'Selecione o membro para compartilhar';
    return false;
  }
  if (idsJaResponsaveis.value.has(formData.value.usuario_id)) {
    errors.value.usuario_id = 'Este usuário já é responsável pelo atendimento';
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
    await apiClient.post(`/api/atendimentos/${props.atendimentoId}/compartilhar/`, {
      usuario_id: formData.value.usuario_id,
      justificativa: formData.value.justificativa.trim()
    });
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Atendimento compartilhado com sucesso!', life: 3000 });
    emit('compartilhado');
    fechar();
  } catch (error) {
    const msg = error.response?.data?.detail || 'Não foi possível compartilhar o atendimento';
    toast.add({ severity: 'error', summary: 'Erro', detail: msg, life: 5000 });
  } finally {
    salvando.value = false;
  }
};

const fechar = () => emit('update:visible', false);
</script>
