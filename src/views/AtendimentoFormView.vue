<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/api';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { useToast } from "primevue/usetoast";

// --- INICIALIZAÇÃO E ESTADO ---
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const atendimento = ref({});
const isEditMode = computed(() => !!route.params.id);

const sugestoesMunicipes  = ref([]);
const municipeSelecionado = ref(null);
const isLoadingMunicipes = ref(false);
let searchTimeout = null;
const contas = ref([]);
const usuarios = ref([]);
const categorias = ref([]);
const categoriasContato = ref([]);
const usuariosFiltrados = ref([]);

const responsavelSelecionado = ref(null);

const isLoading = ref(true);
const dialogMunicipeVisivel = ref(false);
const municipeEmEdicao = ref({});

const dialogoDuplicatasVisivel = ref(false);
const contatosEncontrados = ref([]);

// Adicione este 'watch' para filtrar os usuários dinamicamente
watch(() => atendimento.value.conta, (novaContaId) => {
    // Limpa a seleção de responsável se a conta mudar
    //atendimento.value.responsavel = null;

    if (responsavelSelecionado.value && !responsavelSelecionado.value.contas.includes(novaContaId)) {
        responsavelSelecionado.value = null;
    }

    if (novaContaId) {
        // Filtra a lista principal de usuários
        usuariosFiltrados.value = usuarios.value.filter(usuario => 
            usuario.contas.includes(novaContaId)
        );
    } else {
        // Se nenhuma conta for selecionada, a lista de responsáveis fica vazia
        usuariosFiltrados.value = [];
    }
}, { immediate: true });

// --- FUNÇÕES DE CARREGAMENTO E GERAIS ---
const fetchDropdownData = async () => {
    try {
        const [
            contasRes, 
            usuariosRes, 
            categoriasAtendimentoRes, 
            categoriasContatoRes
        ] = await Promise.all([
            apiClient.get('/api/contas/'),
            apiClient.get('/api/usuarios/'),
            apiClient.get('/api/categorias/'),
            apiClient.get('/api/contatos/categorias/')
        ]);

        // --- AJUSTE 2: FILTRO DO CAMPO "GABINETE DESTINO" ---
        // Se o usuário não for superusuário, mostra apenas as contas às quais ele pertence.
        if (!authStore.user?.is_superuser) {
            const userContasIds = authStore.user?.perfil?.contas || [];
            contas.value = contasRes.data.filter(conta => userContasIds.includes(conta.id));
        } else {
            // Superusuário vê todas as contas.
            contas.value = contasRes.data;
        }

        // --- AJUSTE 1: FILTRO DO CAMPO "ATRIBUIR A RESPONSÁVEL" ---
        // Remove todos os usuários que pertencem ao grupo "Recepção" da lista.
        usuarios.value = usuariosRes.data.filter(user => 
            !user.groups.includes('Recepção')
        );
        
        // O resto dos dados carrega normalmente
        categorias.value = categoriasAtendimentoRes.data;
        categoriasContato.value = categoriasContatoRes.data;

    } catch (error) { 
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar dados de apoio.', life: 3000 }); 
    }
};

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    isLoading.value = false;
    return;
  }
  await fetchDropdownData();
  if (isEditMode.value) {
    try {
      const { data } = await apiClient.get(`/api/atendimentos/${route.params.id}/`);
      atendimento.value = { ...data, categorias: data.categorias?.map(c => c.id) || [] };

      if (data.responsavel_obj) {
        responsavelSelecionado.value = data.responsavel_obj;
      }

      if (data.municipe) {
        const municipeRes = await apiClient.get(`/api/municipes/lookup/?q=${data.municipe}`);
        if (municipeRes.data.length > 0) {
            municipeSelecionado.value = municipeRes.data[0];
        }
      }
    } catch (error) { toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os dados.' }); }
  } else {
      atendimento.value = { titulo: '', descricao: '', municipe: null, conta: null, responsavel: null, categorias: [] };
      const userProfile = authStore.user?.perfil;
      if (!authStore.isRecepcao && userProfile?.contas?.length === 1) {
          atendimento.value.conta = userProfile.contas[0];
      }
  }
  isLoading.value = false;
});

const buscarMunicipes = (event) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    try {
      // O AutoComplete usa event.query em vez de event.value
      const termoBusca = event.query || '';
      const { data } = await apiClient.get('/api/municipes/lookup/', { params: { q: termoBusca } });
      sugestoesMunicipes.value = data;
    } catch (error) {
      console.error("Erro ao buscar munícipes:", error);
      sugestoesMunicipes.value = [];
    }
  }, 300);
};

watch(municipeSelecionado, (novoValor) => {
  // O v-model do formulário (atendimento.municipe) precisa do ID, não do objeto.
  // Este 'watch' sincroniza os dois.
  atendimento.value.municipe = novoValor ? novoValor.id : null;
});

const salvarAtendimento = async () => {
  isLoading.value = true;
  atendimento.value.responsavel = responsavelSelecionado.value ? responsavelSelecionado.value.id : null;
  
  try {
    const { data } = isEditMode.value
      ? await apiClient.put(`/api/atendimentos/${atendimento.value.id}/`, atendimento.value)
      : await apiClient.post('/api/atendimentos/', atendimento.value);
    
    toast.add({ severity: 'success', summary: 'Sucesso', detail: isEditMode.value ? 'Atendimento atualizado!' : `Atendimento criado! Protocolo: ${data.protocolo}`, life: 3000 });
    router.push(authStore.isRecepcao ? '/' : `/atendimentos/${data.id}`);
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar o atendimento.', life: 3000 });
  } finally {
    isLoading.value = false;
  }
};

const tiposDeTelefone = ref([
    { label: 'Principal', value: 'principal' },
    { label: 'Celular', value: 'celular' },
    { label: 'Trabalho', value: 'trabalho' },
    { label: 'Outro', value: 'outro' },
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
    // Garante que o usuário não possa remover o último campo de telefone
    if (municipeEmEdicao.value.telefones.length > 1) {
        municipeEmEdicao.value.telefones.splice(index, 1);
    } else {
        // Se for o último, apenas limpa o número
        municipeEmEdicao.value.telefones[0].numero = '';
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

// --- LÓGICA DE CADASTRO/EDIÇÃO DE MUNÍCIPE ---

const abrirDialogoMunicipe = () => {
    // --- INÍCIO DO DEBUG ---
    console.clear(); // Limpa o console para facilitar a leitura
    console.log("--- INICIANDO DEBUG DE VÍNCULO DE CONTAS (ATENDIMENTO) ---");
    console.log("Analisando os dados do authStore...");

    const userProfile = authStore.user?.perfil;
    console.log("Perfil do usuário encontrado no authStore:", userProfile);

    const userAccounts = userProfile?.contas;
    console.log("Valor BRUTO de 'contas' vindo do perfil:", userAccounts);
    console.log("O valor acima é um array?", Array.isArray(userAccounts));
    // --- FIM DO DEBUG ---

    const categoriaDefault = categoriasContato.value.find(c => c.nome.toLowerCase() === 'munícipe');
    let contasIniciais = [];

    if (authStore.isMembro || authStore.isSecretaria || authStore.isRecepcao) {
        if (userAccounts) { // userAccounts é a variável usada neste arquivo
            contasIniciais = Array.isArray(userAccounts) ? userAccounts : [userAccounts];
        }
    }

    municipeEmEdicao.value = {
        categoria: categoriaDefault?.id || null,
        contas: contasIniciais,
        telefones: [{ tipo: 'principal', numero: '' }],
        emails: [{ tipo: 'principal', email: '' }]
    };
    dialogMunicipeVisivel.value = true;
};

const editarDialogoMunicipe = async () => {
  if (!atendimento.value.municipe) return;
  isLoading.value = true;
  try {
    const { data } = await apiClient.get(`/api/municipes/${atendimento.value.municipe}/`);
    municipeEmEdicao.value = {
      ...data,
      contas: data.contas?.map(c => c.id) || [],
      cep: data.endereco?.cep || '',
      logradouro: data.endereco?.logradouro || '',
      bairro: data.endereco?.bairro || '',
      telefones: (data.telefones && data.telefones.length > 0) ? data.telefones : [{ tipo: 'principal', numero: '' }],
      emails: (data.emails && data.emails.length > 0) ? data.emails : [{ tipo: 'principal', email: '' }]
    };
    dialogMunicipeVisivel.value = true;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os dados do munícipe.' });
  } finally {
    isLoading.value = false;
  }
};

const buscarCep = async () => {
  const cep = municipeEmEdicao.value.cep?.replace(/\D/g, '');
  if (cep?.length === 8) {
    try {
      const { data } = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
      if (!data.erro) {
        municipeEmEdicao.value.logradouro = data.logradouro;
        municipeEmEdicao.value.bairro = data.bairro;
      }
    } catch (error) { console.error("Erro ao buscar CEP:", error); }
  }
};

const formatarMunicipeParaBusca = (municipe) => {
    return {
        ...municipe,
        // Este campo invisível junta o nome e o nome de guerra
        // para a busca interna do componente.
        texto_busca: `${municipe.nome_completo} ${municipe.nome_de_guerra || ''}`
    };
};

const finalizarCadastroMunicipe = (municipeSalvo) => {
    const municipeFormatado = formatarMunicipeParaBusca(municipeSalvo);
    
    const index = sugestoesMunicipes.value.findIndex(m => m.id === municipeFormatado.id);
    if (index !== -1) {
        sugestoesMunicipes.value[index] = municipeFormatado;
    } else {
        sugestoesMunicipes.value.unshift(municipeFormatado);
    }

    municipeSelecionado.value = municipeFormatado;
    dialogoDuplicatasVisivel.value = false;
    dialogMunicipeVisivel.value = false;
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
        finalizarCadastroMunicipe(data);
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
        const contaIdContexto = atendimento.value.conta;
        const params = { 
            nome_completo: payload.nome_completo, 
            cpf: payload.cpf, 
            email: payload.email,
            telefone: payload.telefones[0]?.numero || '', 
            conta_id: contaIdContexto 
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
    finalizarCadastroMunicipe(contato);
};

const handleAtualizarContatoExistente = async (contatoExistente) => {
    // CORRIGIDO: Pega os dados do formulário e junta com o ID do contato existente
    const dadosParaAtualizar = { ...municipeEmEdicao.value, id: contatoExistente.id };
    const payload = validarEPrepararPayload(dadosParaAtualizar);
    if (!payload) return; // Para se a validação falhar
    await executarSalvamento(payload);
};

const handleCriarNovoContato = async () => {
    const dadosParaCriar = { ...municipeEmEdicao.value };
    delete dadosParaCriar.id;
    const payload = validarEPrepararPayload(dadosParaCriar);
    if (!payload) return;
    await executarSalvamento(payload);
};

</script>

<template>
  <div class="page-container">
    <Card>
      <template #title>
        <div class="card-title">
          <Button icon="pi pi-arrow-left" @click="router.push('/')" text rounded />
          <h2 class="ml-2">{{ isEditMode ? 'Editar Atendimento' : 'Novo Atendimento' }}</h2>
        </div>
      </template>
      <template #content>
        <form @submit.prevent="salvarAtendimento" class="p-fluid">
          <div class="field">
            <label for="conta">Gabinete de Destino*</label>
            <Dropdown id="conta" v-model="atendimento.conta" :options="contas" optionLabel="nome" optionValue="id" placeholder="Selecione um gabinete" />
          </div>
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
                              <div>{{ slotProps.item.nome_completo }}
                                  <i v-if="slotProps.item.qualidade_dados === 'Baixo'" 
                                      class="pi pi-exclamation-triangle text-orange-500 ml-2" 
                                      v-tooltip.top="'Dados incompletos. Considere editar.'"></i>
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
                      icon="pi pi-plus" @click="abrirDialogoMunicipe"
                      title="Adicionar Novo Munícipe"
                      :disabled="!atendimento.conta" 
                      v-tooltip.top="!atendimento.conta ? 'Selecione um Gabinete de Destino primeiro' : ''"
                  />
                  <Button 
                      type="button" 
                      icon="pi pi-pencil" 
                      @click="editarDialogoMunicipe" 
                      :disabled="!municipeSelecionado || !municipeSelecionado.pode_editar"
                      title="Editar Munícipe Selecionado" 
                  />
              </div>
          </div>
          <div class="field">
              <label for="responsavel">Atribuir a Responsável (Opcional)</label>
              <Dropdown 
                  id="responsavel" 
                  v-model="responsavelSelecionado" 
                  :options="usuariosFiltrados"
                  optionLabel="username"
                  placeholder="Selecione um responsável" 
                  filter 
                  showClear 
                  :disabled="!atendimento.conta" />
          </div>
          <div class="field">
            <label for="titulo">Título do Atendimento*</label>
            <InputText id="titulo" type="text" v-model="atendimento.titulo" />
          </div>
          <div class="field">
            <label for="descricao">Descrição Detalhada</label>
            <Textarea id="descricao" v-model="atendimento.descricao" rows="5" autoResize />
          </div>
          <Button type="submit" label="Salvar Atendimento" icon="pi pi-save" :loading="isLoading" class="mt-4" />
        </form>
      </template>
    </Card>

    <Dialog v-model:visible="dialogMunicipeVisivel" :style="{width: '800px'}" header="Dados do Munícipe" :modal="true" class="p-fluid">
      <div class="field">
        <label for="categoria">Categoria*</label>
        <Dropdown id="categoria" v-model="municipeEmEdicao.categoria" :options="categoriasContato" optionLabel="nome" optionValue="id" placeholder="Selecione a categoria" />
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
            class="w-full"
        />
        <small>Se nenhuma conta for selecionada, este contato será visível para todos.</small>
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
          <div class="field col-12 md:col-6">
              <label for="cargo">Cargo</label>
              <InputText id="cargo" v-model="municipeEmEdicao.cargo" />
          </div>
          <div class="field col-12 md:col-6">
              <label for="orgao">Órgão/Empresa</label>
              <InputText id="orgao" v-model="municipeEmEdicao.orgao" />
          </div>
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
        <Button label="Cancelar" icon="pi pi-times" text @click="dialogMunicipeVisivel = false" />
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
.page-container { padding: 2rem; max-width: 800px; margin: auto; }
.field { margin-bottom: 1.5rem; }
.card-title { display: flex; align-items: center; }
label { font-weight: bold; margin-bottom: 0.5rem; display: block; }
</style>