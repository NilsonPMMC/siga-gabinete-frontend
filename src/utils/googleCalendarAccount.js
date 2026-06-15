/**
 * Normaliza contas Google Calendar vindas da API.
 * Suporta token_status legado (string) e novo formato (objeto).
 */

const TOKEN_STATUS_STRINGS = new Set([
  'valid',
  'expired',
  'expiring_soon',
  'not_authenticated',
]);

function normalizeTokenStatus(raw) {
  if (raw && typeof raw === 'object' && 'has_valid_token' in raw) {
    return {
      status: raw.status || (raw.has_valid_token ? 'valid' : 'not_authenticated'),
      has_valid_token: Boolean(raw.has_valid_token),
      expires_soon: Boolean(raw.expires_soon),
      expires_at: raw.expires_at || null,
      last_updated: raw.last_updated || null,
      dias_para_expirar: raw.dias_para_expirar ?? null,
      precisa_autorizacao: Boolean(raw.precisa_autorizacao),
      pode_autorizar: Boolean(raw.pode_autorizar),
      usa_token_delegado: Boolean(raw.usa_token_delegado),
      somente_leitura_siga: Boolean(raw.somente_leitura_siga),
    };
  }

  if (typeof raw === 'string' && TOKEN_STATUS_STRINGS.has(raw)) {
    const hasValid = raw === 'valid' || raw === 'expiring_soon';
    return {
      status: raw,
      has_valid_token: hasValid,
      expires_soon: raw === 'expiring_soon',
      expires_at: null,
      last_updated: null,
      dias_para_expirar: null,
      precisa_autorizacao: raw === 'not_authenticated' || raw === 'expired',
    };
  }

  return {
    status: 'not_authenticated',
    has_valid_token: false,
    expires_soon: false,
    expires_at: null,
    last_updated: null,
    dias_para_expirar: null,
    precisa_autorizacao: true,
  };
}

function normalizePermissoes(account) {
  if (account.permissoes_usuario) {
    return account.permissoes_usuario;
  }

  if (
    account.pode_visualizar !== undefined
    || account.pode_criar !== undefined
    || account.pode_editar !== undefined
    || account.pode_excluir !== undefined
  ) {
    return {
      pode_visualizar: Boolean(account.pode_visualizar),
      pode_criar: Boolean(account.pode_criar),
      pode_editar: Boolean(account.pode_editar),
      pode_excluir: Boolean(account.pode_excluir),
      nivel_acesso: account.nivel_acesso || '',
    };
  }

  return null;
}

export function normalizeGoogleAccount(account) {
  if (!account) return null;

  const token_status = normalizeTokenStatus(account.token_status);
  const permissoes_usuario = normalizePermissoes(account);

  return {
    ...account,
    displayName: account.displayName || account.nome || `Conta #${account.id}`,
    permissoes_usuario,
    token_status,
  };
}

export function normalizeGoogleAccounts(accounts) {
  if (!Array.isArray(accounts)) return [];
  return accounts.map(normalizeGoogleAccount).filter(Boolean);
}

export function extractGoogleAccountsPayload(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.contas)) return data.contas;
  return [];
}

/** Usuário só visualiza pelo SIGA (sem OAuth / sem criar eventos). */
export function isSomenteLeituraSiga(account) {
  const perms = account?.permissoes_usuario;
  if (!perms?.pode_visualizar) return false;
  return !perms.pode_criar && !perms.pode_editar && !perms.pode_excluir;
}

export function podeAutorizarGoogle(account) {
  if (account?.token_status?.pode_autorizar !== undefined) {
    return Boolean(account.token_status.pode_autorizar);
  }
  const perms = account?.permissoes_usuario;
  return Boolean(perms?.pode_criar || perms?.pode_editar);
}

export function contaAcessivelParaLeitura(account) {
  return Boolean(account?.token_status?.has_valid_token);
}
