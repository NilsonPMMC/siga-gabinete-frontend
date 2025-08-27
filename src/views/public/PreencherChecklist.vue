<template>
    <div class="page-container">
        <Toast />

        <div v-if="loading" class="card text-center">
            <ProgressSpinner />
            <p>Carregando formulário...</p>
        </div>
        <div v-else-if="error" class="card">
             <Message severity="error" :closable="false">{{ error }}</Message>
        </div>
        <div v-else-if="success" class="card text-center">
            <i class="pi pi-check-circle" style="font-size: 3rem; color: var(--green-500);"></i>
            <h3 class="mt-3">Checklist Enviado com Sucesso!</h3>
            <p>Obrigado pela sua colaboração.</p>
        </div>

        <div class="card" v-else-if="checklist">
            <div class="text-center mb-4">
                <h3 class="font-bold text-2xl">Checklist do Evento</h3>
                <p class="text-xl text-600">{{ checklist.evento.nome }}</p>
            </div>
            
            <div class="field mb-4">
                <label for="responsavel" class="font-semibold block mb-2">Seu Nome Completo *</label>
                <InputText id="responsavel" v-model="nomeResponsavel" class="w-full" :class="{ 'p-invalid': submitted && !nomeResponsavel }" />
                <small v-if="submitted && !nomeResponsavel" class="p-error">Por favor, informe seu nome.</small>
            </div>

            <p class="mb-3">Selecione os itens necessários para o evento e adicione as informações correspondentes.</p>

            <DataTable :value="tabelaItens" v-model:selection="itensSelecionados" dataKey="master_id" responsiveLayout="scroll">
                <Column selectionMode="multiple" headerStyle="width: 3.5em"></Column>
                <Column field="nome" header="Item"></Column>
                
                <Column field="observacoes" header="Observações/Dados" style="width: 60%">
                    <template #body="slotProps">
                        <Textarea 
                            v-model="slotProps.data.observacoes" 
                            :disabled="!isSelecionado(slotProps.data)" 
                            placeholder="Selecione o item para editar" 
                            rows="2" 
                            class="w-full" 
                        />
                    </template>
                </Column>
            </DataTable>

            <Button label="Enviar Checklist" @click="enviarFormulario" :loading="submitting" class="mt-4 w-full" icon="pi pi-send" />
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import eventosService from '@/services/eventos';

// Importação dos componentes PrimeVue
import ProgressSpinner from 'primevue/progressspinner';
import Message from 'primevue/message';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Checkbox from 'primevue/checkbox';
import Textarea from 'primevue/textarea';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Toast from 'primevue/toast';

const route = useRoute();
const toast = useToast();
const token = route.params.token;

// Estado
const loading = ref(true);
const submitting = ref(false);
const submitted = ref(false);
const error = ref(null);
const success = ref(false);
const checklist = ref(null);
const nomeResponsavel = ref('');
const tabelaItens = ref([]);
const itensSelecionados = ref([]); // Itens que o usuário externo seleciona na tela

// --- Carregamento dos Dados ---
onMounted(async () => {
    try {
        // Buscamos o checklist para pegar o nome do evento e validar o token
        const publicChecklistResponse = await eventosService.getPublicChecklist(token);
        // E também a lista completa de itens mestre para exibir
        const masterItemsResponse = await eventosService.getMasterChecklistItems();

        if (!publicChecklistResponse || !publicChecklistResponse.data) {
           throw new Error("Checklist não encontrado ou link inválido.");
        }
        checklist.value = publicChecklistResponse.data;
        
        // A tabela é populada com TODOS os itens mestres, começando desmarcada
        tabelaItens.value = masterItemsResponse.data.map(itemMestre => ({
            master_id: itemMestre.id,
            nome: itemMestre.nome,
            observacoes: '', // Começa vazia
        }));

    } catch (err) {
        console.error("Erro ao carregar dados:", err);
        error.value = "Não foi possível carregar o formulário. O link pode ser inválido ou ter expirado.";
    } finally {
        loading.value = false;
    }
});

// --- Lógica de Ações ---
const isSelecionado = (item) => itensSelecionados.value.some(sel => sel.master_id === item.master_id);

const enviarFormulario = async () => {
    submitted.value = true;
    if (!nomeResponsavel.value) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Por favor, informe seu nome.', life: 3000 });
        return;
    }
    if (itensSelecionados.value.length === 0) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione ao menos um item do checklist.', life: 3000 });
        return;
    }

    submitting.value = true;
    error.value = null;

    // O payload é construído APENAS com os itens que o usuário selecionou na tela
    const payload = {
        nome_responsavel: nomeResponsavel.value,
        items: itensSelecionados.value.map(item => ({
            master_id: item.master_id, // Enviamos o ID do item mestre
            observacoes: item.observacoes || ''
        }))
    };

    try {
        // Precisamos de um novo método no backend para lidar com a criação de itens
        // Vamos usar o 'submitChecklist' e ajustar o backend para aceitar este formato
        await eventosService.submitChecklist(token, payload);
        success.value = true;
    } catch (err) {
        error.value = 'Houve um erro ao enviar o formulário. Tente novamente.';
        console.error(err);
    } finally {
        submitting.value = false;
    }
};
</script>

<style scoped>
/* Estilos para o container da página e o cabeçalho */
.page-container {
    padding: 2rem;
}
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
}
</style>