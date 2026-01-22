<script setup>
import { ref, watch, onMounted } from 'vue';
import apiClient from '@/api';
import { useToast } from "primevue/usetoast";

const props = defineProps({
    visible: Boolean,
    contaId: Number // ID da conta que estamos gerenciando (Ex: Gabinete)
});

const emit = defineEmits(['update:visible']);
const toast = useToast();

const compartilhamentos = ref([]);
const usuariosDisponiveis = ref([]); // Lista para o AutoComplete
const usuarioSelecionado = ref(null);
const nivelSelecionado = ref('LEITURA');
const isLoading = ref(false);

const niveis = [
    { label: 'Apenas Visualizar', value: 'LEITURA' },
    { label: 'Pode Editar/Criar', value: 'ESCRITA' }
];

// Carrega a lista de quem JÁ tem acesso
const carregarCompartilhamentos = async () => {
    if (!props.contaId) return;
    isLoading.value = true;
    try {
        // Filtra os compartilhamentos desta conta específica
        const res = await apiClient.get(`/api/agenda-compartilhamentos/?conta_alvo=${props.contaId}`);
        compartilhamentos.value = res.data;
    } catch (error) {
        console.error(error);
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao carregar compartilhamentos.' });
    } finally {
        isLoading.value = false;
    }
};

// Busca usuários do sistema para adicionar (AutoComplete)
const buscarUsuarios = async (event) => {
    try {
        // Usa a API de usuarios que já ajustamos
        const query = event.query.toLowerCase();
        const res = await apiClient.get('/api/usuarios/');
        
        // Filtro local simples (ou via API se tiver ?q=)
        usuariosDisponiveis.value = res.data.filter(u => {
            const nome = (u.first_name || u.username).toLowerCase();
            return nome.includes(query);
        });
    } catch (error) {
        usuariosDisponiveis.value = [];
    }
};

const adicionarCompartilhamento = async () => {
    if (!usuarioSelecionado.value) return;

    try {
        await apiClient.post('/api/agenda-compartilhamentos/', {
            conta_alvo: props.contaId,
            usuario: usuarioSelecionado.value.id,
            nivel: nivelSelecionado.value
        });
        
        toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Acesso concedido.' });
        usuarioSelecionado.value = null; // Limpa seleção
        carregarCompartilhamentos(); // Recarrega lista
    } catch (error) {
        const msg = error.response?.data?.detail || 'Erro ao compartilhar.';
        toast.add({ severity: 'error', summary: 'Erro', detail: msg });
    }
};

const removerCompartilhamento = async (id) => {
    try {
        await apiClient.delete(`/api/agenda-compartilhamentos/${id}/`);
        toast.add({ severity: 'success', summary: 'Removido', detail: 'Acesso revogado.' });
        carregarCompartilhamentos();
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível remover.' });
    }
};

// Monitora abertura do modal
watch(() => props.visible, (newVal) => {
    if (newVal) {
        carregarCompartilhamentos();
    }
});
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="emit('update:visible', $event)"
        header="Compartilhar Agenda" 
        modal 
        :style="{ width: '800px' }"
        class="p-fluid"
    >
        <div class="mb-4">
            <p class="text-600 mb-3">Conceda acesso a outros usuários do sistema para visualizarem ou editarem esta agenda.</p>
            
            <div class="flex gap-2 align-items-end">
                <div class="flex-grow-1">
                    <label class="block mb-1 font-bold">Adicionar Usuário</label>
                    <AutoComplete 
                        v-model="usuarioSelecionado" 
                        :suggestions="usuariosDisponiveis" 
                        @complete="buscarUsuarios" 
                        field="username"
                        placeholder="Busque por nome ou login..."
                        forceSelection
                    >
                        <template #item="slotProps">
                            <div>
                                <span class="font-bold">{{ slotProps.item.first_name }}</span>
                                <span class="text-sm text-500 ml-2">({{ slotProps.item.username }})</span>
                            </div>
                        </template>
                    </AutoComplete>
                </div>
                
                <div style="width: 200px;">
                    <label class="block mb-1 font-bold">Nível de Acesso</label>
                    <Dropdown v-model="nivelSelecionado" :options="niveis" optionLabel="label" optionValue="value" />
                </div>
                
                <Button icon="pi pi-plus" @click="adicionarCompartilhamento" :disabled="!usuarioSelecionado" />
            </div>
        </div>

        <Divider />

        <h3 class="text-lg font-medium mb-3">Quem tem acesso</h3>
        
        <DataTable :value="compartilhamentos" :loading="isLoading" size="small" stripedRows>
            <Column field="nome_usuario" header="Usuário">
                <template #body="slotProps">
                    {{ slotProps.data.nome_usuario || slotProps.data.username }}
                </template>
            </Column>
            <Column field="nivel" header="Permissão">
                <template #body="slotProps">
                    <Tag :severity="slotProps.data.nivel === 'ESCRITA' ? 'warning' : 'info'" :value="slotProps.data.nivel" />
                </template>
            </Column>
            <Column class="w-4rem text-center">
                <template #body="slotProps">
                    <Button icon="pi pi-trash" text severity="danger" rounded @click="removerCompartilhamento(slotProps.data.id)" tooltip="Revogar Acesso" />
                </template>
            </Column>
            <template #empty>Ninguém. Apenas membros desta conta acessam.</template>
        </DataTable>

        <template #footer>
            <Button label="Fechar" icon="pi pi-check" @click="emit('update:visible', false)" text />
        </template>
    </Dialog>
</template>