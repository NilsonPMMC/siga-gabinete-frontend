<script setup>
import { computed } from 'vue';

const props = defineProps({
    visible: Boolean,
    evento: Object // O objeto do evento clicado
});

const emit = defineEmits(['update:visible']);

// Formata data para ler fácil
const dataFormatada = computed(() => {
    if (!props.evento?.start) return '';
    const opcoes = { dateStyle: 'full', timeStyle: 'short' };
    const inicio = new Date(props.evento.start).toLocaleString('pt-BR', opcoes);
    
    if (props.evento.end) {
        const fim = new Date(props.evento.end).toLocaleTimeString('pt-BR', { timeStyle: 'short' });
        return `${inicio} às ${fim}`;
    }
    return inicio;
});

const getCorSituacao = (situacao) => {
    const map = {
        'AGENDADO': 'info',
        'CONCLUIDO': 'success',
        'CANCELADO': 'danger',
        'EM_ANDAMENTO': 'warning'
    };
    return map[situacao] || 'secondary';
};
</script>

<template>
    <Dialog 
        :visible="visible" 
        @update:visible="emit('update:visible', $event)"
        header="Detalhes do Compromisso" 
        modal 
        :style="{ width: '450px' }"
        class="p-fluid"
    >
        <div v-if="evento" class="flex flex-column gap-3">
            
            <div class="border-left-3 border-primary pl-3">
                <h2 class="text-xl font-bold m-0 text-900">{{ evento.title }}</h2>
                <div class="mt-2 text-600 flex align-items-center gap-2">
                    <i class="pi pi-clock"></i>
                    <span>{{ dataFormatada }}</span>
                </div>
            </div>

            <div class="flex gap-2">
                <Tag :value="evento.extendedProps?.situacao" :severity="getCorSituacao(evento.extendedProps?.situacao)" />
                <Tag v-if="evento.extendedProps?.confidencial" value="Confidencial" icon="pi pi-lock" severity="secondary" />
                <Tag :value="evento.extendedProps?.tipo_label || evento.extendedProps?.tipo" severity="info" />
            </div>

            <div v-if="evento.extendedProps?.descricao" class="surface-ground p-3 border-round">
                <span class="block font-bold mb-1 text-sm text-700">Descrição/Pauta:</span>
                <p class="m-0 text-700 line-height-3">{{ evento.extendedProps.descricao }}</p>
            </div>

            <div v-if="evento.extendedProps?.convidados?.length">
                <span class="block font-bold mb-2 text-sm text-700">Participantes:</span>
                <ul class="list-none p-0 m-0">
                    <li v-for="conv in evento.extendedProps.convidados" :key="conv.id" class="flex align-items-center py-2 border-bottom-1 surface-border">
                        <i class="pi pi-user mr-2 text-500"></i>
                        <span class="text-700">{{ conv.nome_municipe }}</span>
                    </li>
                </ul>
            </div>
        </div>

        <template #footer>
            <Button label="Fechar" icon="pi pi-times" @click="emit('update:visible', false)" text autofocus />
        </template>
    </Dialog>
</template>