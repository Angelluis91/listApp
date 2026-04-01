// Controla el indicador visual de sincronización con Firestore (punto de color en la esquina inferior derecha)
const dot = () => document.getElementById('sync-dot');

// Muestra el indicador en amarillo mientras se guarda
export function setSyncing() {
  const el = dot();
  if (el) el.className = 'syncing';
}

// Muestra el indicador en verde y lo apaga tras 2 segundos
export function setOk() {
  const el = dot();
  if (el) {
    el.className = 'ok';
    setTimeout(() => { if (el) el.className = ''; }, 2000);
  }
}

// Muestra el indicador en rojo al detectar un error de sincronización
export function setError() {
  const el = dot();
  if (el) el.className = 'error';
}
