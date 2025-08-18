<template>
    <div class="public-form-container">
        <div class="card" v-if="checklist.id">
            <h3>Checklist do Evento: {{ checklist.evento_nome }}</h3>
            <div class="field">
                <label for="responsavel">Seu Nome*</label>
                <InputText id="responsavel" v-model="nomeResponsavel" />
            </div>
            <div v-for="item in checklist.itens_status" :key="item.id" class="checklist-item">
                <div class="flex align-items-center">
                    <Checkbox v-model="item.concluido" :binary="true" :inputId="'item_' + item.id" />
                    <label :for="'item_' + item.id" class="ml-2">{{ item.item_mestre.nome }}</label>
                </div>
                <Textarea v-if="item.concluido" v-model="item.observacoes" placeholder="Adicionar observações..." rows="2" class="mt-2" />
            </div>
            <Button label="Enviar Checklist" @click="enviar" class="mt-4 w-full" />
        </div>
        </div>
</template>

<script setup>
// Lógica para buscar o checklist pelo token da rota,
// e a função 'enviar' que chama o serviço 'submitChecklist'.
</script>