<template>
    <div class="page-container">
        <header class="page-header">
            </header>
        <main class="card">
            <h5>Link de Compartilhamento</h5>
            <p>Envie o link abaixo para o responsável preencher o checklist.</p>
            <div class="p-inputgroup">
                <InputText :value="shareableLink" readonly />
                <Button icon="pi pi-copy" @click="copiarLink" />
            </div>

            <h5 class="mt-4">Status do Checklist</h5>
            <DataTable :value="checklist.itens_status">
                <Column field="item_mestre.nome" header="Item"></Column>
                <Column header="Status">
                    <template #body="slotProps">
                        <i class="pi" :class="{'pi-check-circle text-green-500': slotProps.data.concluido, 'pi-times-circle text-gray-400': !slotProps.data.concluido}"></i>
                    </template>
                </Column>
                <Column field="observacoes" header="Observações"></Column>
            </DataTable>
            
            <Button label="Gerar Relatório (PDF)" icon="pi pi-file-pdf" class="p-button-danger mt-4" />
        </main>
    </div>
</template>

<script setup>
// Lógica para buscar o checklist com base no eventoId da rota,
// construir o shareableLink e exibir os dados na tabela.
</script>