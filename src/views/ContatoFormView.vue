<template>
  <div class="page-container">
    <Toast />
    <div class="card">
      <header class="page-header">
        <Button icon="pi pi-arrow-left" severity="secondary" text rounded @click="voltar" />
        <h1 class="page-title">{{ pageTitle }}</h1>
      </header>

      <div v-if="isLoading" class="text-center p-4">
        <ProgressSpinner />
        <p>Carregando dados do contato...</p>
      </div>

      <div v-else class="form-container p-fluid">
        <div class="grid">
            <div class="col-12 md:col-6">
                <div class="field">
                    <label for="edit-nome">Nome Completo*</label>
                    <InputText id="edit-nome" v-model="municipe.nome_completo" />
                </div>
                <div class="field">
                    <label for="nome_guerra">Nome de Guerra / Apelido</label>
                    <InputText id="nome_guerra" v-model="municipe.nome_de_guerra" />
                </div>
                <div class="field">
                    <label for="edit-categoria">Categoria*</label>
                    <Dropdown id="edit-categoria" v-model="municipe.categoria" :options="categoriasContato" optionLabel="nome" optionValue="id" />
                </div>
                <div class="grid">
                    <div class="field col-12 md:col-6"><label for="edit-cpf">CPF</label><InputMask id="edit-cpf" v-model="municipe.cpf" mask="999.999.999-99" /></div>
                    <div class="field col-12 md:col-6"><label for="edit-nascimento">Data de Nascimento</label><Calendar id="edit-nascimento" v-model="municipe.data_nascimento" dateFormat="dd/mm/yy" /></div>
                </div>
                 <div class="field">
                    <label for="nome">Tratamento</label>
                    <InputText id="nome" v-model="municipe.tratamento" />
                    <small>Ex: Senhor, Senhora, Dr., Dra., Vossa Excelência</small>
                </div>
            </div>

            <div class="col-12 md:col-6">
                <div class="field">
                    <label for="edit-cargo">Cargo</label>
                    <InputText id="edit-cargo" v-model="municipe.cargo" />
                </div>
                <div class="field">
                    <label for="edit-orgao">Órgão/Empresa</label>
                    <InputText id="edit-orgao" v-model="municipe.orgao" />
                </div>
                 <div v-if="authStore.isSuperuser" class="field">
                    <label for="contas">Contas com Acesso (Apenas Superusuário)</label>
                    <MultiSelect 
                        id="contas" 
                        v-model="municipe.contas" 
                        :options="contas" 
                        optionLabel="nome" 
                        optionValue="id" 
                        placeholder="Selecione as contas" 
                        display="chip"
                    />
                    <small>Se nenhuma conta for selecionada, este contato será visível para todos.</small>
                </div>
            </div>
        </div>

        <Divider />

        <div class="grid">
            <div class="col-12 md:col-6">
                <div class="field">
                    <label>Telefone(s)*</label>
                    <div v-for="(telefone, index) in municipe.telefones" :key="index" class="p-inputgroup flex-1 mb-2">
                        <Dropdown v-model="telefone.tipo" :options="tiposDeTelefone" optionLabel="label" optionValue="value" placeholder="Tipo"/>
                        <InputText v-model="telefone.numero" placeholder="(xx) xxxxx-xxxx" @blur="formatarTelefone(index)"/>
                        <Button icon="pi pi-trash" type="button" severity="danger" @click="removerTelefone(index)" :disabled="municipe.telefones.length === 1" />
                    </div>
                    <Button label="Adicionar Telefone" icon="pi pi-plus" type="button" severity="secondary" outlined @click="adicionarTelefone" class="mt-2" />
                </div>
                 <div class="field">
                    <label>Email(s)</label>
                    <div v-for="(emailItem, index) in municipe.emails" :key="index" class="p-inputgroup flex-1 mb-2">
                        <Dropdown v-model="emailItem.tipo" :options="tiposDeEmail" optionLabel="label" optionValue="value" placeholder="Tipo"/>
                        <InputText v-model="emailItem.email" placeholder="exemplo@email.com" type="email"/>
                        <Button icon="pi pi-trash" type="button" severity="danger" @click="removerEmail(index)" :disabled="municipe.emails.length === 1"/>
                    </div>
                    <Button label="Adicionar Email" icon="pi pi-plus" type="button" severity="secondary" outlined @click="adicionarEmail" class="mt-2"/>
                </div>
            </div>
            <div class="col-12 md:col-6">
                <div class="grid">
                    <div class="field col-12 md:col-4"><label for="edit-cep">CEP</label><InputMask id="edit-cep" v-model="municipe.endereco.cep" mask="99999-999" @blur="buscarCep" /></div>
                    <div class="field col-12 md:col-8"><label for="edit-logradouro">Endereço</label><InputText id="edit-logradouro" v-model="municipe.endereco.logradouro" /></div>
                </div>
                <div class="field">
                    <label for="edit-bairro">Bairro</label>
                    <InputText id="edit-bairro" v-model="municipe.endereco.bairro" />
                </div>
            </div>
        </div>
        
      </div>
      
      <div class="form-actions">
        <Button label="Cancelar" severity="secondary" outlined @click="voltar" />
        <Button label="Salvar Contato" icon="pi pi-check" @click="salvarMunicipe" :loading="isSaving" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/api';

// Inicialização
const router = useRouter();
const route = useRoute();
const toast = useToast();
const authStore = useAuthStore();

const municipe = ref({
    telefones: [{ tipo: 'principal', numero: '' }],
    emails: [{ tipo: 'principal', email: '' }],
    endereco: {}
});
const categoriasContato = ref([]);
const contas = ref([]);
const isLoading = ref(false);
const isSaving = ref(false);

const tiposDeTelefone = ref([
    { label: 'Principal', value: 'principal' }, { label: 'Celular', value: 'celular' },
    { label: 'Comercial', value: 'comercial' }, { label: 'Residencial', value: 'residencial' },
    { label: 'Outro', value: 'outro' }
]);
const tiposDeEmail = ref([
    { label: 'Principal', value: 'principal' }, { label: 'Pessoal', value: 'pessoal' },
    { label: 'Comercial', value: 'comercial' }, { label: 'Outro', value: 'outro' }
]);

// Lógica de Título e Modo (Criação vs. Edição)
const isEditMode = computed(() => !!route.params.id);
const pageTitle = computed(() => isEditMode.value ? 'Editar Contato' : 'Novo Contato');

// Carregamento de dados
async function carregarDadosIniciais() {
  isLoading.value = true;
  try {
    const [categoriasRes, contasRes] = await Promise.all([
        apiClient.get('/api/contatos/categorias/'),
        authStore.isSuperuser ? apiClient.get('/api/contas/') : Promise.resolve({ data: [] })
    ]);
    categoriasContato.value = categoriasRes.data;
    contas.value = contasRes.data;

    if (isEditMode.value) {
      const response = await apiClient.get(`/api/municipes/${route.params.id}/`);
      const data = response.data;
      // Garante que os campos complexos existam
      if (!data.telefones || data.telefones.length === 0) data.telefones = [{ tipo: 'principal', numero: '' }];
      if (!data.emails || data.emails.length === 0) data.emails = [{ tipo: 'principal', email: '' }];
      if (!data.endereco) data.endereco = {};
      if (data.data_nascimento) data.data_nascimento = new Date(data.data_nascimento + 'T00:00:00');
      municipe.value = data;
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os dados.' });
  } finally {
    isLoading.value = false;
  }
}

onMounted(carregarDadosIniciais);

// Funções de Ação
const salvarMunicipe = async () => {
    isSaving.value = true;
    try {
        // --- CORREÇÃO AQUI ---
        // 1. Cria uma cópia do objeto 'municipe' para não alterar o estado original da tela
        const payload = { ...municipe.value };

        // 2. Formata a data de nascimento para o formato YYYY-MM-DD
        if (payload.data_nascimento instanceof Date) {
            payload.data_nascimento = payload.data_nascimento.toISOString().split('T')[0];
        }

        // 3. A MÁGICA: Transforma a lista de objetos 'contas' em uma lista de IDs
        //    Verifica se 'contas' existe e se o primeiro item é um objeto (para evitar erros)
        if (payload.contas && payload.contas.length > 0 && typeof payload.contas[0] === 'object' && payload.contas[0] !== null) {
            payload.contas = payload.contas.map(conta => conta.id);
        }
        // --- FIM DA CORREÇÃO ---

        if (isEditMode.value) {
            // Envia o payload corrigido
            await apiClient.put(`/api/municipes/${payload.id}/`, payload);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Contato atualizado!' });
        } else {
            // Envia o payload corrigido
            await apiClient.post('/api/municipes/', payload);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Contato criado!' });
        }
        router.back();
    } catch (error) {
        // Agora, extrai e mostra a mensagem de erro específica do backend
        const errorMessages = Object.values(error.response.data).flat().join(' ');
        toast.add({ severity: 'error', summary: 'Erro ao Salvar', detail: errorMessages || 'Verifique os campos.', life: 5000 });
    } finally {
        isSaving.value = false;
    }
};

const voltar = () => {
  router.back(); // Função para voltar para a página de onde o usuário veio
};

// Funções Auxiliares (Telefone, Email, CEP)
const adicionarTelefone = () => municipe.value.telefones.push({ tipo: 'celular', numero: '' });
const removerTelefone = (index) => municipe.value.telefones.splice(index, 1);

const adicionarEmail = () => municipe.value.emails.push({ tipo: 'pessoal', email: '' });
const removerEmail = (index) => municipe.value.emails.splice(index, 1);

const buscarCep = async () => {
    const cep = municipe.value.endereco.cep?.replace(/\D/g, '');
    if (cep?.length === 8) {
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();
            if (!data.erro) {
                municipe.value.endereco.logradouro = data.logradouro;
                municipe.value.endereco.bairro = data.bairro;
            }
        } catch (error) {
            console.error("Erro ao buscar CEP:", error);
        }
    }
};

const formatarTelefone = (index) => {
    let numero = municipe.value.telefones[index].numero.replace(/\D/g, '');
    if (numero.length === 11) {
        numero = `(${numero.substring(0, 2)}) ${numero.substring(2, 7)}-${numero.substring(7)}`;
    } else if (numero.length === 10) {
        numero = `(${numero.substring(0, 2)}) ${numero.substring(2, 6)}-${numero.substring(6)}`;
    }
    municipe.value.telefones[index].numero = numero;
};
</script>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.page-title { margin: 0; font-size: 1.75rem; }
.form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem; }
</style>