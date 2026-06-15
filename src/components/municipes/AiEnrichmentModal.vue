<script setup>
import { computed, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import contatosService from '@/services/contatos';

const props = defineProps({
  contact: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['applied']);

const toast = useToast();
const visible = ref(false);
const isLoading = ref(false);
const isApplying = ref(false);
const payload = ref(null);
const fontes = ref([]);
const observacoes = ref([]);
const profileMode = ref('existing');
const selectedProfileId = ref(null);
const selectedContaId = ref(null);

const suggestionForm = ref({
  telefones: [],
  emails: [],
  endereco: '',
  cargo: '',
  orgao: '',
  etiqueta_mala_direta: '',
});
const applyFields = ref({
  emails: true,
  telefones: true,
  endereco: true,
  etiqueta_mala_direta: true,
  cargo: true,
  orgao: true,
});

const telefonesText = computed({
  get: () => (suggestionForm.value.telefones || []).join('\n'),
  set: (value) => {
    suggestionForm.value.telefones = String(value || '')
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
  },
});

const emailsText = computed({
  get: () => (suggestionForm.value.emails || []).join('\n'),
  set: (value) => {
    suggestionForm.value.emails = String(value || '')
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
  },
});

const openAndLoad = async () => {
  visible.value = true;
  isLoading.value = true;
  payload.value = null;
  fontes.value = [];
  observacoes.value = [];
  try {
    const result = await contatosService.solicitarEnriquecimentoIA(props.contact.id);
    payload.value = result;
    fontes.value = result.fontes || [];
    observacoes.value = result.observacoes || [];
    suggestionForm.value = {
      telefones: [...(result.suggestion?.telefones || [])],
      emails: [...(result.suggestion?.emails || [])],
      endereco: result.suggestion?.endereco || '',
      cargo: result.suggestion?.cargo || '',
      orgao: result.suggestion?.orgao || '',
      etiqueta_mala_direta: result.suggestion?.etiqueta_mala_direta || '',
    };
    applyFields.value = {
      emails: true,
      telefones: true,
      endereco: true,
      etiqueta_mala_direta: true,
      cargo: true,
      orgao: true,
    };
    const perfis = result.profiles_for_user || [];
    selectedProfileId.value = perfis.length ? perfis[0].id : null;
    const contas = result.user_accounts || [];
    selectedContaId.value = contas.length ? contas[0].id : null;
    profileMode.value = 'existing';
  } catch (error) {
    const detail = error?.response?.data?.detail || 'Não foi possível gerar sugestão de enriquecimento.';
    toast.add({ severity: 'error', summary: 'Falha no enriquecimento', detail, life: 5000 });
    visible.value = false;
  } finally {
    isLoading.value = false;
  }
};

const applySuggestion = async () => {
  const algumaSelecao = Object.values(applyFields.value).some(Boolean);
  if (!algumaSelecao) {
    toast.add({
      severity: 'warn',
      summary: 'Selecione ao menos um campo',
      detail: 'Marque pelo menos um campo para aplicar no registro.',
      life: 4000,
    });
    return;
  }
  isApplying.value = true;
  try {
    const profileOptions =
      profileMode.value === 'new'
        ? { profile_mode: 'new', profile_conta_id: selectedContaId.value }
        : { profile_mode: 'existing', profile_id: selectedProfileId.value };
    profileOptions.suggestion_source = payload.value?.suggestion_source || 'unknown';

    await contatosService.aplicarEnriquecimentoIA(
      props.contact.id,
      suggestionForm.value,
      applyFields.value,
      profileOptions
    );
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Dados enriquecidos salvos.', life: 3000 });
    emit('applied', {
      contactId: props.contact.id,
      enrichedData: { ...suggestionForm.value },
      applyFields: { ...applyFields.value },
    });
    visible.value = false;
  } catch (error) {
    const detail = error?.response?.data?.detail || 'Falha ao salvar enriquecimento.';
    toast.add({ severity: 'error', summary: 'Erro ao aplicar', detail, life: 5000 });
  } finally {
    isApplying.value = false;
  }
};

const suggestionSourceLabel = computed(() => {
  const src = payload.value?.suggestion_source;
  if (src === 'enrichment_agent_fallback') return 'Fonte da sugestão: fallback enrichment_agent';
  if (src === 'orchestrator_final_text') return 'Fonte da sugestão: orchestrator (final_text)';
  return 'Fonte da sugestão: orchestrator';
});
</script>

<template>
  <Button
    icon="pi pi-sparkles"
    text
    rounded
    severity="help"
    title="Enriquecer com IA"
    @click="openAndLoad"
  />

  <Dialog
    v-model:visible="visible"
    modal
    :style="{ width: '1100px' }"
    header="Enriquecimento com IA"
  >
    <div v-if="isLoading" class="loading-wrap">
      <ProgressSpinner style="width: 36px; height: 36px" strokeWidth="6" />
      <div>
        <h4>Consultando fontes oficiais...</h4>
        <p>A IA está analisando dados e montando um preview para revisão.</p>
      </div>
    </div>

    <div v-else-if="payload" class="enrichment-grid">
      <div class="panel">
        <h3>Dados Atuais</h3>
        <div class="field"><b>Cargo:</b> {{ payload.current_data?.cargo || 'Não informado' }}</div>
        <div class="field"><b>Órgão:</b> {{ payload.current_data?.orgao || 'Não informado' }}</div>
        <div class="field"><b>Endereço:</b> {{ payload.current_data?.endereco || 'Não informado' }}</div>
        <div class="field"><b>Emails:</b> {{ (payload.current_data?.emails || []).join(', ') || 'Não informado' }}</div>
        <div class="field"><b>Telefones:</b> {{ (payload.current_data?.telefones || []).join(', ') || 'Não informado' }}</div>
        <div class="field"><b>Etiqueta:</b><pre>{{ payload.current_data?.etiqueta_mala_direta || 'Não informado' }}</pre></div>
      </div>

      <div class="panel">
        <h3>Sugestão da IA (editável)</h3>
        <div class="source-badge">{{ suggestionSourceLabel }}</div>
        <div class="form-field profile-box">
          <label class="block-title">Perfil do Contato (cargo/órgão)</label>
          <div class="profile-mode">
            <label><input type="radio" value="existing" v-model="profileMode" /> Editar perfil existente</label>
            <label><input type="radio" value="new" v-model="profileMode" /> Criar novo perfil</label>
          </div>
          <div v-if="profileMode === 'existing'" class="form-field">
            <label>Perfil vinculado à sua conta</label>
            <Dropdown
              v-model="selectedProfileId"
              :options="payload.profiles_for_user || []"
              optionLabel="conta_nome"
              optionValue="id"
              placeholder="Selecione um perfil"
            >
              <template #option="slotProps">
                <div>
                  <b>{{ slotProps.option.conta_nome }}</b>
                  <small class="block text-color-secondary">
                    {{ slotProps.option.cargo || 'Sem cargo' }} • {{ slotProps.option.orgao || 'Sem órgão' }}
                  </small>
                </div>
              </template>
            </Dropdown>
          </div>
          <div v-else class="form-field">
            <label>Conta para novo perfil</label>
            <Dropdown
              v-model="selectedContaId"
              :options="payload.user_accounts || []"
              optionLabel="nome"
              optionValue="id"
              placeholder="Selecione a conta"
            />
          </div>
        </div>
        <div class="form-field">
          <label class="apply-label"><input type="checkbox" v-model="applyFields.cargo" /> Aplicar cargo</label>
          <label>Cargo</label>
          <InputText v-model="suggestionForm.cargo" />
        </div>
        <div class="form-field">
          <label class="apply-label"><input type="checkbox" v-model="applyFields.orgao" /> Aplicar órgão</label>
          <label>Órgão</label>
          <InputText v-model="suggestionForm.orgao" />
        </div>
        <div class="form-field">
          <label class="apply-label"><input type="checkbox" v-model="applyFields.endereco" /> Aplicar endereço</label>
          <label>Endereço</label>
          <InputText v-model="suggestionForm.endereco" />
        </div>
        <div class="form-field">
          <label class="apply-label"><input type="checkbox" v-model="applyFields.emails" /> Aplicar emails</label>
          <label>Emails (um por linha)</label>
          <Textarea v-model="emailsText" rows="3" autoResize />
        </div>
        <div class="form-field">
          <label class="apply-label"><input type="checkbox" v-model="applyFields.telefones" /> Aplicar telefones</label>
          <label>Telefones (um por linha)</label>
          <Textarea v-model="telefonesText" rows="3" autoResize />
        </div>
        <div class="form-field">
          <label class="apply-label">
            <input type="checkbox" v-model="applyFields.etiqueta_mala_direta" /> Aplicar etiqueta mala direta
          </label>
          <label>Etiqueta mala direta</label>
          <Textarea v-model="suggestionForm.etiqueta_mala_direta" rows="6" autoResize />
        </div>
      </div>
    </div>

    <div v-if="!isLoading && payload" class="sources">
      <h4>Fontes consultadas</h4>
      <ul>
        <li v-for="fonte in fontes" :key="fonte">
          <a :href="fonte" target="_blank" rel="noopener noreferrer">{{ fonte }}</a>
        </li>
      </ul>
      <p v-for="obs in observacoes" :key="obs" class="obs">{{ obs }}</p>
    </div>

    <template #footer>
      <Button label="Descartar" class="p-button-secondary" @click="visible = false" />
      <Button
        label="Aprovar e Salvar"
        icon="pi pi-check"
        :loading="isApplying"
        @click="applySuggestion"
        :disabled="isLoading || isApplying"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.loading-wrap {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0;
}
.loading-wrap p {
  margin: 0;
  color: #6b7280;
}
.enrichment-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.panel {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 1rem;
}
.panel h3 {
  margin-top: 0;
}
.field {
  margin-bottom: 0.7rem;
}
.field pre {
  white-space: pre-wrap;
  margin: 0.4rem 0 0;
}
.form-field {
  margin-bottom: 0.8rem;
}
.block-title {
  font-weight: 600;
  margin-bottom: 0.4rem;
}
.profile-box {
  padding: 0.7rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafafa;
}
.profile-mode {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.6rem;
  font-size: 0.92rem;
}
.form-field label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
  color: #374151;
}
.apply-label {
  display: inline-flex !important;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem !important;
  color: #4b5563 !important;
  margin-bottom: 0.35rem !important;
}
.sources {
  margin-top: 1rem;
}
.sources ul {
  margin: 0.4rem 0 0.6rem;
  padding-left: 1.2rem;
}
.obs {
  margin: 0.15rem 0;
  color: #6b7280;
  font-size: 0.9rem;
}
.source-badge {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.78rem;
  background: #eef2ff;
  color: #3730a3;
  margin-bottom: 0.7rem;
}
@media (max-width: 900px) {
  .enrichment-grid {
    grid-template-columns: 1fr;
  }
}
</style>
