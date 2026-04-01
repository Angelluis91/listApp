// Renderiza y gestiona la pantalla principal (La Compra): lista plana de items con toggle, CRUD inline y búsqueda
import { state }                   from '../state/appState.js';
import { mainStats }               from '../utils/statsUtils.js';
import { saveMain, saveStructure } from '../services/mainService.js';

const CHECK_SVG = `<svg viewBox="0 0 12 9" fill="none"><path d="M1 4.5L4.5 8L11 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Actualiza los contadores y barra de progreso global del header
export function updateMainSummary() {
  const { total, done } = mainStats(state.mainStructure, state.mainState);
  document.getElementById('s-total').textContent = total;
  document.getElementById('s-done').textContent  = done;
  const pct = total > 0 ? ((done / total) * 100).toFixed(0) : 0;
  document.getElementById('g-prog').style.width = pct + '%';
}

// Re-renderiza la pantalla principal: cabecera, búsqueda, items y botón de añadir
export function renderMain() {
  updateMainSummary();
  const searchQuery = (document.getElementById('main-search')?.value || '').toLowerCase().trim();
  const container   = document.getElementById('main-sections');
  if (!container) return;
  container.innerHTML = '';

  let items = state.mainStructure;
  if (state.showPendingOnly) items = items.filter(i => !state.mainState[i.id]);
  if (searchQuery)           items = items.filter(i => i.label.toLowerCase().includes(searchQuery));

  if (!state.mainStructure.length) {
    container.innerHTML = `<div class="empty">Sin elementos todavía.<br>Pulsa el botón para añadir el primero.</div>`;
  } else if (!items.length) {
    container.innerHTML = `<div class="empty">Sin resultados</div>`;
  } else {
    const list = document.createElement('div');
    list.className = 'items-flat-list';
    items.forEach(item => list.appendChild(createItemRow(item)));
    container.appendChild(list);
  }

  // Botón para añadir un nuevo item al final de la lista
  const addBtn = document.createElement('button');
  addBtn.className = 'add-item-btn';
  addBtn.textContent = '＋ Añadir elemento';
  addBtn.addEventListener('click', addItem);
  container.appendChild(addBtn);
}

// Crea el elemento DOM de una fila de item con checkbox, etiqueta y botones de acción
function createItemRow(item) {
  const checked = !!state.mainState[item.id];
  const row = document.createElement('div');
  row.className = 'item-row' + (checked ? ' checked' : '');
  row.innerHTML = `
    <button class="item-check ${checked ? 'is-checked' : ''}">${checked ? CHECK_SVG : ''}</button>
    <span class="item-label">${item.label}</span>
    <div class="item-actions">
      <button class="icon-btn sm" title="Renombrar" data-action="edit-item">✏️</button>
      <button class="icon-btn sm danger" title="Eliminar" data-action="delete-item">🗑</button>
    </div>
  `;

  row.querySelector('.item-check').addEventListener('click', e => { e.stopPropagation(); toggleItem(item, row); });
  row.querySelector('.item-label').addEventListener('click', () => toggleItem(item, row));
  row.querySelector('[data-action="edit-item"]').addEventListener('click', e => {
    e.stopPropagation();
    startEditItem(item, row.querySelector('.item-label'));
  });
  row.querySelector('[data-action="delete-item"]').addEventListener('click', e => {
    e.stopPropagation();
    deleteItem(item.id);
  });

  return row;
}

// Marca o desmarca un item y actualiza la UI sin re-renderizar toda la lista
function toggleItem(item, row) {
  state.mainState[item.id] = !state.mainState[item.id];
  const checked = state.mainState[item.id];
  row.classList.toggle('checked', checked);
  const cb = row.querySelector('.item-check');
  cb.classList.toggle('is-checked', checked);
  cb.innerHTML = checked ? CHECK_SVG : '';
  updateMainSummary();
  saveMain();
}

// Muestra un campo inline al final de la lista para añadir un nuevo item
function addItem() {
  const container = document.getElementById('main-sections');
  if (container.querySelector('.add-item-input-row')) return;

  const inputRow = document.createElement('div');
  inputRow.className = 'add-item-input-row';
  inputRow.innerHTML = `<input class="inline-input" type="text" placeholder="Nombre del elemento..." maxlength="60">`;
  const addBtn = container.querySelector('.add-item-btn');
  container.insertBefore(inputRow, addBtn);

  const input = inputRow.querySelector('input');
  input.focus();

  const save = async () => {
    const label = input.value.trim();
    if (label && !state.mainStructure.find(i => i.label === label)) {
      const id = 'item_' + Date.now();
      state.mainStructure.push({ id, label });
      state.mainState[id] = false;
      await saveStructure();
      saveMain();
    }
    renderMain();
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') renderMain();
  });
}

// Elimina un item de la estructura y su clave de estado, y persiste los cambios
async function deleteItem(itemId) {
  state.mainStructure = state.mainStructure.filter(i => i.id !== itemId);
  delete state.mainState[itemId];
  saveMain();
  await saveStructure();
  renderMain();
}

// Activa la edición inline del nombre de un item y persiste el cambio si se modifica
function startEditItem(item, labelEl) {
  startInlineEdit(labelEl, item.label, async (newLabel) => {
    if (newLabel !== item.label) {
      item.label = newLabel;
      await saveStructure();
    }
    renderMain();
  });
}

// Reemplaza un elemento de texto por un input editable y llama a onSave al confirmar
function startInlineEdit(el, currentValue, onSave) {
  const input = document.createElement('input');
  input.type      = 'text';
  input.className = 'inline-input';
  input.value     = currentValue;
  el.replaceWith(input);
  input.focus();
  input.select();

  let saved = false;
  const save = () => {
    if (saved) return;
    saved = true;
    onSave(input.value.trim() || currentValue);
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { saved = true; onSave(currentValue); renderMain(); }
  });
}

// Alterna entre mostrar todos los items o solo los pendientes
export function togglePending() {
  state.showPendingOnly = !state.showPendingOnly;
  document.getElementById('btn-pending').textContent = state.showPendingOnly ? 'Ver todos' : 'Ver pendientes';
  renderMain();
}

// Desmarca todos los items de la lista principal y sincroniza con Firestore
export function clearAll() {
  state.mainStructure.forEach(item => { state.mainState[item.id] = false; });
  saveMain();
  renderMain();
}
