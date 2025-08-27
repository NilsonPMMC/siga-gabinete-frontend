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

const filtroApenasDuplicatas = ref(false);
const grupoDuplicadoAtual = ref([]);
const registrosParaDeletar = ref([]);

const aniversariantes = ref([]);
const categoriasContato = ref([]);
const contas = ref([]);

const dialogoAniversariantesVisivel = ref(false);
const dialogoVisivel = ref(false); // Este diálogo será usado para CRIAR e EDITAR
const dialogoGestaoVisivel = ref(false);
const municipeEmEdicao = ref({});

// --- ESTADO PARA A LÓGICA DE DUPLICATAS ---
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
            apiClient.get('/api/municipes/'), // Carrega a lista inicial (os 100 mais recentes)
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
    // Adiciona um novo objeto de email ao array
    municipeEmEdicao.value.emails.push({ tipo: 'pessoal', email: '' });
};

const removerEmail = (index) => {
    // Remove um email, garantindo que pelo menos um campo permaneça
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
    // Adiciona um novo objeto de telefone ao array
    municipeEmEdicao.value.telefones.push({ tipo: 'celular', numero: '' });
};

const removerTelefone = (index) => {
    // Remove um telefone, garantindo que pelo menos um campo permaneça
    if (municipeEmEdicao.value.telefones.length > 1) {
        municipeEmEdicao.value.telefones.splice(index, 1);
    } else {
        municipeEmEdicao.value.telefones[0].numero = '';
    }
};

const formatarTelefone = (index) => {
    const telefones = municipeEmEdicao.value.telefones;
    if (!telefones[index] || !telefones[index].numero) return;

    // Limpa tudo que não for número
    const numerosLimpos = telefones[index].numero.replace(/\D/g, '');
    
    // Aplica a máscara correta baseada no tamanho
    if (numerosLimpos.length === 11) {
        telefones[index].numero = `(${numerosLimpos.substring(0, 2)}) ${numerosLimpos.substring(2, 7)}-${numerosLimpos.substring(7)}`;
    } else if (numerosLimpos.length === 10) {
        telefones[index].numero = `(${numerosLimpos.substring(0, 2)}) ${numerosLimpos.substring(2, 6)}-${numerosLimpos.substring(6)}`;
    } else {
        telefones[index].numero = numerosLimpos;
    }
};

// --- NOVAS FUNÇÕES PARA GERENCIAR DUPLICATAS ---
const abrirModalGestaoDuplicatas = async (grupo_id) => {
    if (!grupo_id) return;
    isLoading.value = true; // Mostra um loading enquanto busca
    try {
        // A MÁGICA ACONTECE AQUI:
        // Faz uma chamada à API pedindo especificamente os contatos do grupo
        const response = await apiClient.get('/api/municipes/', {
            params: { grupo: grupo_id }
        });
        
        // Popula a variável do modal com a resposta completa do backend
        grupoDuplicadoAtual.value = response.data;
        registrosParaDeletar.value = [];
        dialogoGestaoVisivel.value = true;

    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar o grupo de duplicatas.', life: 3000 });
    } finally {
        isLoading.value = false; // Esconde o loading
    }
};

const confirmarDelecaoDeDuplicatas = () => {
    if (registrosParaDeletar.value.length === 0 || registrosParaDeletar.value.length >= grupoDuplicadoAtual.value.length) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione os registros para deletar, mas preserve ao menos um.', life: 3000 });
        return;
    }
    
    confirm.require({
        message: `Você tem certeza que deseja deletar ${registrosParaDeletar.value.length} registro(s)? Esta ação não pode ser desfeita.`,
        header: 'Confirmar Exclusão',
        icon: 'pi pi-exclamation-triangle',
        acceptClassName: 'p-button-danger',
        accept: async () => {
            for (const registro of registrosParaDeletar.value) {
                try {
                    await apiClient.delete(`/api/municipes/${registro.id}/`);
                } catch (error) {
                    toast.add({ severity: 'error', summary: 'Erro', detail: `Falha ao deletar o registro de ${registro.nome_completo}.`, life: 3000 });
                }
            }
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Registros duplicados foram removidos.', life: 3000 });
            dialogoGestaoVisivel.value = false;
            carregarDadosIniciais();
        },
    });
};

// --- LÓGICA DE CADASTRO INTELIGENTE (TRANSPLANTADA E ADAPTADA) ---

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
    telefones: (municipe.telefones && municipe.telefones.length > 0) ? municipe.telefones : [{ tipo: 'principal', numero: '' }],
    emails: (municipe.emails && municipe.emails.length > 0) ? municipe.emails : [{ tipo: 'principal', email: '' }],
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
        // Atualiza o contato na lista principal e na lista da tela
        todosMunicipes.value[index] = contatoSalvo;
    } else {
        // Adiciona o novo contato no início de ambas as listas
        todosMunicipes.value.unshift(contatoSalvo);
    }
    aplicarFiltros(); // Re-aplica os filtros para a tela ser atualizada
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
    // 1. Validação de campos obrigatórios (continua igual)
    if (!dados.nome_completo || !dados.categoria) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Nome Completo e Categoria são obrigatórios.', life: 3000 });
        return null;
    }

    if (!dados.telefones || dados.telefones.length === 0 || !dados.telefones[0].numero) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'É necessário preencher pelo menos um telefone.', life: 3000 });
        return null;
    }

    const payload = { ...dados };

    // 2. Formatação de data (continua igual)
    if (payload.data_nascimento) {
        try {
            const data = new Date(payload.data_nascimento);
            if (isNaN(data.getTime())) throw new Error("Data inválida");
            const ano = data.getFullYear();
            const mes = (data.getMonth() + 1).toString().padStart(2, '0');
            const dia = data.getDate().toString().padStart(2, '0');
            payload.data_nascimento = `${ano}-${mes}-${dia}`;
        } catch (e) {
            toast.add({ severity: 'error', summary: 'Erro de Formato', detail: 'A data de nascimento é inválida.', life: 3000 });
            return null;
        }
    }

    // --- LÓGICA DE PRESERVAÇÃO DE DADOS (CORRIGIDA) ---

    // 3. Tratamento de telefone: só cria/atualiza o objeto `telefones`
    // se o campo `telefone` do formulário tiver algum valor.
    if (payload.telefone) {
        payload.telefones = [{ tipo: 'principal', numero: payload.telefone }];
    } 
    // Se o usuário APAGOU o telefone, o campo existe mas está vazio
    else if (payload.hasOwnProperty('telefone') && !payload.telefone) {
        payload.telefones = [];
    }

    // 4. Tratamento de endereço: só cria/atualiza o objeto `endereco`
    // se PELO MENOS UM dos campos de endereço tiver algum valor.
    if (payload.cep || payload.logradouro || payload.bairro) {
        payload.endereco = { 
            cep: payload.cep || '', 
            logradouro: payload.logradouro || '', 
            bairro: payload.bairro || '' 
        };
    }

    // 5. Limpeza dos campos temporários
    delete payload.telefone;
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
            email: payload.email,
            // Envia a lista de contas para a API (o backend precisa saber como lidar com múltiplos IDs)
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


// --- FUNÇÕES DE FILTRO E AÇÕES DA PÁGINA ---

const aplicarFiltros = async () => {
  isLoading.value = true;
  try {
    // 1. Prepara os parâmetros da busca
    const params = {
      q: filtroTexto.value,
      letra: filtroLetra.value,
      // 2. A MÁGICA: Adiciona o novo filtro se ele estiver ativo
      duplicatas: filtroApenasDuplicatas.value ? 'true' : 'false',
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
  // 1. Limpa TODOS os estados de filtro
  filtroTexto.value = '';
  filtroLetra.value = '';
  filtroApenasDuplicatas.value = false; // <<< ADICIONADO
  
  // 2. Recarrega a lista inicial (os 100 mais recentes)
  isLoading.value = true;
  try {
    const response = await apiClient.get('/api/municipes/');
    municipesNaTela.value = response.data;
  } catch (error) { 
    console.error("Erro ao limpar filtro:", error); 
  } finally { 
    isLoading.value = false; 
  }
};

const filtrarPorLetra = async (letra) => {
  filtroTexto.value = '';
  if (filtroLetra.value === letra) {
    filtroLetra.value = '';
  } else {
    filtroLetra.value = letra;
  }
  isLoading.value = true;
  try {
    const response = await apiClient.get('/api/municipes/', { params: { letra: filtroLetra.value } });
    municipesNaTela.value = response.data;
  } catch (error) { console.error("Erro ao filtrar por letra:", error); } 
  finally { isLoading.value = false; }
};

const confirmarExclusaoContato = (contato) => {
  confirm.require({
    message: `Você tem certeza que deseja excluir o contato "${contato.nome_completo}"? Esta ação não pode ser desfeita e irá remover permanentemente o registro.`,
    header: 'Confirmar Exclusão',
    icon: 'pi pi-exclamation-triangle',
    acceptClassName: 'p-button-danger',
    acceptLabel: 'Sim, excluir',
    rejectLabel: 'Cancelar',
    accept: async () => {
      try {
        // Chama a API para deletar o munícipe
        await apiClient.delete(`/api/municipes/${contato.id}/`);
        
        // Remove o contato das listas locais para atualizar a tela sem recarregar
        todosMunicipes.value = todosMunicipes.value.filter(m => m.id !== contato.id);
        municipesNaTela.value = municipesNaTela.value.filter(m => m.id !== contato.id);

        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Contato excluído permanentemente.', life: 3000 });
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
          <div class="field col-fixed flex align-items-center mt-4">
            <ToggleButton v-model="filtroApenasDuplicatas" onLabel="Mostrando Duplicatas" offLabel="Mostrar Apenas Duplicatas" onIcon="pi pi-users" offIcon="pi pi-users"/>
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
        <Column field="orgao" header="Órgão/Empresa" sortable></Column>
        <Column field="emails" header="Email Principal" :sortable="false">
            <template #body="slotProps">
                <div class="flex align-items-center gap-2" v-if="slotProps.data.emails && slotProps.data.emails.length > 0">
                    <span>{{ slotProps.data.emails[0].email }}</span>
                    <Button icon="pi pi-copy" text rounded size="small" @click="copiarTexto(slotProps.data.emails[0].email)" title="Copiar Email" />
                </div>
            </template>
        </Column>

        <Column header="Telefone">
          <template #body="slotProps">
            <div class="flex align-items-center gap-2" v-if="slotProps.data.telefones && slotProps.data.telefones[0]">
              <span>{{ slotProps.data.telefones[0]?.numero }}</span>
              <Button icon="pi pi-copy" text rounded size="small" @click="copiarTexto(slotProps.data.telefones[0]?.numero)" title="Copiar Telefone" />
            </div>
          </template>
        </Column>

        <Column header="Status" style="width: 5rem; text-align: center;">
          <template #body="slotProps">
            <Button 
              v-if="slotProps.data.grupo_duplicado"
              icon="pi pi-exclamation-triangle" 
              severity="warning" 
              text 
              rounded 
              v-tooltip.top="'Possível duplicata encontrada! Clique para gerenciar.'"
              @click="abrirModalGestaoDuplicatas(slotProps.data.grupo_duplicado)"
            />
          </template>
        </Column>

        <Column header="Qualidade" style="width: 10rem; text-align: center;">
          <template #body="slotProps">
            <Tag v-if="slotProps.data.qualidade_dados === 'Completo'" severity="success" value="Completo"></Tag>
            <Tag v-if="slotProps.data.qualidade_dados === 'Parcial'" severity="warning" value="Parcial"></Tag>
            <Tag v-if="slotProps.data.qualidade_dados === 'Baixo'" severity="danger" value="Baixo"></Tag>
          </template>
        </Column>

        <Column header="Status" style="width: 5rem; text-align: center;">
            <template #body="slotProps">
                <i v-if="slotProps.data.alerta_atualizacao" class="pi pi-clock text-2xl text-orange-500" v-tooltip.top="'Contato desatualizado há mais de 6 meses'"></i>
            </template>
        </Column>

        <Column header="Ações">
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

    <Dialog v-model:visible="dialogoGestaoVisivel" :style="{width: '80vw'}" header="Gerenciar Possíveis Duplicatas" :modal="true">
      <p>Abaixo estão os registros que o sistema identificou como possíveis duplicatas. Compare os dados, selecione os registros que você deseja **excluir** e clique em "Deletar Selecionados". **Lembre-se de preservar o registro mais completo.**</p>
      
      <DataTable :value="grupoDuplicadoAtual" v-model:selection="registrosParaDeletar" dataKey="id">
        <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
        <Column field="nome_completo" header="Nome"></Column>
        <Column field="cpf" header="CPF"></Column>
        <Column field="email" header="Email"></Column>
        <Column header="Telefone">
            <template #body="slotProps">{{ slotProps.data.telefones?.[0]?.numero || '' }}</template>
        </Column>
        <Column field="data_cadastro" header="Cadastrado em">
            <template #body="slotProps">{{ new Date(slotProps.data.data_cadastro).toLocaleDateString('pt-BR') }}</template>
        </Column>
      </DataTable>

      <template #footer>
        <Button label="Cancelar" icon="pi pi-times" text @click="dialogoGestaoVisivel = false" />
        <Button 
          label="Deletar Registros Selecionados" 
          icon="pi pi-trash" 
          class="p-button-danger" 
          @click="confirmarDelecaoDeDuplicatas" 
          :disabled="registrosParaDeletar.length === 0" 
        />
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