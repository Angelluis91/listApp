// Punto de entrada de la app: registra todos los event listeners del DOM e inicia las suscripciones a Firestore
import './styles/main.css';
import { subscribeMain }          from './services/mainService.js';
import { subscribeLists }         from './services/listsService.js';
import { renderMain, togglePending, clearAll } from './ui/mainList.js';
import { renderLists }            from './ui/customLists.js';
import { addDetailItem }          from './ui/detail.js';
import { openModal, closeModal, createList } from './ui/modal.js';
import { switchTab, goBackToLists } from './ui/navigation.js';

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

// ── Modal nueva lista ───────────────────────────────────────────────────────
document.getElementById('btn-new-list').addEventListener('click', openModal);
document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
document.getElementById('btn-modal-create').addEventListener('click', createList);
document.getElementById('modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
document.getElementById('modal-name').addEventListener('keydown', e => { if (e.key === 'Enter') createList(); });

// ── Inicio: suscribir a Firestore ───────────────────────────────────────────
subscribeMain(renderMain);
subscribeLists(renderLists);
