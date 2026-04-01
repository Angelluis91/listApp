// Funciones puras para calcular estadísticas de progreso (totales y completados) de listas y secciones

/**
 * Calcula el total y completados de TODA la lista principal.
 * @param {Array} data   - Array de secciones (MAIN_DATA)
 * @param {Object} mainState - Estado actual { 'secId|item': bool }
 */
export function mainStats(data, mainState) {
  let total = 0;
  let done = 0;
  data.forEach(sec =>
    sec.items.forEach(item => {
      total++;
      if (mainState[sec.id + '|' + item]) done++;
    })
  );
  return { total, done };
}

/**
 * Calcula el total y completados de UNA sección.
 * @param {Object} sec       - Objeto de sección { id, items: [] }
 * @param {Object} mainState - Estado actual
 */
export function secStats(sec, mainState) {
  const total = sec.items.length;
  const done  = sec.items.filter(i => mainState[sec.id + '|' + i]).length;
  return { total, done };
}

/**
 * Calcula el total y completados de una lista personalizada.
 * @param {Object|null} list - Lista con items [{ id, label, done }]
 */
export function detailStats(list) {
  if (!list) return { total: 0, done: 0 };
  return {
    total: list.items.length,
    done:  list.items.filter(i => i.done).length,
  };
}
