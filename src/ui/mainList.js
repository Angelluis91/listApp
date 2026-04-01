// Renderiza y gestiona la pantalla principal (La Compra): secciones editables, resumen de seleccionados e interacción inline
import { state }                    from '../state/appState.js';
import { mainStats, secStats }      from '../utils/statsUtils.js';
import { saveMain, saveStructure }  from '../services/mainService.js';

const CHECK_SVG = `<svg viewBox="0 0 12 9" fill="none"><path d="M1 4.5L4.5 8L11 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ── Resumen de elementos seleccionados ────────────────────────────────────────

// Renderiza el panel de elementos marcados; lo oculta si no hay ninguno seleccionado
export function renderSelectedSummary() {
  const wrapper = document.getElementById('selected-summary');
  if (!wrapper) return;

  const selected = [];
  state.mainStructure.forEach(sec =>
    sec.items.forEach(item => {
      if (state.mainState[sec.id + '|' + item]) selected.push({ sec, item });
    })
  );

  if (!selected.length) { wrapper.innerHTML = ''; return; }

  wrapper.innerHTML = `
    <div class="selected-summary-card">
      <div class="summary-hdr">
        <div class="summary-check-icon">✓</div>
        <span class="summary-count">${selected.length} seleccionado${selected.length !== 1 ? 's' : ''}</span>
        <button class="summary-clear-btn" id="btn-summary-clear">Limpiar</button>
      </div>
      <div class="summary-chips">
        ${selected.map(({ sec, item }) => `
          <span class="summary-chip">
            ${sec.icon} ${item}
            <button class="summary-chip-remove" data-sec="${sec.id}" data-item="${encodeURIComponent(item)}" title="Quitar">×</button>
          </span>
        `).join('')}
      </div>
    </div>
  `;
  document.getElementById('btn-summary-clear').addEventListener('click', clearAll);

  // Quitar un item individual desde el resumen sin limpiar toda la lista
  wrapper.querySelectorAll('.summary-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sec + '|' + decodeURIComponent(btn.dataset.item);
      state.mainState[key] = false;
      saveMain();
      renderMain();
    });
  });
}

// ── Estadísticas del header ───────────────────────────────────────────────────

// Actualiza los contadores y barra de progreso global del header
export function updateMainSummary() {
  const { total, done } = mainStats(state.mainStructure, state.mainState);
  document.getElementById('s-total').textContent = total;
  document.getElementById('s-done').textContent  = done;
  const pct = total > 0 ? ((done / total) * 100).toFixed(0) : 0;
  document.getElementById('g-prog').style.width = pct + '%';
}

// ── Render principal ──────────────────────────────────────────────────────────

// Re-renderiza toda la pantalla principal: resumen, secciones y botón de añadir sección
export function renderMain() {
  updateMainSummary();
  renderSelectedSummary();

  const searchQuery = (document.getElementById('main-search')?.value || '').toLowerCase().trim();
  const container   = document.getElementById('main-sections');
  if (!container) return;
  container.innerHTML = '';

  if (!state.mainStructure.length) {
    container.innerHTML = `<div class="empty">Sin secciones todavía.<br>Pulsa el botón para crear la primera.</div>`;
  } else {
    state.mainStructure.forEach(sec => renderSection(sec, searchQuery, container));
  }

  // Botón para añadir una nueva sección al final de la lista
  const addBtn = document.createElement('button');
  addBtn.className = 'add-section-btn';
  addBtn.textContent = '＋ Añadir sección';
  addBtn.addEventListener('click', addSection);
  container.appendChild(addBtn);
}

// ── Render de sección ─────────────────────────────────────────────────────────

// Crea y añade la tarjeta de una sección con todos sus items al contenedor
function renderSection(sec, searchQuery, container) {
  const itemsToShow = searchQuery
    ? sec.items.filter(i => i.toLowerCase().includes(searchQuery))
    : sec.items;

  const { total, done } = secStats(sec, state.mainState);
  const pct = total > 0 ? ((done / total) * 100).toFixed(0) : 0;

  const card = document.createElement('div');
  card.className = 'section-card' + (total > 0 && done === total ? ' all-done' : '');
  card.id = 'sec-' + sec.id;
  card.innerHTML = `
    <div class="sec-card-header">
      <div class="sec-card-left">
        <span class="sec-emoji">${sec.icon}</span>
        <span class="sec-name" id="sec-name-${sec.id}">${sec.name}</span>
        <span class="sec-badge" id="sec-badge-${sec.id}">${done}/${total}</span>
      </div>
      <div class="sec-card-actions">
        <button class="icon-btn sm" title="Renombrar sección" data-action="edit-sec">✏️</button>
        <button class="icon-btn sm danger" title="Eliminar sección" data-action="delete-sec">🗑</button>
        <button class="icon-btn sm caret-btn" title="Colapsar">▾</button>
      </div>
    </div>
    <div class="sec-progress-bar">
      <div class="sec-progress-fill" id="sec-prog-${sec.id}" style="width:${pct}%"></div>
    </div>
    <div class="sec-items-list" id="items-${sec.id}"></div>
    <button class="add-item-btn" data-action="add-item">＋ Añadir elemento</button>
  `;

  card.querySelector('[data-action="edit-sec"]').addEventListener('click', () => startEditSection(sec.id));
  card.querySelector('[data-action="delete-sec"]').addEventListener('click', () => deleteSection(sec.id));
  card.querySelector('.caret-btn').addEventListener('click', () => toggleSec(sec.id, card));
  card.querySelector('[data-action="add-item"]').addEventListener('click', () => addItemToSection(sec.id, card));

  const itemsList = card.querySelector('#items-' + sec.id);
  itemsToShow.forEach(item => itemsList.appendChild(createItemRow(sec, item)));

  if (!itemsToShow.length && searchQuery) {
    itemsList.innerHTML = `<div class="empty" style="padding:16px">Sin resultados en esta sección</div>`;
  }

  container.appendChild(card);
}

// ── Fila de item ──────────────────────────────────────────────────────────────

// Crea el elemento DOM de una fila de item con checkbox, label y botones de acción
function createItemRow(sec, item) {
  const k       = sec.id + '|' + item;
  const checked = !!state.mainState[k];

  const row = document.createElement('div');
  row.className = 'item-row' + (checked ? ' checked' : '');

  row.innerHTML = `
    <button class="item-check ${checked ? 'is-checked' : ''}">${checked ? CHECK_SVG : ''}</button>
    <span class="item-label">${item}</span>
    <div class="item-actions">
      <button class="icon-btn sm" title="Renombrar" data-action="edit-item">✏️</button>
      <button class="icon-btn sm danger" title="Eliminar" data-action="delete-item">🗑</button>
    </div>
  `;

  row.querySelector('.item-check').addEventListener('click', e => { e.stopPropagation(); toggleMainItem(sec, item, row); });
  row.querySelector('.item-label').addEventListener('click', () => toggleMainItem(sec, item, row));
  row.querySelector('[data-action="edit-item"]').addEventListener('click', e => {
    e.stopPropagation();
    startEditItem(sec.id, item, row.querySelector('.item-label'));
  });
  row.querySelector('[data-action="delete-item"]').addEventListener('click', e => {
    e.stopPropagation();
    deleteItemFromSection(sec.id, item);
  });

  return row;
}

// ── Toggle de item ────────────────────────────────────────────────────────────

// Marca o desmarca un item y actualiza la UI y Firestore sin re-renderizar todo
function toggleMainItem(sec, item, row) {
  const k = sec.id + '|' + item;
  state.mainState[k] = !state.mainState[k];
  const checked = state.mainState[k];

  row.classList.toggle('checked', checked);
  const cb = row.querySelector('.item-check');
  cb.classList.toggle('is-checked', checked);
  cb.innerHTML = checked ? CHECK_SVG : '';

  updateMainSummary();
  renderSelectedSummary();

  // Actualiza la barra de progreso de la sección sin re-renderizar la tarjeta
  const { total, done } = secStats(sec, state.mainState);
  const pct = total > 0 ? ((done / total) * 100).toFixed(0) : 0;
  const fill  = document.getElementById('sec-prog-' + sec.id);
  const badge = document.getElementById('sec-badge-' + sec.id);
  const card  = document.getElementById('sec-' + sec.id);
  if (fill)  fill.style.width = pct + '%';
  if (badge) badge.textContent = done + '/' + total;
  if (card)  card.classList.toggle('all-done', total > 0 && done === total);

  saveMain();
}

// ── Collapse de sección ───────────────────────────────────────────────────────

// Expande o colapsa una sección al pulsar el caret
function toggleSec(id, card) {
  card.classList.toggle('collapsed');
}

// ── CRUD secciones ────────────────────────────────────────────────────────────

// Muestra un campo inline al final de la lista para crear una nueva sección
function addSection() {
  const container = document.getElementById('main-sections');
  if (container.querySelector('.add-section-input-row')) return;

  const row = document.createElement('div');
  row.className = 'add-section-input-row';
  row.innerHTML = `<input class="inline-input" type="text" placeholder="Nombre de la sección..." maxlength="50">`;

  const addBtn = container.querySelector('.add-section-btn');
  container.insertBefore(row, addBtn);

  const input = row.querySelector('input');
  input.focus();

  const save = async () => {
    const name = input.value.trim();
    if (name) {
      state.mainStructure.push({ id: 'sec_' + Date.now(), icon: '📦', name, items: [] });
      await saveStructure();
    }
    renderMain();
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') renderMain();
  });
}

// Pide confirmación, elimina la sección y limpia sus claves de estado
async function deleteSection(sectionId) {
  if (!confirm('¿Eliminar esta sección y todos sus elementos?')) return;
  const sec = state.mainStructure.find(s => s.id === sectionId);
  if (sec) {
    sec.items.forEach(item => { delete state.mainState[sectionId + '|' + item]; });
    saveMain();
  }
  state.mainStructure = state.mainStructure.filter(s => s.id !== sectionId);
  await saveStructure();
  renderMain();
}

// Activa la edición inline del nombre de una sección
function startEditSection(sectionId) {
  const nameEl = document.getElementById('sec-name-' + sectionId);
  if (!nameEl) return;
  const current = nameEl.textContent;

  startInlineEdit(nameEl, current, async (newName) => {
    if (newName !== current) {
      const sec = state.mainStructure.find(s => s.id === sectionId);
      if (sec) { sec.name = newName; await saveStructure(); }
    }
    renderMain();
  });
}

// ── CRUD items ────────────────────────────────────────────────────────────────

// Muestra un campo inline al final de los items de una sección para añadir uno nuevo
function addItemToSection(sectionId, card) {
  const sec = state.mainStructure.find(s => s.id === sectionId);
  if (!sec) return;

  const itemsList = card.querySelector('#items-' + sectionId);
  if (itemsList.querySelector('.add-item-input-row')) return;

  const inputRow = document.createElement('div');
  inputRow.className = 'add-item-input-row';
  inputRow.innerHTML = `<input class="inline-input" type="text" placeholder="Nombre del elemento..." maxlength="60">`;
  itemsList.appendChild(inputRow);

  const input = inputRow.querySelector('input');
  input.focus();

  const save = async () => {
    const label = input.value.trim();
    if (label && !sec.items.includes(label)) {
      sec.items.push(label);
      state.mainState[sectionId + '|' + label] = false;
      await saveStructure();
    }
    renderMain();
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') renderMain();
  });
}

// Elimina un item de la sección, limpia su estado y persiste los cambios
async function deleteItemFromSection(sectionId, item) {
  const sec = state.mainStructure.find(s => s.id === sectionId);
  if (!sec) return;
  sec.items = sec.items.filter(i => i !== item);
  delete state.mainState[sectionId + '|' + item];
  saveMain();
  await saveStructure();
  renderMain();
}

// Activa la edición inline del nombre de un item y migra la clave de estado si cambia
function startEditItem(sectionId, item, labelEl) {
  startInlineEdit(labelEl, item, async (newName) => {
    if (newName !== item) {
      const sec = state.mainStructure.find(s => s.id === sectionId);
      if (sec) {
        const idx = sec.items.indexOf(item);
        if (idx !== -1) {
          sec.items[idx] = newName;
          const oldKey = sectionId + '|' + item;
          const newKey = sectionId + '|' + newName;
          state.mainState[newKey] = !!state.mainState[oldKey];
          delete state.mainState[oldKey];
          saveMain();
          await saveStructure();
        }
      }
    }
    renderMain();
  });
}

// ── Helper de edición inline ──────────────────────────────────────────────────

// Reemplaza un elemento de texto por un input editable y llama a onSave al confirmar
function startInlineEdit(el, currentValue, onSave) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-input';
  input.value = currentValue;
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

// ── Acciones globales ─────────────────────────────────────────────────────────

// Alterna entre mostrar todos los items o solo los pendientes
export function togglePending() {
  state.showPendingOnly = !state.showPendingOnly;
  document.getElementById('btn-pending').textContent = state.showPendingOnly ? 'Ver todos' : 'Ver pendientes';
  renderMain();
}

// Desmarca todos los items de la lista principal y sincroniza con Firestore
export function clearAll() {
  state.mainStructure.forEach(sec =>
    sec.items.forEach(item => { state.mainState[sec.id + '|' + item] = false; })
  );
  saveMain();
  renderMain();
}
