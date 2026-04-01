// Renderiza y gestiona la interacción de la pantalla principal (La Compra): secciones, filtros, búsqueda y toggle de items
import { state }           from '../state/appState.js';
import { MAIN_DATA }       from '../data/mainData.js';
import { mainStats, secStats } from '../utils/statsUtils.js';
import { saveMain }        from '../services/mainService.js';

// Actualiza los contadores de total/completados y la barra de progreso global
export function updateMainSummary() {
  const { total, done } = mainStats(MAIN_DATA, state.mainState);
  document.getElementById('s-total').textContent = total;
  document.getElementById('s-done').textContent  = done;
  const pct = total > 0 ? ((done / total) * 100).toFixed(0) : 0;
  document.getElementById('g-prog').style.width = pct + '%';
}

// Renderiza los chips de filtro por categoría en la barra superior
export function renderMainFilters() {
  const bar = document.getElementById('main-filters');
  bar.innerHTML = '';

  const allChip = document.createElement('div');
  allChip.className = 'chip' + (state.activeFilter === 'all' ? ' active' : '');
  allChip.textContent = 'Todos';
  allChip.addEventListener('click', () => { state.activeFilter = 'all'; renderMain(); });
  bar.appendChild(allChip);

  MAIN_DATA.forEach(sec => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (state.activeFilter === sec.id ? ' active' : '');
    chip.textContent = sec.icon + ' ' + sec.name;
    chip.addEventListener('click', () => { state.activeFilter = sec.id; renderMain(); });
    bar.appendChild(chip);
  });
}

// Renderiza todas las secciones y sus items aplicando filtro activo y búsqueda por texto
export function renderMain() {
  renderMainFilters();
  updateMainSummary();

  const searchQuery = document.getElementById('main-search').value.toLowerCase().trim();
  const container   = document.getElementById('main-sections');
  container.innerHTML = '';

  const sections = state.activeFilter === 'all'
    ? MAIN_DATA
    : MAIN_DATA.filter(s => s.id === state.activeFilter);

  let any = false;

  sections.forEach(sec => {
    const filtered = sec.items.filter(item => {
      if (state.showPendingOnly && state.mainState[sec.id + '|' + item]) return false;
      if (searchQuery && !item.toLowerCase().includes(searchQuery)) return false;
      return true;
    });
    if (!filtered.length) return;

    any = true;
    const { total, done } = secStats(sec, state.mainState);
    const pct = total > 0 ? ((done / total) * 100).toFixed(0) : 0;

    const div = document.createElement('div');
    div.className = 'section';
    div.id = 'sec-' + sec.id;
    div.innerHTML = `
      <div class="section-hdr">
        <span class="section-icon">${sec.icon}</span>
        <span class="section-name">${sec.name}</span>
        <span class="sec-count" id="sc-${sec.id}">${done}/${total}</span>
        <span class="caret">▾</span>
      </div>
      <div class="sec-progress">
        <div class="sec-progress-fill" id="sp-${sec.id}" style="width:${pct}%"></div>
      </div>
      <div class="items-grid" id="grid-${sec.id}"></div>
    `;
    div.querySelector('.section-hdr').addEventListener('click', () => toggleSec(sec.id));
    container.appendChild(div);

    const grid = div.querySelector('#grid-' + sec.id);
    filtered.forEach(item => {
      const k  = sec.id + '|' + item;
      const el = document.createElement('div');
      el.className = 'item' + (state.mainState[k] ? ' checked' : '');
      el.innerHTML = `<div class="cb">${state.mainState[k] ? '✓' : ''}</div><span class="item-label">${item}</span>`;
      el.addEventListener('click', () => toggleMainItem(sec, item, el));
      grid.appendChild(el);
    });
  });

  if (!any) {
    container.innerHTML = `<div class="empty">🔍 No se encontraron productos</div>`;
  }
}

// Marca o desmarca un item y actualiza la UI y Firestore sin re-renderizar toda la pantalla
function toggleMainItem(sec, item, el) {
  const k = sec.id + '|' + item;
  state.mainState[k] = !state.mainState[k];
  el.classList.toggle('checked', state.mainState[k]);
  el.querySelector('.cb').textContent = state.mainState[k] ? '✓' : '';
  updateMainSummary();

  const { total, done } = secStats(sec, state.mainState);
  const pct = total > 0 ? ((done / total) * 100).toFixed(0) : 0;
  const sp = document.getElementById('sp-' + sec.id);
  const sc = document.getElementById('sc-' + sec.id);
  if (sp) sp.style.width = pct + '%';
  if (sc) sc.textContent = done + '/' + total;

  saveMain();
}

// Expande o colapsa una sección al pulsar su cabecera
function toggleSec(id) {
  const s = document.getElementById('sec-' + id);
  if (s) s.classList.toggle('collapsed');
}

// Alterna entre mostrar todos los items o solo los pendientes (no marcados)
export function togglePending() {
  state.showPendingOnly = !state.showPendingOnly;
  document.getElementById('btn-pending').textContent = state.showPendingOnly ? 'Ver todos' : 'Ver pendientes';
  renderMain();
}

// Desmarca todos los items de la lista principal y sincroniza con Firestore
export function clearAll() {
  MAIN_DATA.forEach(sec =>
    sec.items.forEach(item => { state.mainState[sec.id + '|' + item] = false; })
  );
  saveMain();
  renderMain();
}
