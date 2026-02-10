<script setup>
import { ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import apiClient from '@/api';

const props = defineProps({
    visible: Boolean,
    duplicadoInicial: Object // O objeto munícipe que queremos eliminar (opcional)
});

const emit = defineEmits(['update:visible', 'merged']);

const toast = useToast();
const confirm = useConfirm();

const principal = ref(null);
const duplicado = ref(null);
const sugestoes = ref([]);
const isMerging = ref(false);

// Se o modal abrir já com um "duplicado" selecionado na tela anterior
watch(() => props.duplicadoInicial, (val) => {
    if (val) {
        duplicado.value = val;
    }
}, { immediate: true });

const buscarMunicipes = async (event) => {
    if (!event.query.trim()) return;
    try {
        const res = await apiClient.get('/api/municipes/lookup/', { params: { q: event.query } });
        sugestoes.value = res.data;
    } catch (e) { console.error(e); }
};

const executarFusao = () => {
    if (!principal.value || !duplicado.value) return;

    if (principal.value.id === duplicado.value.id) {
        toast.add({ severity: 'warn', summary: 'Inválido', detail: 'Selecione munícipes diferentes.' });
        return;
    }

    confirm.require({
        message: `ATENÇÃO: Você vai excluir permanentemente "${duplicado.value.nome_completo}" e passar todo seu histórico para "${principal.value.nome_completo}". Esta ação não pode ser desfeita.`,
        header: 'Confirmar Fusão',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            isMerging.value = true;
            try {
                const payload = {
                    id_principal: principal.value.id,
                    id_duplicado: duplicado.value.id
                };
                
                const res = await apiClient.post('/api/municipes/unificar/', payload);
                
                toast.add({ severity: 'success', summary: 'Sucesso', detail: `${res.data.links_migrados} vínculos transferidos.` });
                emit('merged');
                emit('update:visible', false);
                
                // Limpa
                principal.value = null;
                duplicado.value = null;
            } catch (error) {
                toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao unificar registros.' });
            } finally {
                isMerging.value = false;
            }
        }
    });
};
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="emit('update:visible', $event)"
        header="Unificar e Excluir Duplicatas" 
        modal 
        :style="{ width: '700px' }"
        class="p-fluid"
    >
        <div class="surface-ground p-4 border-round mb-4">
            <p class="m-0 text-700 line-height-3">
                <i class="pi pi-info-circle mr-2 text-primary"></i>
                Use esta ferramenta para corrigir duplicidades. O registro da <strong>DIREITA</strong> será excluído, e todos os seus atendimentos, agendas e visitas serão transferidos para o registro da <strong>ESQUERDA</strong>.
            </p>
        </div>

        <div class="grid align-items-center">
            <div class="col-5">
                <div class="text-center mb-2 font-bold text-green-600">
                    <i class="pi pi-check-circle mr-1"></i>
                    HERDEIRO (Vai Ficar)
                </div>
                <div class="p-3 border-2 border-green-100 surface-card border-round text-center">
                    <AutoComplete 
                        v-model="principal" 
                        :suggestions="sugestoes" 
                        @complete="buscarMunicipes" 
                        field="nome_completo" 
                        placeholder="Busque o correto..."
                        class="w-full"
                        forceSelection
                    >
                        <template #item="slotProps">
                            <div class="flex flex-column align-items-start">
                                <span class="font-bold">{{ slotProps.item.nome_completo }}</span>
                                <span class="text-sm text-500" v-if="slotProps.item.cpf">CPF: {{ slotProps.item.cpf }}</span>
                            </div>
                        </template>
                    </AutoComplete>
                    
                    <div v-if="principal" class="mt-3 text-sm text-left">
                        <div><strong>ID:</strong> {{ principal.id }}</div>
                        <div v-if="principal.cpf"><strong>CPF:</strong> {{ principal.cpf }}</div>
                        <div v-if="principal.email"><strong>Email:</strong> {{ principal.email }}</div>
                    </div>
                </div>
            </div>

            <div class="col-2 text-center">
                <i class="pi pi-arrow-left text-4xl text-500"></i>
                <div class="text-xs text-500 mt-1">Herda de</div>
            </div>

            <div class="col-5">
                <div class="text-center mb-2 font-bold text-red-600">
                    <i class="pi pi-trash mr-1"></i>
                    DUPLICADO (Será Excluído)
                </div>
                <div class="p-3 border-2 border-red-100 surface-card border-round text-center">
                    <AutoComplete 
                        v-model="duplicado" 
                        :suggestions="sugestoes" 
                        @complete="buscarMunicipes" 
                        field="nome_completo" 
                        placeholder="Busque o duplicado..."
                        class="w-full"
                        forceSelection
                    >
                         <template #item="slotProps">
                            <div class="flex flex-column align-items-start">
                                <span class="font-bold">{{ slotProps.item.nome_completo }}</span>
                                <span class="text-sm text-500">ID: {{ slotProps.item.id }}</span>
                            </div>
                        </template>
                    </AutoComplete>

                    <div v-if="duplicado" class="mt-3 text-sm text-left">
                        <div><strong>ID:</strong> {{ duplicado.id }}</div>
                        <div v-if="duplicado.cpf"><strong>CPF:</strong> {{ duplicado.cpf }}</div>
                        <div class="text-red-500 mt-2 font-bold text-center">SERÁ APAGADO</div>
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="emit('update:visible', false)" />
            <Button 
                label="Unificar Registros" 
                icon="pi pi-check" 
                severity="danger" 
                @click="executarFusao" 
                :loading="isMerging"
                :disabled="!principal || !duplicado" 
            />
        </template>
    </Dialog>
</template>