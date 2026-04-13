// Renderiza y gestiona la pantalla principal: dos secciones por tienda (Mercadona/Alcampo),
// totales por tienda, precios editables inline y CRUD completo de items
import { state }                   from '../state/appState.js';
import { mainStats }               from '../utils/statsUtils.js';
import { saveMain, saveStructure } from '../services/mainService.js';

const CHECK_SVG   = `<svg viewBox="0 0 12 9" fill="none"><path d="M1 4.5L4.5 8L11 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHEVRON_SVG = `<svg class="store-chevron" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Secciones actualmente contraídas (persiste en la sesión, no en Firestore)
const collapsedStores = new Set();

// Normaliza texto para búsqueda: minúsculas + sin acentos
function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const STORE_CONFIG = {
  mercadona: { label: 'Mercadona', color: '#00875a', light: '#e6f4f0', border: '#b2dfdb' },
  alcampo:   { label: 'Alcampo',   color: '#e65c00', light: '#fff3e0', border: '#ffcc80' },
};

// Calcula el total en euros de los items marcados de una tienda concreta (precio × cantidad)
function storeTotal(store) {
  return state.mainStructure
    .filter(i => i.store === store && state.mainState[i.id])
    .reduce((sum, i) => sum + (i.price || 0) * (i.qty || 1), 0);
}

// Actualiza contadores globales, barra de progreso y totales por tienda en el header
export function updateMainSummary() {
  const { total, done } = mainStats(state.mainStructure, state.mainState);
  document.getElementById('s-total').textContent = total;
  document.getElementById('s-done').textContent  = done;
  const pct = total > 0 ? ((done / total) * 100).toFixed(0) : 0;
  document.getElementById('g-prog').style.width = pct + '%';

  const tm = storeTotal('mercadona');
  const ta = storeTotal('alcampo');
  document.getElementById('total-mercadona').textContent = tm.toFixed(2) + ' €';
  document.getElementById('total-alcampo').textContent   = ta.toFixed(2) + ' €';
  document.getElementById('total-global').textContent    = (tm + ta).toFixed(2) + ' €';
}

// Re-renderiza las dos secciones de tienda con sus items filtrados
export function renderMain() {
  updateMainSummary();
  const searchQuery = normalize(document.getElementById('main-search')?.value || '').trim();
  const container   = document.getElementById('main-sections');
  if (!container) return;
  container.innerHTML = '';

  ['mercadona', 'alcampo'].forEach(store => {
    let items = state.mainStructure.filter(i => i.store === store);
    if (state.showPendingOnly) items = items.filter(i => !state.mainState[i.id]);
    if (searchQuery)           items = items.filter(i => normalize(i.label).includes(searchQuery));
    container.appendChild(renderStoreSection(store, items));
  });
}

// Devuelve la fecha de última actualización exitosa de precios de una tienda, o null si nunca
function storeLastPriceUpdate(store) {
  const dates = state.mainStructure
    .filter(i => i.store === store && i.priceStatus === 'ok' && i.priceLastUpdated)
    .map(i => i.priceLastUpdated)
    .sort();
  if (!dates.length) return null;
  const d = new Date(dates[dates.length - 1]);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

// Crea la tarjeta de una tienda con cabecera desplegable, lista de items y botón de añadir
function renderStoreSection(store, items) {
  const cfg        = STORE_CONFIG[store];
  const collapsed  = collapsedStores.has(store);
  const lastUpdate = storeLastPriceUpdate(store);

  // Contar cuántos items están marcados para mostrar en el badge del header
  const allItems  = state.mainStructure.filter(i => i.store === store);
  const doneCount = allItems.filter(i => state.mainState[i.id]).length;

  const section = document.createElement('div');
  section.className = 'store-section' + (collapsed ? ' collapsed' : '');
  section.style.setProperty('--store-color', cfg.color);
  section.style.setProperty('--store-light', cfg.light);
  section.style.setProperty('--store-border', cfg.border);

  // Cabecera clicable que despliega/contrae la sección
  const header = document.createElement('div');
  header.className = 'store-section-header';
  header.innerHTML = `
    <span class="store-section-title">${cfg.label}</span>
    ${lastUpdate ? `<span class="store-price-badge" title="Última actualización de precios">✓ ${lastUpdate}</span>` : ''}
    <span class="store-section-count">${doneCount}/${allItems.length}</span>
    ${CHEVRON_SVG}
  `;
  header.addEventListener('click', () => {
    collapsedStores.has(store) ? collapsedStores.delete(store) : collapsedStores.add(store);
    section.classList.toggle('collapsed');
  });
  section.appendChild(header);

  // Cuerpo de la sección — se colapsa con CSS grid animation
  const body = document.createElement('div');
  body.className = 'store-section-body';

  const inner = document.createElement('div');

  const list = document.createElement('div');
  list.className = 'items-flat-list';
  if (items.length) {
    items.forEach(item => list.appendChild(createItemRow(item)));
  } else {
    list.innerHTML = `<div class="empty" style="padding:14px;font-size:.82rem">Sin elementos</div>`;
  }
  inner.appendChild(list);

  // Botón para añadir un elemento a esta tienda
  const addBtn = document.createElement('button');
  addBtn.className = 'add-item-btn';
  addBtn.textContent = '＋ Añadir elemento';
  addBtn.addEventListener('click', () => addItem(store, inner));
  inner.appendChild(addBtn);

  body.appendChild(inner);
  section.appendChild(body);

  return section;
}

// Crea el elemento DOM de una fila: checkbox, etiqueta editable, contador, precio editable y acciones
function createItemRow(item) {
  const checked  = !!state.mainState[item.id];
  const qty      = item.qty || 1;
  const total    = item.price > 0 ? (item.price * qty).toFixed(2) + ' €' : '—';

  const row = document.createElement('div');
  row.className = 'item-row' + (checked ? ' checked' : '');
  row.innerHTML = `
    <button class="item-check ${checked ? 'is-checked' : ''}">${checked ? CHECK_SVG : ''}</button>
    <span class="item-label">${item.label}</span>
    <div class="item-qty">
      <button class="qty-btn" data-action="qty-dec">−</button>
      <span class="qty-value">${qty}</span>
      <button class="qty-btn" data-action="qty-inc">+</button>
    </div>
    <button class="item-price" title="Editar precio unitario">${total}</button>
    <div class="item-actions">
      <button class="icon-btn sm" title="Cambiar tienda" data-action="change-store">🔄</button>
      <button class="icon-btn sm" title="Renombrar" data-action="edit-item">✏️</button>
      <button class="icon-btn sm danger" title="Eliminar" data-action="delete-item">🗑</button>
    </div>
  `;

  row.querySelector('.item-check').addEventListener('click', e => { e.stopPropagation(); toggleItem(item, row); });
  row.querySelector('.item-label').addEventListener('click', () => toggleItem(item, row));
  row.querySelector('.item-price').addEventListener('click', e => { e.stopPropagation(); startEditPrice(item, row.querySelector('.item-price')); });
  row.querySelector('[data-action="qty-dec"]').addEventListener('click', e => { e.stopPropagation(); changeQty(item, -1); });
  row.querySelector('[data-action="qty-inc"]').addEventListener('click', e => { e.stopPropagation(); changeQty(item, +1); });
  row.querySelector('[data-action="change-store"]').addEventListener('click', e => { e.stopPropagation(); changeStore(item); });
  row.querySelector('[data-action="edit-item"]').addEventListener('click', e => { e.stopPropagation(); startEditLabel(item, row.querySelector('.item-label')); });
  row.querySelector('[data-action="delete-item"]').addEventListener('click', e => { e.stopPropagation(); deleteItem(item.id); });

  return row;
}

// Incrementa o decrementa la cantidad del item (mínimo 1)
async function changeQty(item, delta) {
  item.qty = Math.max(1, (item.qty || 1) + delta);
  await saveStructure();
  renderMain();
}

// Marca o desmarca un item, actualiza la UI y los totales sin re-renderizar
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

// Activa la edición inline del precio UNITARIO de un item
function startEditPrice(item, priceBtn) {
  const input = document.createElement('input');
  input.type      = 'number';
  input.className = 'inline-input price-input';
  input.value     = item.price > 0 ? item.price : '';
  input.min       = '0';
  input.step      = '0.01';
  input.placeholder = '0.00 c/u';
  priceBtn.replaceWith(input);
  input.focus();
  input.select();

  let saved = false;
  const save = async () => {
    if (saved) return;
    saved = true;
    const val = parseFloat(input.value);
    item.price = isNaN(val) || val < 0 ? 0 : Math.round(val * 100) / 100;
    await saveStructure();
    renderMain();
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { saved = true; renderMain(); }
  });
}

// Mueve un item a la otra tienda y persiste el cambio
async function changeStore(item) {
  item.store = item.store === 'mercadona' ? 'alcampo' : 'mercadona';
  await saveStructure();
  renderMain();
}

// Activa la edición inline del nombre de un item
function startEditLabel(item, labelEl) {
  startInlineEdit(labelEl, item.label, async (newLabel) => {
    if (newLabel !== item.label) {
      item.label = newLabel;
      await saveStructure();
    }
    renderMain();
  });
}

// Muestra un campo inline al final de la sección para añadir un nuevo item a la tienda indicada
function addItem(store, innerEl) {
  if (innerEl.querySelector('.add-item-input-row')) return;

  const inputRow = document.createElement('div');
  inputRow.className = 'add-item-input-row';
  inputRow.innerHTML = `<input class="inline-input" type="text" placeholder="Nombre del elemento..." maxlength="60">`;
  const addBtn = innerEl.querySelector('.add-item-btn');
  innerEl.insertBefore(inputRow, addBtn);

  const input = inputRow.querySelector('input');
  input.focus();

  const save = async () => {
    const label = input.value.trim();
    if (label && !state.mainStructure.find(i => i.label === label)) {
      const id = 'item_' + Date.now();
      state.mainStructure.push({ id, label, store, price: 0 });
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

// Desmarca todos los items y sincroniza con Firestore
export function clearAll() {
  state.mainStructure.forEach(item => { state.mainState[item.id] = false; });
  saveMain();
  renderMain();
}
