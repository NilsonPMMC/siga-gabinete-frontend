<template>
    <div class="page-container">
        <Toast />
        <ConfirmDialog></ConfirmDialog>

        <header class="page-header">
            <div class="flex align-items-center gap-3">
                <router-link to="/eventos">
                    <Button icon="pi pi-arrow-left" severity="secondary" text rounded />
                </router-link>
                <div>
                    <h1 class="mb-0">Gestão de Convidados</h1>
                    <p class="mt-1 text-color-secondary">{{ evento.nome }}</p>
                </div>
            </div>
            <div class="flex align-items-center gap-3">
                <Button label="Adicionar Convidado" icon="pi pi-plus" class="p-button-success" @click="abrirDialogoAdicionar" />
                <Button label="Adicionar por Categoria" icon="pi pi-users" class="p-button-info" @click="abrirDialogoCategoria" />
            </div>
        </header>
        <Panel header="Relatórios do Evento" toggleable class="mb-4 flex">
            <div class="flex flex-wrap gap-2">
                <Button 
                    label="Lista de Presentes" 
                    icon="pi pi-file-pdf" 
                    class="p-button-secondary" 
                    @click="baixarRelatorio('presentes')"
                    :loading="downloadingPdf.presentes"
                />
                <Button 
                    label="Gerar Crachás" 
                    icon="pi pi-id-card" 
                    class="p-button-secondary" 
                    @click="baixarRelatorio('crachas')"
                    :loading="downloadingPdf.crachas"
                    :disabled="!convidadosSelecionados || convidadosSelecionados.length === 0"
                />
                <Button 
                label="Prismas de Mesa" 
                icon="pi pi-desktop" 
                class="p-button-secondary" 
                @click="baixarRelatorio('prismas')"
                :loading="downloadingPdf.prismas"
                :disabled="!convidadosSelecionados || convidadosSelecionados.length === 0"
            />
            </div>
        </Panel>
        <Message severity="warn" size="small" icon="pi pi-exclamation-circle" v-if="!convidadosSelecionados || convidadosSelecionados.length === 0" class="mb-4">Selecione um ou mais convidados na tabela para gerar os crachás.</Message>
        <main>
            <DataTable :value="convidados" :loading="loading" responsiveLayout="scroll" @rowReorder="onRowReorder" v-model:selection="convidadosSelecionados">
                <template #empty>Nenhum convidado adicionado a este evento.</template>
                <Column :rowReorder="true" headerStyle="width: 3rem" :reorderableColumn="false" />
                <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
                <Column header="Nome" :sortable="true" sortField="municipe.nome_completo">
                    <template #body="slotProps">
                        <div class="flex flex-column">
                            <span class="font-bold">{{ slotProps.data.municipe.nome_completo }}</span>
                            <small v-if="slotProps.data.municipe.nome_de_guerra" class="text-primary-500">{{ slotProps.data.municipe.nome_de_guerra }}</small>
                        </div>
                    </template>
                </Column>
                <Column header="Cargo / Órgão">
                    <template #body="slotProps">
                        <div class="flex flex-column">
                            <span>{{ slotProps.data.municipe.cargo || 'Não informado' }}</span>
                            <small v-if="slotProps.data.municipe.orgao" class="text-color-secondary">{{ slotProps.data.municipe.orgao }}</small>
                        </div>
                    </template>
                </Column>
                <Column header="Telefone">
                    <template #body="slotProps">
                        {{ getTelefonePrincipal(slotProps.data.municipe.telefones) }}
                    </template>
                </Column>
                <Column header="Presença" bodyClass="text-center" style="width: 8rem">
                    <template #body="slotProps">
                        <InputSwitch v-model="slotProps.data.presente" @change="togglePresenca(slotProps.data)" />
                    </template>
                </Column>
                <Column header="Ações" bodyClass="text-center" style="width: 8rem">
                    <template #body="slotProps">
                        <Button icon="pi pi-trash" text rounded severity="danger" @click="confirmarDelete(slotProps.data)" title="Excluir" />
                    </template>
                </Column>
            </DataTable>
        </main>

        <Dialog v-model:visible="dialogoAdicionarVisivel" header="Adicionar Convidado ao Evento" :modal="true" :style="{ width: '600px' }">
            <div class="field">
                <label for="municipe">Munícipe*</label>
                <div class="p-inputgroup">
                    <AutoComplete
                        id="municipe"
                        v-model="municipeSelecionado"
                        :suggestions="sugestoesMunicipes"
                        @complete="buscarMunicipes"
                        field="nome_completo"
                        placeholder="Digite para buscar um munícipe..."
                        forceSelection
                        style="width: 100%;"
                    >
                        <template #item="slotProps">
                            <div class="flex flex-column align-items-start">
                                <div>
                                    {{ slotProps.item.nome_completo }}
                                    </div>
                                <small v-if="slotProps.item.nome_de_guerra" class="text-sm text-primary-500 font-italic">
                                    {{ slotProps.item.nome_de_guerra }}
                                </small>
                                <small v-if="slotProps.item.cargo" class="text-sm text-color-secondary">{{ slotProps.item.cargo }}</small>
                            </div>
                        </template>
                    </AutoComplete>
                    <Button 
                        type="button"
                        icon="pi pi-plus" 
                        @click="abrirDialogoNovoMunicipe"
                        title="Adicionar Novo Munícipe"
                    />
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="dialogoAdicionarVisivel = false" />
                <Button label="Adicionar" icon="pi pi-check" @click="adicionarConvidado" :disabled="!municipeSelecionado" />
            </template>
        </Dialog>

        <Dialog v-model:visible="dialogoCategoriaVisivel" header="Adicionar Convidados por Categoria" :modal="true" :style="{ width: '500px' }">
            <div class="field">
                <label for="categoria-dropdown">Selecione a Categoria de Contato</label>
                <Dropdown
                    id="categoria-dropdown"
                    v-model="categoriaSelecionada"
                    :options="categorias"
                    optionLabel="nome"
                    placeholder="Selecione uma categoria"
                    class="w-full"
                    :loading="loadingCategorias"
                />
            </div>
            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="dialogoCategoriaVisivel = false" />
                <Button label="Adicionar Convidados" icon="pi pi-check" @click="adicionarPorCategoria" :disabled="!categoriaSelecionada" />
            </template>
        </Dialog>

        <Dialog v-model:visible="dialogoNovoMunicipeVisivel" :style="{width: '800px'}" header="Cadastrar Novo Munícipe" :modal="true" class="p-fluid">
            <div class="field">
                <label for="categoria">Categoria*</label>
                <Dropdown id="categoria" v-model="municipeEmEdicao.categoria" :options="categoriasContato" optionLabel="nome" optionValue="id" placeholder="Selecione a categoria" />
            </div>
            
            <div class="field">
                <label for="nome">Nome Completo*</label>
                <InputText id="nome" v-model="municipeEmEdicao.nome_completo" />
            </div>
            <div class="field">
                <label for="nome">Tratamento</label>
                <InputText id="nome" v-model="municipeEmEdicao.tratamento" />
                <small>Ex: Senhor, Senhora, Dr., Dra., Vossa Excelência</small>
            </div>
            <div class="field">
                <label for="nome_guerra">Nome de Guerra / Apelido</label>
                <InputText id="nome_guerra" v-model="municipeEmEdicao.nome_de_guerra" />
            </div>

            <div class="grid">
                <div class="field col-12 md:col-6">
                    <label for="cpf">CPF</label>
                    <InputMask id="cpf" v-model="municipeEmEdicao.cpf" mask="999.999.999-99" />
                </div>
                <div class="field col-12 md:col-6">
                    <label for="nascimento">Data de Nascimento</label>
                    <Calendar id="nascimento" v-model="municipeEmEdicao.data_nascimento" dateFormat="dd/mm/yy" showIcon />
                </div>
            </div>
            
            <div class="grid">
                <div class="field col-12 md:col-6">
                    <label for="cargo">Cargo</label>
                    <InputText id="cargo" v-model="municipeEmEdicao.cargo" />
                </div>
                <div class="field col-12 md:col-6">
                    <label for="orgao">Órgão/Empresa</label>
                    <InputText id="orgao" v-model="municipeEmEdicao.orgao" />
                </div>
            </div>
            
            <div class="field">
                <label>Telefone(s)*</label>
                <div v-for="(telefone, index) in municipeEmEdicao.telefones" :key="index" class="p-inputgroup flex-1 mb-2">
                    <Dropdown v-model="telefone.tipo" :options="tiposDeTelefone" optionLabel="label" optionValue="value" placeholder="Tipo" />
                    
                    <InputText 
                        v-model="telefone.numero" 
                        placeholder="(xx) xxxxx-xxxx"
                        @blur="formatarTelefone(index)"
                    />
                    
                    <Button icon="pi pi-trash" type="button" severity="danger" @click="removerTelefone(index)" :disabled="municipeEmEdicao.telefones.length === 1" />
                </div>
                <Button label="Adicionar Telefone" icon="pi pi-plus" type="button" severity="secondary" outlined @click="adicionarTelefone" class="mt-2" />
            </div>

            <div class="field">
                <label>Email(s)</label>
                <div v-for="(emailItem, index) in municipeEmEdicao.emails" :key="index" class="p-inputgroup flex-1 mb-2">
                    <Dropdown 
                        v-model="emailItem.tipo" 
                        :options="tiposDeEmail" 
                        optionLabel="label" 
                        optionValue="value" 
                        placeholder="Tipo" 
                    />
                    <InputText 
                        v-model="emailItem.email"
                        placeholder="exemplo@email.com"
                        type="email"
                    />
                    <Button 
                        icon="pi pi-trash" 
                        type="button"
                        severity="danger" 
                        @click="removerEmail(index)"
                        :disabled="municipeEmEdicao.emails.length === 1" 
                    />
                </div>
                <Button 
                    label="Adicionar Email" 
                    icon="pi pi-plus" 
                    type="button"
                    severity="secondary" 
                    outlined 
                    @click="adicionarEmail" 
                    class="mt-2"
                />
            </div>
            <div class="grid">
                <div class="field col-12 md:col-3">
                    <label for="cep">CEP</label>
                    <InputMask id="cep" v-model="municipeEmEdicao.cep" mask="99999-999" @blur="buscarCep" />
                </div>
                <div class="field col-12 md:col-9">
                    <label for="endereco">Endereço (Rua)</label>
                    <InputText id="endereco" v-model="municipeEmEdicao.logradouro" />
                </div>
            </div>
            <div class="field">
                <label for="bairro">Bairro</label>
                <InputText id="bairro" v-model="municipeEmEdicao.bairro" />
            </div>
            
            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="dialogoNovoMunicipeVisivel = false" />
                <Button label="Salvar e Convidar" icon="pi pi-check" @click="salvarNovoMunicipe" />
            </template>
        </Dialog>

        <Dialog v-model:visible="dialogoDuplicatasVisivel" :style="{width: '700px'}" header="Verificação de Duplicatas" :modal="true">
            <p>Encontramos um ou mais contatos na base de dados que parecem ser a mesma pessoa. Por favor, verifique antes de prosseguir.</p>
            <DataTable :value="contatosEncontrados" class="mt-4">
                <Column field="nome_completo" header="Nome"></Column>
                <Column field="cpf" header="CPF"></Column>
                <Column header="Ações" style="width: 15rem">
                    <template #body="slotProps">
                        <Button label="Usar este e Convidar" class="p-button-sm" @click="usarContatoExistenteEConvidar(slotProps.data)" />
                    </template>
                </Column>
            </DataTable>
            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="dialogoDuplicatasVisivel = false" />
                <Button label="Criar Novo Mesmo Assim" icon="pi pi-plus" class="p-button-warning" @click="handleCriarNovoAposVerificacao" />
            </template>
        </Dialog>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import apiClient from '@/api';
import eventosService from '@/services/eventos';
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useAuthStore } from '@/stores/auth';

import AutoComplete from 'primevue/autocomplete';
import Toolbar from 'primevue/toolbar';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Toast from 'primevue/toast';
import ConfirmDialog from 'primevue/confirmdialog';
import Dropdown from 'primevue/dropdown';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputMask from 'primevue/inputmask';
import Calendar from 'primevue/calendar';
import Textarea from 'primevue/textarea';
import Tag from 'primevue/tag';
import MultiSelect from 'primevue/multiselect';
import InputSwitch from 'primevue/inputswitch';
import Message from 'primevue/message';

const route = useRoute();
const toast = useToast();
const confirm = useConfirm();
const authStore = useAuthStore();

const evento = ref({});
const convidados = ref([]);
const loading = ref(true);
const downloadingPdf = ref({ presentes: false, crachas: false, prismas: false });

const dialogoAdicionarVisivel = ref(false);
const dialogoNovoMunicipeVisivel = ref(false);
const municipeSelecionado = ref(null);
const sugestoesMunicipes = ref([]);
let searchTimeout = null;
const eventoId = route.params.id;

const dialogoCategoriaVisivel = ref(false);
const categorias = ref([]);
const categoriaSelecionada = ref(null);
const loadingCategorias = ref(false);

const municipeEmEdicao = ref({});
const categoriasContato = ref([]);

const dialogoDuplicatasVisivel = ref(false);
const contatosEncontrados = ref([]);
const convidadosSelecionados = ref([]);

// --- FUNÇÕES DE CARREGAMENTO ---
const carregarDados = async () => {
    if (!authStore.isAuthenticated) {
        loading.value = false;
        return;
    }
    loading.value = true;
    try {
        const [eventoRes, convidadosRes] = await Promise.all([
            eventosService.getEvento(eventoId),
            eventosService.getConvidados(eventoId)
        ]);
        evento.value = eventoRes.data;
        convidados.value = convidadosRes.data.map(convidado => ({
            ...convidado,
            presente: convidado.status === 'presente'
        }));
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar dados.', life: 3000 });
    } finally {
        loading.value = false;
    }
};

onMounted(carregarDados);

const baixarRelatorio = async (tipo) => {
    if (tipo === 'presentes') {
        downloadingPdf.value.presentes = true;
        try {
            const response = await eventosService.getConvidadosPresentesReport(eventoId);
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            
            const contentDisposition = response.headers['content-disposition'];
            let fileName = `relatorio_presentes_${evento.value.nome}.pdf`;
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
                if (fileNameMatch && fileNameMatch.length === 2)
                    fileName = fileNameMatch[1];
            }

            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o relatório.', life: 3000 });
            console.error("Erro ao baixar relatório de convidados:", error);
        } finally {
            downloadingPdf.value.presentes = false;
        }
    }
    else if (tipo === 'crachas') {
        if (!convidadosSelecionados.value || convidadosSelecionados.value.length === 0) {
            toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione ao menos um convidado para gerar os crachás.', life: 3000 });
            return;
        }

        downloadingPdf.value.crachas = true;
        try {
            const ids = convidadosSelecionados.value.map(c => c.id);
            const response = await eventosService.getCrachasReport(eventoId, ids);
            
            // Lógica de download (igual à outra)
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `crachas_${evento.value.nome}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar os crachás.', life: 3000 });
            console.error("Erro ao baixar crachás:", error);
        } finally {
            downloadingPdf.value.crachas = false;
        }
    }
    else if (tipo === 'prismas') {
        if (!convidadosSelecionados.value || convidadosSelecionados.value.length === 0) {
            toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione ao menos um convidado para gerar os prismas.', life: 3000 });
            return;
        }

        downloadingPdf.value.prismas = true;
        try {
            const ids = convidadosSelecionados.value.map(c => c.id);
            const response = await eventosService.getPrismasReport(eventoId, ids);
            
            // Lógica de download (idêntica às outras)
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `prismas_${evento.value.nome}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar os prismas.', life: 3000 });
            console.error("Erro ao baixar prismas:", error);
        } finally {
            downloadingPdf.value.prismas = false;
        }
    }
};

// --- LÓGICA DE ADICIONAR CONVIDADO ---
const abrirDialogoAdicionar = () => {
    municipeSelecionado.value = null;
    sugestoesMunicipes.value = [];
    dialogoAdicionarVisivel.value = true;
};

const buscarMunicipes = (event) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        if (event.query.trim()) {
            try {
                const response = await eventosService.searchMunicipes(event.query);
                sugestoesMunicipes.value = response.data;
            } catch (error) {
                console.error("Erro ao buscar munícipes:", error);
            }
        }
    }, 300);
};

const adicionarConvidado = async () => {
    if (!municipeSelecionado.value) return;
    try {
        const payload = {
            evento: eventoId,
            municipe_id: municipeSelecionado.value.id
        };
        await eventosService.addConvidado(payload);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Convidado adicionado!', life: 3000 });
        dialogoAdicionarVisivel.value = false;
        carregarDados(); // Recarrega a lista
    } catch (error) {
        const errorMsg = error.response?.data?.non_field_errors?.[0] || 'Este munícipe já foi convidado para o evento.';
        toast.add({ severity: 'error', summary: 'Erro', detail: errorMsg, life: 4000 });
    }
};

const abrirDialogoCategoria = async () => {
    loadingCategorias.value = true;
    try {
        const response = await eventosService.getCategorias();
        // A sua API pode retornar um objeto com 'results', então nos preparamos para isso
        categorias.value = Array.isArray(response.data) ? response.data : response.data.results;
        categoriaSelecionada.value = null;
        dialogoCategoriaVisivel.value = true;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar as categorias.', life: 3000 });
    } finally {
        loadingCategorias.value = false;
    }
};

const adicionarPorCategoria = async () => {
    if (!categoriaSelecionada.value) return;
    try {
        const response = await eventosService.addConvidadosPorCategoria(eventoId, categoriaSelecionada.value.id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: response.data.status, life: 4000 });
        dialogoCategoriaVisivel.value = false;
        carregarDados(); // Atualiza a lista de convidados na tela
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao adicionar convidados.', life: 3000 });
    }
};

const tiposDeTelefone = ref([
    { label: 'Principal', value: 'principal' },
    { label: 'Celular', value: 'celular' },
    { label: 'Trabalho', value: 'trabalho' },
    { label: 'Outro', value: 'outro' }
]);

const formatarTelefone = (index) => {
    const telefones = municipeEmEdicao.value.telefones;
    if (!telefones[index] || !telefones[index].numero) return;

    // 1. Limpa tudo que não for número
    const numerosLimpos = telefones[index].numero.replace(/\D/g, '');
    
    // 2. Aplica a máscara correta baseada no tamanho
    if (numerosLimpos.length === 11) {
        telefones[index].numero = `(${numerosLimpos.substring(0, 2)}) ${numerosLimpos.substring(2, 7)}-${numerosLimpos.substring(7)}`;
    } else if (numerosLimpos.length === 10) {
        telefones[index].numero = `(${numerosLimpos.substring(0, 2)}) ${numerosLimpos.substring(2, 6)}-${numerosLimpos.substring(6)}`;
    } else {
        // Se não for nem 10 nem 11, mantém apenas os números para o usuário corrigir
        telefones[index].numero = numerosLimpos;
    }
};

const adicionarTelefone = () => {
    municipeEmEdicao.value.telefones.push({ tipo: 'celular', numero: '' });
};

const removerTelefone = (index) => {
    if (municipeEmEdicao.value.telefones.length > 1) {
        municipeEmEdicao.value.telefones.splice(index, 1);
    } else {
        municipeEmEdicao.value.telefones[0].numero = '';
    }
};

const tiposDeEmail = ref([
    { label: 'Principal', value: 'principal' },
    { label: 'Trabalho', value: 'trabalho' },
    { label: 'Outro', value: 'outro' },
]);

const adicionarEmail = () => {
    municipeEmEdicao.value.emails.push({ tipo: 'pessoal', email: '' });
};

const removerEmail = (index) => {
    if (municipeEmEdicao.value.emails.length > 1) {
        municipeEmEdicao.value.emails.splice(index, 1);
    } else {
        municipeEmEdicao.value.emails[0].email = '';
    }
};

const buscarCep = async () => {
  const cep = municipeEmEdicao.value.cep?.replace(/\D/g, ''); // Limpa o CEP para conter apenas números
  if (cep?.length === 8) {
    try {
      const { data } = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
      if (!data.erro) {
        // Alimenta os campos do formulário com a resposta da API
        municipeEmEdicao.value.logradouro = data.logradouro;
        municipeEmEdicao.value.bairro = data.bairro;
        // Adicione outros campos se necessário (cidade, estado, etc.)
      }
    } catch (error) { 
        console.error("Erro ao buscar CEP:", error); 
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível consultar o CEP.', life: 3000 });
    }
  }
};

const iniciarNovoMunicipe = () => ({
    nome_completo: '', nome_de_guerra: '', cargo: '', orgao: '',
    categoria: null, cpf: '', data_nascimento: null,
    telefones: [{ tipo: 'principal', numero: '' }],
    emails: [{ tipo: 'principal', email: '' }],
    cep: '', logradouro: '', bairro: '',
    contas: [evento.value.conta]
});

const abrirDialogoNovoMunicipe = async () => {
    try {
        const response = await eventosService.getCategorias();
        categoriasContato.value = Array.isArray(response.data) ? response.data : response.data.results;
        municipeEmEdicao.value = iniciarNovoMunicipe();
        dialogoAdicionarVisivel.value = false;
        dialogoNovoMunicipeVisivel.value = true;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar as categorias.', life: 3000 });
    }
};

const validarEPrepararPayload = (dados) => {
    if (!dados.nome_completo || !dados.categoria) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Nome Completo e Categoria são obrigatórios.', life: 3000 });
        return null;
    }
    if (!dados.telefones || dados.telefones.length === 0 || !dados.telefones[0].numero) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'É necessário preencher pelo menos um telefone.', life: 3000 });
        return null;
    }
    const payload = { ...dados };
    if (payload.data_nascimento) {
        try {
            const data = new Date(payload.data_nascimento);
            if (isNaN(data.getTime())) throw new Error("Data inválida");
            payload.data_nascimento = data.toISOString().split('T')[0];
        } catch (e) {
            toast.add({ severity: 'error', summary: 'Erro de Formato', detail: 'A data de nascimento é inválida.', life: 3000 });
            return null;
        }
    }
    if (payload.cep || payload.logradouro || payload.bairro) {
        payload.endereco = { cep: payload.cep || '', logradouro: payload.logradouro || '', bairro: payload.bairro || '' };
    }
    delete payload.cep; delete payload.logradouro; delete payload.bairro;
    return payload;
};

const convidarMunicipe = async (municipe) => {
    try {
        await eventosService.addConvidado({ evento: eventoId, municipe_id: municipe.id });
        dialogoAdicionarVisivel.value = false;
        dialogoNovoMunicipeVisivel.value = false;
        dialogoDuplicatasVisivel.value = false;
        toast.add({ severity: 'success', summary: 'Sucesso', detail: `"${municipe.nome_completo}" adicionado como convidado!`, life: 3000 });
        carregarDados();
    } catch (error) {
        const errorMsg = error.response?.data?.non_field_errors?.[0] || 'Este munícipe já foi convidado para o evento.';
        toast.add({ severity: 'error', summary: 'Erro', detail: errorMsg, life: 4000 });
    }
};

const executarSalvamento = async (payload) => {
    try {
        const response = await eventosService.createMunicipe(payload);
        // Após criar o munícipe, chama a função para convidá-lo
        await convidarMunicipe(response.data);
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar o novo munícipe.', life: 3000 });
    }
};

const salvarNovoMunicipe = async () => {
    const payload = validarEPrepararPayload(municipeEmEdicao.value);
    if (!payload) return;

    try {
        const params = {
            nome_completo: payload.nome_completo,
            cpf: payload.cpf || '',
            email: payload.emails?.[0]?.email || '',
            telefone: payload.telefones?.[0]?.numero || '',
            conta_id: evento.value.conta
        };
        
        const { data } = await apiClient.get('/api/municipes/check-duplicates/', { params }); 
        
        if (data.length > 0) {
            contatosEncontrados.value = data;
            dialogoDuplicatasVisivel.value = true;
        } else {
            // Se não houver duplicatas, salva e convida diretamente
            await executarSalvamento(payload);
        }
    } catch (error) {
        console.error("Erro ao verificar duplicatas:", error.response?.data || error);
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao verificar duplicatas.', life: 3000 });
    }
};

const usarContatoExistenteEConvidar = (contato) => {
    // Ação do botão "Usar este e Convidar"
    convidarMunicipe(contato);
};

const handleCriarNovoAposVerificacao = () => {
    // Ação do botão "Criar Novo Mesmo Assim"
    const payload = validarEPrepararPayload(municipeEmEdicao.value);
    if (!payload) return;
    executarSalvamento(payload);
};

const togglePresenca = async (convidado) => {
    // O v-model já atualizou 'convidado.presente' para true ou false
    const novoStatus = convidado.presente ? 'presente' : 'convidado';

    try {
        await eventosService.updateConvidadoStatus(convidado.id, novoStatus);
        // Atualiza o status original no objeto para consistência
        convidado.status = novoStatus;
        toast.add({ severity: 'success', summary: 'Status Atualizado', detail: `${convidado.municipe.nome_completo} marcado como ${novoStatus === 'presente' ? 'presente' : 'ausente'}.`, life: 2000 });
    } catch (error) {
        // Reverte a mudança visual em caso de erro na API
        convidado.presente = !convidado.presente;
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível atualizar o status.', life: 3000 });
    }
};

// --- LÓGICA DE DELETAR CONVIDADO ---
const confirmarDelete = (convidado) => {
    confirm.require({
        message: `Tem certeza que deseja remover "${convidado.municipe.nome_completo}" da lista de convidados?`,
        header: 'Confirmar Remoção',
        icon: 'pi pi-info-circle',
        acceptClass: 'p-button-danger',
        accept: () => deletarConvidado(convidado.id),
    });
};

const deletarConvidado = async (id) => {
    try {
        await eventosService.deleteConvidado(id);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Convidado removido.', life: 3000 });
        carregarDados(); // Recarrega a lista
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível remover o convidado.', life: 3000 });
    }
};

const onRowReorder = async (event) => {
    // A variável 'convidados' é atualizada automaticamente pelo PrimeVue
    convidados.value = event.value;
    
    // Extrai apenas os IDs na nova ordem
    const orderedIds = convidados.value.map(convidado => convidado.id);
    
    try {
        await eventosService.reorderConvidados(eventoId, orderedIds);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Ordem dos convidados salva!', life: 3000 });
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar a nova ordem.', life: 3000 });
        // Em caso de erro, recarrega os dados para reverter a mudança visual
        carregarDados();
    }
};

// --- FUNÇÕES AUXILIARES DE FORMATAÇÃO ---
const formatarStatus = (status) => {
    const nomes = { convidado: 'Convidado', confirmado: 'Confirmado', presente: 'Presente' };
    return nomes[status] || status;
};

const getSeveridadeStatus = (status) => {
    const cores = { convidado: 'info', confirmado: 'success', presente: 'primary' };
    return cores[status] || 'secondary';
};

const getTelefonePrincipal = (telefones) => {
    if (!telefones || telefones.length === 0) return 'N/A';
    const principal = telefones.find(t => t.tipo === 'principal');
    return principal ? principal.numero : telefones[0].numero;
};
</script>

<style scoped>
/* Estilos para o container da página e o cabeçalho */
.page-container {
    padding: 2rem;
}
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
}
</style>