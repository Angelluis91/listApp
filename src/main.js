// Punto de entrada de la app: registra todos los event listeners del DOM e inicia las suscripciones a Firestore
import './styles/main.css';
import { subscribeMain, subscribeStructure }   from './services/mainService.js';
import { subscribeLists }                      from './services/listsService.js';
import { renderMain, togglePending, clearAll } from './ui/mainList.js';
import { renderLists }                         from './ui/customLists.js';
import { addDetailItem }                       from './ui/detail.js';
import { openModal, closeModal, createList, openEditModal } from './ui/modal.js';
import { switchTab, goBackToLists }            from './ui/navigation.js';

// ── Navegación por tabs ─────────────────────────────────────────────────────
document.getElementById('tab-main').addEventListener('click', () => switchTab('main'));
document.getElementById('tab-lists').addEventListener('click', () => switchTab('lists'));

// ── Pantalla principal ──────────────────────────────────────────────────────
document.getElementById('btn-pending').addEventListener('click', togglePending);
document.getElementById('btn-clear').addEventListener('click', clearAll);
document.getElementById('main-search').addEventListener('input', renderMain);

// ── Pantalla detalle ────────────────────────────────────────────────────────
document.getElementById('btn-back').addEventListener('click', goBackToLists);
document.getElementById('btn-add-item').addEventListener('click', addDetailItem);
document.getElementById('new-item-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addDetailItem();
});

// ── Modal nueva/editar lista ────────────────────────────────────────────────
document.getElementById('btn-new-list').addEventListener('click', openModal);
document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
document.getElementById('btn-modal-create').addEventListener('click', createList);
document.getElementById('modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('modal-name').addEventListener('keydown', e => { if (e.key === 'Enter') createList(); });

// Delegación de eventos para el botón de editar lista dentro del contenedor de listas
document.getElementById('lists-container').addEventListener('click', e => {
  const editBtn = e.target.closest('[data-action="edit-list"]');
  if (editBtn) { e.stopPropagation(); openEditModal(editBtn.dataset.id); }
});

// ── Inicio: suscribir a Firestore ───────────────────────────────────────────
subscribeMain(renderMain);
subscribeStructure(renderMain);
subscribeLists(renderLists);
