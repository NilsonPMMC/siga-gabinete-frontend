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

const solicitacao = ref({});
const isEditMode = computed(() => !!route.params.id);
const isLoading = ref(false);

const sugestoesMunicipes = ref([]);
const municipeSelecionado = ref(null);

const isLoadingMunicipes = ref(false);
let searchTimeout = null;
const contas = ref([]);
const categoriasContato = ref([]);

const dialogMunicipeVisivel = ref(false);
const municipeEmEdicao = ref({});

// Estado para a lógica de duplicatas
const dialogoDuplicatasVisivel = ref(false);
const contatosEncontrados = ref([]);

watch(municipeSelecionado, (novoValor) => {
  solicitacao.value.solicitante = novoValor ? novoValor.id : null;
});

// --- FUNÇÕES DE CARREGAMENTO E GERAIS ---
const fetchDropdownData = async () => {
    try {
        // Não precisa mais buscar a lista de usuários
        const [contasRes, categoriasContatoRes] = await Promise.all([
            apiClient.get('/api/contas/'),
            apiClient.get('/api/contatos/categorias/'),
        ]);
        
        // Se o usuário não for superusuário, filtra as contas
        if (!authStore.user?.is_superuser) {
            const userContasIds = authStore.user?.perfil?.contas || [];
            contas.value = contasRes.data.filter(conta => userContasIds.includes(conta.id));
        } else {
            contas.value = contasRes.data;
        }

        categoriasContato.value = categoriasContatoRes.data;
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar dados de apoio.' });
    }
};

onMounted(async () => {
    if (!authStore.isAuthenticated) {
        isLoading.value = false;
        return;
    }
    isLoading.value = true;
    await fetchDropdownData();

    if (isEditMode.value) {
        try {
            const { data } = await apiClient.get(`/api/solicitacoes-agenda/${route.params.id}/`);
            if (data.data_sugerida) data.data_sugerida = new Date(data.data_sugerida);
            solicitacao.value = data;

            if (data.solicitante) {
                const municipeRes = await apiClient.get(`/api/municipes/lookup/?q=${data.solicitante}`);
                if (municipeRes.data.length > 0) {
                    municipeSelecionado.value = municipeRes.data[0];
                }
            }
        } catch (error) { 
            toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os dados.' }); 
        }
    } else {
        // Lógica de preenchimento automático da conta
        const userProfile = authStore.user?.perfil;
        let contaInicial = null;
        if (!authStore.isRecepcao && userProfile?.contas?.length === 1) {
            contaInicial = userProfile.contas[0];
        }
        solicitacao.value = {
            conta: contaInicial
        };
    }
    isLoading.value = false;
});

const buscarMunicipes = (event) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    isLoadingMunicipes.value = true;
    try {
      const params = {};
      if (event.query?.trim()) {
        params.q = event.query;
      }
      const { data } = await apiClient.get('/api/municipes/lookup/', { params });
      sugestoesMunicipes.value = data;
    } catch (error) {
      console.error("Erro ao buscar munícipes:", error);
    } finally {
      isLoadingMunicipes.value = false;
    }
  }, 300);
};

const salvarAgenda = async () => {
  isLoading.value = true;
  const payload = { ...solicitacao.value };
  if (payload.data_sugerida) {
    payload.data_sugerida = new Date(payload.data_sugerida).toISOString();
  }
  try {
    const { data } = isEditMode.value
      ? await apiClient.put(`/api/solicitacoes-agenda/${payload.id}/`, payload)
      : await apiClient.post('/api/solicitacoes-agenda/', payload);
    
    toast.add({ severity: 'success', summary: 'Sucesso', detail: `Solicitação de agenda ${isEditMode.value ? 'atualizada' : 'criada'}!`, life: 3000 });
    router.push('/agendas');
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao salvar a solicitação.', life: 3000 });
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

// --- LÓGICA DE CADASTRO INTELIGENTE DE MUNÍCIPE (TRANSPLANTADA E ADAPTADA) ---

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
    if (!solicitacao.value.solicitante) return;
    isLoading.value = true;
    try {
        const { data } = await apiClient.get(`/api/municipes/${solicitacao.value.solicitante}/`);
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

const finalizarCadastroMunicipe = (municipeSalvo) => {
    // Adiciona ou atualiza na lista de sugestões
    const index = sugestoesMunicipes.value.findIndex(m => m.id === municipeSalvo.id);
    if (index !== -1) {
      sugestoesMunicipes.value[index] = municipeSalvo;
    } else {
      sugestoesMunicipes.value.unshift(municipeSalvo);
    }
    // Seleciona o munícipe recém-salvo no Autocomplete
    municipeSelecionado.value = municipeSalvo;
    
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
        const contaIdContexto = solicitacao.value.conta;
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
</script>

<template>
  <div class="page-container">
    <Card>
      <template #title>
        <div class="card-title">
          <Button icon="pi pi-arrow-left" @click="router.push('/agendas')" text rounded />
          <h2 class="ml-2">{{ isEditMode ? 'Editar Solicitação de Agenda' : 'Nova Solicitação de Agenda' }}</h2>
        </div>
      </template>
      <template #content>
        <form @submit.prevent="salvarAgenda" class="p-fluid">
          <div class="field">
            <label for="conta">Gabinete Solicitado*</label>
            <Dropdown id="conta" v-model="solicitacao.conta" :options="contas" optionLabel="nome" optionValue="id" placeholder="Selecione um gabinete" />
          </div>
          <div class="field">
              <label for="solicitante">Solicitante*</label>
              <div class="p-inputgroup">
                  <AutoComplete
                      id="solicitante"
                      v-model="municipeSelecionado"
                      :suggestions="sugestoesMunicipes"
                      @complete="buscarMunicipes"
                      field="nome_completo"
                      placeholder="Digite para buscar um solicitante..."
                      forceSelection
                      style="width: 100%;"
                  >
                      <template #item="slotProps">
                          <div class="flex flex-column align-items-start">
                              <div>{{ slotProps.item.nome_completo }}</div>
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
                      title="Adicionar Novo Solicitante"
                      :disabled="!solicitacao.conta" 
                      v-tooltip.top="!solicitacao.conta ? 'Selecione um Gabinete Solicitado primeiro' : ''"
                    />
                  <Button 
                      type="button" 
                      icon="pi pi-pencil" 
                      @click="editarDialogoMunicipe" 
                      :disabled="!solicitacao.solicitante"
                      title="Editar Solicitante Selecionado" 
                  />
              </div>
          </div>
          <div class="field">
            <label for="assunto">Assunto*</label>
            <InputText id="assunto" v-model="solicitacao.assunto" />
          </div>
          <div class="field">
            <label for="detalhes">Detalhes Adicionais</label>
            <Textarea id="detalhes" v-model="solicitacao.detalhes" rows="4" autoResize />
          </div>
          <div class="field">
            <label for="data_sugerida">Data Sugerida (Opcional)</label>
            <Calendar id="data_sugerida" v-model="solicitacao.data_sugerida" showTime hourFormat="24" dateFormat="dd/mm/yy" />
          </div>
          <Button type="submit" label="Salvar Solicitação" icon="pi pi-save" :loading="isLoading" class="mt-4" />
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