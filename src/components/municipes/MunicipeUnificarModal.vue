<script setup>
import { ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Message from 'primevue/message';
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
const isSimulating = ref(false);
const abaAtiva = ref(0);
const preview = ref(null);

// Se o modal abrir já com um "duplicado" selecionado na tela anterior
watch(() => props.duplicadoInicial, (val) => {
    if (val) {
        duplicado.value = val;
    }
}, { immediate: true });

watch([principal, duplicado], () => {
    preview.value = null;
});

watch(() => props.visible, (visivel) => {
    if (!visivel) {
        preview.value = null;
        abaAtiva.value = 0;
    }
});

const buscarMunicipes = async (event) => {
    if (!event.query.trim()) return;
    try {
        const params = { q: event.query };
        if (duplicado.value?.id) {
            params.exclude_id = duplicado.value.id;
        }
        const res = await apiClient.get('/api/municipes/lookup/', { params });
        sugestoes.value = res.data;
    } catch (e) { console.error(e); }
};

const simularFusao = async () => {
    if (!principal.value || !duplicado.value) return;

    if (principal.value.id === duplicado.value.id) {
        toast.add({ severity: 'warn', summary: 'Inválido', detail: 'Selecione munícipes diferentes.' });
        return;
    }

    isSimulating.value = true;
    preview.value = null;
    try {
        const res = await apiClient.post('/api/municipes/unificar/preview/', {
            id_principal: principal.value.id,
            id_duplicado: duplicado.value.id,
        });
        preview.value = res.data;
        abaAtiva.value = 1;

        if (res.data.bloqueios?.length) {
            toast.add({
                severity: 'error',
                summary: 'Simulação bloqueada',
                detail: res.data.bloqueios[0],
            });
        } else {
            toast.add({
                severity: 'info',
                summary: 'Simulação concluída',
                detail: `${res.data.links_migrados} vínculo(s) serão transferidos.`,
            });
        }
    } catch (error) {
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Falha ao simular a unificação.' });
    } finally {
        isSimulating.value = false;
    }
};

const executarFusao = () => {
    if (!principal.value || !duplicado.value || !preview.value?.pode_unificar) return;

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

                principal.value = null;
                duplicado.value = null;
                preview.value = null;
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
        :style="{ width: '780px' }"
        class="p-fluid"
    >
        <TabView v-model:activeIndex="abaAtiva">
            <TabPanel header="Seleção">
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

                <div class="flex justify-content-end mt-3">
                    <Button
                        label="Simular unificação"
                        icon="pi pi-search"
                        @click="simularFusao"
                        :loading="isSimulating"
                        :disabled="!principal || !duplicado"
                    />
                </div>
            </TabPanel>

            <TabPanel header="Simulação" :disabled="!preview">
                <div v-if="preview">
                    <Message v-for="(bloq, idx) in preview.bloqueios" :key="'b'+idx" severity="error" class="mb-2">
                        {{ bloq }}
                    </Message>
                    <Message v-for="(aviso, idx) in preview.avisos" :key="'a'+idx" severity="warn" class="mb-2">
                        {{ aviso }}
                    </Message>

                    <div class="surface-ground p-3 border-round mb-3">
                        <div class="font-bold mb-2">Resumo</div>
                        <div class="text-sm">
                            <div><strong>Herdeiro:</strong> {{ preview.principal.nome_completo }} (ID {{ preview.principal.id }})</div>
                            <div><strong>Duplicado excluído:</strong> {{ preview.duplicado.nome_completo }} (ID {{ preview.duplicado.id }})</div>
                            <div class="mt-2"><strong>Total de vínculos transferidos:</strong> {{ preview.links_migrados }}</div>
                        </div>
                    </div>

                    <div v-if="preview.dados_herdados" class="mb-3">
                        <div class="font-bold mb-2">Dados que serão herdados</div>
                        <ul class="m-0 pl-3 text-sm">
                            <li v-if="preview.dados_herdados.cpf">CPF: {{ preview.dados_herdados.cpf }}</li>
                            <li v-if="preview.dados_herdados.matricula_rh">Matrícula RH: {{ preview.dados_herdados.matricula_rh }}</li>
                            <li v-if="preview.dados_herdados.foto">Foto do duplicado</li>
                            <li v-if="preview.dados_herdados.telefones_adicionados?.length">
                                {{ preview.dados_herdados.telefones_adicionados.length }} telefone(s) adicional(is)
                            </li>
                            <li v-if="preview.dados_herdados.emails_adicionados?.length">
                                {{ preview.dados_herdados.emails_adicionados.length }} e-mail(s) adicional(is)
                            </li>
                            <li v-if="!preview.dados_herdados.cpf && !preview.dados_herdados.matricula_rh && !preview.dados_herdados.foto && !preview.dados_herdados.telefones_adicionados?.length && !preview.dados_herdados.emails_adicionados?.length">
                                Nenhum dado complementar será copiado.
                            </li>
                        </ul>
                    </div>

                    <div v-if="preview.vinculos_transferir?.length" class="mb-3">
                        <div class="font-bold mb-2 text-green-700">Vínculos a transferir</div>
                        <ul class="m-0 pl-3 text-sm">
                            <li v-for="grupo in preview.vinculos_transferir" :key="grupo.modelo">
                                {{ grupo.quantidade }} {{ grupo.nome }}
                            </li>
                        </ul>
                    </div>

                    <div v-if="preview.vinculos_descartar?.length" class="mb-3">
                        <div class="font-bold mb-2 text-orange-700">Vínculos descartados (conflito)</div>
                        <ul class="m-0 pl-3 text-sm">
                            <li v-for="grupo in preview.vinculos_descartar" :key="'d-'+grupo.modelo">
                                {{ grupo.quantidade }} {{ grupo.nome }} — {{ grupo.motivo }}
                            </li>
                        </ul>
                    </div>
                </div>
                <p v-else class="text-500 text-center py-4">
                    Execute a simulação na aba Seleção para ver o impacto da fusão.
                </p>
            </TabPanel>
        </TabView>

        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="emit('update:visible', false)" />
            <Button
                label="Unificar Registros"
                icon="pi pi-check"
                severity="danger"
                @click="executarFusao"
                :loading="isMerging"
                :disabled="!principal || !duplicado || !preview?.pode_unificar"
                v-tooltip.top="!preview ? 'Simule a unificação antes de confirmar' : (!preview.pode_unificar ? 'Corrija os bloqueios da simulação' : '')"
            />
        </template>
    </Dialog>
</template>
