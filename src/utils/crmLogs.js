export function formatarTimestampCrm(valor) {
  if (!valor) return '—';
  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatarLinhaCrmLog(log) {
  if (!log) return '';
  const quando = formatarTimestampCrm(log.timestamp);
  const quem = log.usuario_nome || 'Sistema';
  const acao = log.acao_display || log.acao || '—';
  return `${quando} — ${quem} — ${acao}`;
}
