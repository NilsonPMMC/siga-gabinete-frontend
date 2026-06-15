/**
 * Monta query params comuns dos relatórios de atendimento (inclui filtros de perfil).
 */
export function montarParamsRelatorioAtendimentos({
  dataInicio,
  dataFim,
  contaId,
  status,
  responsavelIds,
  categoriaIds,
  cargos,
  formatarData,
}) {
  const params = {};
  const di = formatarData ? formatarData(dataInicio) : dataInicio;
  const df = formatarData ? formatarData(dataFim) : dataFim;
  if (di) params.data_inicio = di;
  if (df) params.data_fim = df;
  if (contaId) params.conta_id = contaId;
  if (status) params.status = status;
  if (responsavelIds?.length) {
    params.responsavel_ids = responsavelIds.join(',');
  }
  if (categoriaIds?.length) {
    params.categoria_contato_id = categoriaIds;
  }
  if (cargos?.length) {
    params.cargo = cargos;
  }
  return params;
}
