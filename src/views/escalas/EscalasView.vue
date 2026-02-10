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
const isLoading = ref(false); // Começa false para não piscar antes da hora

// Modal
const showModal = ref(false);
const registroParaEditar = ref(null);
const contaPreSelecionada = ref(null);

const showEmergencia = ref(false);
const contatosEmergencia = ref([]);

// Dados do Usuário
const usuarioContasIds = computed(() => {
    if (authStore.user?.is_superuser || authStore.user?.groups?.includes('Gestor de Escalas')) {
        return null;
    }
    const contas = authStore.user?.perfil?.contas;
    if (contas && contas.length > 0) {
        if (typeof contas[0] === 'number') return contas; 
        if (contas[0].id) return contas.map(c => c.id);
    }
    return [];
});

const isGestor = computed(() => 
    authStore.user?.is_superuser || 
    authStore.user?.groups?.includes('Gestor de Escalas')
);

onMounted(async () => {
    // 1. Carrega estrutura básica (Esqueleto)
    await carregarContasObrigatorias();
    // 2. Carrega períodos e aciona a lógica do "Vigente"
    await carregarPeriodos();
});

// --- MONITORAMENTO DE MUDANÇA (CORREÇÃO DO PROBLEMA DE ATUALIZAÇÃO) ---
watch(periodoSelecionado, async (novoId) => {
    if (novoId) {
        // 1. Zera a lista visualmente (Cards ficam vermelhos/pendentes instantaneamente)
        registros.value = []; 
        
        // 2. Busca os dados do novo período
        await carregarRegistros(novoId);
    }
});
// --- LÓGICA DO "VIGENTE" (CORRIGIDA) ---
const carregarPeriodos = async () => {
    try {
        const res = await apiClient.get('/api/escalas/periodos/?ativo=true');
        
        // Garante ordenação cronológica
        const listaOrdenada = res.data.sort((a,b) => new Date(a.data_inicio) - new Date(b.data_inicio));
        periodos.value = listaOrdenada;

        selecionarVigenteAutomaticamente(listaOrdenada);
    } catch (e) {
        console.error(e);
    }
};

const selecionarVigenteAutomaticamente = (lista) => {
    if (!lista.length) return;

    const hoje = new Date();
    hoje.setHours(0,0,0,0); // Zera hora para comparar apenas datas

    // LÓGICA DO CLIENTE:
    // O "Vigente" é o primeiro período que ainda não acabou (Data Fim >= Hoje).
    // Isso pega o final de semana atual (se for sexta) ou o próximo (se for segunda).
    
    const proximo = lista.find(p => {
        const fim = new Date(p.data_fim);
        fim.setHours(23,59,59,999); // Considera até o último segundo do dia final
        return fim >= hoje;
    });

    if (proximo) {
        periodoSelecionado.value = proximo.id;
    } else {
        // Se todos já passaram, seleciona o último da lista (histórico recente)
        periodoSelecionado.value = lista[lista.length - 1].id;
    }
};

const getStatusPeriodo = (periodo) => {
    if (!periodo) return {};
    
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    
    const inicio = new Date(periodo.data_inicio);
    const fim = new Date(periodo.data_fim);
    fim.setHours(23,59,59,999);

    // Se já acabou
    if (fim < hoje) {
        return { label: 'ENCERRADO', severity: 'warning', icon: 'pi pi-history' };
    }
    
    // Se hoje está dentro (É o fim de semana do plantão)
    if (hoje >= inicio && hoje <= fim) {
        return { label: 'EM ANDAMENTO', severity: 'success', icon: 'pi pi-play' };
    }

    // Se é futuro (ex: Segunda-feira olhando para o próximo Sábado)
    // AQUI O PULO DO GATO: Se este for o periodoSelecionado (Vigente), marcamos visualmente
    if (periodo.id === periodoSelecionado.value) {
        return { label: 'PRÓXIMO VIGENTE', severity: 'info', icon: 'pi pi-calendar' };
    }

    return { label: 'FUTURO', severity: 'secondary', icon: 'pi pi-calendar-plus' };
};

// --- CARREGAMENTOS ---
const carregarContasObrigatorias = async () => {
    try {
        const res = await apiClient.get('/api/contas/?participa_escala=true');
        contasObrigatorias.value = res.data;
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar secretarias.' });
    }
};

const carregarRegistros = async (periodoId) => {
    // Se não passar ID (chamada manual), usa o selecionado
    const idParaBuscar = periodoId || periodoSelecionado.value;
    
    if (!idParaBuscar) return;

    isLoading.value = true;
    try {
        const res = await apiClient.get('/api/escalas/registros/', {
            params: { 
                periodo: idParaBuscar,
                // Timestamp evita cache agressivo do navegador
                _t: new Date().getTime() 
            }
        });
        registros.value = res.data;
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar plantões.' });
    } finally {
        isLoading.value = false;
    }
};

const carregarEmergencia = async () => {
    try {
        const res = await apiClient.get('/api/escalas/emergencia/');
        contatosEmergencia.value = res.data;
        showEmergencia.value = true;
    } catch (e) { console.error(e); }
};

// --- DASHBOARD DATA (COMPUTED) ---
const dashboardData = computed(() => {
    if (!contasObrigatorias.value.length) return [];

    let contasBase = contasObrigatorias.value;

    // Filtro de Permissão (Gestor vê tudo, Usuário vê suas contas)
    if (usuarioContasIds.value !== null) {
        contasBase = contasBase.filter(c => usuarioContasIds.value.includes(c.id));
    }

    return contasBase.map(conta => {
        // Cruza a estrutura de contas com os registros retornados
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
const abrirModalCriacao = (contaId = null) => {
    registroParaEditar.value = null;
    // Se o usuário clicou no botão geral, tenta adivinhar a conta dele
    const idConta = contaId || (usuarioContasIds.value ? usuarioContasIds.value[0] : null);
    contaPreSelecionada.value = idConta;
    showModal.value = true;
};

const editarRegistro = (registro) => {
    registroParaEditar.value = registro.id;
    // Precisamos passar a conta também para o modal saber qual travar
    contaPreSelecionada.value = registro.conta; 
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
                toast.add({ severity: 'success', summary: 'Removido', detail: 'Registro excluído.' });
                // Recarrega usando o ID que já está selecionado
                carregarRegistros(periodoSelecionado.value);
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao excluir.' });
            }
        }
    });
};

const abrirWhatsApp = (numero) => {
    if (!numero) return;
    const numLimpo = numero.replace(/\D/g, '');
    window.open(`https://wa.me/55${numLimpo}`, '_blank');
};

const cobrarSecretaria = (conta) => {
    const periodoNome = periodos.value.find(p => p.id === periodoSelecionado.value)?.nome || '';
    const texto = `Olá! Consta pendente o preenchimento da Escala de Plantão (${periodoNome}) da ${conta.nome}. Poderia regularizar?`;
    navigator.clipboard.writeText(texto);
    toast.add({ severity: 'info', summary: 'Copiado', detail: 'Mensagem copiada.' });
};

const cobrarPorEmail = (conta) => {
    const emailDestino = conta.email_titular || ''; 
    const periodoNome = periodos.value.find(p => p.id === periodoSelecionado.value)?.nome || '';
    const assunto = `Pendente: Escala de Plantão (${periodoNome})`;
    const corpo = `Olá,\n\nConstatamos que a escala de plantão da ${conta.nome} para o período mencionado ainda não foi preenchida.\n\nPor favor, regularize o quanto antes.`;
    window.location.href = `mailto:${emailDestino}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
};

const gerarRelatorioPDF = () => {
    if (!periodoSelecionado.value) return;
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
                <h1 class="m-0 text-3xl text-900">Escala de Plantão</h1>
                <p class="text-600 m-0">Gerencie os plantonistas das secretarias.</p>
            </div>
            
            <div class="flex flex-wrap gap-2 justify-content-end align-items-center">
                <Button 
                    label="Imprimir" 
                    icon="pi pi-print" 
                    severity="secondary" 
                    outlined
                    @click="gerarRelatorioPDF" 
                />
                <Button 
                    label="Telefones Úteis" 
                    icon="pi pi-phone" 
                    severity="help" 
                    outlined
                    @click="carregarEmergencia" 
                />
                
                <div class="flex flex-column sm:flex-row gap-2 align-items-center bg-white p-2 border-round shadow-1">
                    <span class="font-bold ml-2 text-700">Período:</span>
                    <Dropdown 
                        v-model="periodoSelecionado" 
                        :options="periodos" 
                        optionLabel="nome" 
                        optionValue="id" 
                        placeholder="Selecione..." 
                        class="w-20rem"
                    >
                        <template #value="slotProps">
                            <div v-if="slotProps.value" class="flex align-items-center justify-content-between w-full">
                                <span>{{ periodos.find(p => p.id === slotProps.value)?.nome }}</span>
                                <Tag 
                                    v-if="periodos.find(p => p.id === slotProps.value)"
                                    :value="getStatusPeriodo(periodos.find(p => p.id === slotProps.value)).label" 
                                    :severity="getStatusPeriodo(periodos.find(p => p.id === slotProps.value)).severity" 
                                    class="ml-2 text-xs" 
                                />
                            </div>
                            <span v-else>{{ slotProps.placeholder }}</span>
                        </template>

                        <template #option="slotProps">
                            <div class="flex align-items-center justify-content-between w-full">
                                <span>{{ slotProps.option.nome }}</span>
                                <Tag 
                                    :value="getStatusPeriodo(slotProps.option).label" 
                                    :severity="getStatusPeriodo(slotProps.option).severity" 
                                    :icon="getStatusPeriodo(slotProps.option).icon"
                                    class="ml-2 text-xs"
                                />
                            </div>
                        </template>
                    </Dropdown>
                </div>
            </div>
        </div>

        <div v-if="isGestor && dashboardData.length > 0" class="mb-4 surface-card p-3 border-round shadow-1">
            <div class="flex justify-content-between mb-2">
                <span class="font-bold text-700">Adesão das Secretarias</span>
                <span class="font-bold text-primary">{{ porcentagemConformidade }}%</span>
            </div>
            <ProgressBar 
                :value="porcentagemConformidade" 
                :showValue="false" 
                style="height: 12px;" 
                :class="{'bg-red-100': porcentagemConformidade < 50, 'bg-green-100': porcentagemConformidade >= 50}">
            </ProgressBar>
        </div>

        <div v-if="isLoading" class="text-center p-6">
            <ProgressSpinner />
            <div class="text-600 mt-2">Carregando plantões...</div>
        </div>

        <div v-else class="grid">
            <div v-for="item in dashboardData" :key="`${item.conta.id}_${periodoSelecionado}`" class="col-12 md:col-6 lg:col-4 xl:col-3">
                <Card class="h-full border-top-3 shadow-2 transition-duration-200 hover:shadow-4 surface-card" 
                    :class="{'border-green-500': item.status === 'ok', 'border-red-500': item.status === 'pendente'}">
                    
                    <template #title>
                        <div class="flex justify-content-between align-items-start mb-2">
                            <span class="text-lg font-bold text-900 line-height-3" style="min-height: 3rem;">{{ item.conta.nome }}</span>
                            <i v-if="item.status === 'ok'" class="pi pi-check-circle text-green-500 text-xl"></i>
                            <i v-else class="pi pi-exclamation-circle text-red-500 text-xl"></i>
                        </div>
                    </template>

                    <template #content>
                        <div v-if="item.status === 'pendente'" class="text-center py-3">
                            <p class="text-600 mb-3 text-sm">Escala não informada.</p>
                            
                            <div class="flex justify-content-center gap-2">
                                <Button v-if="isGestor" icon="pi pi-whatsapp" severity="success" rounded text @click="cobrarSecretaria(item.conta)" tooltip="Cobrar via Zap" />
                                <Button v-if="isGestor" icon="pi pi-envelope" severity="secondary" rounded text @click="cobrarPorEmail(item.conta)" tooltip="Cobrar via Email" />
                                
                                <Button v-if="!isGestor" label="Informar" icon="pi pi-plus" size="small" @click="abrirModalCriacao(item.conta.id)" />
                            </div>
                        </div>

                        <div v-else class="flex flex-column gap-2">
                            <div v-for="plantao in item.plantonistas" :key="plantao.id" class="flex align-items-center p-2 surface-100 border-round hover:surface-200 transition-duration-100">
                                
                                <Avatar 
                                    :image="plantao.foto_servidor" 
                                    :label="!plantao.foto_servidor ? plantao.nome_servidor.charAt(0) : null"
                                    shape="circle" 
                                    class="mr-2 flex-shrink-0" 
                                />
                                
                                <div class="flex-1 overflow-hidden">
                                    <div class="font-bold text-sm white-space-nowrap overflow-hidden text-overflow-ellipsis text-900">{{ plantao.nome_servidor }}</div>
                                    <div class="text-xs text-600">{{ plantao.cargo_funcao_plantao || 'Plantonista' }}</div>
                                    <div class="text-xs text-primary font-bold mt-1">
                                        <i class="pi pi-whatsapp text-xs"></i> {{ plantao.telefone_plantao }}
                                    </div>
                                </div>

                                <div class="flex flex-column gap-1 ml-1">
                                    <Button icon="pi pi-phone" text rounded severity="success" size="small" style="width: 1.5rem; height: 1.5rem;" @click="abrirWhatsApp(plantao.telefone_plantao)" tooltip="Chamar" />
                                    <Button icon="pi pi-pencil" text rounded severity="secondary" size="small" style="width: 1.5rem; height: 1.5rem;" @click="editarRegistro(plantao)" tooltip="Editar" />
                                    <Button icon="pi pi-trash" text rounded severity="danger" size="small" style="width: 1.5rem; height: 1.5rem;" @click="excluirRegistro(plantao.id)" tooltip="Excluir" />
                                </div>
                            </div>
                            
                            <Button label="Adicionar Outro" icon="pi pi-plus" text size="small" class="w-full mt-1 text-primary" @click="abrirModalCriacao(item.conta.id)" />
                        </div>
                    </template>
                </Card>
            </div>
            
            <div v-if="isGestor" class="col-12 md:col-6 lg:col-4 xl:col-3">
                 <div class="h-full border-2 border-dashed surface-border border-round flex align-items-center justify-content-center p-5 cursor-pointer hover:surface-200 transition-duration-200" @click="abrirModalCriacao(null)">
                    <div class="text-center text-600">
                        <i class="pi pi-plus-circle text-4xl mb-2 text-primary"></i>
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
            :contaId="contaPreSelecionada" 
            :contasDisponiveis="contasObrigatorias"
            @saved="() => carregarRegistros(periodoSelecionado)"
        />
        
        <Sidebar v-model:visible="showEmergencia" position="right" class="w-full md:w-30rem">
            <template #header>
                <div class="flex align-items-center gap-2">
                    <i class="pi pi-phone text-red-500 text-2xl"></i>
                    <h2 class="m-0 text-red-500">Contatos Úteis</h2>
                </div>
            </template>
            <div class="flex flex-column gap-3 mt-4">
                <div v-for="contato in contatosEmergencia" :key="contato.id" class="surface-card p-3 shadow-2 border-round border-left-3 border-red-500">
                    <div class="flex justify-content-between align-items-center">
                        <div>
                            <div class="font-bold text-lg text-900">{{ contato.nome }}</div>
                            <div class="text-600 text-sm" v-if="contato.descricao">{{ contato.descricao }}</div>
                        </div>
                        <div class="text-right">
                            <div class="font-bold text-lg text-primary mb-1">{{ contato.telefone }}</div>
                            <Button icon="pi pi-copy" rounded text severity="secondary" @click="navigator.clipboard.writeText(contato.telefone)" />
                        </div>
                    </div>
                </div>
            </div>
        </Sidebar>
    </div>
</template>

<style scoped>
.page-container { padding: 2rem; background-color: var(--surface-ground); min-height: 100vh; }
</style>