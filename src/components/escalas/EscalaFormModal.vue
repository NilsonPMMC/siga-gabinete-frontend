<script setup>
import { ref, watch } from 'vue';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";

const props = defineProps({
    visible: Boolean,
    registroId: Number, // Se vier ID, é edição
    periodoId: Number,  // Obrigatório na criação
    contaId: Number,    // Pré-selecionado se o usuário for da secretaria
    contasDisponiveis: Array // Para o Gabinete poder escolher a secretaria
});

const emit = defineEmits(['update:visible', 'saved']);
const toast = useToast();

const form = ref({
    periodo: null,
    conta: null,
    servidor: null, // Objeto completo do munícipe
    telefone_plantao: '',
    cargo_funcao_plantao: '',
    observacao: ''
});

const isLoading = ref(false);
const sugestoesServidores = ref([]);

// Monitora abertura para limpar ou carregar dados
watch(() => props.visible, async (newVal) => {
    if (newVal) {
        if (props.registroId) {
            await carregarRegistro(props.registroId);
        } else {
            limparForm();
            form.value.periodo = props.periodoId;
            
            // SE VIER CONTA PRE-SELECIONADA (Do Card), TRAVA NELA
            if (props.contaId) {
                form.value.conta = props.contaId;
            }
        }
    }
});

const limparForm = () => {
    form.value = {
        periodo: props.periodoId,
        conta: props.contaId || null,
        servidor: null,
        telefone_plantao: '',
        cargo_funcao_plantao: '',
        observacao: ''
    };
};

const carregarRegistro = async (id) => {
    isLoading.value = true;
    try {
        const res = await apiClient.get(`/api/escalas/registros/${id}/`);
        const dados = res.data;
        form.value = {
            ...dados,
            // Ajuste para o AutoComplete (precisa do objeto, mas o serializer pode ter mandado ID)
            // Aqui assumimos que seu serializer manda o ID no POST, mas para exibir precisamos do nome.
            // O ideal é carregar o objeto munícipe se vier só ID, mas vamos simplificar:
            servidor: { id: dados.servidor, nome_completo: dados.nome_servidor }, 
            conta: dados.conta
        };
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar registro.' });
        emit('update:visible', false);
    } finally {
        isLoading.value = false;
    }
};

const buscarServidor = async (event) => {
    try {
        // CORREÇÃO 1: Parâmetros limpos (sem aninhamento 'params: { params: ... }')
        const response = await apiClient.get('/api/escalas/servidores/lookup/', { 
            params: { q: event.query } 
        });

        // CORREÇÃO 2: O nome da variável é 'response', não 'res'
        sugestoesServidores.value = response.data; 
        
    } catch (error) {
        console.error("Erro na busca:", error);
        sugestoesServidores.value = []; // Limpa em caso de erro
    }
};

// Ao selecionar um servidor, preenche os dados
const aoSelecionarServidor = (evento) => {
    const municipe = evento.value;
    
    if (municipe) {
        // 1. Tenta pegar o telefone da lista de telefones do RH
        if (municipe.telefones && municipe.telefones.length > 0) {
            // Pega o primeiro (Principal)
            form.value.telefone_plantao = municipe.telefones[0].numero;
        } else {
            // Se não tiver, limpa para o usuário digitar
            form.value.telefone_plantao = '';
        }

        // 2. Tenta pegar o cargo
        if (municipe.cargo) {
            form.value.cargo_funcao_plantao = municipe.cargo;
        }
        
        // Dica visual para o usuário
        if (!form.value.telefone_plantao) {
            toast.add({ severity: 'info', summary: 'Atenção', detail: 'Este servidor não possui telefone cadastrado. Por favor, insira manualmente.', life: 5000 });
        }
    }
};

const salvar = async () => {
    if (!form.value.conta || !form.value.servidor || !form.value.telefone_plantao) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Preencha Secretaria, Servidor e Telefone.' });
        return;
    }

    isLoading.value = true;
    try {
        const payload = {
            ...form.value,
            servidor: form.value.servidor.id, // Envia só o ID
            periodo: props.periodoId
        };

        if (props.registroId) {
            await apiClient.put(`/api/escalas/registros/${props.registroId}/`, payload);
            toast.add({ severity: 'success', summary: 'Atualizado', detail: 'Escala atualizada.' });
        } else {
            await apiClient.post('/api/escalas/registros/', payload);
            toast.add({ severity: 'success', summary: 'Criado', detail: 'Servidor escalado com sucesso.' });
        }
        emit('saved');
        emit('update:visible', false);
    } catch (error) {
        const msg = error.response?.data?.detail || 'Erro ao salvar.';
        toast.add({ severity: 'error', summary: 'Erro', detail: msg });
    } finally {
        isLoading.value = false;
    }
};
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="emit('update:visible', $event)" 
        :header="registroId ? 'Editar Plantão' : 'Novo Plantão'" 
        modal 
        class="p-fluid" 
        :style="{ width: '500px' }"
    >
        <div class="field">
            <label>Secretaria / Órgão</label>
            <Dropdown 
                v-model="form.conta" 
                :options="contasDisponiveis" 
                optionLabel="nome" 
                optionValue="id" 
                placeholder="Selecione..." 
                :disabled="!!contaId || !!registroId" 
                filter
            />
        </div>

        <div class="field">
            <label>Servidor (Busca no RH)</label>
            <AutoComplete 
                v-model="form.servidor" 
                :suggestions="sugestoesServidores" 
                @complete="buscarServidor" 
                @item-select="aoSelecionarServidor"
                field="nome_completo" 
                dropdown
                placeholder="Digite o nome..."
            >
                <template #option="slotProps">
                    <div class="flex align-items-center">
                        <div>{{ slotProps.option.nome_completo }}</div>
                        <small class="ml-2 text-500" v-if="slotProps.option.cargo">({{ slotProps.option.cargo }})</small>
                    </div>
                </template>
            </AutoComplete>
        </div>

        <div class="field">
            <label>Telefone do Plantão (WhatsApp)</label>
            <InputMask v-model="form.telefone_plantao" mask="(99) 99999-9999" placeholder="(11) 9..." />
            <small>Este número será salvo no cadastro se for novo.</small>
        </div>
        <!--
        <div class="formgrid grid">
            
            <div class="field col-6">
                <label>Função no dia</label>
                <InputText v-model="form.cargo_funcao_plantao" placeholder="Ex: Motorista" />
            </div>
        </div>

        <div class="field">
            <label>Observação</label>
            <Textarea v-model="form.observacao" rows="2" />
        </div>
        -->
        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="emit('update:visible', false)" />
            <Button label="Salvar" icon="pi pi-check" @click="salvar" :loading="isLoading" />
        </template>
    </Dialog>
</template>