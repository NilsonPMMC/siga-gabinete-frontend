<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/api';
import { useAuthStore } from '@/stores/auth';
import Avatar from 'primevue/avatar';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Dialog from 'primevue/dialog';
import Checkbox from 'primevue/checkbox';
import RadioButton from 'primevue/radiobutton';
import MunicipeFormModal from '@/components/municipes/MunicipeFormModal.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const municipeData = ref(null);
const isLoading = ref(true);
const isDownloading = ref(false);
const showEditModal = ref(false);
const dossieDialogVisible = ref(false);
const filtroEscopo = ref('total');
const secoesSelecionadas = ref(['atendimentos', 'agendas', 'eventos']);

// Função para buscar os dados (Extraída do onMounted para ser reutilizável)
const carregarDadosDoMunicipe = async () => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  
  // O ID vem da URL (ex: /municipes/15 -> id é 15)
  const municipeId = route.params.id;
  
  try {
    isLoading.value = true;
    const response = await apiClient.get(`/api/municipes/${municipeId}/historico/`);
    municipeData.value = response.data;
  } catch (error) {
    console.error("Erro ao buscar histórico do munícipe:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  carregarDadosDoMunicipe();
});

// Callback: O que acontece quando o modal termina de salvar?
const aoSalvarEdicao = () => {
  // Recarrega os dados para mostrar as alterações na tela
  carregarDadosDoMunicipe();
};

const abrirOpcoesDossie = () => {
    dossieDialogVisible.value = true;
};

const confirmarDownload = async () => {
  dossieDialogVisible.value = false; // Fecha o modal
  isDownloading.value = true;
  
  try {
    // Monta os parâmetros QueryString
    const params = {
        escopo: filtroEscopo.value,
        secoes: secoesSelecionadas.value.join(',') // ex: "atendimentos,eventos"
    };

    const response = await apiClient.get(`/api/municipes/${route.params.id}/dossie-pdf/`, {
      params: params, // Envia os filtros para o backend
      responseType: 'blob'
    });

    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    const nomeArquivo = `Dossie_${municipeData.value.nome_completo.replace(/\s+/g, '_')}.pdf`;
    link.setAttribute('download', nomeArquivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error("Erro ao baixar:", error);
    alert("Erro ao gerar documento.");
  } finally {
    isDownloading.value = false;
  }
};

// Navegação
const verAtendimento = (id) => router.push(`/atendimentos/${id}`);
const verAgenda = (id) => router.push(`/agendas/editar/${id}`);
const podeVerDetalhesAtendimento = () => !authStore.isRecepcao;
</script>

<template>
  <div class="page-container">
    <div v-if="isLoading" class="loading-container text-center">
      <ProgressSpinner />
    </div>

    <div v-else-if="municipeData">
      <div class="header-container flex justify-content-between align-items-center mb-4">
        <div class="flex align-items-center gap-2">
            <Button icon="pi pi-arrow-left" @click="router.push('/contatos')" text rounded severity="secondary" aria-label="Voltar" />
            <h2 class="page-title m-0">{{ municipeData.dados_cadastrais?.nome || municipeData.nome_completo }}</h2>
        </div>
        <div class="flex align-items-center gap-2">
          <Button 
              label="Editar Cadastro" 
              icon="pi pi-pencil" 
              @click="showEditModal = true" 
          />
          <Button label="Baixar Dossiê" icon="pi pi-file-pdf" severity="danger" outlined @click="abrirOpcoesDossie" :loading="isDownloading" />
        </div>
      </div>

      <Card class="mb-4">
        <template #title>
            <div class="flex align-items-center gap-3">
                
                <div 
                    class="w-8rem h-8rem border-circle shadow-2 surface-card flex align-items-center justify-content-center overflow-hidden relative"
                    style="min-width: 8rem; min-height: 8rem;"
                >
                    <img 
                        v-if="municipeData.foto" 
                        :src="municipeData.foto" 
                        alt="Foto Perfil" 
                        class="w-full h-full"
                        style="object-fit: cover;"
                        @error="municipeData.foto = null"
                    />
                    <i v-else class="pi pi-user text-5xl text-400"></i>
                </div>
                <div>
                    <span class="text-xl font-bold">Dados do Munícipe</span>
                    <div class="mt-2">
                        <Tag v-if="municipeData.categoria?.nome" :value="municipeData.categoria.nome" severity="info" />
                        <Tag v-if="municipeData.categoria?.nome === 'AUTORIDADE'" value="VIP" severity="warning" class="ml-2" />
                    </div>
                </div>
            </div>
        </template>
        <template #content>
            <div class="grid mt-3">
            <div class="col-12 md:col-6"><strong>Nome:</strong> {{ municipeData.dados_cadastrais?.nome || municipeData.nome_completo }}</div>
            <div class="col-12 md:col-6"><strong>CPF:</strong> {{ municipeData.dados_cadastrais?.cpf || municipeData.cpf || 'Não informado' }}</div>
            <div class="col-12 md:col-6"><strong>Cargo:</strong> {{ municipeData.dados_cadastrais?.cargo || municipeData.cargo || 'Não informado' }}</div>
            <div class="col-12 md:col-6"><strong>Órgão:</strong> {{ municipeData.dados_cadastrais?.orgao || municipeData.orgao || 'Não informado' }}</div>
            <div class="col-12 md:col-6">
                <strong>Telefone:</strong> 
                {{ municipeData.dados_cadastrais?.telefones?.[0]?.numero || municipeData.telefones?.[0]?.numero || 'Não informado' }}
            </div>
            <div class="col-12 md:col-6"><strong>Email:</strong> {{ municipeData.dados_cadastrais?.email || municipeData.email || 'Não informado' }}</div>
          </div>
        </template>
      </Card>

      <TabView>
        <TabPanel header="Histórico de Atendimentos">
            <DataTable :value="municipeData.atendimentos" paginator :rows="5" :loading="isLoading" emptyMessage="Nenhum atendimento encontrado.">
                <Column field="data_criacao" header="Data" sortable>
                    <template #body="{ data }">
                        {{ new Date(data.data_criacao).toLocaleDateString('pt-BR') }}
                    </template>
                </Column>
                <Column field="protocolo" header="Protocolo" sortable></Column>
                <Column field="titulo" header="Título" style="width: 50%"></Column>
                <Column field="nome_conta" header="Gabinete"></Column>
                <Column field="status" header="Status" sortable></Column>
                <Column header="Ações">
                  <template #body="slotProps">
                    <Button v-if="podeVerDetalhesAtendimento()" icon="pi pi-eye" text rounded @click="verAtendimento(slotProps.data.id)" title="Ver Detalhes do Atendimento" />
                  </template>
                </Column>
            </DataTable>
        </TabPanel>
        
        <TabPanel header="Histórico de Agendas">
            <DataTable :value="municipeData.solicitacoes_agenda" paginator :rows="5" :loading="isLoading" emptyMessage="Nenhuma solicitação de agenda encontrada.">
                <Column field="data_criacao" header="Data" sortable>
                    <template #body="{ data }">
                        {{ new Date(data.data_agendada).toLocaleDateString('pt-BR') }}
                    </template>
                </Column>
                <Column field="assunto" header="Assunto" style="width: 50%"></Column>
                <Column field="conta_nome" header="Gabinete"></Column>
                <Column field="status" header="Status" sortable></Column>
                <Column header="Ações">
                  <template #body="slotProps">
                    <Button v-if="authStore.isSecretaria || authStore.user?.is_superuser" icon="pi pi-pencil" text rounded severity="secondary" @click="verAgenda(slotProps.data.id)" title="Gerenciar Solicitação" />
                  </template>
                </Column>
            </DataTable>
        </TabPanel>
      </TabView>

    </div>

    <div v-else>
      <p>Munícipe não encontrado.</p>
    </div>

    <MunicipeFormModal 
        v-model:visible="showEditModal" 
        :municipeId="route.params.id" 
        @saved="aoSalvarEdicao" 
    />

    <Dialog v-model:visible="dossieDialogVisible" header="Opções do Dossiê" :modal="true" :style="{ width: '450px' }">
        <div class="flex flex-column gap-4">
            
            <div>
                <label class="font-bold block mb-2">Abrangência</label>
                <div class="flex gap-3">
                    <div class="flex align-items-center">
                        <RadioButton v-model="filtroEscopo" inputId="scope1" name="escopo" value="total" />
                        <label for="scope1" class="ml-2">Visão Geral (Conta)</label>
                    </div>
                    <div class="flex align-items-center">
                        <RadioButton v-model="filtroEscopo" inputId="scope2" name="escopo" value="meus" />
                        <label for="scope2" class="ml-2">Apenas Meus Atendimentos</label>
                    </div>
                </div>
            </div>

            <div>
                <label class="font-bold block mb-2">Conteúdo do Relatório</label>
                <div class="flex flex-column gap-2">
                    <div class="flex align-items-center">
                        <Checkbox v-model="secoesSelecionadas" inputId="sec1" name="secao" value="atendimentos" />
                        <label for="sec1" class="ml-2">Histórico de Atendimentos</label>
                    </div>
                    <div class="flex align-items-center">
                        <Checkbox v-model="secoesSelecionadas" inputId="sec2" name="secao" value="agendas" />
                        <label for="sec2" class="ml-2">Solicitações de Agenda</label>
                    </div>
                    <div class="flex align-items-center">
                        <Checkbox v-model="secoesSelecionadas" inputId="sec3" name="secao" value="eventos" />
                        <label for="sec3" class="ml-2">Eventos e Cerimonial</label>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="dossieDialogVisible = false" />
            <Button label="Gerar PDF" icon="pi pi-check" @click="confirmarDownload" autofocus />
        </template>
    </Dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
</style>