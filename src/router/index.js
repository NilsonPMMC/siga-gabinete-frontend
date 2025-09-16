import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import AtendimentoDetailView from '../views/AtendimentoDetailView.vue'
import AtendimentoFormView from '../views/AtendimentoFormView.vue';
import AgendaListView from '../views/AgendaListView.vue';
import AgendaFormView from '../views/AgendaFormView.vue';
import RelatoriosView from '../views/RelatoriosView.vue';
import AgendaReportView from '../views/AgendaReportView.vue';
import MunicipeDetailView from '../views/MunicipeDetailView.vue';
import ContatosView from '../views/ContatosView.vue';
import BuscaView from '../views/BuscaView.vue';
import ConfiguracoesView from '../views/ConfiguracoesView.vue';
import RequestPasswordResetView from '../views/RequestPasswordResetView.vue';
import ResetPasswordConfirmView from '../views/ResetPasswordConfirmView.vue';
import EspacosView from '../views/EspacosView.vue';
import EspacoAgendaView from '../views/EspacoAgendaView.vue';
import CheckInHistoryView from '@/views/CheckInHistoryView.vue';
import GoogleAgendaView from '@/views/GoogleAgendaView.vue';
import AgendasCompartilhadasListView from '@/views/AgendasCompartilhadasListView.vue';
import AgendaCompartilhadaView from '@/views/AgendaCompartilhadaView.vue';
import AtendimentoListView from '@/views/AtendimentoListView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/', name: 'dashboard', component: DashboardView, meta: { requiresAuth: true } },
    { path: '/atendimentos', name: 'atendimentos-list', component: AtendimentoListView, meta: { requiresAuth: true } },
    { path: '/agendas', name: 'agendas', component: AgendaListView, meta: { requiresAuth: true } },
    { path: '/agendas/novo', name: 'agenda-novo', component: AgendaFormView, meta: { requiresAuth: true } },
    { path: '/agendas/editar/:id', name: 'agenda-editar', component: AgendaFormView, meta: { requiresAuth: true } },
    { path: '/relatorios', name: 'relatorios', component: RelatoriosView, meta: { requiresAuth: true } },
    { path: '/atendimentos/novo', name: 'atendimento-novo', component: AtendimentoFormView, meta: { requiresAuth: true } },
    { path: '/atendimentos/editar/:id', name: 'atendimento-editar', component: AtendimentoFormView, meta: { requiresAuth: true } },
    { path: '/atendimentos/:id', name: 'atendimento-detalhe', component: AtendimentoDetailView, meta: { requiresAuth: true } },
    { path: '/relatorios/agendas', name: 'relatorios-agendas', component: AgendaReportView, meta: { requiresAuth: true } },
    { path: '/municipes/:id/historico', name: 'municipe-detalhe', component: MunicipeDetailView, meta: { requiresAuth: true } },
    { path: '/contatos', name: 'contatos', component: ContatosView, meta: { requiresAuth: true } },
    { path: '/busca', name: 'busca', component: BuscaView, meta: { requiresAuth: true } },
    { path: '/configuracoes', name: 'configuracoes', component: ConfiguracoesView, meta: { requiresAuth: true } },
    { path: '/configuracoes/checklist-items', name: 'config-checklist-items', component: () => import('@/views/eventos/MasterChecklistManager.vue'), meta: { requiresAuth: true, permission: 'canManageEventos' } },
    { path: '/recuperar-senha', name: 'recuperar-senha', component: RequestPasswordResetView },
    { path: '/reset-password/:uid/:token', name: 'reset-password-confirm', component: ResetPasswordConfirmView },
    { path: '/espacos', name: 'espacos', component: EspacosView, meta: { requiresAuth: true } },
    { path: '/espacos/:id/agenda', name: 'espaco-agenda', component: EspacoAgendaView, meta: { requiresAuth: true } },
    { path: '/checkins', name: 'CheckInHistory', component: CheckInHistoryView, meta: { requiresAuth: true } },
    { path: '/google-agenda', name: 'GoogleAgenda', component: GoogleAgendaView, meta: { requiresAuth: true } },
    { path: '/agendas-compartilhadas', name: 'agendas-compartilhadas-list', component: AgendasCompartilhadasListView, meta: { requiresAuth: true } },
    { path: '/agendas-compartilhadas/:id', name: 'agenda-compartilhada-detail', component: AgendaCompartilhadaView, meta: { requiresAuth: true } },
    { 
      path: '/eventos', 
      name: 'eventos-lista', 
      component: () => import('@/views/eventos/EventosLista.vue'), 
      meta: { requiresAuth: true, permission: 'canManageEventos' } // Permissão específica
    },
    {
      path: '/mailings',
      name: 'mailing-manager',
      component: () => import('@/views/eventos/MailingManager.vue'),
      meta: { requiresAuth: true, permission: 'canManageEventos' }
    },
    {
      path: '/mailings/:id/detail',
      name: 'mailing-list-detail',
      component: () => import('@/views/eventos/MailingListDetail.vue'),
      props: true,
      meta: { requiresAuth: true, permission: 'canManageEventos' }
    },
    {
      path: '/eventos/:id/convidados',
      name: 'evento-convidados', // Página dedicada para convidados
      component: () => import('@/views/eventos/EventoConvidados.vue'), // Criaremos este
      props: true,
      meta: { requiresAuth: true, permission: 'canManageEventos' }
    },
    {
      path: '/eventos/:id/presenca',
      name: 'evento-presenca', // Página dedicada para a lista de presença
      component: () => import('@/views/eventos/EventoPresenca.vue'), // Criaremos este
      props: true,
      meta: { requiresAuth: true, permission: 'canManageEventos' }
    },
    {
      path: '/eventos/:id/checklist',
      name: 'evento-checklist', // Página dedicada para o checklist
      component: () => import('@/views/eventos/EventoChecklist.vue'), // Criaremos este
      props: true,
      meta: { requiresAuth: true, permission: 'canManageEventos' }
    },
    {
      path: '/eventos/:id/comunicacoes',
      name: 'evento-comunicacoes', // O mesmo nome que usamos no botão
      component: () => import('@/views/eventos/EventoComunicacao.vue'), // Criaremos este arquivo
      props: true,
      meta: { requiresAuth: true, permission: 'canManageEventos' }
    },
    {
      path: '/comunicacoes/:id/detalhes', // Uma URL focada na comunicação
      name: 'evento-comunicacao-detalhes', // O nome que usamos no botão
      component: () => import('@/views/eventos/EventoComunicacaoView.vue'), // O novo arquivo que vamos criar
      props: true,
      meta: { requiresAuth: true, permission: 'canManageEventos' }
    },
    {
      path: '/check-in/:contaId',
      name: 'publico-check-in',
      component: () => import('@/views/public/RegistrarPresenca.vue'),
      props: true
    },
    {
      path: '/public/checklist/:token',
      name: 'public-checklist',
      component: () => import('@/views/public/PreencherChecklist.vue'),
      props: true // Passa o :token como prop para o componente
    },
    {
      path: '/gestao-duplicatas',
      name: 'gestao-duplicatas',
      component: () => import('../views/GestaoDuplicatasView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/lembretes',
      name: 'lembretes',
      component: () => import('../views/LembretesView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/oficios',
      name: 'oficios-lista',
      component: () => import('../views/oficios/OficiosListView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/oficios/novo',
      name: 'oficios-novo',
      component: () => import('../views/oficios/OficioFormView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/oficios/editar/:id', // O :id é o parâmetro que receberemos
      name: 'oficios-editar',
      component: () => import('../views/oficios/OficioFormView.vue'),
      props: true, // Passa o :id como prop para o componente
      meta: { requiresAuth: true }
    },
    {
      path: '/oficios/editar/:id', // O :id é o parâmetro que receberemos
      name: 'oficios-editar',
      component: () => import('../views/oficios/OficioFormView.vue'),
      props: true, // Passa o :id como prop para o componente
      meta: { requiresAuth: true }
    },
    {
      path: '/etiquetas',
      name: 'etiquetas',
      component: () => import('../views/etiquetas/EtiquetasView.vue'),
      meta: { requiresAuth: true }
    },
  ]
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  // 1. Verifica se a rota exige autenticação
  if (to.meta.requiresAuth) {
    // 1a. Se não estiver autenticado, vai para o login
    if (!authStore.isAuthenticated) {
      return next({ name: 'login' })
    }

    // 1b. Se a rota exige uma permissão específica
    if (to.meta.permission) {
      // Usamos nosso getter da store! Se não tiver a permissão, acesso negado.
      if (!authStore[to.meta.permission]) {
        // Você pode criar uma rota 'acesso-negado' ou simplesmente redirecionar para o dashboard
        return next({ name: 'dashboard' }) 
      }
    }
    
    // Se passou por todas as verificações, permite o acesso
    return next()

  } else {
    // Se a rota não exige autenticação, permite o acesso direto
    return next()
  }
})

export default router
