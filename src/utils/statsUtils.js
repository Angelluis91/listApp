// Funciones puras para calcular estadísticas de progreso (totales y completados) de listas

// Calcula el total y completados de la lista principal plana
export function mainStats(items, mainState) {
  const total = items.length;
  const done  = items.filter(i => mainState[i.id]).length;
  return { total, done };
}

// Calcula el total y completados de una lista personalizada
export function detailStats(list) {
  if (!list) return { total: 0, done: 0 };
  return {
    total: list.items.length,
    done:  list.items.filter(i => i.done).length,
  };
}
