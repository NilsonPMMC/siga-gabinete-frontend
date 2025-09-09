<template>
    <div class="grid">
        <div class="col-12">
            <div class="card">
                <h5>{{ isEditing ? 'Editar Lembrete' : 'Novo Lembrete' }}</h5>
                <form @submit.prevent="salvarLembrete">
                    <div class="p-fluid formgrid grid">
                        <div v-if="authStore.user?.is_superuser" class="field col-12">
                            <label for="conta">Conta/Gabinete*</label>
                            <Dropdown id="conta" v-model="lembrete.conta" :options="contas" optionLabel="nome" optionValue="id" placeholder="Selecione uma conta" :filter="true" required />
                        </div>

                        <div class="field col-12">
                            <label for="titulo">Título*</label>
                            <InputText id="titulo" v-model="lembrete.titulo" required />
                        </div>

                        <div class="field col-12">
                            <label for="conteudo">Conteúdo*</label>
                            <QuillEditor theme="snow" toolbar="full" contentType="html" v-model:content="lembrete.conteudo" style="min-height: 250px" />
                        </div>
                    </div>
                    <div class="d-flex justify-content-end mt-4">
                        <Button label="Cancelar" icon="pi pi-times" class="p-button-secondary me-2" @click="router.push('/lembretes')"></Button>
                        <Button type="submit" label="Salvar" icon="pi pi-check" class="p-button-primary"></Button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import api from '@/api';

import { QuillEditor } from '@vueup/vue-quill';
import '@vueup/vue-quill/dist/vue-quill.snow.css';

import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const authStore = useAuthStore();

const lembrete = ref({
    conta: null,
    titulo: '',
    conteudo: ''
});
const contas = ref([]);

const lembreteId = computed(() => route.params.id);
const isEditing = computed(() => !!lembreteId.value);

const fetchContas = async () => {
    // A busca de contas só é necessária para o superusuário
    if (authStore.user?.is_superuser) {
        try {
            const response = await api.get('/contas/');
            contas.value = response.data;
        } catch (error) {
            console.error('Erro ao buscar contas:', error);
            toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar a lista de contas.', life: 3000 });
        }
    }
};

const fetchLembrete = async () => {
    if (isEditing.value) {
        try {
            const response = await api.get(`/lembretes/${lembreteId.value}/`);
            lembrete.value = response.data;
        } catch (error) {
            console.error('Erro ao buscar dados do lembrete:', error);
            toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar o lembrete para edição.', life: 3000 });
            router.push('/lembretes');
        }
    }
};

const salvarLembrete = async () => {
    // Se o usuário NÃO for superuser, define a conta automaticamente
    if (!authStore.user?.is_superuser) {
        const userContas = authStore.userContas;
        if (userContas && userContas.length > 0) {
            lembrete.value.conta = userContas[0]; // Pega a primeira conta do perfil do usuário
        } else {
            toast.add({ severity: 'error', summary: 'Erro de Permissão', detail: 'Seu usuário não está vinculado a nenhuma conta.', life: 3000 });
            return;
        }
    }

    try {
        if (isEditing.value) {
            await api.put(`/lembretes/${lembreteId.value}/`, lembrete.value);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Lembrete atualizado!', life: 3000 });
        } else {
            await api.post('/lembretes/', lembrete.value);
            toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Lembrete criado!', life: 3000 });
        }
        router.push('/lembretes');
    } catch (error) {
        console.error('Erro ao salvar lembrete:', error);
        toast.add({ severity: 'error', summary: 'Erro', detail: 'Ocorreu um erro ao salvar o lembrete.', life: 3000 });
    }
};

onMounted(() => {
    fetchContas();
    fetchLembrete();
});
</script>

<style>
/* Estilos para o editor Quill se ajustar ao tema do PrimeVue */
.ql-editor {
    background-color: var(--surface-b);
    color: var(--text-color);
    min-height: 250px;
}
.ql-toolbar.ql-snow {
    border-radius: var(--border-radius) var(--border-radius) 0 0;
    border-color: var(--surface-d);
}
.ql-container.ql-snow {
    border-radius: 0 0 var(--border-radius) var(--border-radius);
    border-color: var(--surface-d);
}
</style>