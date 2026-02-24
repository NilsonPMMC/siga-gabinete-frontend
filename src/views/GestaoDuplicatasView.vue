<template>
  <div class="page-container">
    <Toast />
    <ConfirmDialog></ConfirmDialog>

    <header class="page-header">
      <div>
        <h1 class="mb-0">Gestão de Contatos Duplicados</h1>
        <p class="mt-1 text-color-secondary">Grupos de contatos que podem ser a mesma pessoa.</p>
      </div>
      <div class="flex align-items-center gap-2 flex-wrap">
        <Button
          label="Rodar Auditoria agora"
          icon="pi pi-refresh"
          class="p-button-outlined"
          :loading="loadingAuditoria"
          :disabled="loading"
          @click="rodarAuditoria"
        />
        <router-link to="/contatos">
          <Button label="Voltar para Contatos" icon="pi pi-arrow-left" />
        </router-link>
      </div>
    </header>

    <main>
      <div v-if="loading" class="text-center mt-4">
        <ProgressSpinner />
        <p>Buscando duplicatas...</p>
      </div>

      <div v-else-if="loadingMerge" class="text-center mt-4">
        <ProgressSpinner />
        <p>Unificando contatos... Aguarde.</p>
      </div>

      <Message v-else-if="!Object.keys(grupos).length" severity="info">Nenhum grupo de duplicatas encontrado no momento. Use "Rodar Auditoria agora" para verificar.</Message>

      <div v-else class="duplicatas-grid">
        <Card v-for="(grupo, grupoId) in grupos" :key="grupoId" class="p-card-duplicata">
          <template #title>
            <div class="flex justify-content-between align-items-center flex-wrap gap-2">
              <span class="text-lg">Grupo de Duplicatas</span>
              <div class="flex gap-2">
                <Button
                  icon="pi pi-times"
                  class="p-button-rounded p-button-text p-button-secondary"
                  v-tooltip.top="'Ignorar grupo (remover da lista)'"
                  @click="confirmarDescartarGrupo(grupoId)"
                />
                <Button
                  label="Mesclar Contatos"
                  icon="pi pi-link"
                  class="p-button-success"
                  :disabled="!isMergeReady(grupoId)"
                  @click="confirmarMesclagem(grupoId)"
                />
              </div>
            </div>
          </template>
          <template #content>
            <p class="mb-4">Selecione um contato como <strong>principal</strong> para manter. Todos os vínculos (atendimentos, perfis, etc.) dos outros contatos serão transferidos para ele. Após a fusão, os outros registros serão removidos.</p>
            <div v-for="contato in grupo" :key="contato.id" class="contato-item">
              <div class="flex align-items-center justify-content-between flex-wrap gap-2">
                <div class="flex align-items-center">
                  <RadioButton
                    :inputId="'principal_' + contato.id"
                    :name="'principal_' + grupoId"
                    :value="contato.id"
                    v-model="selecoes[grupoId].principal"
                  />
                  <label :for="'principal_' + contato.id" class="ml-2">
                    <span class="font-bold text-lg">{{ contato.nome_completo }}</span> (ID: {{ contato.id }})
                  </label>
                </div>
                <Button
                  label="Não é duplicata"
                  icon="pi pi-user-minus"
                  class="p-button-sm p-button-outlined p-button-secondary"
                  @click="confirmarDescartarContato(grupoId, contato)"
                />
              </div>
              <div class="contato-detalhes">
                <p v-if="contato.cpf"><strong>CPF:</strong> {{ contato.cpf }}</p>
                <p><strong>Telefones:</strong> {{ formatarTelefones(contato.telefones) }}</p>
                <p><strong>E-mails:</strong> {{ formatarEmails(contato.emails) }}</p>
                <small>Cadastrado em: {{ formatarDataCadastro(contato.data_cadastro) }}</small>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";

// Componentes PrimeVue
import Card from 'primevue/card';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import Message from 'primevue/message';
import RadioButton from 'primevue/radiobutton';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';

const toast = useToast();
const confirm = useConfirm();

const loading = ref(true);
const loadingAuditoria = ref(false);
const loadingMerge = ref(false);
const grupos = ref({});
const selecoes = ref({});

// Rodar auditoria em background (chama o management command via API)
const rodarAuditoria = async () => {
  loadingAuditoria.value = true;
  try {
    await apiClient.post('/api/municipes/rodar-auditoria/');
    toast.add({
      severity: 'success',
      summary: 'Auditoria iniciada',
      detail: 'A verificação está rodando em background. Atualize a página em alguns minutos para ver os grupos.',
      life: 5000
    });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível iniciar a auditoria.' });
  } finally {
    loadingAuditoria.value = false;
  }
};

// Descartar grupo inteiro (limpa grupo_duplicado de todos os membros)
const confirmarDescartarGrupo = (grupoId) => {
  const grupo = grupos.value[grupoId] || [];
  confirm.require({
    message: `Remover ${grupo.length} contato(s) deste grupo de duplicatas? Eles deixarão de aparecer aqui (o grupo será ignorado).`,
    header: 'Ignorar grupo',
    icon: 'pi pi-question-circle',
    acceptLabel: 'Sim, ignorar grupo',
    rejectLabel: 'Cancelar',
    accept: () => descartarGrupo(grupoId),
  });
};

const descartarGrupo = async (grupoId) => {
  try {
    const res = await apiClient.post('/api/municipes/descartar-grupo/', { grupo_duplicado: grupoId });
    toast.add({ severity: 'success', summary: 'Grupo ignorado', detail: res.data.message, life: 3000 });
    const next = { ...grupos.value };
    delete next[grupoId];
    grupos.value = next;
    inicializarSelecoes();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: error.response?.data?.error || 'Não foi possível ignorar o grupo.' });
  }
};

// Descartar um único contato do grupo ("Não é duplicata")
const confirmarDescartarContato = (grupoId, contato) => {
  confirm.require({
    message: `Remover "${contato.nome_completo}" deste grupo? Ele deixará de ser considerado duplicata.`,
    header: 'Não é duplicata',
    icon: 'pi pi-user-minus',
    acceptLabel: 'Sim, remover',
    rejectLabel: 'Cancelar',
    accept: () => descartarContato(grupoId, contato),
  });
};

const descartarContato = async (grupoId, contato) => {
  try {
    await apiClient.post(`/api/municipes/${contato.id}/descartar-duplicata/`);
    toast.add({ severity: 'success', summary: 'Removido', detail: 'Contato removido do grupo de duplicatas.', life: 3000 });
    const lista = (grupos.value[grupoId] || []).filter(c => c.id !== contato.id);
    if (lista.length <= 1) {
      const next = { ...grupos.value };
      delete next[grupoId];
      grupos.value = next;
    } else {
      grupos.value = { ...grupos.value, [grupoId]: lista };
    }
    inicializarSelecoes();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: error.response?.data?.error || 'Não foi possível remover.' });
  }
};

// Função para buscar os contatos com grupo_duplicado
const carregarDuplicatas = async () => {
  loading.value = true;
  try {
    const response = await apiClient.get('/api/municipes/', {
        params: { tem_grupo_duplicado: 'true' }
    });
    agruparContatos(response.data);
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao buscar contatos duplicados.' });
  } finally {
    loading.value = false;
  }
};

// Agrupa os contatos pelo 'grupo_duplicado'
const agruparContatos = (contatos) => {
  const gruposMap = {};
  for (const contato of contatos) {
    if (contato.grupo_duplicado) {
      if (!gruposMap[contato.grupo_duplicado]) {
        gruposMap[contato.grupo_duplicado] = [];
      }
      gruposMap[contato.grupo_duplicado].push(contato);
    }
  }
  grupos.value = gruposMap;
  inicializarSelecoes();
};

// Prepara o objeto para v-model das seleções de rádio
const inicializarSelecoes = () => {
    const novasSelecoes = {};
    for (const grupoId in grupos.value) {
        novasSelecoes[grupoId] = { principal: null };
    }
    selecoes.value = novasSelecoes;
};

onMounted(carregarDuplicatas);

const formatarDataCadastro = (dataString) => {
  if (!dataString) return 'Data não disponível';
  const data = new Date(dataString);
  if (isNaN(data.getTime())) return 'Data inválida';

  const dataFormatada = data.toLocaleDateString('pt-BR');
  const horaFormatada = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return `${dataFormatada} - ${horaFormatada}`;
};

// Funções de formatação para exibição
const formatarTelefones = (telefones) => {
  if (!telefones || !telefones.length) return 'Nenhum';
  return telefones.map(t => t.numero).join(', ');
};
const formatarEmails = (emails) => {
  if (!emails || !emails.length) return 'Nenhum';
  return emails.map(e => e.email).join(', ');
};

// Verifica se o botão de mesclar pode ser ativado
const isMergeReady = (grupoId) => {
    return selecoes.value[grupoId] && selecoes.value[grupoId].principal !== null;
};

// Lógica de mesclagem
const confirmarMesclagem = (grupoId) => {
    const idPrincipal = selecoes.value[grupoId].principal;
    const contatosDoGrupo = grupos.value[grupoId];
    const contatosParaMesclar = contatosDoGrupo.filter(c => c.id !== idPrincipal);
    const nomePrincipal = contatosDoGrupo.find(c => c.id === idPrincipal)?.nome_completo;

    confirm.require({
        message: `Todos os vínculos de ${contatosParaMesclar.length} contato(s) serão transferidos para "${nomePrincipal}" (ID: ${idPrincipal}). Os registros antigos serão removidos permanentemente. Deseja continuar?`,
        header: 'Confirmar Fusão de Contatos',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sim, mesclar',
        rejectLabel: 'Cancelar',
        accept: () => executarMesclagem(idPrincipal, contatosParaMesclar),
    });
};

const executarMesclagem = async (idPrincipal, contatosParaMesclar) => {
  loadingMerge.value = true;
  const totalTransferidos = { atendimentos: 0, visitas: 0, solicitacoes_agenda: 0, perfis: 0, reservas: 0 };
  try {
    for (const contato of contatosParaMesclar) {
      const res = await apiClient.post('/api/municipes/mesclar-duplicatas/', {
        id_principal: idPrincipal,
        id_duplicado: contato.id
      });
      const t = res.data.transferidos || {};
      totalTransferidos.atendimentos += t.atendimentos || 0;
      totalTransferidos.visitas += t.visitas || 0;
      totalTransferidos.solicitacoes_agenda += t.solicitacoes_agenda || 0;
      totalTransferidos.perfis += t.perfis || 0;
      totalTransferidos.reservas += t.reservas || 0;
    }
    const partes = [];
    if (totalTransferidos.atendimentos) partes.push(`${totalTransferidos.atendimentos} atendimento(s)`);
    if (totalTransferidos.visitas) partes.push(`${totalTransferidos.visitas} visita(s)`);
    if (totalTransferidos.solicitacoes_agenda) partes.push(`${totalTransferidos.solicitacoes_agenda} solicitação(ões) de agenda`);
    if (totalTransferidos.perfis) partes.push(`${totalTransferidos.perfis} cargo(s)/perfil(is)`);
    if (totalTransferidos.reservas) partes.push(`${totalTransferidos.reservas} reserva(s)`);
    const detail = partes.length ? partes.join(', ') + ' transferidos.' : 'Contatos mesclados com sucesso!';
    toast.add({ severity: 'success', summary: 'Fusão concluída', detail, life: 5000 });
    await carregarDuplicatas();
  } catch (error) {
    const errorMsg = error.response?.data?.error || 'Não foi possível completar a operação.';
    toast.add({ severity: 'error', summary: 'Erro na Fusão', detail: errorMsg, life: 5000 });
  } finally {
    loadingMerge.value = false;
  }
};

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
  flex-wrap: wrap;
  gap: 1rem;
}
.duplicatas-grid {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr;
}
.p-card-duplicata {
  border-left: 5px solid var(--orange-500);
}
.contato-item {
  padding: 1rem;
  border: 1px solid var(--surface-d);
  border-radius: 6px;
  margin-top: 1rem;
}
.contato-detalhes {
  padding-left: 2.5rem;
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-color-secondary);
}
.contato-detalhes p {
  margin: 0.25rem 0;
}
</style>
