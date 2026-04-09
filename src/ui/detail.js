// Renderiza y gestiona la pantalla de detalle de una lista personalizada: items, añadir, eliminar, editar y toggle
import { state }       from '../state/appState.js';
import { detailStats } from '../utils/statsUtils.js';
import { saveList }    from '../services/listsService.js';

// Genera la URL de Google Calendar para el recordatorio de una lista
function buildGCalUrl(list) {
  const start = new Date(list.reminder);
  const end   = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt   = d => d.toISOString().replace(/[-:]/g, '').slice(0, 15);
  const params = new URLSearchParams({
    action:  'TEMPLATE',
    text:    `${list.emoji} ${list.name}`,
    dates:   `${fmt(start)}/${fmt(end)}`,
    details: `Recordatorio de tu lista "${list.name}" en List Up`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// Formatea una fecha ISO como "12 abr · 14:30" para el header del detalle
function formatReminder(isoString) {
  const d    = new Date(isoString);
  const day  = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `📅 ${day} · ${time}`;
}

const CHECK_SVG = `<svg viewBox="0 0 12 9" fill="none"><path d="M1 4.5L4.5 8L11 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Actualiza los contadores y barra de progreso en la cabecera del detalle
export function updateDetailSummary() {
  const list = state.customLists.find(l => l.id === state.currentListId);
  const { total, done } = detailStats(list);
  document.getElementById('d-total').textContent = total;
  document.getElementById('d-done').textContent  = done;
  const pct = total > 0 ? ((done / total) * 100).toFixed(0) : 0;
  document.getElementById('d-prog').style.width = pct + '%';
}

// Renderiza los items de la lista activa como filas con checkbox, etiqueta editable y botones de acción
export function renderDetail() {
  updateDetailSummary();
  const list      = state.customLists.find(l => l.id === state.currentListId);
  const container = document.getElementById('detail-items');
  container.innerHTML = '';

  if (!list || !list.items.length) {
    container.innerHTML = `<div class="empty">Añade productos con el campo de arriba</div>`;
    return;
  }

  list.items.forEach(item => container.appendChild(createDetailRow(list, item)));
}

// Crea el elemento DOM de una fila de item con checkbox, etiqueta editable y botones de acción
function createDetailRow(list, item) {
  const row = document.createElement('div');
  row.className = 'detail-item' + (item.done ? ' checked' : '');
  row.innerHTML = `
    <button class="item-check ${item.done ? 'is-checked' : ''}">${item.done ? CHECK_SVG : ''}</button>
    <span class="item-label">${item.label}</span>
    <div class="item-actions">
      <button class="icon-btn sm" title="Renombrar" data-action="edit-item">✏️</button>
      <button class="icon-btn sm danger" title="Eliminar" data-action="delete-item">🗑</button>
    </div>
  `;

  row.querySelector('.item-check').addEventListener('click', e => { e.stopPropagation(); toggleDetailItem(item.id, row, list); });
  row.querySelector('.item-label').addEventListener('click', () => toggleDetailItem(item.id, row, list));
  row.querySelector('[data-action="edit-item"]').addEventListener('click', e => {
    e.stopPropagation();
    startEditDetailItem(item, row.querySelector('.item-label'), list);
  });
  row.querySelector('[data-action="delete-item"]').addEventListener('click', e => {
    e.stopPropagation();
    deleteDetailItem(item.id);
  });

  return row;
}

// Navega a la pantalla de detalle de una lista personalizada dado su ID
export function openList(id) {
  state.currentListId = id;
  const list = state.customLists.find(l => l.id === id);
  if (!list) return;

  document.getElementById('screen-lists').classList.remove('active');
  document.getElementById('screen-detail').classList.add('active');

  // Hero header
  document.getElementById('detail-hero-emoji').textContent = list.emoji;
  document.getElementById('detail-title').textContent      = list.name;

  // Recordatorio
  const reminderEl = document.getElementById('detail-reminder');
  if (list.reminder) {
    const expired = new Date(list.reminder) < new Date();
    document.getElementById('detail-reminder-text').textContent = formatReminder(list.reminder);
    document.getElementById('detail-gcal-link').href           = buildGCalUrl(list);
    reminderEl.className = 'detail-hero-reminder' + (expired ? ' expired' : '');
  } else {
    reminderEl.className = 'detail-hero-reminder hidden';
  }

  document.getElementById('new-item-input').value = '';
  renderDetail();
}

// Marca o desmarca un item de la lista activa y actualiza la UI sin re-renderizar todo
function toggleDetailItem(itemId, row, list) {
  if (!list) return;
  const item = list.items.find(i => i.id === itemId);
  if (!item) return;

  item.done = !item.done;
  row.classList.toggle('checked', item.done);
  const cb = row.querySelector('.item-check');
  cb.classList.toggle('is-checked', item.done);
  cb.innerHTML = item.done ? CHECK_SVG : '';

  updateDetailSummary();
  saveList(list);
}

// Activa la edición inline del nombre de un item y persiste el cambio si se modifica
function startEditDetailItem(item, labelEl, list) {
  const input = document.createElement('input');
  input.type      = 'text';
  input.className = 'inline-input';
  input.value     = item.label;
  labelEl.replaceWith(input);
  input.focus();
  input.select();

  let saved = false;
  const save = () => {
    if (saved) return;
    saved = true;
    const newLabel = input.value.trim() || item.label;
    if (newLabel !== item.label) {
      item.label = newLabel;
      saveList(list);
    }
    renderDetail();
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { saved = true; renderDetail(); }
  });
}

// Añade un nuevo item a la lista activa, lo renderiza y sincroniza con Firestore
export async function addDetailItem() {
  const input = document.getElementById('new-item-input');
  const label = input.value.trim();
  if (!label) return;

  const list = state.customLists.find(l => l.id === state.currentListId);
  if (!list) return;

  list.items.push({ id: Date.now().toString(), label, done: false });
  input.value = '';
  renderDetail();
  await saveList(list);

  setTimeout(() => {
    const c = document.getElementById('detail-items');
    if (c.lastElementChild) c.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}

// Elimina un item de la lista activa y sincroniza con Firestore
function deleteDetailItem(itemId) {
  const list = state.customLists.find(l => l.id === state.currentListId);
  if (!list) return;
  list.items = list.items.filter(i => i.id !== itemId);
  renderDetail();
  saveList(list);
}
