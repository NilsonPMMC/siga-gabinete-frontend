<script setup>
import { ref, onMounted, computed } from 'vue';
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

/** Histórico unificado: atendimentos (inclui visitas migradas); visitas legadas só sem vínculo. */
const historicoUnificado = computed(() => {
  if (!municipeData.value) return [];
  const itens = [];
  const atendimentos = municipeData.value.atendimentos || [];
  const visitas = municipeData.value.visitas || [];
  atendimentos.forEach((a) => {
    const dataStr = a.data_criacao ? new Date(a.data_criacao).toLocaleDateString('pt-BR') : '';
    itens.push({
      tipo: 'atendimento',
      dataOrdenacao: a.data_criacao ? new Date(a.data_criacao).getTime() : 0,
      data: dataStr,
      detalhe: `Atendimento via ${a.origem_display || a.origem || 'Presencial'}${a.assunto_nome ? ` — ${a.assunto_nome}` : ''} em ${dataStr}`,
      protocolo: a.protocolo,
      id: a.id,
    });
  });
  visitas
    .filter((v) => !v.atendimento)
    .forEach((v) => {
      const dataStr = v.data_checkin ? new Date(v.data_checkin).toLocaleDateString('pt-BR') : '';
      itens.push({
        tipo: 'visita',
        dataOrdenacao: v.data_checkin ? new Date(v.data_checkin).getTime() : 0,
        data: dataStr,
        detalhe: `Visita/Presença (legado) em ${dataStr}`,
        protocolo: null,
        id: null,
      });
    });
  itens.sort((a, b) => b.dataOrdenacao - a.dataOrdenacao);
  return itens;
});

const historicoEnriquecimentoIA = computed(() => {
  const audit = municipeData.value?.auditoria_ia;
  const eventos = Array.isArray(audit?.enrichment_events) ? audit.enrichment_events : [];
  return [...eventos]
    .map((e) => ({
      ts: e?.ts || null,
      data: e?.ts ? new Date(e.ts).toLocaleString('pt-BR') : '—',
      source: e?.source || 'unknown',
      profile_mode: e?.profile_mode || '—',
      user_id: e?.user_id ?? '—',
      applied_fields: e?.applied_fields || {},
      profile_result: e?.profile_result || {},
    }))
    .sort((a, b) => {
      const ta = a.ts ? new Date(a.ts).getTime() : 0;
      const tb = b.ts ? new Date(b.ts).getTime() : 0;
      return tb - ta;
    });
});

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

/** Exibe um e-mail: só o valor, com tipo entre parênteses; evita mostrar objeto ou vazio como JSON */
function formatarEmail(em) {
  if (em == null) return '—';
  const valor = typeof em === 'object' ? (em.email || '').trim() : String(em);
  const tipo = typeof em === 'object' && em.tipo ? em.tipo : '';
  const texto = valor || '—';
  return tipo ? `${texto} (${tipo})` : texto;
}

/** Endereço em uma linha; aceita logradouro ou rua e demais campos comuns */
const enderecoFormatado = computed(() => {
  const e = municipeData.value?.endereco;
  if (!e || typeof e !== 'object' || !Object.keys(e).length) return '';
  const logradouro = e.logradouro || e.rua || '';
  const partes = [logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf, e.cep].filter(Boolean);
  return partes.join(', ');
});
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
                        <Tag v-for="cat in (municipeData.categorias_nomes || [])" :key="cat" :value="cat" severity="info" class="mr-1" />
                        <Tag v-if="(municipeData.categorias_nomes || []).includes('AUTORIDADE')" value="VIP" severity="warning" class="ml-2" />
                    </div>
                </div>
            </div>
        </template>
        <template #content>
            <div class="grid mt-3">
              <div class="col-12 md:col-6"><strong>Nome:</strong> {{ municipeData.nome_completo }}</div>
              <div class="col-12 md:col-6"><strong>Nome de Guerra:</strong> {{ municipeData.nome_de_guerra || '—' }}</div>
              <div class="col-12 md:col-6"><strong>CPF:</strong> {{ municipeData.cpf || 'Não informado' }}</div>
              <div class="col-12 md:col-6"><strong>Data de Nascimento:</strong> {{ municipeData.data_nascimento ? new Date(municipeData.data_nascimento).toLocaleDateString('pt-BR') : '—' }}</div>
              <div class="col-12 md:col-6" v-if="municipeData.cargo || municipeData.orgao">
                <strong>Cargo (geral):</strong> {{ municipeData.cargo || '—' }}
                <small class="block text-500">Cadastro antigo; ver vínculos por conta abaixo.</small>
              </div>
              <div class="col-12 md:col-6" v-if="municipeData.cargo || municipeData.orgao">
                <strong>Órgão (geral):</strong> {{ municipeData.orgao || '—' }}
              </div>
              <div class="col-12">
                <strong>Telefones:</strong>
                <span v-if="!(municipeData.telefones && municipeData.telefones.length)"> Não informado</span>
                <ul v-else class="m-0 mt-1 pl-3 list-none">
                  <li v-for="(tel, i) in municipeData.telefones" :key="i">
                    {{ typeof tel === 'object' ? (tel.numero || tel) : tel }}{{ (typeof tel === 'object' && tel.tipo) ? ` (${tel.tipo})` : '' }}
                  </li>
                </ul>
              </div>
              <div class="col-12">
                <strong>E-mails:</strong>
                <span v-if="!(municipeData.emails && municipeData.emails.length)"> Não informado</span>
                <ul v-else class="m-0 mt-1 pl-3 list-none">
                  <li v-for="(em, i) in municipeData.emails" :key="i">
                    {{ formatarEmail(em) }}
                  </li>
                </ul>
              </div>
              <div class="col-12">
                <strong>Endereço:</strong>
                {{ enderecoFormatado || 'Não informado' }}
              </div>
              <div class="col-12" v-if="municipeData.perfis && municipeData.perfis.length">
                <strong>Cargos / Órgãos por conta:</strong>
                <ul class="m-0 mt-1 pl-3 list-none">
                  <li v-for="p in municipeData.perfis" :key="p.id">
                    <strong>{{ p.conta_nome || p.conta }}</strong>: {{ [p.cargo, p.instituicao, p.departamento].filter(Boolean).join(' — ') || '—' }}
                  </li>
                </ul>
              </div>
              <div class="col-12" v-if="municipeData.observacoes">
                <strong>Observações:</strong>
                <p class="m-0 mt-1 text-surface-700" style="white-space: pre-wrap;">{{ municipeData.observacoes }}</p>
              </div>
            </div>
        </template>
      </Card>

      <TabView>
        <TabPanel header="Histórico">
            <DataTable :value="historicoUnificado" paginator :rows="10" :loading="isLoading" emptyMessage="Nenhum registro encontrado.">
                <Column field="data" header="Data"></Column>
                <Column field="tipo" header="Tipo">
                    <template #body="{ data }">
                        <Tag value="Atendimento" severity="info" />
                    </template>
                </Column>
                <Column field="detalhe" header="Detalhe" style="width: 45%"></Column>
                <Column header="Protocolo">
                    <template #body="{ data }">
                        <span v-if="data.tipo === 'atendimento'">{{ data.protocolo }}</span>
                        <span v-else class="text-color-secondary">—</span>
                    </template>
                </Column>
                <Column header="Ações">
                    <template #body="{ data }">
                        <Button v-if="data.id && podeVerDetalhesAtendimento()" icon="pi pi-eye" text rounded @click="verAtendimento(data.id)" title="Ver atendimento" />
                        <span v-else>—</span>
                    </template>
                </Column>
            </DataTable>
        </TabPanel>

        <TabPanel header="Presença na Agenda Institucional">
            <DataTable :value="municipeData.presencas_agenda_institucional || []" paginator :rows="10" :loading="isLoading" emptyMessage="Nenhuma presença na agenda institucional.">
                <Column field="titulo" header="Compromisso" style="width: 35%"></Column>
                <Column header="Data do compromisso">
                    <template #body="{ data }">
                        {{ data.data_inicio ? new Date(data.data_inicio).toLocaleString('pt-BR') : '—' }}
                    </template>
                </Column>
                <Column field="conta_nome" header="Gabinete"></Column>
                <Column header="Presença (recepção)">
                    <template #body="{ data }">
                        <Tag v-if="data.chegou" value="Presente" severity="success" />
                        <span v-else class="text-color-secondary">Convidado</span>
                    </template>
                </Column>
                <Column header="Horário de chegada">
                    <template #body="{ data }">
                        {{ data.horario_chegada ? new Date(data.horario_chegada).toLocaleString('pt-BR') : '—' }}
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

        <TabPanel header="Enriquecimento IA">
            <DataTable
              :value="historicoEnriquecimentoIA"
              paginator
              :rows="8"
              :loading="isLoading"
              emptyMessage="Nenhum evento de enriquecimento IA registrado."
            >
                <Column field="data" header="Data/Hora" style="width: 16rem"></Column>
                <Column field="source" header="Origem" style="width: 14rem">
                  <template #body="{ data }">
                    <Tag :value="data.source" severity="info" />
                  </template>
                </Column>
                <Column field="profile_mode" header="Perfil" style="width: 8rem"></Column>
                <Column field="user_id" header="Usuário" style="width: 7rem"></Column>
                <Column header="Campos aplicados">
                  <template #body="{ data }">
                    <div class="text-sm">
                      {{ Object.entries(data.applied_fields || {}).filter(([, v]) => v).map(([k]) => k).join(', ') || '—' }}
                    </div>
                  </template>
                </Column>
                <Column header="Resultado perfil">
                  <template #body="{ data }">
                    <span v-if="data.profile_result?.created">perfil criado</span>
                    <span v-else-if="data.profile_result?.updated">perfil atualizado</span>
                    <span v-else>—</span>
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