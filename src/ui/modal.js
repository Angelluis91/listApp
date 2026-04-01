// Controla el modal de creación de nueva lista: apertura, cierre, selector de emoji y guardado en Firestore
import { state }    from '../state/appState.js';
import { EMOJIS }   from '../data/mainData.js';
import { saveList } from '../services/listsService.js';
import { openList } from './detail.js';

// Abre el modal, resetea el formulario y pone el foco en el campo nombre
export function openModal() {
  document.getElementById('modal-name').value = '';
  state.selectedEmoji = '📝';
  renderEmojiPicker();
  document.getElementById('modal').classList.add('open');
  setTimeout(() => document.getElementById('modal-name').focus(), 200);
}

// Cierra el modal eliminando la clase CSS que lo hace visible
export function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

// Renderiza los emojis disponibles, marcando el seleccionado actualmente
function renderEmojiPicker() {
  const picker = document.getElementById('emoji-picker');
  picker.innerHTML = '';
  EMOJIS.forEach(emoji => {
    const span = document.createElement('span');
    span.className = 'emoji-opt' + (emoji === state.selectedEmoji ? ' selected' : '');
    span.textContent = emoji;
    span.addEventListener('click', () => { state.selectedEmoji = emoji; renderEmojiPicker(); });
    picker.appendChild(span);
  });
}

// Valida el nombre, crea la lista en Firestore y navega al detalle de la nueva lista
export async function createList() {
  const nameInput = document.getElementById('modal-name');
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }

  const id   = Date.now().toString();
  const list = { id, name, emoji: state.selectedEmoji, items: [], createdAt: Date.now() };

  closeModal();
  await saveList(list);

  // El listener de Firestore añadirá la lista; abrimos el detalle inmediatamente
  state.customLists.push(list);
  setTimeout(() => openList(id), 200);
}
