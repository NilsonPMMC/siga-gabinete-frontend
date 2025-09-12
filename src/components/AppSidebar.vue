<script setup>
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

// Define os itens do menu com as mesmas regras de visibilidade que você já usa
const model = ref([
    {
        label: 'Início',
        items: [{ label: 'Dashboard', icon: 'pi pi-fw pi-home', to: '/' }]
    },
    {
        label: 'Módulos',
        items: [
            {   label: 'Atendimentos',
                icon: 'pi pi-fw pi-inbox',
                to: '/atendimentos',
                visible: () => authStore.isSecretaria || authStore.user?.is_superuser || authStore.isMembro
            },
            {   label: 'Lembretes',
                icon: 'pi pi-fw pi-book',
                to: '/lembretes',
                visible: () => authStore.isSecretaria || authStore.user?.is_superuser
            },
            {  
                label: 'Eventos',  
                icon: 'pi pi-fw pi-calendar', // Ícone de calendário, por exemplo 
                to: '/eventos',
                // A mágica acontece aqui, usando nosso novo getter!
                visible: () => authStore.canManageEventos 
            },
            {
                label: 'Ofícios',
                icon: 'pi pi-fw pi-file-edit', // Ícone de arquivo/edição
                to: '/oficios',
                // Usa o novo getter para controlar a visibilidade
                visible: () => authStore.canManageOficios 
            },
            { 
                label: 'Check-in', 
                icon: 'pi pi-fw pi-map-marker', 
                to: '/checkins',
                visible: () => authStore.isRecepcao || authStore.user?.is_superuser
            },
            { 
                label: 'Solicitações de Agenda', 
                icon: 'pi pi-fw pi-calendar-plus', 
                to: '/agendas',
                visible: () => authStore.isSecretaria || authStore.user?.is_superuser
            },
            { 
                label: 'Gestão de Espaços', 
                icon: 'pi pi-fw pi-building', 
                to: '/espacos',
                visible: () => authStore.isSecretaria || authStore.user?.is_superuser || authStore.isMembro
            },
            { 
                label: 'Contatos', 
                icon: 'pi pi-fw pi-users', 
                to: '/contatos' 
            },
            { 
                label: 'Gestão de Duplicatas', 
                icon: 'pi pi-fw pi-users', 
                to: '/gestao-duplicatas',
                visible: () => authStore.isSecretaria || authStore.user?.is_superuser || authStore.isMembro
            },
            { 
                label: 'Mailing', 
                icon: 'pi pi-fw pi-envelope', 
                to: '/mailings',
                visible: () => authStore.canManageEventos 
            },
        ]
    },
    {
        label: 'Agendas Google',
        items: [
             {
                label: 'Minha Agenda',
                icon: 'pi pi-fw pi-google',
                to: '/google-agenda',
                visible: () => authStore.isSecretaria || authStore.user?.is_superuser
             },
             {
                label: 'Agendas da Equipe',
                icon: 'pi pi-fw pi-google',
                to: '/agendas-compartilhadas',
                visible: () => authStore.isMembro // Ajuste a permissão conforme necessário
             }
        ]
    },
    {
        label: 'Análise',
        items: [
            { 
                label: 'Relatório de Atendimentos', 
                icon: 'pi pi-fw pi-chart-bar', 
                to: '/relatorios',
                visible: () => authStore.user?.is_superuser || authStore.isSecretaria || authStore.isMembro
            },
            { 
                label: 'Relatório de Agendas', 
                icon: 'pi pi-fw pi-calendar',
                to: '/relatorios/agendas',
                visible: () => authStore.user?.is_superuser || authStore.isSecretaria
            }
        ]
    }
]);
</script>

<template>
    <Menu :model="model" class="w-full">
        <template #submenulabel="{ item }">
            <span class="text-primary font-bold">{{ item.label }}</span>
        </template>
        <template #item="{ item, props }">
             <router-link v-if="item.to && (item.visible === undefined || item.visible())" :to="item.to" v-bind="props.action" class="flex align-items-center p-2">
                <span :class="item.icon" />
                <span class="ml-2">{{ item.label }}</span>
            </router-link>
        </template>
    </Menu>
</template>

<style scoped>
/* Estilo para garantir que o link ocupe todo o espaço do item de menu */
a {
    color: var(--text-color);
    text-decoration: none;
    border-radius: 6px;
}
a:hover {
    background-color: var(--surface-hover);
}
.router-link-exact-active {
    background-color: var(--surface-200); /* Usa uma cor de fundo neutra e sutil */
    color: var(--primary-color); /* Altera a cor do TEXTO para a cor primária (ex: azul) */
    font-weight: 700; /* Adiciona negrito para dar mais destaque */
}
</style>