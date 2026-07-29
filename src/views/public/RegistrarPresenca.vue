<template>
    <div class="public-form-container">
        <Toast />
        <div class="card">
            <div v-if="loading" class="text-center">
                <ProgressSpinner />
            </div>

            <div v-else-if="error" class="card">
                <Message severity="error" :closable="false">{{ error }}</Message>
            </div>
            <div v-else-if="success" class="card text-center">
                <i class="pi pi-check-circle" style="font-size: 3rem; color: var(--green-500);"></i>
                <h3 class="mt-3">Presença Registrada com Sucesso!</h3>
                <p>Obrigado pela sua participação.</p>
            </div>

            <div v-else-if="evento.nome">
                <div class="form-header flex justify-content-between align-items-center mb-5">
                    <img v-if="evento.logo_url" :src="evento.logo_url" alt="Logo" style="height: 50px;" />
                    <img v-if="evento.brasao_url" :src="evento.brasao_url" alt="Brasão" style="height: 50px;" />
                </div>

                <div class="text-center mb-5">
                    <h2 class="mb-1">Registro de Presença</h2>
                    <p class="text-xl font-bold">{{ evento.nome }}</p>
                    <small>{{ evento.data }}</small>
                </div>

                <div class="p-fluid">
                    <div class="field">
                        <label for="nome">Nome Completo*</label>
                        <InputText id="nome" v-model="form.nome_completo" />
                    </div>
                    
                    <div class="field">
                        <label for="nascimento">Data de Nascimento (DD/MM)</label>
                        <InputMask id="nascimento" v-model="form.data_nascimento" mask="99/99" />
                    </div>
                    
                    <div class="field">
                        <label for="telefone">Celular com DDD*</label>
                        <InputMask id="telefone" v-model="form.telefone" mask="(99) 99999-9999" />
                    </div>

                    <div class="field">
                        <label for="orgao">Instituição / Órgão</label>
                        <InputText id="orgao" v-model="form.orgao" />
                    </div>

                    <div class="field">
                        <label for="email">E-mail*</label>
                        <InputText id="email" v-model="form.email" type="email" />
                    </div>
                    
                    <Message v-if="submitError" severity="error" class="mt-3" :closable="false">{{ submitError }}</Message>

                    <Button label="Registrar Presença" class="w-full mt-4" @click="registrar" :loading="submitting" />
                </div>
            </div>
            
            <div v-else class="text-center">
                <Message severity="error">{{ erro }}</Message>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiClient from '@/api';
import { useToast } from 'primevue/usetoast';
// Imports dos componentes PrimeVue
import InputText from 'primevue/inputtext';
import InputMask from 'primevue/inputmask';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import Message from 'primevue/message';
import Toast from 'primevue/toast';

const props = defineProps({
    contaId: { type: String, required: true }
});

const toast = useToast();
const loading = ref(true);
const submitting = ref(false);
const error = ref(null);
const submitError = ref('');
const success = ref(false);
const evento = ref({});
const erro = ref('');

const form = ref({
    nome_completo: '',
    data_nascimento: '',
    telefone: '',
    orgao: '',
    email: ''
});

const limparFormulario = () => {
    form.value = { nome_completo: '', data_nascimento: '', telefone: '', orgao: '', email: '' };
};

const extrairErroApi = (err, fallback) => {
    const data = err.response?.data;
    if (typeof data === 'string' && data.trim()) {
        return data.trim();
    }
    if (data && typeof data === 'object') {
        return data.error || data.detail || data.status || data.message || fallback;
    }
    return fallback;
};

onMounted(async () => {
    try {
        const response = await apiClient.get(`/api/public/check-in/${props.contaId}/`);
        evento.value = {
            id: response.data.evento_id,
            nome: response.data.evento_nome,
            data: response.data.evento_data,
            logo_url: response.data.logo_url,
            brasao_url: response.data.brasao_url,
        };
    } catch (err) {
        erro.value = err.response?.data?.error || 'Não foi possível carregar o evento.';
    } finally {
        loading.value = false;
    }
});

const registrar = async () => {
    if (!form.value.nome_completo || !form.value.telefone || !form.value.email) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Nome, telefone e e-mail são obrigatórios.' });
        return;
    }

    submitting.value = true;
    submitError.value = '';
    try {
        const response = await apiClient.post(`/api/public/check-in/${props.contaId}/`, form.value);
        const mensagem = response.data?.status;
        if (mensagem && mensagem.toLowerCase().includes('já foi registrada')) {
            toast.add({ severity: 'info', summary: 'Presença confirmada', detail: mensagem, life: 6000 });
        }
        success.value = true;
    } catch (err) {
        const detail = extrairErroApi(err, 'Não foi possível registrar a presença. Tente novamente.');
        submitError.value = detail;
        toast.add({ severity: 'error', summary: 'Erro no registro', detail, life: 8000 });
        console.error(err);
    } finally {
        submitting.value = false;
    }
};
</script>

<style scoped>
.public-form-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background-color: var(--surface-ground);
    padding: 1rem;
}
.card {
    width: 100%;
    max-width: 450px;
}
</style>