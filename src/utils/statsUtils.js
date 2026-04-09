// Funciones puras para calcular estadísticas de progreso y utilidades de recordatorio

// Genera la URL de Google Calendar para crear un evento con los datos de la lista
export function buildGCalUrl(list) {
  const start  = new Date(list.reminder);
  const end    = new Date(start.getTime() + 60 * 60 * 1000); // duración 1 hora
  const fmt    = d => d.toISOString().replace(/[-:]/g, '').slice(0, 15);
  const params = new URLSearchParams({
    action:  'TEMPLATE',
    text:    `${list.emoji} ${list.name}`,
    dates:   `${fmt(start)}/${fmt(end)}`,
    details: `Recordatorio de tu lista "${list.name}" en List Up`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// Formatea una fecha ISO como "12 abr · 14:30" para mostrarse en UI
export function formatReminder(isoString) {
  const d    = new Date(isoString);
  const day  = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `📅 ${day} · ${time}`;
}

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
