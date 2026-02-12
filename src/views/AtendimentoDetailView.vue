<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";

// Importando todos os componentes necessários
import Button from 'primevue/button';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Timeline from 'primevue/timeline';
import ProgressSpinner from 'primevue/progressspinner';
import Textarea from 'primevue/textarea';
import ConfirmDialog from 'primevue/confirmdialog';
import AlterarStatusModal from '@/components/atendimentos/AlterarStatusModal.vue';
import Chip from 'primevue/chip';
import FileUpload from 'primevue/fileupload';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const atendimento = ref(null);
const isLoading = ref(true);
const showAlterarStatusModal = ref(false);

onMounted(async () => {
  await carregarAtendimento();
});

// Função removida - categorias agora são apenas visualização

const carregarAtendimento = async () => {
    if (!authStore.isAuthenticated) {
        isLoading.value = false;
        return;
    }
    const atendimentoId = route.params.id;
    try {
        const atendimentoRes = await apiClient.get(`/api/atendimentos/${atendimentoId}/`);
        atendimento.value = atendimentoRes.data;
    } catch (error) { console.error("Erro ao buscar dados:", error); } 
    finally { isLoading.value = false; }
};

const aoStatusAlterado = async () => {
    // Recarrega o atendimento para obter dados atualizados
    await carregarAtendimento();
};

const isPrinting = ref(false); // Para o estado de loading do botão de imprimir

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

const getStatusDisplay = (status) => {
  const map = {
    'ABERTO': 'Aberto',
    'EM_ANALISE': 'Em Análise',
    'ENCAMINHADO': 'Encaminhado',
    'CONCLUIDO': 'Concluído',
    'ARQUIVADO': 'Arquivado'
  };
  return map[status] || status;
};

const setAuthHeader = (event) => {
    const xhr = event.xhr;
    const token = authStore.accessToken;
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
};

const onUploadSuccess = (event) => {
    // A API retorna o objeto do novo anexo criado
    const novoAnexo = JSON.parse(event.xhr.response);
    atendimento.value.anexos.push(novoAnexo);
    toast.add({ severity: 'info', summary: 'Sucesso', detail: 'Arquivo enviado!', life: 3000 });
};

const toggleEdicao = async (tramitacao) => {
    if (tramitacao.editando) {
        const payload = { despacho: tramitacao.textoEditado };
        try {
            const response = await apiClient.put(`/api/tramitacoes/${tramitacao.id}/`, payload);
            tramitacao.despacho = response.data.despacho;
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Nota atualizada.', life: 3000 });
        } catch (error) {
            toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar a edição.', life: 3000 });
        }
        tramitacao.editando = false;
    } else {
        tramitacao.textoEditado = tramitacao.despacho;
        tramitacao.editando = true;
    }
};

const cancelarEdicao = (tramitacao) => {
    tramitacao.editando = false;
}

const confirmarExclusao = (tramitacao) => {
  confirm.require({
    message: 'Tem certeza que deseja excluir esta nota de andamento?',
    header: 'Confirmação de Exclusão',
    icon: 'pi pi-info-circle',
    acceptClassName: 'p-button-danger',
    acceptLabel: 'Sim, Excluir',
    rejectLabel: 'Cancelar',
    accept: async () => {
      try {
        await apiClient.delete(`/api/tramitacoes/${tramitacao.id}/`);
        // Remove a tramitação da lista na tela, sem precisar recarregar
        atendimento.value.tramitacoes = atendimento.value.tramitacoes.filter(t => t.id !== tramitacao.id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Nota de andamento excluída.', life: 3000 });
      } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir a nota.', life: 3000 });
      }
    },
  });
};

// Adicione esta função ao final do seu script
const gerarPdfDetalhado = async () => {
    if (!atendimento.value) return;
    isPrinting.value = true;
    try {
        const response = await apiClient.get(`/api/atendimentos/${atendimento.value.id}/pdf/`, {
            responseType: 'blob', 
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `atendimento_${atendimento.value.protocolo}.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url); // Libera a memória

    } catch (error) {
        console.error("Erro ao gerar PDF detalhado:", error);
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o relatório em PDF.', life: 3000 });
    } finally {
        isPrinting.value = false;
    }
};
</script>
<template>
  <ConfirmDialog></ConfirmDialog>
  <div class="page-container">
    <div v-if="isLoading" class="loading-container">
      <ProgressSpinner />
    </div>

    <div v-else-if="atendimento">
      <Card>
        <template #title>
          <div class="card-title">
            <span>Protocolo: {{ atendimento.protocolo }} - {{ atendimento.titulo }}</span>
            <Tag :value="atendimento.status" :severity="getStatusSeverity(atendimento.status)" />
          </div>
        </template>
        <template #subtitle>
          <div class="card-subtitle">
            <Button label="Voltar ao(s) Atendimento(s)" icon="pi pi-arrow-left" @click="router.push('/atendimentos')" text size="small" />

            <Button 
              label="Imprimir Ficha" 
              icon="pi pi-print" 
              @click="gerarPdfDetalhado" 
              :loading="isPrinting" 
              class="p-button-secondary p-button-text" 
              size="small" 
            />
          </div>
        </template>
        <template #content>
          <div class="grid">
            <div class="col-12 md:col-3">
              <div class="p-fluid">
                <h4>Informações do Atendimento</h4>
                
                <!-- Status -->
                <div class="field mb-4">
                    <label>Status</label>
                    <div class="flex align-items-center gap-2">
                        <Tag :value="getStatusDisplay(atendimento.status)" :severity="getStatusSeverity(atendimento.status)" />
                        <Button 
                            icon="pi pi-pencil" 
                            @click="showAlterarStatusModal = true" 
                            rounded 
                            text 
                            size="small"
                            v-tooltip.top="'Alterar Status'"
                            severity="secondary"
                        />
                    </div>
                    <small class="p-text-secondary">Clique no ícone para alterar o status</small>
                </div>
                
                <!-- Categorias (somente visualização) -->
                <div class="field" v-if="atendimento.categorias && atendimento.categorias.length > 0">
                    <label>Categorias</label>
                    <div class="flex flex-wrap gap-2">
                        <Chip 
                            v-for="categoria in atendimento.categorias" 
                            :key="categoria.id" 
                            :label="categoria.nome" 
                            class="text-sm"
                        />
                    </div>
                </div>
              </div>
            </div>

            <div class="col-12 md:col-9">
              <h4>Detalhes do Solicitante</h4>
              <p class="m-0">
                <strong>Data:</strong> 
                {{ atendimento.data_criacao ? new Date(atendimento.data_criacao).toLocaleDateString('pt-BR') : 'N/A' }}
              </p>
              <p class="m-0"><strong>Munícipe:</strong> {{ atendimento.nome_municipe }}</p>
              <p class="m-0"><strong>Gabinete:</strong> {{ atendimento.nome_conta }}</p>
              <p class="m-0 uppercase"><strong>Responsável:</strong> {{ atendimento.responsavel_nome }}</p>

              <hr>

              <h4>Descrição Completa</h4>
              <p style="white-space: pre-wrap;">{{ atendimento.descricao }}</p>

              <hr>

              <div class="flex align-items-center justify-content-between mb-3">
                <h4 class="m-0">Histórico de Tramitações</h4>
                <Button 
                    label="Alterar Status" 
                    icon="pi pi-sync" 
                    @click="showAlterarStatusModal = true"
                    size="small"
                    severity="secondary"
                />
              </div>
              
              <div v-if="!atendimento.tramitacoes || atendimento.tramitacoes.length === 0" class="text-center p-4 text-color-secondary">
                <i class="pi pi-info-circle text-2xl mb-2"></i>
                <p>Nenhuma tramitação registrada ainda.</p>
                <p class="text-sm">Use o botão "Alterar Status" acima para criar a primeira tramitação.</p>
              </div>
              
              <Timeline v-else :value="atendimento.tramitacoes" align="left" class="custom-timeline">
                <template #marker="slotProps">
                    <div class="timeline-marker">
                        <i v-if="slotProps.item.alterou_status" class="pi pi-sync text-primary"></i>
                        <i v-else class="pi pi-comment text-secondary"></i>
                    </div>
                </template>
                <template #content="slotProps">
                    <Card class="mb-3">
                        <template #content>
                            <div v-if="slotProps.item.editando">
                                <Textarea v-model="slotProps.item.textoEditado" rows="3" autoResize class="w-full mb-2" />
                                <div class="flex gap-2">
                                    <Button label="Salvar" icon="pi pi-check" size="small" @click="toggleEdicao(slotProps.item)" />
                                    <Button label="Cancelar" icon="pi pi-times" size="small" severity="secondary" @click="cancelarEdicao(slotProps.item)" />
                                </div>
                            </div>
                            <div v-else>
                                <!-- Mudança de Status -->
                                <div v-if="slotProps.item.alterou_status && slotProps.item.status_anterior && slotProps.item.status_novo" class="mb-3">
                                    <div class="flex align-items-center gap-2 mb-2">
                                        <Tag 
                                            :value="getStatusDisplay(slotProps.item.status_anterior)" 
                                            :severity="getStatusSeverity(slotProps.item.status_anterior)"
                                            class="text-xs"
                                        />
                                        <i class="pi pi-arrow-right text-sm text-color-secondary"></i>
                                        <Tag 
                                            :value="getStatusDisplay(slotProps.item.status_novo)" 
                                            :severity="getStatusSeverity(slotProps.item.status_novo)"
                                            class="text-xs"
                                        />
                                        <span v-if="slotProps.item.encaminhado_para_nome" class="ml-2 text-sm text-color-secondary">
                                            <i class="pi pi-arrow-right"></i> {{ slotProps.item.encaminhado_para_nome }}
                                        </span>
                                    </div>
                                </div>
                                
                                <!-- Despacho -->
                                <p class="mb-2" style="white-space: pre-wrap;">{{ slotProps.item.despacho }}</p>
                                
                                <!-- Metadados -->
                                <div class="flex align-items-center gap-3 text-sm text-color-secondary mt-2 pt-2 border-top-1 surface-border">
                                    <span>
                                        <i class="pi pi-user mr-1"></i>
                                        {{ slotProps.item.usuario_nome || 'Sistema' }}
                                    </span>
                                    <span>
                                        <i class="pi pi-calendar mr-1"></i>
                                        {{ new Date(slotProps.item.data_tramitacao).toLocaleString('pt-BR') }}
                                    </span>
                                    <div class="flex-grow-1"></div>
                                    <Button 
                                        icon="pi pi-pencil" 
                                        rounded 
                                        text 
                                        size="small" 
                                        @click="toggleEdicao(slotProps.item)"
                                        v-tooltip.top="'Editar'"
                                    />
                                    <Button 
                                        icon="pi pi-trash" 
                                        rounded 
                                        text 
                                        severity="danger" 
                                        size="small" 
                                        @click="confirmarExclusao(slotProps.item)"
                                        v-tooltip.top="'Excluir'"
                                    />
                                </div>
                            </div>
                        </template>
                    </Card>
                </template>
              </Timeline>

              <hr />

              <h4>Anexos</h4>
              <div class="grid">
                <div class="col-12">
                  <h5>Arquivos existentes:</h5>
                  <div v-if="atendimento.anexos && atendimento.anexos.length > 0">
                    <ul>
                      <li v-for="anexo in atendimento.anexos" :key="anexo.id">
                        <a :href="anexo.arquivo_url" target="_blank">{{ anexo.arquivo.split('/').pop() }}</a>
                        <small class="ml-2 p-text-secondary">- {{ anexo.descricao }}</small>
                      </li>
                    </ul>
                  </div>
                  <p v-else>Nenhum anexo encontrado.</p>
                </div>
                <div class="col-12">
                  <h5>Adicionar novo anexo:</h5>
                  <FileUpload 
                    name="arquivo" 
                    :url="`/api/atendimentos/${atendimento.id}/anexos/`" 
                    @before-send="setAuthHeader"
                    @upload="onUploadSuccess"
                    :multiple="true" 
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" 
                    :maxFileSize="10000000">
                    <template #empty>
                      <p>Arraste e solte os arquivos aqui para fazer o upload.</p>
                    </template>
                  </FileUpload>
                </div>
              </div>

            </div>
          </div>
        </template>
      </Card>
    </div>

    <div v-else>
      <p>Atendimento não encontrado. <a href="/">Voltar para o Dashboard</a>.</p>
    </div>

    <!-- Modal de Alterar Status -->
    <AlterarStatusModal 
      v-model:visible="showAlterarStatusModal"
      :atendimento-id="atendimento?.id"
      :status-atual="atendimento?.status"
      @status-alterado="aoStatusAlterado"
    />
  </div>
</template>
<style scoped>
.page-container { padding: 2rem; margin: auto; }
.card-title { display: flex; justify-content: space-between; align-items: center; }
.card-subtitle { 
    display: flex; 
    align-items: center; 
    margin-top: 1rem; 
    gap: 0.5rem; /* Adicione esta linha */
}
hr { margin: 1.5rem 0; border: 0; border-top: 1px solid #dee2e6; }

/* Timeline melhorada */
.custom-timeline :deep(.p-timeline-event-marker) {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-ground);
  border: 2px solid var(--primary-color);
}

.timeline-marker {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-timeline :deep(.p-timeline-event-content) {
  padding-left: 1rem;
}
</style>
