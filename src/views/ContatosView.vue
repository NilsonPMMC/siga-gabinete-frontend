<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { useAuthStore } from '@/stores/auth';
import { useConfirm } from "primevue/useconfirm";
import MultiSelect from 'primevue/multiselect';
import { format, addDays, subDays, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// COMPONENTES REUTILIZÁVEIS
import MunicipeFormModal from '@/components/municipes/MunicipeFormModal.vue';
import MunicipeUnificarModal from '@/components/municipes/MunicipeUnificarModal.vue'; // <--- IMPORTANTE

// --- DECLARAÇÕES INICIAIS ---
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();
const confirm = useConfirm();

const isLoading = ref(true);
const isExporting = ref(false);

const todosMunicipes = ref([]);
const municipesNaTela = ref([]);
const filtroTexto = ref('');
const filtroLetra = ref('');
const filtroCategorias = ref([]);
const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
const filtroOrdem = ref('nome');
const ordemOptions = ref([
    { label: 'Ordenar por Nome', value: 'nome' },
    { label: 'Ordenar por Órgão', value: 'orgao' }
]);
const municipesSelecionados = ref([]);
const categoriasContato = ref([]);
const contas = ref([]);

// --- ESTADOS DO MODAL FORM ---
const showMunicipeModal = ref(false);
const municipeIdParaEditar = ref(null);

// --- ESTADOS DE UNIFICAÇÃO (NOVO) ---
const showUnificarModal = ref(false);
const duplicadoParaUnificacao = ref(null);

// --- ESTADOS DE ANIVERSARIANTES ---
const aniversariantes = ref([]);
const dialogoAniversariantesVisivel = ref(false);
const dataAniversariantesVisivel = ref(startOfToday());
const isLoadingAniversariantes = ref(false);

// --- ESTADOS DE ATUALIZAÇÃO EM LOTE ---
const dialogoCategoriaLoteVisivel = ref(false);
const novaCategoriaId = ref(null);
const isUpdatingCategoria = ref(false);

// --- CARREGAMENTO INICIAL DOS DADOS ---
onMounted(() => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  carregarDadosIniciais();
  carregarAniversariantes(dataAniversariantesVisivel.value);
});

const carregarDadosIniciais = async () => {
    isLoading.value = true;
    try {
        const [municipesRes, categoriasRes, contasRes] = await Promise.all([
            apiClient.get('/api/municipes/'),
            apiClient.get('/api/contatos/categorias/'),
            apiClient.get('/api/contas/')
        ]);

        todosMunicipes.value = municipesRes.data;
        municipesNaTela.value = [...municipesRes.data];
        categoriasContato.value = categoriasRes.data;
        contas.value = contasRes.data;

    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os contatos.' });
    } finally {
        isLoading.value = false;
    }
};

// --- FUNÇÕES DE FILTRO E BUSCA (MANTIDAS) ---
const aplicarFiltros = async () => {
  isLoading.value = true;
  
  const params = new URLSearchParams();
  if (filtroTexto.value) params.append('q', filtroTexto.value);
  if (filtroLetra.value) params.append('letra', filtroLetra.value);

  if (filtroCategorias.value && filtroCategorias.value.length > 0) {
    filtroCategorias.value.forEach(id => {
      params.append('categoria_id', id);
    });
  }

  try {
    const response = await apiClient.get('/api/municipes/', { params });
    municipesNaTela.value = response.data;
  } catch (error) {
    console.error("Erro ao buscar contatos:", error);
  } finally {
    isLoading.value = false;
  }
};

const limparFiltros = async () => {
  filtroTexto.value = '';
  filtroLetra.value = '';
  filtroCategorias.value = [];
  await carregarDadosIniciais();
};

const filtrarPorLetra = async (letra) => {
  filtroTexto.value = '';
  if (filtroLetra.value === letra) {
    filtroLetra.value = '';
  } else {
    filtroLetra.value = letra;
  }
  await aplicarFiltros();
};

// --- LÓGICA DO MODAL (CRUD) ---

const abrirDialogoParaCriacao = () => {
    municipeIdParaEditar.value = null;
    showMunicipeModal.value = true;
};

const abrirDialogoParaEdicao = (municipe) => {
    municipeIdParaEditar.value = municipe.id;
    showMunicipeModal.value = true;
};

const aoSalvarMunicipe = (contatoSalvo) => {
    const index = todosMunicipes.value.findIndex(m => m.id === contatoSalvo.id);
    if (index !== -1) {
        todosMunicipes.value[index] = contatoSalvo;
        const indexNaTela = municipesNaTela.value.findIndex(m => m.id === contatoSalvo.id);
        if (indexNaTela !== -1) {
            municipesNaTela.value[indexNaTela] = contatoSalvo;
        }
    } else {
        todosMunicipes.value.unshift(contatoSalvo);
        municipesNaTela.value.unshift(contatoSalvo);
    }
    
    showMunicipeModal.value = false;
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Lista atualizada.', life: 2000 });
};

// --- AÇÕES COM INTELIGÊNCIA DE FUSÃO ---
const tentarExcluirContato = async (contato) => {
    try {
        // 1. Verifica vínculos
        const res = await apiClient.get(`/api/municipes/${contato.id}/verificar-vinculos/`);
        const { tem_vinculos, total, detalhes } = res.data;

        if (tem_vinculos) {
            // Sugere Fusão
            confirm.require({
                header: 'Registro com Histórico',
                message: `Este contato possui ${total} vínculos (${detalhes.join(', ')}). Deseja unificá-lo com outro registro antes de excluir?`,
                icon: 'pi pi-info-circle',
                acceptLabel: 'Unificar',
                rejectLabel: 'Cancelar',
                acceptClass: 'p-button-warning',
                accept: () => {
                    duplicadoParaUnificacao.value = contato;
                    showUnificarModal.value = true;
                }
            });
        } else {
            // Exclusão Direta
            confirmarExclusaoReal(contato);
        }
    } catch (e) {
        // Fallback se a API falhar (exclui direto)
        confirmarExclusaoReal(contato);
    }
};

const confirmarExclusaoReal = (contato) => {
  confirm.require({
    message: `Você tem certeza que deseja excluir "${contato.nome_completo}"?`,
    header: 'Confirmar Exclusão',
    icon: 'pi pi-exclamation-triangle',
    acceptClassName: 'p-button-danger',
    acceptLabel: 'Sim, excluir',
    rejectLabel: 'Cancelar',
    accept: async () => {
      try {
        await apiClient.delete(`/api/municipes/${contato.id}/`);
        todosMunicipes.value = todosMunicipes.value.filter(m => m.id !== contato.id);
        municipesNaTela.value = municipesNaTela.value.filter(m => m.id !== contato.id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Contato excluído.', life: 3000 });
      } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir o contato.', life: 3000 });
      }
    },
  });
};

const aoUnificar = () => {
    // Recarrega tudo após fusão para garantir consistência
    carregarDadosIniciais();
};

const irParaVisao360 = (id) => router.push(`/municipes/${id}/historico`);

const copiarTexto = (texto) => {
  if (!texto) return;
  navigator.clipboard.writeText(texto).then(() => {
    toast.add({ severity: 'success', summary: 'Copiado', detail: `'${texto}' copiado.`, life: 2000 });
  });
};

// --- FUNÇÕES DE ANIVERSARIANTES (MANTIDAS) ---
const carregarAniversariantes = async (dataParaBuscar) => {
    isLoadingAniversariantes.value = true;
    aniversariantes.value = [];
    try {
        const dataFormatada = format(dataParaBuscar, 'yyyy-MM-dd');
        const response = await apiClient.get('/api/municipes/aniversariantes-do-dia/', {
            params: { data: dataFormatada }
        });
        aniversariantes.value = response.data;
    } catch (error) {
        console.error(error);
    } finally {
        isLoadingAniversariantes.value = false;
    }
};

const buscarDiaAnterior = () => {
    const novaData = subDays(dataAniversariantesVisivel.value, 1);
    dataAniversariantesVisivel.value = novaData;
    carregarAniversariantes(novaData);
};

const buscarDiaSeguinte = () => {
    const novaData = addDays(dataAniversariantesVisivel.value, 1);
    dataAniversariantesVisivel.value = novaData;
    carregarAniversariantes(novaData);
};

const dataAniversariantesFormatada = computed(() => {
    return format(dataAniversariantesVisivel.value, 'dd/MM', { locale: ptBR });
});

const ehHoje = computed(() => {
    return format(dataAniversariantesVisivel.value, 'yyyy-MM-dd') === format(startOfToday(), 'yyyy-MM-dd');
});


// --- EXPORTAÇÕES (MANTIDAS) ---
const exportarExcel = async () => {
  isExporting.value = true;
  try {
    const params = new URLSearchParams();
    if (filtroTexto.value) params.append('q', filtroTexto.value);
    if (filtroOrdem.value) params.append('ordenar_por', filtroOrdem.value);
    if (filtroCategorias.value && filtroCategorias.value.length > 0) {
      filtroCategorias.value.forEach(id => params.append('categoria_id', id));
    }

    const response = await apiClient.get('/api/municipes/export/excel/', { params: params, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'contatos.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar a planilha.', life: 3000 });
  } finally {
    isExporting.value = false;
  }
};

const exportarPDF = async () => {
  isExporting.value = true;
  try {
    const params = new URLSearchParams();
    if (filtroTexto.value) params.append('q', filtroTexto.value);
    if (filtroOrdem.value) params.append('ordenar_por', filtroOrdem.value);
    if (filtroCategorias.value && filtroCategorias.value.length > 0) {
      filtroCategorias.value.forEach(id => params.append('categoria_id', id));
    }

    const response = await apiClient.get('/api/municipes/export/pdf/', { params: params, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_contatos_${new Date().getTime()}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o PDF.', life: 3000 });
  } finally {
    isExporting.value = false;
  }
};

// --- ATUALIZAÇÃO EM LOTE (MANTIDA) ---
const abrirDialogoCategoriaLote = () => {
    novaCategoriaId.value = null;
    dialogoCategoriaLoteVisivel.value = true;
};

const executarAtualizacaoCategoriaLote = async () => {
    if (!novaCategoriaId.value || !municipesSelecionados.value || municipesSelecionados.value.length === 0) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione uma categoria e pelo menos um contato.', life: 3000 });
        return;
    }

    isUpdatingCategoria.value = true;
    const idsParaAtualizar = municipesSelecionados.value.map(m => m.id);

    try {
        const response = await apiClient.post('/api/municipes/atualizar-categoria-lote/', {
            municipe_ids: idsParaAtualizar,
            nova_categoria_id: novaCategoriaId.value
        });

        toast.add({ severity: 'success', summary: 'Sucesso', detail: response.data.message, life: 4000 });
        
        // Atualiza visualmente
        const categoriaSelecionada = categoriasContato.value.find(c => c.id === novaCategoriaId.value);
        if (categoriaSelecionada) {
             municipesNaTela.value.forEach(municipe => {
                 if (idsParaAtualizar.includes(municipe.id)) municipe.categoria = categoriaSelecionada;
             });
             todosMunicipes.value.forEach(municipe => {
                 if (idsParaAtualizar.includes(municipe.id)) municipe.categoria = categoriaSelecionada;
             });
        }

        municipesSelecionados.value = []; 
        dialogoCategoriaLoteVisivel.value = false;

    } catch (error) {
        const errorMsg = error.response?.data?.detail || 'Erro ao atualizar';
        toast.add({ severity: 'error', summary: 'Erro ao Atualizar', detail: errorMsg, life: 5000 });
    } finally {
        isUpdatingCategoria.value = false;
    }
};
</script>

<template>
  <div class="page-container">
    <ConfirmDialog />
    <Toast />
    
    <header class="page-header">
      <h1>Agenda de Contatos</h1>
      <div>
        <Button label="Novo Contato" icon="pi pi-plus" @click="abrirDialogoParaCriacao" class="p-button-success mr-2" />
        <Button 
            label="Alterar Categoria em Lote" 
            icon="pi pi-tags" 
            class="p-button-info" 
            @click="abrirDialogoCategoriaLote" 
            :disabled="!municipesSelecionados || municipesSelecionados.length === 0" 
        />
      </div>
    </header>

    <Card class="mb-4 summary-card bg-green-100 text-green-800 cursor-pointer">
        <template #content>
            <div class="flex align-items-center justify-content-between">
                <Button icon="pi pi-chevron-left" class="p-button-rounded p-button-text text-green-800" @click="buscarDiaAnterior" :disabled="isLoadingAniversariantes" />
                <div class="flex flex-row align-items-center">
                    <div class="font-medium">{{ dataAniversariantesFormatada }} <span v-if="ehHoje">(Hoje)</span></div>
                    <i class="pi pi-gift text-2xl ml-3"></i>
                    <div v-if="isLoadingAniversariantes" class="mt-2"><ProgressSpinner style="width: 20px; height: 20px" strokeWidth="8" /></div>
                    <div v-else>
                      <Button :label="`${aniversariantes.length} Aniversariante(s)`" class="p-button-link font-bold text-green-800" @click="dialogoAniversariantesVisivel = true" :disabled="aniversariantes.length === 0" />
                    </div>
                </div>
                <Button icon="pi pi-chevron-right" class="p-button-rounded p-button-text text-green-800" @click="buscarDiaSeguinte" :disabled="isLoadingAniversariantes" />
            </div>
        </template>
    </Card>

    <Card class="mb-4">
      <template #content>
        <div class="grid formgrid p-fluid gap-2">
          <div class="field col-6 p-0">
            <label>Buscar por Nome, CPF, Email...</label>
            <InputText v-model="filtroTexto" @keyup.enter="aplicarFiltros" placeholder="Digite para buscar..." />
          </div>
          <div class="field col-3 p-0">
            <label>Filtrar Categoria(s)</label>
            <MultiSelect v-model="filtroCategorias" :options="categoriasContato" optionLabel="nome" optionValue="id" placeholder="Filtrar por Categoria" display="chip" />
          </div>
          <div class="field col-2 p-0">
            <label>Ordenar Relatório</label>
            <Dropdown v-model="filtroOrdem" :options="ordemOptions" optionLabel="label" optionValue="value" placeholder="Ordenar por" />
          </div>
        </div>
        <div class="grid formgrid gap-2">
            <Button label="Buscar" icon="pi pi-search" @click="aplicarFiltros" :loading="isLoading" />
            <Button label="Limpar" icon="pi pi-filter-slash" @click="limparFiltros" class="p-button-secondary" />
            <Button label="Exportar Excel" icon="pi pi-file-excel" class="p-button-success" @click="exportarExcel" :loading="isExporting" />
            <Button label="Exportar PDF" icon="pi pi-file-pdf" class="p-button-danger" @click="exportarPDF" :loading="isExporting" />
        </div>
      </template>
    </Card>

    <div class="alphabet-filter my-4 flex flex-wrap justify-content-center gap-2">
      <Button 
        v-for="letra in alfabeto" :key="letra" :label="letra" 
        @click="filtrarPorLetra(letra)" 
        :class="['p-button-sm', { 'p-button-primary': filtroLetra === letra, 'p-button-secondary p-button-outlined': filtroLetra !== letra }]" 
      />
      <Button icon="pi pi-times-circle" @click="limparFiltros" v-if="filtroLetra" class="p-button-sm p-button-danger p-button-outlined" title="Limpar filtro" />
    </div>

    <main>
      <div class="my-3 text-sm text-color-secondary">Exibindo {{ municipesNaTela.length }} contato(s).</div>

      <DataTable 
        :value="municipesNaTela"
        v-model:selection="municipesSelecionados" dataKey="id"
        :loading="isLoading" 
        paginator :rows="15"
        responsiveLayout="scroll" stripedRows size="small"
      >
        <Column selectionMode="multiple" headerStyle="width: 3em"></Column>
        <Column field="nome_completo" header="Nome" sortable>
          <template #body="slotProps">
            <a href="#" @click.prevent="irParaVisao360(slotProps.data.id)">{{ slotProps.data.nome_completo }}</a>
          </template>
        </Column>
        <Column field="categoria_nome" header="Categoria" sortable></Column>
        <Column field="cargo" header="Cargo" sortable></Column>
        <Column field="orgao" header="Orgão" sortable></Column>
        <Column field="emails" header="Email Principal">
            <template #body="slotProps">
                <div class="flex align-items-center gap-2" v-if="slotProps.data.emails?.[0]?.email">
                    <span>{{ slotProps.data.emails[0].email }}</span>
                    <Button icon="pi pi-copy" text rounded size="small" @click="copiarTexto(slotProps.data.emails[0].email)" />
                </div>
            </template>
        </Column>
        <Column header="Telefone">
          <template #body="slotProps">
            <div class="flex align-items-center gap-2" v-if="slotProps.data.telefones?.[0]?.numero">
              <span>{{ slotProps.data.telefones[0].numero }}</span>
              <Button icon="pi pi-copy" text rounded size="small" @click="copiarTexto(slotProps.data.telefones[0].numero)" />
            </div>
          </template>
        </Column>
        <Column header="Qualidade" style="width: 10rem; text-align: center;">
          <template #body="slotProps">
            <Tag v-if="slotProps.data.qualidade_dados === 'Completo'" severity="success" value="Completo"></Tag>
            <Tag v-if="slotProps.data.qualidade_dados === 'Parcial'" severity="warning" value="Parcial"></Tag>
            <Tag v-if="slotProps.data.qualidade_dados === 'Baixo'" severity="danger" value="Baixo"></Tag>
          </template>
        </Column>
        <Column header="Ações" style="width: 10rem">
          <template #body="slotProps">
            <Button icon="pi pi-id-card" text rounded @click="irParaVisao360(slotProps.data.id)" title="Ver Histórico" />
            <Button icon="pi pi-pencil" text rounded severity="secondary" @click="abrirDialogoParaEdicao(slotProps.data)" :disabled="!slotProps.data.pode_editar" title="Editar" />
            <Button icon="pi pi-trash" text rounded severity="danger" @click="tentarExcluirContato(slotProps.data)" :disabled="!slotProps.data.pode_editar" title="Excluir" />
          </template>
        </Column>
        <template #empty>Nenhum munícipe encontrado.</template>
      </DataTable>
    </main>

    <MunicipeFormModal 
        v-model:visible="showMunicipeModal" 
        :municipeId="municipeIdParaEditar" 
        @saved="aoSalvarMunicipe" 
    />

    <MunicipeUnificarModal 
        v-model:visible="showUnificarModal" 
        :duplicadoInicial="duplicadoParaUnificacao"
        @merged="aoUnificar"
    />

    <Dialog v-model:visible="dialogoAniversariantesVisivel" :header="`Aniversariantes do dia ${dataAniversariantesFormatada}`" modal :style="{ width: '1000px' }">
        <DataTable :value="aniversariantes" size="small" paginator :rows="10">
            <Column field="nome_completo" header="Nome" sortable></Column>
            <Column field="cargo" header="Cargo"></Column>
            <Column field="telefones" header="Telefone">
                <template #body="{ data }">{{ data.telefones?.[0]?.numero || 'N/D' }}</template>
            </Column>
            <Column field="emails" header="Email">
                <template #body="{ data }">{{ data.emails?.[0]?.email || 'N/D' }}</template>
            </Column>
        </DataTable>
    </Dialog>

    <Dialog v-model:visible="dialogoCategoriaLoteVisivel" modal header="Alterar Categoria em Lote" :style="{ width: '30vw' }" @hide="novaCategoriaId = null">
        <div class="p-fluid">
            <div class="field">
                <label>Selecione a nova Categoria para os {{ municipesSelecionados.length }} contato(s):</label>
                <Dropdown v-model="novaCategoriaId" :options="categoriasContato" optionLabel="nome" optionValue="id" placeholder="Selecione..." filter />
            </div>
        </div>
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="dialogoCategoriaLoteVisivel = false" />
            <Button label="Confirmar" icon="pi pi-check" @click="executarAtualizacaoCategoriaLote" :disabled="!novaCategoriaId || isUpdatingCategoria" :loading="isUpdatingCategoria" />
        </template>
    </Dialog>

  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
a { text-decoration: none; color: var(--p-primary-color); font-weight: 500; }
a:hover { text-decoration: underline; }
</style>