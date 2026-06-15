<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import { Cropper } from 'vue-advanced-cropper';
import 'vue-advanced-cropper/dist/style.css';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import Message from 'primevue/message';

const emit = defineEmits(['foto-salva']);

const cameraInput = ref(null);
const videoRef = ref(null);
const showCamera = ref(false);
const showCropper = ref(false);
const imageSrc = ref(null);
const cropperRef = ref(null);
const isProcessing = ref(false);

const streamRef = ref(null);
const videoDevices = ref([]);
const selectedDeviceId = ref(null);
const cameraError = ref(null);
const isStartingCamera = ref(false);

function pararCamera() {
  if (streamRef.value) {
    streamRef.value.getTracks().forEach((t) => t.stop());
    streamRef.value = null;
  }
  if (videoRef.value) {
    videoRef.value.srcObject = null;
  }
}

async function listarCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  videoDevices.value = devices
    .filter((d) => d.kind === 'videoinput')
    .map((d, i) => ({
      label: d.label || `Câmera ${i + 1}`,
      value: d.deviceId,
    }));
  if (videoDevices.value.length && !selectedDeviceId.value) {
    selectedDeviceId.value = videoDevices.value[0].value;
  }
}

async function iniciarCamera(deviceId = null) {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraError.value =
      'Este navegador não suporta acesso à câmera. Use HTTPS ou escolha um arquivo de imagem.';
    return;
  }

  isStartingCamera.value = true;
  cameraError.value = null;
  pararCamera();

  const videoConstraints = deviceId
    ? { deviceId: { exact: deviceId } }
    : {
        facingMode: { ideal: 'user' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };

  try {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
    } catch (firstErr) {
      if (deviceId) throw firstErr;
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    streamRef.value = stream;
    await nextTick();
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      await videoRef.value.play();
    }
    await listarCameras();
    if (deviceId) {
      selectedDeviceId.value = deviceId;
    } else if (!selectedDeviceId.value && stream.getVideoTracks()[0]) {
      const settings = stream.getVideoTracks()[0].getSettings();
      if (settings.deviceId) {
        selectedDeviceId.value = settings.deviceId;
      }
    }
  } catch (err) {
    console.error('Erro ao acessar câmera:', err);
    const nome = err?.name || '';
    if (nome === 'NotAllowedError' || nome === 'PermissionDeniedError') {
      cameraError.value =
        'Permissão da câmera negada. Autorize o acesso no navegador e tente novamente.';
    } else if (nome === 'NotFoundError' || nome === 'DevicesNotFoundError') {
      cameraError.value = 'Nenhuma câmera encontrada neste dispositivo.';
    } else if (nome === 'NotReadableError') {
      cameraError.value =
        'A câmera está em uso por outro aplicativo ou não pôde ser aberta.';
    } else {
      cameraError.value = err?.message || 'Não foi possível abrir a câmera.';
    }
  } finally {
    isStartingCamera.value = false;
  }
}

async function abrirCamera() {
  showCamera.value = true;
  cameraError.value = null;
  selectedDeviceId.value = null;
  videoDevices.value = [];
  await nextTick();
  await iniciarCamera();
}

async function trocarCamera() {
  if (!selectedDeviceId.value) return;
  await iniciarCamera(selectedDeviceId.value);
}

function fecharCamera() {
  showCamera.value = false;
  pararCamera();
  cameraError.value = null;
}

function capturarDaWebcam() {
  const video = videoRef.value;
  if (!video?.videoWidth) {
    cameraError.value = 'Aguarde a câmera carregar antes de capturar.';
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      if (imageSrc.value) URL.revokeObjectURL(imageSrc.value);
      imageSrc.value = URL.createObjectURL(blob);
      fecharCamera();
      showCropper.value = true;
    },
    'image/jpeg',
    0.92
  );
}

function abrirSeletorArquivo() {
  fecharCamera();
  cameraInput.value?.click();
}

const onFileSelected = (event) => {
  const file = event.target.files[0];
  if (file && file.type.startsWith('image/')) {
    if (imageSrc.value) URL.revokeObjectURL(imageSrc.value);
    imageSrc.value = URL.createObjectURL(file);
    showCropper.value = true;
  }
  event.target.value = '';
};

const salvarRecorte = () => {
  if (!cropperRef.value) return;
  isProcessing.value = true;
  const { canvas } = cropperRef.value.getResult();
  canvas.toBlob(
    (blob) => {
      emit('foto-salva', blob);
      showCropper.value = false;
      if (imageSrc.value) URL.revokeObjectURL(imageSrc.value);
      imageSrc.value = null;
      isProcessing.value = false;
    },
    'image/jpeg',
    0.8
  );
};

watch(showCamera, (visivel) => {
  if (!visivel) pararCamera();
});

onBeforeUnmount(() => {
  pararCamera();
  if (imageSrc.value) URL.revokeObjectURL(imageSrc.value);
});

defineExpose({ abrirCamera });
</script>

<template>
  <div class="foto-capture-container">
    <input
      type="file"
      ref="cameraInput"
      accept="image/*"
      class="hidden"
      @change="onFileSelected"
    />

    <Dialog
      v-model:visible="showCamera"
      header="Capturar foto"
      modal
      class="p-fluid"
      :style="{ width: '95vw', maxWidth: '560px' }"
      :closable="!isStartingCamera"
      :closeOnEscape="!isStartingCamera"
      appendTo="body"
      @hide="fecharCamera"
    >
      <Message v-if="cameraError" severity="warn" :closable="false" class="mb-3">
        {{ cameraError }}
      </Message>

      <div v-if="videoDevices.length > 1" class="field mb-3">
        <label class="font-medium text-sm mb-1 block">Câmera</label>
        <Dropdown
          v-model="selectedDeviceId"
          :options="videoDevices"
          optionLabel="label"
          optionValue="value"
          placeholder="Selecione a câmera"
          class="w-full"
          @change="trocarCamera"
        />
      </div>

      <div
        class="camera-preview border-round overflow-hidden flex align-items-center justify-content-center bg-black-alpha-90"
      >
        <video
          ref="videoRef"
          autoplay
          playsinline
          muted
          class="camera-video"
        />
        <div
          v-if="isStartingCamera"
          class="absolute flex align-items-center justify-content-center text-white"
        >
          <i class="pi pi-spin pi-spinner text-3xl" />
        </div>
      </div>

      <p class="text-500 text-sm mt-2 mb-0 text-center">
        Posicione o rosto no quadro e toque em capturar. O site precisa estar em HTTPS para usar a câmera.
      </p>

      <template #footer>
        <div class="flex flex-column gap-2 w-full sm:flex-row">
          <Button
            label="Arquivo / galeria"
            icon="pi pi-image"
            text
            severity="secondary"
            class="flex-1"
            :disabled="isStartingCamera"
            @click="abrirSeletorArquivo"
          />
          <Button
            label="Cancelar"
            icon="pi pi-times"
            text
            severity="secondary"
            class="flex-1"
            :disabled="isStartingCamera"
            @click="fecharCamera"
          />
          <Button
            label="Capturar"
            icon="pi pi-camera"
            class="flex-1"
            :loading="isStartingCamera"
            :disabled="!!cameraError || isStartingCamera"
            @click="capturarDaWebcam"
          />
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showCropper"
      header="Ajustar foto"
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
          :stencil-props="{ aspectRatio: 1 / 1 }"
          :resize-image="{ adjustStencil: false }"
          image-class="cropper-image"
        />
      </div>

      <template #footer>
        <div class="flex gap-2 mt-3">
          <Button
            label="Cancelar"
            icon="pi pi-times"
            text
            @click="showCropper = false"
            :disabled="isProcessing"
            class="flex-1"
            severity="secondary"
          />
          <Button
            label="Confirmar foto"
            icon="pi pi-check"
            @click="salvarRecorte"
            :loading="isProcessing"
            class="flex-1"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.camera-preview {
  position: relative;
  min-height: 280px;
  max-height: 60vh;
  aspect-ratio: 4 / 3;
}
.camera-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1); /* espelho natural para selfie/webcam frontal */
}
.hidden {
  display: none;
}
</style>

<style>
.cropper-wrapper {
  height: 400px;
  width: 100%;
  background: #333;
}
.cropper-image {
  max-width: 100%;
  max-height: 100%;
}
</style>
