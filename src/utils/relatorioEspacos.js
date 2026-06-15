/**
 * Ajusta o intervalo para semanas completas (segunda a domingo), como no relatório Google Agenda.
 */
export function periodoParaRelatorioPdf(datas) {
  if (!datas?.[0] || !datas?.[1]) return null;

  const dataInicioOriginal = new Date(datas[0]);
  const dataFimOriginal = new Date(datas[1]);

  const diaSemanaInicio = dataInicioOriginal.getDay();
  const diasParaVoltar = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1;
  const dataInicioAjustada = new Date(dataInicioOriginal);
  dataInicioAjustada.setDate(dataInicioOriginal.getDate() - diasParaVoltar);

  const diaSemanaFim = dataFimOriginal.getDay();
  const diasParaAvancar = diaSemanaFim === 0 ? 0 : 7 - diaSemanaFim;
  const dataFimAjustada = new Date(dataFimOriginal);
  dataFimAjustada.setDate(dataFimOriginal.getDate() + diasParaAvancar);

  return {
    data_inicio: dataInicioAjustada.toISOString().slice(0, 10),
    data_fim: dataFimAjustada.toISOString().slice(0, 10),
  };
}

export async function baixarRelatorioEspacosPdf(apiClient, { datas, espacoId = null }) {
  const periodo = periodoParaRelatorioPdf(datas);
  if (!periodo) {
    throw new Error('PERIODO_INVALIDO');
  }

  const params = { ...periodo };
  if (espacoId) {
    params.espaco_id = espacoId;
  }

  const response = await apiClient.get('/api/relatorios/espacos/pdf/', {
    params,
    responseType: 'blob',
  });

  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  const sufixo = espacoId ? `_espaco_${espacoId}` : '';
  link.setAttribute(
    'download',
    `relatorio_espacos_${periodo.data_inicio}_${periodo.data_fim}${sufixo}.pdf`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
