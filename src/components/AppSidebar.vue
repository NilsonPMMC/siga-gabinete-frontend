<script setup>
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import PanelMenu from 'primevue/panelmenu';

const authStore = useAuthStore();

const rawItems = [
    {
        label: 'Dashboard',
        icon: 'pi pi-fw pi-home',
        to: '/',
        visible: () => !authStore.isUsuarioEstritamenteEscalas
    },
    {
        label: 'Módulos',
        items: [
            {   
                label: 'Atendimentos',
                icon: 'pi pi-fw pi-inbox',
                visible: () => authStore.isSecretaria || authStore.user?.is_superuser || authStore.isMembro,
                items: [
                    {
                        label: 'Lista de Atendimentos',
                        icon: 'pi pi-fw pi-list',
                        to: '/atendimentos'
                    },
                    {
                        label: 'Painel BI',
                        icon: 'pi pi-fw pi-chart-bar',
                        to: '/bi-analytics'
                    }
                ]
            },
            { 
                label: 'Solicitações de Agenda', 
                icon: 'pi pi-fw pi-calendar-plus', 
                to: '/agendas',
                visible: () => authStore.isSecretaria || authStore.user?.is_superuser
            },
            {   
                label: 'Eventos',
                icon: 'pi pi-fw pi-megaphone',
                visible: () => authStore.canManageEventos,
                items: [
                    {
                        label: 'Gestão de Eventos',
                        icon: 'pi pi-fw pi-calendar',
                        to: '/eventos'
                    },
                    {
                        label: 'Painel BI',
                        icon: 'pi pi-fw pi-chart-bar',
                        to: '/eventos/bi',
                    }
                ]
            },
            {   
                label: 'Contatos',
                icon: 'pi pi-fw pi-users',
                visible: () => authStore.isRecepcao || authStore.isSecretaria || authStore.user?.is_superuser || authStore.isMembro,
                items: [
                    { 
                        label: 'Contatos', 
                        icon: 'pi pi-fw pi-users', 
                        to: '/contatos' 
                    },
                    {
                        label: 'Duplicatas', 
                        icon: 'pi pi-fw pi-copy', 
                        to: '/gestao-duplicatas',
                        visible: () => authStore.isSecretaria || authStore.user?.is_superuser || authStore.isMembro
                    },
                    {
                        label: 'Saneamento de Dados',
                        icon: 'pi pi-fw pi-sliders-h',
                        to: '/saneamento-dados',
                        visible: () => authStore.isSecretaria || authStore.user?.is_superuser || authStore.isMembro
                    },
                    {
                        label: 'Mailing', 
                        icon: 'pi pi-fw pi-envelope', 
                        to: '/mailings',
                        visible: () => authStore.canManageEventos 
                    }
                ]
            },
            {
                label: 'Escalas',
                icon: 'pi pi-fw pi-clock', // Ícone sugestivo de "Turno/Tempo"
                visible: () => authStore.canViewEscalas, // Usa a lógica que criamos acima
                items: [
                    {
                        label: 'Painel de Plantão',
                        icon: 'pi pi-fw pi-th-large', // Ícone de Dashboard/Painel
                        to: '/escalas'
                    }
                    // Futuramente, se tiver relatórios específicos, entram aqui
                ]
            },
            { 
                label: 'Agenda Institucional', 
                icon: 'pi pi-fw pi-calendar', 
                to: '/agenda-institucional',
                visible: () => authStore.isSecretaria || authStore.isMembro || authStore.user?.is_superuser
            },
            { 
                label: 'Gestão de Espaços', 
                icon: 'pi pi-fw pi-building', 
                to: '/espacos',
                visible: () => authStore.isSecretaria || authStore.user?.is_superuser || authStore.isMembro
            },
            {
                label: 'Etiquetas',
                icon: 'pi pi-fw pi-tag',
                to: '/etiquetas',
                visible: () => authStore.isSecretaria || authStore.isMembro || authStore.user?.is_superuser
            },
            {   
                label: 'Lembretes',
                icon: 'pi pi-fw pi-book',
                to: '/lembretes',
                visible: () => authStore.isSecretaria || authStore.user?.is_superuser
            },
            {
                label: 'Ofícios',
                icon: 'pi pi-fw pi-file-edit',
                to: '/oficios',
                visible: () => authStore.canManageOficios 
            },
            {
                label: 'Agenda',
                icon: 'pi pi-fw pi-calendar',
                to: '/agenda-recepcao',
                visible: () => authStore.isRecepcao || authStore.isSuperuser
            }
        ]
    },
    {
        label: 'Agenda Prefeita',
        icon: 'pi pi-fw pi-calendar',
        items: [
             {
                label: 'Minha Agenda',
                icon: 'pi pi-fw pi-calendar',
                to: '/google-agenda',
                visible: () => authStore.isSecretaria || authStore.user?.is_superuser
             },
             {
                label: 'Agendas da Equipe',
                icon: 'pi pi-fw pi-calendar',
                to: '/agendas-compartilhadas',
                visible: () => authStore.isMembro
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
            },
            { 
                label: 'Relatório Check-in / Visitas', 
                icon: 'pi pi-fw pi-user-plus',
                to: '/checkins',
                visible: () => authStore.user?.is_superuser
            }
        ]
    }
];

const model = computed(() => {
    const filtrarItens = (itens) => {
        return itens
            .filter(item => {
                return item.visible === undefined || (typeof item.visible === 'function' ? item.visible() : item.visible);
            })
            .map(item => {
                const novoItem = { ...item };
                if (item.items) {
                    novoItem.items = filtrarItens(item.items);
                }
                return novoItem;
            });
    };
    return filtrarItens(rawItems);
});
</script>

<template>
    <PanelMenu :model="model" class="w-full border-none">
        <template #item="{ item, props }">
             <router-link 
                v-if="item.to" 
                :to="item.to" 
                v-bind="props.action" 
                class="flex align-items-center p-3 text-700 hover:surface-100 font-medium border-round cursor-pointer transition-colors transition-duration-150 w-full"
                active-class="surface-200 text-primary"
             >
                <span :class="item.icon" class="mr-2" />
                <span>{{ item.label }}</span>
            </router-link>

            <a 
                v-else 
                v-bind="props.action" 
                class="flex align-items-center p-3 text-700 hover:surface-100 font-medium border-round cursor-pointer transition-colors transition-duration-150 w-full select-none"
                tabindex="0"
            >
                <span :class="item.icon" class="mr-2" />
                <span class="flex-1">{{ item.label }}</span>
                <i v-if="item.items" class="pi pi-angle-down text-sm" :class="{ 'rotate-180': item.expanded }"></i>
            </a>
        </template>
    </PanelMenu>
</template>

<style scoped>
:deep(.p-panelmenu .p-panelmenu-header-content),
:deep(.p-panelmenu .p-panelmenu-content) {
    border: none !important;
    background: transparent !important;
    padding: 0 !important;
}
:deep(.p-panelmenu-panel) {
    margin-bottom: 0.5rem;
}
:deep(.p-panelmenu-content .p-menuitem-link) {
    padding-left: 2rem !important; 
}
</style>