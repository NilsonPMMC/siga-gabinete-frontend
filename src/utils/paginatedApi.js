/**
 * Normaliza respostas paginadas do DRF ({ count, next, previous, results })
 * e mantém compatibilidade com arrays legados.
 */
export function unwrapPaginatedResponse(response) {
  const data = response?.data;
  if (Array.isArray(data)) {
    return {
      results: data,
      count: data.length,
      next: null,
      previous: null,
    };
  }
  const results = data?.results ?? [];
  return {
    results,
    count: data?.count ?? results.length,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
  };
}
