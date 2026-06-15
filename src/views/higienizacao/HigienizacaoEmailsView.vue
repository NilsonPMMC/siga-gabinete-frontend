<template>
  <div class="page-container">
    <Toast />
    
    <div class="page-header">
      <h1>Higienização de E-mails</h1>
      <Button
        label="Atualizar"
        icon="pi pi-refresh"
        @click="carregarDados"
        :loading="isLoading"
        class="p-button-outlined"
      />
    </div>

    <!-- Indicadores -->
    <div class="grid mb-4">
      <div class="col-12 md:col-3">
        <Card>
          <template #content>
            <div class="stat-card">
              <i class="pi pi-ban stat-icon error"></i>
              <div>
                <div class="stat-value">{{ estatisticas.total_suprimidos }}</div>
                <div class="stat-label">E-mails Bloqueados</div>
              </div>
            </div>
          </template>
        </Card>
      </div>
      
      <div class="col-12 md:col-3">
        <Card>
          <template #content>
            <div class="stat-card">
              <i class="pi pi-check-circle stat-icon success"></i>
              <div>
                <div class="stat-value">{{ estatisticas.total_liberados }}</div>
                <div class="stat-label">E-mails Liberados</div>
              </div>
            </div>
          </template>
        </Card>
      </div>
      
      <div class="col-12 md:col-3">
        <Card>
          <template #content>
            <div class="stat-card">
              <i class="pi pi-inbox stat-icon info"></i>
              <div>
                <div class="stat-value">{{ estatisticas.total_geral }}</div>
                <div class="stat-label">Total Registrado</div>
              </div>
            </div>
          </template>
        </Card>
      </div>
      
      <div class="col-12 md:col-3">
        <Card>
          <template #content>
            <div class="stat-card">
              <i class="pi pi-clock stat-icon warning"></i>
              <div>
                <div class="stat-value">{{ estatisticas.novos_ultima_semana }}</div>
                <div class="stat-label">Novos (7 dias)</div>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- Top Motivos -->
    <Card class="mb-4" v-if="estatisticas.top_motivos && estatisticas.top_motivos.length > 0">
      <template #title>Top Motivos de Supressão</template>
      <template #content>
        <ul class="motivos-list">
          <li v-for="motivo in estatisticas.top_motivos" :key="motivo.motivo">
            <Tag :value="motivo.count" severity="danger" />
            <span class="motivo-label">{{ motivo.motivo_display }}</span>
          </li>
        </ul>
      </template>
    </Card>

    <!-- Filtros e Tabela -->
    <Card>
      <template #title>E-mails Suprimidos</template>
      <template #content>
        <!-- Filtros -->
        <div class="grid formgrid p-fluid mb-3">
          <div class="field col-12 md:col-3">
            <label for="filtroStatus">Status</label>
            <Dropdown
              id="filtroStatus"
              v-model="filtros.status"
              :options="opcoesStatus"
              optionLabel="label"
              optionValue="value"
              placeholder="Todos"
              showClear
              @change="aplicarFiltros"
            />
          </div>
          
          <div class="field col-12 md:col-3">
            <label for="filtroMotivo">Motivo</label>
            <Dropdown
              id="filtroMotivo"
              v-model="filtros.motivo"
              :options="opcoesMotivo"
              optionLabel="label"
              optionValue="value"
              placeholder="Todos"
              showClear
              @change="aplicarFiltros"
            />
          </div>
          
          <div class="field col-12 md:col-3">
            <label for="filtroOrigem">Origem</label>
            <Dropdown
              id="filtroOrigem"
              v-model="filtros.origem"
              :options="opcoesOrigem"
              optionLabel="label"
              optionValue="value"
              placeholder="Todas"
              showClear
              @change="aplicarFiltros"
            />
          </div>
          
          <div class="field col-12 md:col-3">
            <label for="filtroBusca">Buscar E-mail</label>
            <InputText
              id="filtroBusca"
              v-model="filtros.busca"
              placeholder="Digite o e-mail..."
              @keyup.enter="aplicarFiltros"
            />
          </div>
        </div>

        <!-- Ações em Lote -->
        <div class="flex justify-content-between mb-3">
          <div class="flex gap-2">
            <Button
              label="Liberar Selecionados"
              icon="pi pi-check"
              @click="liberarLote"
              :disabled="!selecionados.length"
              class="p-button-success p-button-sm"
            />
            <Button
              label="Bloquear Selecionados"
              icon="pi pi-ban"
              @click="bloquearLote"
              :disabled="!selecionados.length"
              class="p-button-danger p-button-sm"
            />
          </div>
          <span class="text-500">{{ selecionados.length }} selecionado(s)</span>
        </div>

        <!-- Tabela -->
        <DataTable
          :value="supressoes"
          v-model:selection="selecionados"
          :loading="isLoading"
          dataKey="id"
          paginator
          :rows="20"
          :rowsPerPageOptions="[10, 20, 50, 100]"
          paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
          currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords}"
          responsiveLayout="scroll"
        >
          <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
          
          <Column field="email" header="E-mail" sortable>
            <template #body="{ data }">
              <span class="font-mono">{{ data.email }}</span>
            </template>
          </Column>
          
          <Column field="status" header="Status" sortable>
            <template #body="{ data }">
              <Tag
                :value="data.status_display"
                :severity="data.status === 'ativo' ? 'danger' : 'success'"
              />
            </template>
          </Column>
          
          <Column field="motivo" header="Motivo" sortable>
            <template #body="{ data }">
              {{ data.motivo_display }}
            </template>
          </Column>
          
          <Column field="ocorrencias" header="Ocorrências" sortable style="min-width: 10rem">
            <template #body="{ data }">
              <div class="flex align-items-center gap-2">
                <Badge :value="data.ocorrencias" severity="warning" />
                <span class="text-sm text-color-secondary">
                  {{ data.ocorrencias === 1 ? 'ocorrência' : 'ocorrências' }}
                </span>
              </div>
            </template>
          </Column>
          
          <Column field="ultima_ocorrencia" header="Última Ocorrência" sortable>
            <template #body="{ data }">
              {{ formatarData(data.ultima_ocorrencia) }}
            </template>
          </Column>
          
          <Column field="origem" header="Origem" sortable>
            <template #body="{ data }">
              {{ data.origem_display }}
            </template>
          </Column>
          
          <Column header="Contatos" style="min-width: 12rem">
            <template #body="{ data }">
              <div v-if="data.municipes_relacionados && data.municipes_relacionados.length > 0">
                <Button
                  v-for="(municipe, idx) in data.municipes_relacionados.slice(0, 2)"
                  :key="idx"
                  :label="municipe.nome_de_guerra || municipe.nome_completo"
                  icon="pi pi-user"
                  class="p-button-text p-button-sm mb-1 w-full text-left"
                  @click="abrirModalMunicipe(municipe.id)"
                  style="justify-content: flex-start"
                />
                <small v-if="data.municipes_relacionados.length > 2" class="text-color-secondary">
                  +{{ data.municipes_relacionados.length - 2 }} outro(s)
                </small>
              </div>
              <span v-else class="text-color-secondary text-sm">—</span>
            </template>
          </Column>
          
          <Column header="Ações" style="width: 10rem">
            <template #body="{ data }">
              <div class="flex gap-1">
                <Button
                  v-if="data.status === 'ativo'"
                  icon="pi pi-check"
                  class="p-button-rounded p-button-text p-button-success p-button-sm"
                  @click="liberarEmail(data)"
                  v-tooltip.top="'Liberar para envio'"
                />
                <Button
                  v-if="data.status === 'liberado'"
                  icon="pi pi-ban"
                  class="p-button-rounded p-button-text p-button-danger p-button-sm"
                  @click="bloquearEmail(data)"
                  v-tooltip.top="'Bloquear envio'"
                />
                <Button
                  icon="pi pi-pencil"
                  class="p-button-rounded p-button-text p-button-sm"
                  @click="abrirModalEdicao(data)"
                  v-tooltip.top="'Editar observações'"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- Modal de Edição -->
    <Dialog
      v-model:visible="modalVisivel"
      :style="{ width: '500px' }"
      header="Editar Supressão"
      :modal="true"
      class="p-fluid"
    >
      <div v-if="supressaoEmEdicao">
        <div class="field">
          <label>E-mail</label>
          <InputText :value="supressaoEmEdicao.email" disabled />
        </div>
        
        <div class="field">
          <label for="obsEdit">Observações</label>
          <Textarea
            id="obsEdit"
            v-model="supressaoEmEdicao.observacao"
            rows="4"
            placeholder="Adicione observações sobre esta supressão..."
          />
        </div>
      </div>
      
      <template #footer>
        <Button
          label="Cancelar"
          icon="pi pi-times"
          text
          @click="modalVisivel = false"
        />
        <Button
          label="Salvar"
          icon="pi pi-check"
          @click="salvarEdicao"
          :loading="isSaving"
        />
      </template>
    </Dialog>

    <!-- Modal de Edição de Munícipe -->
    <MunicipeFormModal
      v-model:visible="modalMunicipeVisible"
      :municipe-id="municipeIdParaEdicao"
      @saved="onMunicipeSalvo"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import apiClient from '@/api';
import MunicipeFormModal from '@/components/municipes/MunicipeFormModal.vue';

const toast = useToast();

// Estados
const isLoading = ref(false);
const isSaving = ref(false);
const supressoes = ref([]);
const selecionados = ref([]);
const estatisticas = ref({
  total_suprimidos: 0,
  total_liberados: 0,
  total_geral: 0,
  novos_ultima_semana: 0,
  top_motivos: []
});

const filtros = ref({
  status: null,
  motivo: null,
  origem: null,
  busca: ''
});

const modalVisivel = ref(false);
const supressaoEmEdicao = ref(null);

// Modal de edição de munícipe
const modalMunicipeVisible = ref(false);
const municipeIdParaEdicao = ref(null);

// Opções de filtros
const opcoesStatus = [
  { label: 'Bloqueado', value: 'ativo' },
  { label: 'Liberado', value: 'liberado' }
];

const opcoesMotivo = [
  { label: 'Bounce', value: 'bounce' },
  { label: 'Sintaxe Inválida', value: 'invalid_syntax' },
  { label: 'Manual', value: 'manual' },
  { label: 'Outro', value: 'outro' }
];

const opcoesOrigem = [
  { label: 'Log de Envio', value: 'log_envio' },
  { label: 'Usuário', value: 'usuario' },
  { label: 'Importação', value: 'import' }
];

// Funções
const carregarDados = async () => {
  await Promise.all([carregarSupressoes(), carregarEstatisticas()]);
};

const carregarSupressoes = async () => {
  isLoading.value = true;
  try {
    const params = {};
    if (filtros.value.status) params.status = filtros.value.status;
    if (filtros.value.motivo) params.motivo = filtros.value.motivo;
    if (filtros.value.origem) params.origem = filtros.value.origem;
    if (filtros.value.busca) params.search = filtros.value.busca;
    
    const response = await apiClient.get('/api/email-supressoes/', { params });
    supressoes.value = response.data.results || response.data;
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Erro',
      detail: 'Falha ao carregar supressões.',
      life: 4000
    });
  } finally {
    isLoading.value = false;
  }
};

const carregarEstatisticas = async () => {
  try {
    const response = await apiClient.get('/api/email-supressoes/estatisticas/');
    estatisticas.value = response.data;
  } catch (error) {
    console.error('Erro ao carregar estatísticas:', error);
  }
};

const aplicarFiltros = () => {
  carregarSupressoes();
};

const liberarEmail = async (supressao) => {
  try {
    await apiClient.patch(`/api/email-supressoes/${supressao.id}/`, {
      status: 'liberado'
    });
    toast.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: 'E-mail liberado para envio.',
      life: 3000
    });
    carregarDados();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Erro',
      detail: 'Falha ao liberar e-mail.',
      life: 4000
    });
  }
};

const bloquearEmail = async (supressao) => {
  try {
    await apiClient.patch(`/api/email-supressoes/${supressao.id}/`, {
      status: 'ativo'
    });
    toast.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: 'E-mail bloqueado.',
      life: 3000
    });
    carregarDados();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Erro',
      detail: 'Falha ao bloquear e-mail.',
      life: 4000
    });
  }
};

const liberarLote = async () => {
  if (!confirm(`Liberar ${selecionados.value.length} e-mail(s) para envio?`)) {
    return;
  }
  
  try {
    const ids = selecionados.value.map(s => s.id);
    const response = await apiClient.post('/api/email-supressoes/liberar-lote/', { ids });
    toast.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: response.data.detail,
      life: 3000
    });
    selecionados.value = [];
    carregarDados();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Erro',
      detail: 'Falha ao liberar e-mails.',
      life: 4000
    });
  }
};

const bloquearLote = async () => {
  if (!confirm(`Bloquear ${selecionados.value.length} e-mail(s)?`)) {
    return;
  }
  
  try {
    const ids = selecionados.value.map(s => s.id);
    const response = await apiClient.post('/api/email-supressoes/bloquear-lote/', { ids });
    toast.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: response.data.detail,
      life: 3000
    });
    selecionados.value = [];
    carregarDados();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Erro',
      detail: 'Falha ao bloquear e-mails.',
      life: 4000
    });
  }
};

const abrirModalEdicao = (supressao) => {
  supressaoEmEdicao.value = { ...supressao };
  modalVisivel.value = true;
};

const salvarEdicao = async () => {
  isSaving.value = true;
  try {
    await apiClient.patch(`/api/email-supressoes/${supressaoEmEdicao.value.id}/`, {
      observacao: supressaoEmEdicao.value.observacao
    });
    toast.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: 'Observações salvas.',
      life: 3000
    });
    modalVisivel.value = false;
    carregarSupressoes();
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Erro',
      detail: 'Falha ao salvar observações.',
      life: 4000
    });
  } finally {
    isSaving.value = false;
  }
};

const formatarData = (dataISO) => {
  if (!dataISO) return '-';
  const data = new Date(dataISO);
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const abrirModalMunicipe = (municipeId) => {
  municipeIdParaEdicao.value = municipeId;
  modalMunicipeVisible.value = true;
};

const onMunicipeSalvo = () => {
  toast.add({
    severity: 'success',
    summary: 'Sucesso',
    detail: 'Contato atualizado. Recarregando lista...',
    life: 3000
  });
  // Recarrega a lista para atualizar os vínculos
  carregarSupressoes();
};

onMounted(() => {
  carregarDados();
});
</script>

<style scoped>
.page-container {
  padding: 2rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-icon.error {
  color: var(--red-500);
}

.stat-icon.success {
  color: var(--green-500);
}

.stat-icon.info {
  color: var(--blue-500);
}

.stat-icon.warning {
  color: var(--orange-500);
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-color);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}

.motivos-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.motivos-list li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.motivo-label {
  font-weight: 500;
}

.font-mono {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
}
</style>
