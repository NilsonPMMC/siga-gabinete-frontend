import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { requiresAuth: true } },
    { path: '/atendimentos', name: 'atendimentos-list', component: () => import('../views/AtendimentoListView.vue'), meta: { requiresAuth: true } },
    { path: '/agendas', name: 'agendas', component: () => import('../views/AgendaListView.vue'), meta: { requiresAuth: true } },
    { path: '/agendas/novo', name: 'agenda-novo', component: () => import('../views/AgendaFormView.vue'), meta: { requiresAuth: true } },
    { path: '/agendas/editar/:id', name: 'agenda-editar', component: () => import('../views/AgendaFormView.vue'), meta: { requiresAuth: true } },
    { path: '/agendas/:id', name: 'agenda-detalhes', component: () => import('../views/AgendaDetailView.vue'), meta: { requiresAuth: true } },
    { path: '/relatorios', name: 'relatorios', component: () => import('../views/RelatoriosView.vue'), meta: { requiresAuth: true, permission: 'canViewRelatoriosAtendimentos' } },
    { path: '/atendimentos/novo', name: 'atendimento-novo', component: () => import('../views/AtendimentoFormView.vue'), meta: { requiresAuth: true } },
    { path: '/atendimentos/editar/:id', name: 'atendimento-editar', component: () => import('../views/AtendimentoFormView.vue'), meta: { requiresAuth: true } },
    { path: '/atendimentos/:id', name: 'atendimento-detalhe', component: () => import('../views/AtendimentoDetailView.vue'), meta: { requiresAuth: true } },
    { path: '/relatorios/agendas', name: 'relatorios-agendas', component: () => import('../views/AgendaReportView.vue'), meta: { requiresAuth: true } },
    { path: '/municipes/:id/historico', name: 'municipe-detalhe', component: () => import('../views/MunicipeDetailView.vue'), meta: { requiresAuth: true } },
    { path: '/contatos', name: 'contatos', component: () => import('../views/ContatosView.vue'), meta: { requiresAuth: true } },
    { path: '/busca', name: 'busca', component: () => import('../views/BuscaView.vue'), meta: { requiresAuth: true } },
    { path: '/configuracoes', name: 'configuracoes', component: () => import('../views/ConfiguracoesView.vue'), meta: { requiresAuth: true } },
    { path: '/configuracoes/checklist-items', name: 'config-checklist-items', component: () => import('@/views/eventos/MasterChecklistManager.vue'), meta: { requiresAuth: true, permission: 'canManageEventos' } },
    { path: '/configuracoes/contato-categorias', name: 'config-contato-categorias', component: () => import('@/views/MasterContatoCategorias.vue'), meta: { requiresAuth: true, permission: 'canManageEventos' } },
    { path: '/recuperar-senha', name: 'recuperar-senha', component: () => import('../views/RequestPasswordResetView.vue'), meta: { public: true } },
    { path: '/reset-password/:uid/:token', name: 'reset-password-confirm', component: () => import('../views/ResetPasswordConfirmView.vue'), meta: { public: true } },
    { path: '/espacos', name: 'espacos', component: () => import('../views/EspacosView.vue'), meta: { requiresAuth: true } },
    { path: '/espacos/:id/agenda', name: 'espaco-agenda', component: () => import('../views/EspacoAgendaView.vue'), meta: { requiresAuth: true } },
    {
      path: '/checkins',
      redirect: '/atendimentos',
    },
    { path: '/google-agenda', name: 'GoogleAgenda', component: () => import('@/views/GoogleAgendaView.vue'), meta: { requiresAuth: true } },
    { path: '/google-calendar', name: 'GoogleCalendar', component: () => import('@/views/GoogleCalendarView.vue'), meta: { requiresAuth: true } },
    { path: '/agendas-compartilhadas', name: 'agendas-compartilhadas-list', component: () => import('@/views/AgendasCompartilhadasListView.vue'), meta: { requiresAuth: true } },
    { path: '/agendas-compartilhadas/:id', name: 'agenda-compartilhada-detail', component: () => import('@/views/AgendaCompartilhadaView.vue'), meta: { requiresAuth: true } },
    {
      path: '/eventos',
      name: 'eventos-lista',
      component: () => import('@/views/eventos/EventosLista.vue'),
      meta: { requiresAuth: true, permission: 'canManageEventos' }
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
      name: 'evento-convidados',
      component: () => import('@/views/eventos/EventoConvidados.vue'),
      props: true,
      meta: { requiresAuth: true, permission: 'canManageEventos' }
    },
    {
      path: '/eventos/:id/presenca',
      name: 'evento-presenca',
      component: () => import('@/views/eventos/EventoPresenca.vue'),
      props: true,
      meta: { requiresAuth: true, permission: 'canManageEventos' }
    },
    {
      path: '/eventos/:id/checklist',
      name: 'evento-checklist',
      component: () => import('@/views/eventos/EventoChecklist.vue'),
      props: true,
      meta: { requiresAuth: true, permission: 'canManageEventos' }
    },
    {
      path: '/eventos/:id/comunicacoes',
      name: 'evento-comunicacoes',
      component: () => import('@/views/eventos/EventoComunicacao.vue'),
      props: true,
      meta: { requiresAuth: true, permission: 'canManageEventos' }
    },
    {
      path: '/comunicacoes/:id/detalhes',
      name: 'evento-comunicacao-detalhes',
      component: () => import('@/views/eventos/EventoComunicacaoView.vue'),
      props: true,
      meta: { requiresAuth: true, permission: 'canManageEventos' }
    },
    {
      path: '/check-in/:contaId',
      name: 'publico-check-in',
      component: () => import('@/views/public/RegistrarPresenca.vue'),
      props: true,
      meta: { public: true }
    },
    {
      path: '/public/checklist/:token',
      name: 'public-checklist',
      component: () => import('@/views/public/PreencherChecklist.vue'),
      props: true,
      meta: { public: true }
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
      path: '/oficios/editar/:id',
      name: 'oficios-editar',
      component: () => import('../views/oficios/OficioFormView.vue'),
      props: true,
      meta: { requiresAuth: true }
    },
    {
      path: '/etiquetas',
      name: 'etiquetas',
      component: () => import('../views/etiquetas/EtiquetasView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/contatos/novo',
      name: 'contato-novo',
      component: () => import('../views/ContatoFormView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/contatos/editar/:id',
      name: 'contato-editar',
      component: () => import('../views/ContatoFormView.vue'),
      props: true,
      meta: { requiresAuth: true }
    },
    {
      path: '/bi-analytics',
      name: 'bi-analytics',
      component: () => import('../views/BiAnalyticsView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/agenda-institucional',
      name: 'agenda-institucional',
      component: () => import('../views/agenda/AgendaInstitucionalManager.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/agenda-recepcao',
      name: 'agenda-recepcao',
      component: () => import('../views/agenda/VisaoDiaRecepcao.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/eventos/bi',
      name: 'eventos-bi',
      component: () => import('../views/eventos/bi/BiEventosView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/escalas',
      name: 'escalas',
      component: () => import('../views/escalas/EscalasView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/saneamento-dados',
      name: 'saneamento-dados',
      component: () => import('../views/SaneamentoDadosView.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/higienizacao-emails',
      name: 'higienizacao-emails',
      component: () => import('@/views/higienizacao/HigienizacaoEmailsView.vue'),
      meta: { requiresAuth: true, permission: 'canManageEventos' }
    },
  ]
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth) {
    const hadSessionBeforeCheck = Boolean(authStore.accessToken || authStore.refresh);
    const hasActiveSession = await authStore.ensureActiveSession();
    if (!hasActiveSession) {
      authStore.clearSession();
      next(hadSessionBeforeCheck ? { path: '/login', query: { reason: 'expired' }, replace: true } : { path: '/login', replace: true });
      return;
    }
  }

  const user = authStore.user;
  if (to.meta.requiresAuth && !user) {
    authStore.clearSession();
    next({ path: '/login', replace: true });
    return;
  }

  if (to.meta.permission && user) {
    const permitido = authStore[to.meta.permission];
    if (!permitido) {
      next('/');
      return;
    }
  }

  if (authStore.isUsuarioEstritamenteOperadorCrm && !to.meta.public) {
    const rotasOperador = ['/contatos', '/login'];
    if (!rotasOperador.includes(to.path)) {
      next('/contatos');
      return;
    }
  }

  if (to.path === '/' && user) {
    const isApenasEscalas =
      user.groups.includes('Escalas') &&
      !user.groups.includes('Gestor de Escalas') &&
      !user.groups.includes('Membro do Gabinete') &&
      !user.groups.includes('Secretária') &&
      !user.is_superuser;

    if (isApenasEscalas) {
      next('/escalas');
      return;
    }

    if (authStore.isUsuarioEstritamenteOperadorCrm) {
      next('/contatos');
      return;
    }
  }

  next();
});

export default router
