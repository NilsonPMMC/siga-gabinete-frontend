<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import apiClient from '@/api';
import axios from 'axios';
import { useToast } from "primevue/usetoast";
import { useAuthStore } from '@/stores/auth';
import { useConfirm } from "primevue/useconfirm";

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
const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');

const aniversariantes = ref([]);
const categoriasContato = ref([]);
const contas = ref([]);

const dialogoAniversariantesVisivel = ref(false);
const dialogoVisivel = ref(false);
const municipeEmEdicao = ref({});

const dialogoDuplicatasVisivel = ref(false);
const contatosEncontrados = ref([]);


// --- CARREGAMENTO INICIAL DOS DADOS ---
onMounted(() => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  carregarDadosIniciais();
});

const carregarDadosIniciais = async () => {
    isLoading.value = true;
    try {
        const [municipesRes, categoriasRes, aniversariantesRes, contasRes] = await Promise.all([
            apiClient.get('/api/municipes/'),
            apiClient.get('/api/contatos/categorias/'),
            apiClient.get('/api/municipes/aniversariantes-do-dia/'),
            apiClient.get('/api/contas/')
        ]);

        todosMunicipes.value = municipesRes.data;
        municipesNaTela.value = municipesRes.data;
        categoriasContato.value = categoriasRes.data;
        aniversariantes.value = aniversariantesRes.data;
        contas.value = contasRes.data;

    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os contatos.' });
    } finally {
        isLoading.value = false;
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

const tiposDeTelefone = ref([
    { label: 'Principal', value: 'principal' },
    { label: 'Celular', value: 'celular' },
    { label: 'Trabalho', value: 'trabalho' },
    { label: 'Outro', value: 'outro' },
]);

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

const formatarTelefone = (index) => {
    const telefones = municipeEmEdicao.value.telefones;
    if (!telefones[index] || !telefones[index].numero) return;
    const numerosLimpos = telefones[index].numero.replace(/\D/g, '');
    
    if (numerosLimpos.length === 11) {
        telefones[index].numero = `(${numerosLimpos.substring(0, 2)}) ${numerosLimpos.substring(2, 7)}-${numerosLimpos.substring(7)}`;
    } else if (numerosLimpos.length === 10) {
        telefones[index].numero = `(${numerosLimpos.substring(0, 2)}) ${numerosLimpos.substring(2, 6)}-${numerosLimpos.substring(6)}`;
    } else {
        telefones[index].numero = numerosLimpos;
    }
};

const abrirDialogoParaCriacao = () => {
    const categoriaDefault = categoriasContato.value.find(c => c.nome.toLowerCase() === 'munícipe');
    let contasIniciais = [];
    if (authStore.isMembro || authStore.isSecretaria || authStore.isRecepcao) {
        contasIniciais = authStore.user?.perfil?.contas || [];
    }
    municipeEmEdicao.value = {
        categoria: categoriaDefault?.id || null,
        contas: contasIniciais,
        telefones: [{ tipo: 'principal', numero: '' }],
        emails: [{ tipo: 'principal', email: '' }]
    };
    dialogoVisivel.value = true;
};

const abrirDialogoParaEdicao = (municipe) => {
  municipeEmEdicao.value = { 
    ...municipe,
    contas: municipe.contas ? municipe.contas.map(c => c.id) : [],
    categoria: municipe.categoria, 
    telefones: (municipe.telefones && municipe.telefones.length > 0) ? JSON.parse(JSON.stringify(municipe.telefones)) : [{ tipo: 'principal', numero: '' }],
    emails: (municipe.emails && municipe.emails.length > 0) ? JSON.parse(JSON.stringify(municipe.emails)) : [{ tipo: 'principal', email: '' }],
    cep: municipe.endereco?.cep || '',
    logradouro: municipe.endereco?.logradouro || '',
    bairro: municipe.endereco?.bairro || '',
  };
  dialogoVisivel.value = true;
};

const buscarCep = async () => {
    const cep = municipeEmEdicao.value.cep?.replace(/\D/g, '');
    if (cep && cep.length === 8) {
        try {
            const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
            if (!response.data.erro) {
                municipeEmEdicao.value.logradouro = response.data.logradouro;
                municipeEmEdicao.value.bairro = response.data.bairro;
            }
        } catch (error) { console.error("Erro ao buscar CEP:", error); }
    }
};

const finalizarCadastro = (contatoSalvo) => {
    const index = todosMunicipes.value.findIndex(m => m.id === contatoSalvo.id);
    if (index !== -1) {
        todosMunicipes.value[index] = contatoSalvo;
    } else {
        todosMunicipes.value.unshift(contatoSalvo);
    }
    aplicarFiltros();
    dialogoVisivel.value = false;
    dialogoDuplicatasVisivel.value = false;
};

const extractApiError = (error) => {
    if (error.response?.data) {
        const data = error.response.data;
        for (const key in data) {
            if (Array.isArray(data[key]) && data[key].length > 0) return data[key][0];
        }
    }
    return 'Falha na comunicação com o servidor.';
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
        payload.endereco = { 
            cep: payload.cep || '', 
            logradouro: payload.logradouro || '', 
            bairro: payload.bairro || '' 
        };
    }

    delete payload.cep;
    delete payload.logradouro;
    delete payload.bairro;
    
    return payload;
};

const executarSalvamento = async (payload) => {
    try {
        const { data } = payload.id
            ? await apiClient.patch(`/api/municipes/${payload.id}/`, payload)
            : await apiClient.post('/api/municipes/', payload);
        toast.add({ severity: 'success', summary: 'Sucesso', detail: payload.id ? 'Contato atualizado!' : 'Contato criado!', life: 3000 });
        finalizarCadastro(data);
    } catch (error) {
        const errorMsg = extractApiError(error);
        toast.add({ severity: 'error', summary: 'Erro de Validação', detail: errorMsg, life: 5000 });
    }
};

const salvarMunicipe = async () => {
    const payload = validarEPrepararPayload(municipeEmEdicao.value);
    if (!payload) return;
    if (payload.id) {
        await executarSalvamento(payload);
        return;
    }
    try {
        const contasUsuario = authStore.user?.perfil?.contas || [];
        const params = { 
            nome_completo: payload.nome_completo, 
            cpf: payload.cpf, 
            email: payload.emails[0]?.email,
            telefone: payload.telefones[0]?.numero,
            conta_id: contasUsuario.join(',') 
        };
        const { data } = await apiClient.get('/api/municipes/check-duplicates/', { params });
        if (data.length > 0) {
            contatosEncontrados.value = data;
            dialogoDuplicatasVisivel.value = true;
        } else {
            await executarSalvamento(payload);
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao verificar duplicatas.', life: 3000 });
    }
};

const usarContatoExistente = (contato) => {
    finalizarCadastro(contato);
};

const handleAtualizarContatoExistente = async (contatoExistente) => {
    const dadosParaAtualizar = { ...municipeEmEdicao.value, id: contatoExistente.id };
    const payload = validarEPrepararPayload(dadosParaAtualizar);
    if (!payload) return;
    await executarSalvamento(payload);
};

const handleCriarNovoContato = async () => {
    const dadosParaCriar = { ...municipeEmEdicao.value };
    delete dadosParaCriar.id;
    const payload = validarEPrepararPayload(dadosParaCriar);
    if (!payload) return;
    await executarSalvamento(payload);
};

const aplicarFiltros = async () => {
  isLoading.value = true;
  try {
    const params = {
      q: filtroTexto.value,
      letra: filtroLetra.value,
    };
    
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

const confirmarExclusaoContato = (contato) => {
  confirm.require({
    message: `Você tem certeza que deseja excluir o contato "${contato.nome_completo}"? Esta ação não pode ser desfeita.`,
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

const irParaVisao360 = (id) => router.push(`/municipes/${id}/historico`);

const copiarTexto = (texto) => {
  if (!texto) return;
  navigator.clipboard.writeText(texto).then(() => {
    toast.add({ severity: 'success', summary: 'Copiado', detail: `'${texto}' copiado.`, life: 2000 });
  });
};

const exportarExcel = async () => {
  isExporting.value = true;
  try {
    const response = await apiClient.get('/api/municipes/export/excel/', {
      params: { q: filtroTexto.value },
      responseType: 'blob',
    });
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
</script>

<template>
  <div class="page-container">
    <ConfirmDialog />
    <Toast />
    <header class="page-header">
      <h1>Agenda de Contatos</h1>
      <Button label="Novo Contato" icon="pi pi-plus" @click="abrirDialogoParaCriacao" class="p-button-success" />
    </header>

    <Card 
        v-if="aniversariantes.length > 0 && !authStore.isRecepcao" 
        class="mb-4 summary-card bg-green-100 text-green-800 cursor-pointer" 
        @click="dialogoAniversariantesVisivel = true">
        <template #content>
            <div class="flex align-items-center justify-content-center">
                <i class="pi pi-gift text-2xl mr-3"></i>
                <span class="font-bold">Hoje temos {{ aniversariantes.length }} aniversariante(s)! Clique para ver.</span>
            </div>
        </template>
    </Card>

    <Card class="mb-4">
      <template #content>
        <div class="grid formgrid p-fluid align-items-end gap-2">
          <div class="field col">
            <label for="filtroTexto">Buscar por Nome, CPF, Email, Cargo ou Órgão</label>
            <InputText id="filtroTexto" v-model="filtroTexto" @keyup.enter="aplicarFiltros" placeholder="Digite para buscar..." />
          </div>
          <div class="field col-fixed flex gap-2">
            <Button label="Buscar" icon="pi pi-search" @click="aplicarFiltros" :loading="isLoading" />
            <Button label="Limpar" icon="pi pi-times" @click="limparFiltros" class="p-button-secondary" />
            <Button label="Exportar Excel" icon="pi pi-file-excel" class="p-button-success" @click="exportarExcel" :loading="isExporting" />
          </div>
        </div>
      </template>
    </Card>

    <div class="alphabet-filter my-4 flex flex-wrap justify-content-center gap-2">
      <Button 
        v-for="letra in alfabeto" 
        :key="letra"
        :label="letra"
        @click="filtrarPorLetra(letra)"
        :class="['p-button-sm', { 'p-button-primary': filtroLetra === letra, 'p-button-secondary p-button-outlined': filtroLetra !== letra }]"
      />
      <Button 
        icon="pi pi-times-circle"
        @click="limparFiltros"
        v-if="filtroLetra"
        class="p-button-sm p-button-danger p-button-outlined"
        title="Limpar filtro"
      />
    </div>

    <main>
      <DataTable :value="municipesNaTela" :loading="isLoading" paginator :rows="15" responsiveLayout="scroll">
        <Column field="nome_completo" header="Nome" sortable>
          <template #body="slotProps">
            <a href="#" @click.prevent="irParaVisao360(slotProps.data.id)">
              {{ slotProps.data.nome_completo }}
            </a>
          </template>
        </Column>
        <Column field="categoria_nome" header="Categoria" sortable></Column>
        <Column field="cargo" header="Cargo" sortable></Column>
        <Column field="orgao" header="Orgão" sortable></Column>
        <Column field="emails" header="Email Principal" :sortable="false">
            <template #body="slotProps">
                <div class="flex align-items-center gap-2" v-if="slotProps.data.emails && slotProps.data.emails.length > 0 && slotProps.data.emails[0].email">
                    <span>{{ slotProps.data.emails[0].email }}</span>
                    <Button icon="pi pi-copy" text rounded size="small" @click="copiarTexto(slotProps.data.emails[0].email)" title="Copiar Email" />
                </div>
            </template>
        </Column>

        <Column header="Telefone">
          <template #body="slotProps">
            <div class="flex align-items-center gap-2" v-if="slotProps.data.telefones && slotProps.data.telefones[0] && slotProps.data.telefones[0].numero">
              <span>{{ slotProps.data.telefones[0]?.numero }}</span>
              <Button icon="pi pi-copy" text rounded size="small" @click="copiarTexto(slotProps.data.telefones[0]?.numero)" title="Copiar Telefone" />
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

        <!-- <Column header="Status" style="width: 5rem; text-align: center;">
            <template #body="slotProps">
                <i v-if="slotProps.data.alerta_atualizacao" class="pi pi-clock text-2xl text-blue-500" v-tooltip.top="'Contato desatualizado há mais de 6 meses'"></i>
            </template>
        </Column>-->

        <Column header="Ações" style="width: 10rem">
          <template #body="slotProps">
            <Button icon="pi pi-id-card" text rounded @click="irParaVisao360(slotProps.data.id)" title="Ver Histórico Completo" />
            <Button 
              icon="pi pi-pencil" 
              text 
              rounded 
              severity="secondary" 
              @click="abrirDialogoParaEdicao(slotProps.data)" 
              title="Editar Contato"
              :disabled="!slotProps.data.pode_editar" 
            />
            <Button 
              icon="pi pi-trash" 
              text 
              rounded 
              severity="danger" 
              @click="confirmarExclusaoContato(slotProps.data)" 
              title="Excluir Contato"
              :disabled="!slotProps.data.pode_editar" 
            />
          </template>
        </Column>
        <template #empty>Nenhum munícipe encontrado.</template>
      </DataTable>
    </main>

    <!-- Todos os Dialogs (Aniversariantes, Edição/Criação, Verificação de Duplicatas) permanecem os mesmos -->
    <Dialog v-model:visible="dialogoAniversariantesVisivel" header="Aniversariantes do Dia" :modal="true">
        <DataTable :value="aniversariantes" paginator :rows="5">
            <Column field="nome_completo" header="Nome"></Column>
            <Column field="cargo" header="Cargo/Órgão"></Column>
            <Column header="Telefone">
                <template #body="slotProps">
                    <div class="flex align-items-center gap-2" v-if="slotProps.data.telefones && slotProps.data.telefones[0]">
                        <span>{{ slotProps.data.telefones[0]?.numero }}</span>
                        <Button icon="pi pi-copy" text rounded size="small" @click="copiarTexto(slotProps.data.telefones[0]?.numero)" />
                    </div>
                </template>
            </Column>
            <Column header="Email Principal">
                <template #body="slotProps">
                    <div class="flex align-items-center gap-2" v-if="slotProps.data.emails && slotProps.data.emails.length > 0">
                        <span>{{ slotProps.data.emails[0].email }}</span>
                        <Button icon="pi pi-copy" text rounded size="small" @click="copiarTexto(slotProps.data.emails[0].email)" title="Copiar Email" />
                    </div>
                </template>
            </Column>
        </DataTable>
        <template #footer>
            <Button label="Fechar" icon="pi pi-times" @click="dialogoAniversariantesVisivel = false" text />
        </template>
    </Dialog>

    <Dialog v-model:visible="dialogoVisivel" :style="{width: '800px'}" :header="municipeEmEdicao.id ? 'Editar Contato' : 'Novo Contato'" :modal="true" class="p-fluid">
        <div class="field">
            <label for="edit-categoria">Categoria*</label>
            <Dropdown id="edit-categoria" v-model="municipeEmEdicao.categoria" :options="categoriasContato" optionLabel="nome" optionValue="id" />
        </div>
        
        <div v-if="authStore.isSuperuser" class="field">
          <label for="contas">Contas com Acesso (Apenas Superusuário)</label>
          <MultiSelect 
              id="contas" 
              v-model="municipeEmEdicao.contas" 
              :options="contas" 
              optionLabel="nome" 
              optionValue="id" 
              placeholder="Selecione as contas" 
              display="chip"
          />
          <small>Se nenhuma conta for selecionada, este contato será visível para todos.</small>
        </div>
        <div class="field">
          <label for="edit-nome">Nome Completo*</label>
          <InputText id="edit-nome" v-model="municipeEmEdicao.nome_completo" />
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
          <div class="field col-12 md:col-6"><label for="edit-cargo">Cargo</label><InputText id="edit-cargo" v-model="municipeEmEdicao.cargo" /></div>
          <div class="field col-12 md:col-6"><label for="edit-orgao">Órgão/Empresa</label><InputText id="edit-orgao" v-model="municipeEmEdicao.orgao" /></div>
        </div>
        <div class="grid">
            <div class="field col-12 md:col-6"><label for="edit-cpf">CPF</label><InputMask id="edit-cpf" v-model="municipeEmEdicao.cpf" mask="999.999.999-99" /></div>
            <div class="field col-12 md:col-6"><label for="edit-nascimento">Data de Nascimento</label><Calendar id="edit-nascimento" v-model="municipeEmEdicao.data_nascimento" dateFormat="dd/mm/yy" /></div>
        </div>
        <div class="field">
            <label>Telefone(s)*</label>
            <div v-for="(telefone, index) in municipeEmEdicao.telefones" :key="index" class="p-inputgroup flex-1 mb-2">
                <Dropdown 
                    v-model="telefone.tipo" 
                    :options="tiposDeTelefone" 
                    optionLabel="label" 
                    optionValue="value" 
                    placeholder="Tipo"
                />
                <InputText 
                    v-model="telefone.numero"
                    placeholder="(xx) xxxxx-xxxx"
                    @blur="formatarTelefone(index)"
                />
                <Button 
                    icon="pi pi-trash" 
                    type="button"
                    severity="danger" 
                    @click="removerTelefone(index)"
                    :disabled="municipeEmEdicao.telefones.length === 1" 
                />
            </div>
            <Button 
                label="Adicionar Telefone" 
                icon="pi pi-plus" 
                type="button"
                severity="secondary" 
                outlined 
                @click="adicionarTelefone" 
                class="mt-2"
            />
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
            <div class="field col-12 md:col-3"><label for="edit-cep">CEP</label><InputMask id="edit-cep" v-model="municipeEmEdicao.cep" mask="99999-999" @blur="buscarCep" /></div>
            <div class="field col-12 md:col-9"><label for="edit-logradouro">Endereço</label><InputText id="edit-logradouro" v-model="municipeEmEdicao.logradouro" /></div>
        </div>
        <div class="field">
          <label for="edit-bairro">Bairro</label>
          <InputText id="edit-bairro" v-model="municipeEmEdicao.bairro" />
        </div>
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="dialogoVisivel = false" />
            <Button label="Salvar" icon="pi pi-check" @click="salvarMunicipe" />
        </template>
    </Dialog>

    <Dialog v-model:visible="dialogoDuplicatasVisivel" :style="{width: '700px'}" header="Verificação de Duplicatas" :modal="true">
      <p>Encontramos um ou mais contatos na base de dados que parecem ser a mesma pessoa. Por favor, verifique antes de prosseguir.</p>
      <DataTable :value="contatosEncontrados" class="mt-4">
        <Column field="nome_completo" header="Nome"></Column>
        <Column field="cpf" header="CPF"></Column>
        <Column field="email" header="Email"></Column>
        <Column header="Ações" style="width: 12rem">
          <template #body="slotProps">
            <Button label="Usar este" class="p-button-sm" @click="usarContatoExistente(slotProps.data)" />
            <Button 
              label="Atualizar" 
              class="p-button-sm p-button-secondary ml-2" 
              @click="handleAtualizarContatoExistente(slotProps.data)"
              v-if="slotProps.data.pode_editar"
            />
          </template>
        </Column>
      </DataTable>
      <template #footer>
        <Button label="Cancelar" icon="pi pi-times" text @click="dialogoDuplicatasVisivel = false" />
        <Button label="Criar Novo Mesmo Assim" icon="pi pi-plus" class="p-button-warning" @click="handleCriarNovoContato" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
a {
    text-decoration: none;
    color: var(--p-primary-color);
    font-weight: 500;
}
a:hover {
    text-decoration: underline;
}
.field.col-fixed {
    flex-grow: 0;
}
</style>
