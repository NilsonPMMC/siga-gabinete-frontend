export function normalizarCargo(cargo) {
  return (cargo || '').trim().toUpperCase();
}

export function chavePerfilContaCargo(perfil) {
  const contaId = perfil?.conta?.id ?? perfil?.conta;
  return `${contaId}::${normalizarCargo(perfil?.cargo)}`;
}

export function perfilEstaDuplicado(perfil, perfis = []) {
  const chave = chavePerfilContaCargo(perfil);
  let ocorrencias = 0;
  for (const item of perfis) {
    if (chavePerfilContaCargo(item) === chave) ocorrencias += 1;
  }
  return ocorrencias > 1;
}

export function validarPerfisSemDuplicata(perfis = []) {
  const vistos = new Set();
  const erros = [];
  perfis.forEach((perfil, idx) => {
    const contaId = perfil?.conta?.id ?? perfil?.conta;
    if (!contaId) return;
    const chave = chavePerfilContaCargo(perfil);
    if (vistos.has(chave)) {
      erros.push(`Vínculo #${idx + 1}: cargo e conta duplicados.`);
      return;
    }
    vistos.add(chave);
  });
  return erros;
}
