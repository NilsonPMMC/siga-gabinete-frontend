<template>
  <Dialog 
    v-model:visible="dialogVisible" 
    :header="pageTitle" 
    :modal="true" 
    :style="{ width: '900px' }"
    :breakpoints="{ '960px': '95vw' }"
    @show="carregarDados"
    @hide="resetForm"
    class="p-fluid"
    maximizable 
  >
    <div v-if="isLoading" class="flex flex-column align-items-center justify-content-center p-6">
      <ProgressSpinner />
      <p class="mt-3 text-gray-600">Carregando ficha do munícipe...</p>
    </div>

    <div v-else>
      <div class="grid formgrid">
        
        <div class="col-12 md:col-3 flex flex-column align-items-center justify-content-start pt-2 mt-3">
            <div class="relative">
                <Avatar 
                    :image="fotoPreviewUrl || avatarPlaceholderUrl" 
                    size="xlarge" 
                    shape="circle" 
                    class="w-8rem h-8rem shadow-2 surface-card"
                    style="border: 4px solid white"
                />
                <Button 
                    icon="pi pi-camera" 
                    rounded 
                    severity="primary"
                    class="absolute bottom-0 right-0 shadow-2"
                    style="transform: translate(25%, 25%)"
                    @click="fotoCaptureComponent.abrirCamera()"
                    v-tooltip="'Alterar Foto'"
                />
            </div>

            <FotoCapture 
                ref="fotoCaptureComponent" 
                @foto-salva="onFotoCapturada" 
            />
            
            <small class="text-500" v-if="!fotoPreviewUrl">Toque no ícone de câmera para adicionar uma foto.</small>
        </div>

        <div class="col-12 md:col-9 mt-3">
            <div class="grid">
                <div class="field col-12">
                    <label for="nome" class="font-bold">Nome Completo *</label>
                    <InputText id="nome" v-model="municipe.nome_completo" autofocus />
                </div>
                
                <div class="field col-12 md:col-6">
                    <label for="apelido">Nome Social / Apelido</label>
                    <InputText id="apelido" v-model="municipe.nome_de_guerra" />
                </div>
                
                <!-- Categoria por perfil abaixo -->

                <div class="field col-6 md:col-4">
                    <label for="cpf">CPF</label>
                    <InputMask id="cpf" v-model="municipe.cpf" mask="999.999.999-99" />
                </div>
                
                <div class="field col-6 md:col-4">
                    <label for="nascimento">Nascimento</label>
                    <Calendar id="nascimento" v-model="municipe.data_nascimento" dateFormat="dd/mm/yy" showIcon />
                </div>

                <div class="field col-12 md:col-4">
                    <label for="tratamento">Tratamento (geral)</label>
                    <InputText id="tratamento" v-model="municipe.tratamento" placeholder="Ex: Sr., Dr." />
                </div>

                <div v-if="authStore.isSuperuser" class="field col-12">
                    <label for="contas">Visibilidade (Gabinete)</label>
                    <MultiSelect id="contas" v-model="municipe.contas" :options="contas" optionLabel="nome" optionValue="id" display="chip" placeholder="Padrão: Apenas meu gabinete" />
                </div>
            </div>
        </div>
      </div>

      <div class="field col-12">
        <div class="flex align-items-center justify-content-between mb-2">
            <label class="font-bold">Vínculo Profissional (Cargo / Órgão)</label>
            <Button label="Adicionar vínculo" icon="pi pi-plus" text size="small" @click="adicionarPerfil" />
        </div>
        <div v-for="(perfil, idx) in municipe.perfis" :key="'perfil-'+idx" class="surface-100 p-3 mb-3 border-round">
            <div class="grid">
                <div class="field col-12 md:col-2" v-if="contasParaPerfil.length">
                    <label>Gabinete</label>
                    <Dropdown v-model="perfil.conta" :options="contasParaPerfil" optionLabel="nome" optionValue="id" placeholder="Conta" class="w-full" />
                </div>
                <div class="field col-12 md:col-3">
                    <label>Cargo</label>
                    <InputText v-model="perfil.cargo" placeholder="Cargo" class="w-full" />
                </div>
                <div class="field col-12 md:col-3">
                    <label>Instituição/Órgão</label>
                    <InputText v-model="perfil.instituicao" placeholder="Órgão" class="w-full" />
                </div>
                <div class="field col-12 md:col-3" v-if="categoriasContato.length">
                    <label>Categoria *</label>
                    <Dropdown v-model="perfil.categoria" :options="categoriasContato" optionLabel="nome" optionValue="id" placeholder="Selecione..." class="w-full" />
                </div>
                <div class="field col-12 md:col-1 flex align-items-end">
                    <Button icon="pi pi-trash" text severity="danger" @click="removerPerfil(idx)" v-tooltip="'Remover perfil'" />
                </div>
            </div>
            <div class="field col-12 mt-2" v-if="!contasParaPerfil.length">
                <small class="text-500">Salve o contato e vincule a um gabinete (acima) para adicionar perfis (cargo/órgão).</small>
            </div>
        </div>
        <small v-if="!municipe.perfis?.length" class="text-500">Nenhum vínculo. Use "Adicionar vínculo" para cadastrar cargo/órgão por gabinete.</small>
    </div>

      <Divider align="center" type="dashed">
          <span class="p-tag bg-gray-200 text-gray-700">Informações de Contato</span>
      </Divider>

      <div class="grid">
        
        <div class="col-12 md:col-6 pr-3 border-right-1 border-gray-200 md:border-right-1 surface-border">
            <h4 class="text-base text-700 font-medium mb-3"><i class="pi pi-phone mr-2"></i>Meios de Contato</h4>
            
            <div v-for="(tel, i) in municipe.telefones" :key="'tel'+i" class="flex gap-2 mb-2">
                <Dropdown v-model="tel.tipo" :options="tiposDeTelefone" optionLabel="label" optionValue="value" class="w-8rem" />
                <InputText v-model="tel.numero" placeholder="(00) 00000-0000" class="flex-1" @blur="formatarTelefone(i)" />
                <Button icon="pi pi-trash" text severity="danger" @click="removerTelefone(i)" :disabled="municipe.telefones.length === 1" />
            </div>
            <Button label="Adicionar Telefone" icon="pi pi-plus" text size="small" @click="adicionarTelefone" class="mb-3" />

            <div v-for="(mail, i) in municipe.emails" :key="'mail'+i" class="flex gap-2 mb-2">
                <Dropdown v-model="mail.tipo" :options="tiposDeEmail" optionLabel="label" optionValue="value" class="w-8rem" />
                <InputText v-model="mail.email" placeholder="email@exemplo.com" class="flex-1" />
                <Button icon="pi pi-trash" text severity="danger" @click="removerEmail(i)" :disabled="municipe.emails.length === 1" />
            </div>
            <Button label="Adicionar Email" icon="pi pi-plus" text size="small" @click="adicionarEmail" />
        </div>

        <div class="col-12 md:col-6 pl-3">
            <h4 class="text-base text-700 font-medium mb-3"><i class="pi pi-map-marker mr-2"></i>Endereço</h4>
            
            <div class="grid">
                <div class="field col-5">
                    <label>CEP</label>
                    <div class="p-inputgroup">
                        <InputMask v-model="municipe.endereco.cep" mask="99999-999" @blur="buscarCep" />
                        <Button icon="pi pi-search" @click="buscarCep" severity="secondary" />
                    </div>
                </div>
                <div class="field col-7">
                    <label>Bairro</label>
                    <InputText v-model="municipe.endereco.bairro" />
                </div>
                <div class="field col-12">
                    <label>Logradouro</label>
                    <InputText v-model="municipe.endereco.logradouro" />
                </div>
                <div class="field col-4">
                    <label>Número</label>
                    <InputText v-model="municipe.endereco.numero" />
                </div>
                <div class="field col-8">
                    <label>Complemento</label>
                    <InputText v-model="municipe.endereco.complemento" />
                </div>
                <div class="field col-12">
                    <label>Cidade/UF</label>
                    <InputText v-model="municipe.endereco.cidade" placeholder="Mogi das Cruzes - SP" />
                </div>
            </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-content-between align-items-center w-full">
          <span class="text-gray-500 text-sm">* Campos obrigatórios</span>
          <div class="flex gap-2">
              <Button label="Cancelar" icon="pi pi-times" text severity="secondary" @click="fecharModal" />
              <Button label="Salvar Ficha" icon="pi pi-check" @click="salvarMunicipe" :loading="isSaving" />
          </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/api';
import Avatar from 'primevue/avatar';
import FotoCapture from '@/components/common/FotoCapture.vue';
import avatarPlaceholderUrl from '@/public/images/avatar-placeholder.png';

const props = defineProps({
  visible: { type: Boolean, required: true },
  municipeId: { type: [Number, String], default: null }
});

const emit = defineEmits(['update:visible', 'saved']);

const toast = useToast();
const authStore = useAuthStore();
const isLoading = ref(false);
const isSaving = ref(false);

const categoriasContato = ref([]);
const contas = ref([]);
const localId = ref(null);

// --- ESTADOS DA FOTO ---
const fotoPreviewUrl = ref(null);
const fotoArquivoParaUpload = ref(null);
const fotoCaptureComponent = ref(null);

const defaultMunicipe = {
  nome_completo: '',
  telefones: [{ tipo: 'celular', numero: '' }],
  emails: [{ tipo: 'pessoal', email: '' }],
  endereco: { cep: '', logradouro: '', bairro: '' },
  perfis: []
};

const municipe = ref({ ...defaultMunicipe });

const tiposDeTelefone = ref([
    { label: 'Principal', value: 'principal' }, { label: 'Celular', value: 'celular' },
    { label: 'Comercial', value: 'comercial' }, { label: 'Residencial', value: 'residencial' }
]);
const tiposDeEmail = ref([
    { label: 'Principal', value: 'principal' }, { label: 'Pessoal', value: 'pessoal' },
    { label: 'Comercial', value: 'comercial' }
]);

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
});

const contasParaPerfil = computed(() => {
  if (contas.value?.length) return contas.value;
  return Array.isArray(municipe.value.contas) ? municipe.value.contas : [];
});

const isEditMode = computed(() => !!props.municipeId);
const pageTitle = computed(() => isEditMode.value ? 'Editar Contato' : 'Novo Contato Rápido');

// --- DEBUG: CARREGAMENTO ---
async function carregarDados() {
  isLoading.value = true;
  try {
    const [categoriasRes, contasRes] = await Promise.all([
        apiClient.get('/api/contatos/categorias/'),
        apiClient.get('/api/contas/')
    ]);
    categoriasContato.value = categoriasRes.data;
    const todasContas = contasRes.data || [];
    if (authStore.isSuperuser) {
        contas.value = todasContas;
    } else {
        const idsUsuario = authStore.userContas || [];
        contas.value = idsUsuario.length ? todasContas.filter(c => idsUsuario.includes(c.id)) : [];
    }

    if (isEditMode.value) {
      console.log(`Buscando dados do munícipe ID: ${props.municipeId}`);
      const response = await apiClient.get(`/api/municipes/${props.municipeId}/`);
      const data = response.data;
      
      // Sanitização
      if (!data.telefones?.length) data.telefones = [{ tipo: 'celular', numero: '' }];
      if (!data.emails?.length) data.emails = [{ tipo: 'pessoal', email: '' }];
      if (!data.endereco) data.endereco = {};
      if (data.data_nascimento) data.data_nascimento = new Date(data.data_nascimento + 'T00:00:00');
      if (!Array.isArray(data.perfis)) data.perfis = [];
      // Garantir que cada perfil tenha conta e categoria como id (para os Dropdowns)
      data.perfis = data.perfis.map(p => ({ ...p, conta: p.conta?.id ?? p.conta, categoria: p.categoria?.id ?? p.categoria }));
      
      municipe.value = data;

      if (data.foto) {
          console.log("Definindo preview com URL do backend:", data.foto);
          fotoPreviewUrl.value = data.foto; 
      } else {
          console.log("Munícipe sem foto no backend.");
          fotoPreviewUrl.value = null;
      }

    } else {
        resetForm();
        // Cria um perfil vazio para o usuário preencher (categoria é por perfil)
        if (!municipe.value.perfis?.length && contasParaPerfil.value?.length) {
            municipe.value.perfis = [{ conta: contasParaPerfil.value[0].id, categoria: null, cargo: '', instituicao: '', departamento: '', tratamento: '', ativo: true }];
        }
        // --- LÓGICA AUTOMÁTICA PARA RECEPÇÃO ---
        // Verifica se o usuário tem perfil de Recepção
        const isRecepcao = authStore.user?.groups?.includes('Recepção');
        
        if (isRecepcao && municipe.value.perfis?.length) {
            const catMunicipe = categoriasContato.value.find(c => c.nome.toLowerCase() === 'munícipe' || c.nome.toLowerCase() === 'municipe');
            if (catMunicipe) {
                municipe.value.perfis[0].categoria = catMunicipe.id;
            }
        }
    }
  } catch (error) {
    console.error("Erro no carregamento:", error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao carregar dados.' });
    fecharModal();
  } finally {
    isLoading.value = false;
  }
}

// --- DEBUG: CAPTURA ---
const onFotoCapturada = (blobFoto) => {
    console.log("--- DEBUG: FOTO CAPTURADA ---");
    console.log("Blob recebido:", blobFoto);
    console.log("Tipo do Blob:", blobFoto.type);
    console.log("Tamanho:", blobFoto.size);

    fotoArquivoParaUpload.value = blobFoto;
    
    if (fotoPreviewUrl.value && !fotoPreviewUrl.value.startsWith('http')) {
        URL.revokeObjectURL(fotoPreviewUrl.value); 
    }
    fotoPreviewUrl.value = URL.createObjectURL(blobFoto);
    console.log("Preview local atualizado.");
};

function resetForm() {
    localId.value = null;
    if (!isEditMode.value) {
        municipe.value = JSON.parse(JSON.stringify(defaultMunicipe));
    }
    fotoPreviewUrl.value = null;
    fotoArquivoParaUpload.value = null;
}

function fecharModal() {
  dialogVisible.value = false;
}


// --- CORREÇÃO DA FUNÇÃO SALVAR ---
const salvarMunicipe = async () => {
    // 1. Validação: ao menos um perfil com categoria
    const temPerfilComCategoria = municipe.value.perfis?.some(p => p.categoria);
    if (!municipe.value.perfis?.length || !temPerfilComCategoria) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Adicione ao menos um vínculo (cargo/órgão) com Categoria selecionada.', life: 4000 });
        return;
    }
    if (!municipe.value.nome_completo) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Informe o Nome.', life: 4000 });
        return;
    }

    isSaving.value = true; // TRAVA O BOTÃO

    try {
        const payload = { ...municipe.value };
        delete payload.foto; // Texto vai limpo, sem o campo de arquivo

        // Formata datas
        if (payload.data_nascimento instanceof Date) {
            payload.data_nascimento = payload.data_nascimento.toISOString().split('T')[0];
        }
        
        // Corrige arrays de IDs (contas)
        if (payload.contas && payload.contas.length > 0 && typeof payload.contas[0] === 'object') {
            payload.contas = payload.contas.map(conta => conta.id);
        }
        // Perfis: enviar apenas id (se existir), conta (id), cargo, instituicao, departamento, tratamento, ativo
        if (Array.isArray(payload.perfis)) {
            payload.perfis = payload.perfis.map(p => ({
                ...(p.id && { id: p.id }),
                conta: typeof p.conta === 'object' ? p.conta?.id : p.conta,
                categoria: typeof p.categoria === 'object' ? p.categoria?.id : p.categoria,
                cargo: p.cargo || null,
                instituicao: p.instituicao || null,
                departamento: p.departamento || null,
                tratamento: p.tratamento || null,
                ativo: p.ativo !== false
            })).filter(p => p.conta);
        }

        let response;
        
        // --- A CORREÇÃO DO FANTASMA ESTÁ AQUI ---
        // Verifica se é edição olhando a prop OU o localId (que definimos logo após salvar)
        const idParaSalvar = props.municipeId || localId.value;

        if (idParaSalvar) {
            // EDICAO (PUT)
            response = await apiClient.put(`/api/municipes/${idParaSalvar}/`, payload);
        } else {
            // CRIAÇÃO (POST)
            response = await apiClient.post('/api/municipes/', payload);
            
            // IMEDIATAMENTE define o ID local. 
            // Se o upload da foto falhar ou demorar, o próximo clique será um PUT (Edição), não outro POST.
            localId.value = response.data.id; 
            municipe.value.id = response.data.id;
        }

        // O objeto base agora é o que voltou do servidor (com ID garantido)
        let objetoFinal = response.data;

        // 2. Upload da Foto (PATCH) — usa o ID do registro salvo (edição ou criação)
        const idParaFoto = objetoFinal?.id ?? localId.value ?? idParaSalvar;
        if (fotoArquivoParaUpload.value && idParaFoto) {
            const formData = new FormData();
            formData.append('foto', fotoArquivoParaUpload.value, 'foto_perfil.jpg');

            try {
                const resUpload = await apiClient.patch(`/api/municipes/${idParaFoto}/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                
                // Atualiza o objeto final com a URL da foto nova
                objetoFinal = resUpload.data;
                
                // Cache Busting: Adiciona um timestamp falso na URL para o navegador atualizar a imagem na hora
                if (objetoFinal.foto) {
                    objetoFinal.foto = `${objetoFinal.foto}?t=${new Date().getTime()}`;
                }

                toast.add({ severity: 'info', summary: 'Foto', detail: 'Foto atualizada com sucesso.' });

            } catch (errFoto) {
                console.error("Erro no upload da foto (Texto foi salvo):", errFoto);
                toast.add({ severity: 'warn', summary: 'Aviso', detail: 'O contato foi salvo, mas houve erro ao enviar a foto.' });
            }
        }

        // Emite o evento para a lista atualizar
        emit('saved', objetoFinal);
        fecharModal();

    } catch (error) {
        console.error("Erro ao salvar:", error);
        let msg = 'Erro desconhecido.';
        if (error.response) {
            if (error.response.status >= 500) msg = "Erro interno no servidor.";
            else if (error.response.data) msg = Object.values(error.response.data).flat().join(' - ');
        }
        toast.add({ severity: 'error', summary: 'Erro ao Salvar', detail: msg, life: 5000 });
    } finally {
        isSaving.value = false; // DESTRAVA O BOTÃO SÓ NO FINAL
    }
};

const adicionarTelefone = () => municipe.value.telefones.push({ tipo: 'celular', numero: '' });
const removerTelefone = (i) => municipe.value.telefones.splice(i, 1);
const adicionarEmail = () => municipe.value.emails.push({ tipo: 'pessoal', email: '' });
const removerEmail = (i) => municipe.value.emails.splice(i, 1);

function adicionarPerfil() {
  if (!municipe.value.perfis) municipe.value.perfis = [];
  const lista = contasParaPerfil.value;
  const primeiraConta = lista?.length ? lista[0].id : null;
  municipe.value.perfis.push({
    conta: primeiraConta,
    categoria: null,
    cargo: '',
    instituicao: '',
    departamento: '',
    tratamento: '',
    ativo: true
  });
}
function removerPerfil(i) {
  municipe.value.perfis.splice(i, 1);
}

const buscarCep = async () => {
    const cep = municipe.value.endereco.cep?.replace(/\D/g, '');
    if (cep?.length === 8) {
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            if (!data.erro) {
                municipe.value.endereco.logradouro = data.logradouro;
                municipe.value.endereco.bairro = data.bairro;
            }
        } catch (e) { console.error(e); }
    }
};

const formatarTelefone = (index) => {
    let numero = municipe.value.telefones[index].numero.replace(/\D/g, '');
    if (numero.length === 11) municipe.value.telefones[index].numero = `(${numero.substring(0, 2)}) ${numero.substring(2, 7)}-${numero.substring(7)}`;
    else if (numero.length === 10) municipe.value.telefones[index].numero = `(${numero.substring(0, 2)}) ${numero.substring(2, 6)}-${numero.substring(6)}`;
};
</script>