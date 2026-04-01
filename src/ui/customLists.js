// Renderiza la pantalla "Mis Listas": tarjetas de listas personalizadas con progreso, edición y eliminación
import { state }            from '../state/appState.js';
import { detailStats }      from '../utils/statsUtils.js';
import { deleteListFromDB } from '../services/listsService.js';
import { openList }         from './detail.js';

// Renderiza las tarjetas de todas las listas personalizadas con su progreso y acciones
export function renderLists() {
  const container = document.getElementById('lists-container');
  container.innerHTML = '';

  if (!state.customLists.length) {
    container.innerHTML = `<div class="empty">Aún no tienes listas personalizadas.<br>¡Crea la primera!</div>`;
    return;
  }

  state.customLists.forEach(list => {
    const { total, done } = detailStats(list);
    const pct = total > 0 ? ((done / total) * 100).toFixed(0) : 0;

    const card = document.createElement('div');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="list-card-emoji">${list.emoji}</div>
      <div class="list-card-info">
        <div class="list-card-name">${list.name}</div>
        <div class="list-card-meta">${done}/${total} seleccionados</div>
        <div class="list-card-prog">
          <div class="list-card-prog-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <span class="list-card-arrow">›</span>
      <button class="icon-btn sm list-card-edit" data-action="edit-list" data-id="${list.id}" title="Editar lista">✏️</button>
      <button class="icon-btn sm danger list-card-delete" title="Eliminar">🗑</button>
    `;

    card.querySelector('.list-card-info').addEventListener('click', () => openList(list.id));
    card.querySelector('.list-card-arrow').addEventListener('click', () => openList(list.id));
    card.querySelector('.list-card-delete').addEventListener('click', e => {
      e.stopPropagation();
      deleteList(list.id);
    });

    container.appendChild(card);
  });
}

// Pide confirmación al usuario y elimina la lista de Firestore
function deleteList(id) {
  if (!confirm('¿Eliminar esta lista?')) return;
  deleteListFromDB(id);
  // El listener de Firestore actualiza customLists y llama a renderLists automáticamente
}
