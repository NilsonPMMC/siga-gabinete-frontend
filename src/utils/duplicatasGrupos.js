/**
 * Mantém apenas contatos em grupos de duplicata com 2+ membros (mesma regra da Gestão de Duplicatas).
 */
export function filtrarContatosEmGruposValidos(contatos) {
  if (!Array.isArray(contatos) || !contatos.length) return [];

  const gruposMap = {};
  for (const contato of contatos) {
    if (!contato.grupo_duplicado) continue;
    if (!gruposMap[contato.grupo_duplicado]) {
      gruposMap[contato.grupo_duplicado] = [];
    }
    gruposMap[contato.grupo_duplicado].push(contato);
  }

  const validos = [];
  for (const lista of Object.values(gruposMap)) {
    if (lista.length >= 2) {
      validos.push(...lista);
    }
  }
  return validos;
}

export function agruparContatosPorDuplicata(contatos) {
  const map = {};
  for (const contato of filtrarContatosEmGruposValidos(contatos)) {
    if (!map[contato.grupo_duplicado]) {
      map[contato.grupo_duplicado] = [];
    }
    map[contato.grupo_duplicado].push(contato);
  }
  return map;
}
