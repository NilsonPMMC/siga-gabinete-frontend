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
import Dropdown from 'primevue/dropdown';
import MultiSelect from 'primevue/multiselect';
import ToggleButton from 'primevue/togglebutton';
import ConfirmDialog from 'primevue/confirmdialog';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const atendimento = ref(null);
const isLoading = ref(true);

// Opções para o dropdown de Status (poderíamos buscar da API também no futuro)
const statusOptions = ref([
    { name: 'Aberto', code: 'ABERTO' },
    { name: 'Em Análise', code: 'EM_ANALISE' },
    { name: 'Encaminhado', code: 'ENCAMINHADO' },
    { name: 'Concluído', code: 'CONCLUIDO' },
    { name: 'Arquivado', code: 'ARQUIVADO' },
]);
const todasCategorias = ref([]);

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  const atendimentoId = route.params.id;
  try {
    const [atendimentoRes, categoriasRes] = await Promise.all([
        apiClient.get(`/api/atendimentos/${atendimentoId}/`),
        apiClient.get('/api/categorias/')
    ]);

    atendimento.value = {
        ...atendimentoRes.data,
        categorias: atendimentoRes.data.categorias.map(c => c.id)
    };
    todasCategorias.value = categoriasRes.data;

  } catch (error) { console.error("Erro ao buscar dados:", error); } 
  finally { isLoading.value = false; }
});

const salvarAlteracoes = async () => {
    try {
        const payload = {
            status: atendimento.value.status,
            categorias_ids: atendimento.value.categorias 
        };
        const response = await apiClient.patch(`/api/atendimentos/${atendimento.value.id}/`, payload);

        atendimento.value.status = response.data.status;
        atendimento.value.categorias = response.data.categorias.map(c => c.id);

        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Atendimento atualizado.', life: 3000 });
    } catch (error) {
        console.error("Erro ao atualizar atendimento:", error.response?.data);
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível atualizar o atendimento.', life: 3000 });
    }
};

const novaTramitacaoTexto = ref('');
const isSavingTramitacao = ref(false);
const notificarMunicipe = ref(false);
const isPrinting = ref(false); // Para o estado de loading do botão de imprimir

const getStatusSeverity = (status) => {
  const map = { 'ABERTO': 'info', 'EM_ANALISE': 'warning', 'CONCLUIDO': 'success' };
  return map[status] || 'secondary';
};

const salvarNovaTramitacao = async () => {
  if (!novaTramitacaoTexto.value.trim()) {
    toast.add({ severity: 'warn', summary: 'Atenção', detail: 'O campo de despacho não pode estar vazio.', life: 3000 });
    return;
  }

  isSavingTramitacao.value = true;
  try {
    const payload = {
      despacho: novaTramitacaoTexto.value,
      notificar_municipe: notificarMunicipe.value // Adicionamos a nova informação
    }
    const response = await apiClient.post(`/api/atendimentos/${atendimento.value.id}/tramitacoes/`, payload);
    atendimento.value.tramitacoes.unshift(response.data);
    novaTramitacaoTexto.value = '';
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Novo andamento registrado.', life: 3000 });

  } catch (error) {
    console.error("Erro ao salvar tramitação:", error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar a nota.', life: 3000 });
  } finally {
    isSavingTramitacao.value = false;
  }
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
                <h4>Gerenciar Atendimento</h4>
                <div class="field">
                    <label for="status">Status do Atendimento</label>
                    <Dropdown id="status" v-model="atendimento.status" :options="statusOptions" optionLabel="name" optionValue="code" placeholder="Selecione o status" />
                </div>
                <div class="field">
                    <label for="categorias">Categorias</label>
                    <MultiSelect id="categorias" v-model="atendimento.categorias" :options="todasCategorias" optionLabel="nome" optionValue="id" placeholder="Selecione as categorias" display="chip" />
                </div>
                <Button label="Salvar Alterações" icon="pi pi-save" @click="salvarAlteracoes" class="mt-2" />
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

              <h4>Histórico de Tramitações</h4>
              <Timeline :value="atendimento.tramitacoes" align="left" class="custom-timeline">
                <template #marker="slotProps">
                    <Button :icon="slotProps.item.editando ? 'pi pi-save' : 'pi pi-pencil'" rounded text size="small" @click="toggleEdicao(slotProps.item)" />
                </template>
                <template #content="slotProps">
                    <Textarea v-if="slotProps.item.editando" v-model="slotProps.item.textoEditado" rows="2" autoResize class="w-full mb-2" />
                    <p v-else><strong>{{ slotProps.item.despacho }}</strong></p>
                    <small>Por: {{ slotProps.item.usuario_nome || 'Sistema' }} em {{ new Date(slotProps.item.data_tramitacao).toLocaleString('pt-BR') }}</small>
                </template>
                <template #opposite="slotProps">
                     <Button v-if="slotProps.item.editando" icon="pi pi-times" rounded text severity="secondary" size="small" @click="cancelarEdicao(slotProps.item)" />
                     <Button v-else icon="pi pi-trash" rounded text severity="danger" size="small" @click="confirmarExclusao(slotProps.item)" />
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

              <hr>

              <h4>Adicionar Novo Andamento</h4>
              <div class="novo-despacho-form">
                  <div class="p-fluid">
                      <Textarea v-model="novaTramitacaoTexto" rows="3" placeholder="Digite a nota de progresso aqui..." autoResize />
                  </div>

                  <div class="field mt-3">
                      <ToggleButton v-model="notificarMunicipe" onLabel="Notificar Munícipe" offLabel="Não Notificar Munícipe" onIcon="pi pi-check" offIcon="pi pi-times" class="w-full sm:w-auto" />
                  </div>

                  <div class="flex justify-content-end mt-3">
                      <Button label="Salvar Nota" icon="pi pi-check" @click="salvarNovaTramitacao" :loading="isSavingTramitacao" />
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
/* Força o container do checkbox a ter um display flexível */
.p-checkbox {
  display: flex;
  align-items: center;
}

/* Garante que a "caixa" do checkbox tenha um tamanho visível */
.p-checkbox-box {
  width: 20px;
  height: 20px;
}
</style>
