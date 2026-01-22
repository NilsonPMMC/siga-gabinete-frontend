<script setup>
import { ref } from 'vue';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';

// Emite o arquivo final processado (Blob) para o componente pai
const emit = defineEmits(['foto-salva']);

const cameraInput = ref(null);
const showCropper = ref(false);
const imageSrc = ref(null);
const cropperRef = ref(null); // Referência para a instância do cropper
const isProcessing = ref(false);

// 1. Captura a imagem da câmera ou arquivo
const onFileSelected = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        // Converte para URL temporária para exibir no editor
        imageSrc.value = URL.createObjectURL(file);
        showCropper.value = true;
    }
    // Reseta o input para permitir selecionar a mesma foto se errar
    event.target.value = ''; 
};

// 2. Processa o recorte
const salvarRecorte = () => {
    if (!cropperRef.value) return;
    isProcessing.value = true;

    const { canvas } = cropperRef.value.getResult();
    
    // Redimensiona (ex: máx 600x600) e comprime (JPEG 80% qualidade)
    // Isso garante que a foto fique leve para o banco de dados
    canvas.toBlob((blob) => {
        // Emite o arquivo final já processado
        emit('foto-salva', blob); 
        
        // Limpa e fecha
        showCropper.value = false;
        imageSrc.value = null;
        isProcessing.value = false;
    }, 'image/jpeg', 0.8);
};

// Função auxiliar para acionar o input escondido
const abrirCamera = () => {
    cameraInput.value.click();
}

// Expõe a função para ser chamada pelo pai se necessário (opcional)
defineExpose({ abrirCamera });
</script>

<template>
    <div class="foto-capture-container">
        
        <input 
            type="file" 
            ref="cameraInput" 
            accept="image/*" 
            capture="user"
            class="hidden" 
            @change="onFileSelected"
        />

        <Dialog 
            v-model:visible="showCropper" 
            header="Ajustar Foto" 
            modal 
            class="p-fluid"
            :style="{ width: '95vw', maxWidth: '500px' }"
            :closable="!isProcessing"
            :closeOnEscape="!isProcessing"
            appendTo="body"
        >
            <div class="crop-container flex justify-content-center bg-black-alpha-90" v-if="imageSrc">
                <Cropper
                    ref="cropperRef"
                    class="cropper-wrapper"
                    :src="imageSrc"
                    :stencil-props="{ aspectRatio: 1/1 }" 
                    :resize-image="{ adjustStencil: false }"
                    image-class="cropper-image"
                />
                </div>

            <template #footer>
                <div class="flex gap-2 mt-3">
                    <Button label="Cancelar" icon="pi pi-times" text @click="showCropper = false" :disabled="isProcessing" class="flex-1" severity="secondary" />
                    <Button label="Confirmar Foto" icon="pi pi-check" @click="salvarRecorte" :loading="isProcessing" class="flex-1" />
                </div>
            </template>
        </Dialog>

    </div>
</template>

<style>
/* Estilos globais necessários para o cropper funcionar bem no modal */
.cropper-wrapper {
    height: 400px; /* Altura fixa para a área de recorte */
    width: 100%;
    background: #333;
}
.cropper-image {
    max-width: 100%;
    max-height: 100%;
}
.hidden {
    display: none;
}
</style>