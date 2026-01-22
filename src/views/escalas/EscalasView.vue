<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";
import { useAuthStore } from '@/stores/auth';
import { useConfirm } from "primevue/useconfirm";
import ProgressBar from 'primevue/progressbar';
import EscalaFormModal from '@/components/escalas/EscalaFormModal.vue';

const toast = useToast();
const authStore = useAuthStore();
const confirm = useConfirm();

// Estados
const periodos = ref([]);
const periodoSelecionado = ref(null);
const contasObrigatorias = ref([]);
const registros = ref([]);
const isLoading = ref(true);

// Modal
const showModal = ref(false);
const registroParaEditar = ref(null);

const showEmergencia = ref(false);
const contatosEmergencia = ref([]);

// Dados do Usuário
const usuarioContasIds = computed(() => {
    // Gestores veem tudo (retorna null para indicar "sem filtro")
    if (authStore.user?.is_superuser || authStore.user?.groups?.includes('Gestor de Escalas')) {
        return null;
    }

    const contas = authStore.user?.perfil?.contas;
    
    if (contas && contas.length > 0) {
        // DEBUG: Vamos ver o que tem aqui
        console.log("DEBUG - Contas do Usuário (Raw):", contas);

        // Se o primeiro item for número, é uma lista de IDs [1, 2]
        if (typeof contas[0] === 'number') {
            return contas; 
        }
        // Se tiver propriedade id, é objeto [{id:1}, {id:2}]
        if (contas[0].id) {
            return contas.map(c => c.id);
        }
    }
    return [];
});

const isGestor = computed(() => 
    authStore.user?.is_superuser || 
    authStore.user?.groups?.includes('Gestor de Escalas')
);

onMounted(async () => {
    await carregarPeriodos();
    // Carrega a lista de secretarias que PRECISAM fazer escala (Esqueleto do Dashboard)
    await carregarContasObrigatorias();
    
    if (periodos.value.length > 0) {
        periodoSelecionado.value = periodos.value[0].id; // Seleciona o mais recente
    }
});

// Recarrega registros sempre que mudar o período
watch(periodoSelecionado, () => {
    if (periodoSelecionado.value) carregarRegistros();
});

const carregarPeriodos = async () => {
    try {
        const res = await apiClient.get('/api/escalas/periodos/?ativo=true');
        periodos.value = res.data;
    } catch (e) {
        console.error(e);
    }
};

const carregarContasObrigatorias = async () => {
    try {
        // Busca apenas as contas marcadas com participa_escala=True
        const res = await apiClient.get('/api/contas/?participa_escala=true');
        contasObrigatorias.value = res.data;
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar estrutura de secretarias.', life: 3000 });
    }
};

const carregarRegistros = async () => {
    isLoading.value = true;
    try {
        const res = await apiClient.get('/api/escalas/registros/', {
            params: { periodo: periodoSelecionado.value }
        });
        registros.value = res.data;
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar plantões.', life: 3000 });
    } finally {
        isLoading.value = false;
    }
};

const carregarEmergencia = async () => {
    try {
        const res = await apiClient.get('/api/escalas/emergencia/');
        contatosEmergencia.value = res.data;
        showEmergencia.value = true; // Abre a sidebar
    } catch (e) {
        console.error(e);
    }
};

// --- A MÁGICA: TRANSFORMA LISTAS EM DASHBOARD ---
const dashboardData = computed(() => {
    // Se não carregou a estrutura, retorna vazio
    if (!contasObrigatorias.value.length) return [];

    let contasBase = contasObrigatorias.value;

    console.log("DEBUG - Todas Contas Obrigatorias:", contasBase.map(c => c.nome));
    console.log("DEBUG - IDs Permitidos para este usuário:", usuarioContasIds.value);

    // FILTRO DE PERMISSÃO
    if (usuarioContasIds.value !== null) {
        // Filtra mantendo apenas as contas que estão na lista de IDs do usuário
        contasBase = contasBase.filter(c => usuarioContasIds.value.includes(c.id));
    }

    console.log("DEBUG - Contas Visíveis Final:", contasBase.map(c => c.nome));

    return contasBase.map(conta => {
        const plantonistas = registros.value.filter(r => r.conta === conta.id);
        return {
            conta: conta,
            plantonistas: plantonistas,
            status: plantonistas.length > 0 ? 'ok' : 'pendente'
        };
    });
});

const porcentagemConformidade = computed(() => {
    if (dashboardData.value.length === 0) return 0;
    const ok = dashboardData.value.filter(d => d.status === 'ok').length;
    return Math.round((ok / dashboardData.value.length) * 100);
});

// --- AÇÕES ---

// Ajuste na função abrirModalCriacao para garantir que o ID passe
const abrirModalCriacao = (contaId = null) => {
    registroParaEditar.value = null;
    
    // Se veio o ID do clique no Card, usa ele.
    // Se não, tenta pegar a primeira conta do usuário como fallback.
    const idConta = contaId || (usuarioContasIds.value ? usuarioContasIds.value[0] : null);
    
    contaPreSelecionada.value = idConta;
    showModal.value = true;
};

const editarRegistro = (registro) => {
    registroParaEditar.value = registro.id;
    showModal.value = true;
};

const excluirRegistro = (id) => {
    confirm.require({
        message: 'Remover este servidor da escala?',
        header: 'Confirmar',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await apiClient.delete(`/api/escalas/registros/${id}/`);
                toast.add({ severity: 'success', summary: 'Removido', detail: 'Registro excluído.', life: 3000 });
                carregarRegistros();
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível excluir.', life: 3000 });
            }
        }
    });
};

const abrirWhatsApp = (numero) => {
    // Remove caracteres não numéricos
    const numLimpo = numero.replace(/\D/g, '');
    window.open(`https://wa.me/55${numLimpo}`, '_blank');
};

const cobrarSecretaria = (conta) => {
    const texto = `Olá! Consta pendente o preenchimento da Escala de Plantão (${periodos.value.find(p => p.id === periodoSelecionado.value)?.nome}) da ${conta.nome}. Poderia regularizar?`;
    navigator.clipboard.writeText(texto);
    toast.add({ severity: 'info', summary: 'Copiado', detail: 'Mensagem de cobrança copiada. Cole no WhatsApp do titular.', life: 4000 });
};

// Função de Cobrar por Email
const cobrarPorEmail = (conta) => {
    // Tenta achar o email do titular ou da conta
    // Ajuste conforme seu objeto Conta (pode ser conta.email ou conta.titular.email)
    const emailDestino = conta.email_titular || ''; 
    const assunto = `Pendente: Escala de Plantão (${periodos.value.find(p => p.id === periodoSelecionado.value)?.nome})`;
    const corpo = `Olá,\n\nConstatamos que a escala de plantão da ${conta.nome} para o período mencionado ainda não foi preenchida no sistema SIGA.\n\nPor favor, regularize o quanto antes.\n\nAtenciosamente,\nGabinete.`;
    
    // Abre o cliente de email padrão
    window.location.href = `mailto:${emailDestino}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
};

// Crie essa ref lá em cima junto com as outras
const contaPreSelecionada = ref(null);

// Função para abrir o PDF em nova aba
const gerarRelatorioPDF = () => {
    if (!periodoSelecionado.value) return;
    // URL direta para a View que criamos
    const url = `${apiClient.defaults.baseURL}/api/escalas/relatorio/${periodoSelecionado.value}/`;
    window.open(url, '_blank');
};
</script>

<template>
    <div class="page-container">
        <Toast />
        <ConfirmDialog />

        <div class="flex flex-column md:flex-row justify-content-between align-items-center mb-4 gap-3">
            <div>
                <h1 class="m-0 text-3xl">Escala de Plantão</h1>
            </div>
            <div class="flex gap-2">
                <Button 
                    label="Imprimir Escala" 
                    icon="pi pi-print" 
                    severity="secondary" 
                    @click="gerarRelatorioPDF" 
                    class="p-button-raised ml-2"
                />
                <Button 
                    label="Telefones Úteis" 
                    icon="pi pi-phone" 
                    severity="danger" 
                    @click="carregarEmergencia" 
                    class="p-button-raised"
                />
                <div class="flex gap-2 align-items-center bg-white p-3 border-round shadow-1">
                    <span class="font-bold">Período:</span>
                    <Dropdown 
                        v-model="periodoSelecionado" 
                        :options="periodos" 
                        optionLabel="nome" 
                        optionValue="id" 
                        placeholder="Selecione..." 
                        class="w-20rem"
                    />
                </div>
            </div>
        </div>

        <div v-if="isGestor && dashboardData.length > 0" class="mb-4">
            <div class="flex justify-content-between mb-1">
                <span class="text-sm font-bold text-600">Adesão das Secretarias</span>
                <span class="text-sm font-bold">{{ porcentagemConformidade }}%</span>
            </div>
            <ProgressBar 
                :value="porcentagemConformidade" 
                :showValue="false" 
                style="height: 10px;" 
                :class="{'bg-red-100': porcentagemConformidade < 50, 'bg-green-100': porcentagemConformidade >= 50}">
            </ProgressBar>
        </div>

        <div v-if="isLoading" class="text-center p-5">
            <ProgressSpinner />
        </div>

        <div v-else class="grid">
            <div v-for="item in dashboardData" :key="item.conta.id" class="col-12 md:col-6 lg:col-4">
                <Card class="h-full border-top-3 shadow-2" 
                    :class="{'border-green-500': item.status === 'ok', 'border-red-500': item.status === 'pendente'}">
                    
                    <template #title>
                        <div class="flex justify-content-between align-items-start">
                            <span class="text-xl font-bold text-800">{{ item.conta.nome }}</span>
                            <Tag :severity="item.status === 'ok' ? 'success' : 'danger'" :value="item.status === 'ok' ? 'OK' : 'PENDENTE'" />
                        </div>
                    </template>

                    <template #content>
                        <div v-if="item.status === 'pendente'" class="text-center py-4">
                            <i class="pi pi-exclamation-circle text-red-500 text-4xl mb-2"></i>
                            <p class="text-600">Nenhum plantonista informado.</p>
                            
                            <div class="flex justify-content-center gap-2 mt-3">
                                <Button v-if="isGestor" icon="pi pi-whatsapp" severity="success" rounded text @click="cobrarSecretaria(item.conta)" tooltip="Copiar Cobrança Zap" />
                                
                                <Button v-if="isGestor" icon="pi pi-envelope" severity="secondary" rounded text @click="cobrarPorEmail(item.conta)" tooltip="Cobrar por E-mail" />
                                
                                <Button v-if="!isGestor" label="Informar Agora" icon="pi pi-plus" size="small" @click="abrirModalCriacao(item.conta.id)" />
                            </div>
                        </div>

                        <div v-else class="flex flex-column gap-3">
                            <div v-for="plantao in item.plantonistas" :key="plantao.id" class="flex align-items-center p-2 surface-50 border-round">
                                <Avatar :image="plantao.foto_servidor" icon="pi pi-user" shape="circle" size="large" class="mr-3" />
                                <div class="flex-1 overflow-hidden">
                                    <div class="font-bold white-space-nowrap overflow-hidden text-overflow-ellipsis">{{ plantao.nome_servidor }}</div>
                                    <div class="text-sm text-600">{{ plantao.cargo_funcao_plantao || 'Plantonista' }}</div>
                                    <div class="text-sm text-primary font-bold mt-1">
                                        <i class="pi pi-phone text-xs"></i> {{ plantao.telefone_plantao }}
                                    </div>
                                </div>
                                <div class="flex flex-column gap-1">
                                    <Button 
                                        icon="pi pi-whatsapp" 
                                        text rounded severity="success" 
                                        size="small" 
                                        @click="abrirWhatsApp(plantao.telefone_plantao)" 
                                        tooltip="Chamar no Zap" 
                                    />
                                    
                                    <Button 
                                        icon="pi pi-pencil" 
                                        text rounded severity="secondary" 
                                        size="small" 
                                        @click="editarRegistro(plantao)" 
                                        tooltip="Editar dados"
                                    />

                                    <Button 
                                        icon="pi pi-trash" 
                                        text rounded severity="danger" 
                                        size="small" 
                                        @click="excluirRegistro(plantao.id)" 
                                        tooltip="Remover da escala"
                                    />
                                </div>
                            </div>
                            
                            <Button label="Adicionar Outro" icon="pi pi-plus" text size="small" class="w-full mt-2" @click="abrirModalCriacao(item.conta.id)" />
                        </div>
                    </template>
                </Card>
            </div>
            
            <div v-if="isGestor" class="col-12 md:col-6 lg:col-4">
                 <div class="h-full border-2 border-dashed surface-border border-round flex align-items-center justify-content-center p-5 cursor-pointer hover:surface-100 transition-duration-200" @click="abrirModalCriacao(null)">
                    <div class="text-center text-600">
                        <i class="pi pi-plus text-3xl mb-2"></i>
                        <div class="font-bold">Adicionar Avulso</div>
                        <div class="text-sm">Registrar plantão manualmente</div>
                    </div>
                 </div>
            </div>
        </div>

        <EscalaFormModal 
            v-model:visible="showModal" 
            :registroId="registroParaEditar" 
            :periodoId="periodoSelecionado" 
            :contaId="contaPreSelecionada"  :contasDisponiveis="contasObrigatorias"
            @saved="carregarRegistros"
        />
    </div>
    <Sidebar v-model:visible="showEmergencia" position="right" class="w-full md:w-30rem">
        <template #header>
            <div class="flex align-items-center gap-2">
                <i class="pi pi-exclamation-triangle text-red-500 text-2xl"></i>
                <h2 class="m-0 text-red-500">Contatos Primordiais</h2>
            </div>
        </template>

        <div class="flex flex-column gap-3 mt-2">
            <div v-for="contato in contatosEmergencia" :key="contato.id" class="surface-card p-3 shadow-2 border-round border-left-3 border-red-500">
                <div class="flex justify-content-between align-items-center">
                    <div>
                        <div class="font-bold text-xl text-900">{{ contato.nome }}</div>
                        <div class="text-600 text-sm" v-if="contato.descricao">{{ contato.descricao }}</div>
                    </div>
                    <div class="text-right">
                        <div class="font-bold text-lg text-primary mb-1">{{ contato.telefone }}</div>
                        <Button 
                            icon="pi pi-phone" 
                            rounded 
                            text 
                            severity="danger" 
                            @click="abrirWhatsApp(contato.telefone)" 
                            tooltip="Ligar/Copiar"
                        />
                    </div>
                </div>
            </div>
        </div>
    </Sidebar>
</template>

<style scoped>
.page-container { padding: 2rem; }
</style>