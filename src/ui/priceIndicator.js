// Indicador visual pequeño del estado de la última actualización de precios (💡 / ✅ / ❌)
let indicatorEl = null;
let hideTimer   = null;

// Guarda referencia al elemento DOM del indicador (llamar una vez al inicio)
export function initPriceIndicator() {
  indicatorEl = document.getElementById('price-indicator');
}

// Muestra el estado según los datos del log: ok → ✅ (se oculta sólo), error → ❌ (permanece visible)
export function showPriceStatus({ status, message, updatedAt }) {
  if (!indicatorEl) return;

  const icon  = status === 'ok' ? '✅' : '❌';
  const date  = updatedAt ? new Date(updatedAt).toLocaleDateString('es-ES') : '';
  const label = status === 'ok'
    ? `Precios actualizados · ${date}`
    : `Error al actualizar precios`;

  indicatorEl.innerHTML = `${icon} <span>${label}</span>`;
  indicatorEl.className = `price-indicator price-indicator--${status} visible`;
  indicatorEl.title     = message || '';

  clearTimeout(hideTimer);
  // Los mensajes de éxito desaparecen solos tras 7 segundos
  if (status === 'ok') {
    hideTimer = setTimeout(() => indicatorEl.classList.remove('visible'), 7000);
  }
}
