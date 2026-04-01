// Renderiza y gestiona la pantalla de detalle de una lista personalizada: items, añadir, eliminar y toggle
import { state }       from '../state/appState.js';
import { detailStats } from '../utils/statsUtils.js';
import { saveList }    from '../services/listsService.js';

// Actualiza los contadores y barra de progreso en la cabecera del detalle
export function updateDetailSummary() {
  const list = state.customLists.find(l => l.id === state.currentListId);
  const { total, done } = detailStats(list);
  document.getElementById('d-total').textContent = total;
  document.getElementById('d-done').textContent  = done;
  const pct = total > 0 ? ((done / total) * 100).toFixed(0) : 0;
  document.getElementById('d-prog').style.width = pct + '%';
}

// Renderiza los items de la lista activa como filas con checkbox y botón de borrar
export function renderDetail() {
  updateDetailSummary();
  const list      = state.customLists.find(l => l.id === state.currentListId);
  const container = document.getElementById('detail-items');
  container.innerHTML = '';

  if (!list || !list.items.length) {
    container.innerHTML = `<div class="empty">Añade productos con el campo de arriba</div>`;
    return;
  }

  list.items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'simple-item' + (item.done ? ' checked' : '');
    el.innerHTML = `
      <div class="cb">${item.done ? '✓' : ''}</div>
      <span class="simple-label">${item.label}</span>
      <button class="simple-del" data-id="${item.id}">✕</button>
    `;
    el.querySelector('.simple-del').addEventListener('click', e => {
      e.stopPropagation();
      deleteDetailItem(item.id);
    });
    el.addEventListener('click', e => {
      if (!e.target.classList.contains('simple-del')) toggleDetailItem(item.id, el);
    });
    container.appendChild(el);
  });
}

// Navega a la pantalla de detalle de una lista personalizada dado su ID
export function openList(id) {
  state.currentListId = id;
  const list = state.customLists.find(l => l.id === id);
  if (!list) return;

  document.getElementById('screen-lists').classList.remove('active');
  document.getElementById('screen-detail').classList.add('active');
  document.getElementById('detail-title').textContent = list.emoji + ' ' + list.name;
  document.getElementById('new-item-input').value = '';
  renderDetail();
}

// Marca o desmarca un item de la lista activa y sincroniza con Firestore
function toggleDetailItem(itemId, el) {
  const list = state.customLists.find(l => l.id === state.currentListId);
  if (!list) return;
  const item = list.items.find(i => i.id === itemId);
  if (!item) return;

  item.done = !item.done;
  el.classList.toggle('checked', item.done);
  el.querySelector('.cb').textContent = item.done ? '✓' : '';
  updateDetailSummary();
  saveList(list);
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
