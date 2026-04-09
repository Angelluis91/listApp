// Controla el modal de creación/edición de lista: apertura, cierre, selector de emoji, recordatorio y guardado en Firestore
import { state }                    from '../state/appState.js';
import { EMOJIS }                   from '../data/mainData.js';
import { saveList, updateListMeta } from '../services/listsService.js';
import { openList }                 from './detail.js';

// ID de la lista que se está editando; null cuando el modal está en modo creación
let editingListId = null;

// Abre el modal en modo creación, resetea el formulario y pone el foco en el campo nombre
export function openModal() {
  editingListId = null;
  document.getElementById('modal-title').textContent       = 'Nueva lista';
  document.getElementById('btn-modal-create').textContent  = 'Crear';
  document.getElementById('modal-name').value    = '';
  document.getElementById('modal-reminder').value = '';
  state.selectedEmoji = '📝';
  renderEmojiPicker();
  document.getElementById('modal').classList.add('open');
  setTimeout(() => document.getElementById('modal-name').focus(), 200);
}

// Abre el modal en modo edición cargando los datos actuales de la lista indicada
export function openEditModal(listId) {
  const list = state.customLists.find(l => l.id === listId);
  if (!list) return;

  editingListId = listId;
  document.getElementById('modal-title').textContent       = 'Editar lista';
  document.getElementById('btn-modal-create').textContent  = 'Guardar';
  document.getElementById('modal-name').value              = list.name;
  // Cargar recordatorio existente en formato datetime-local (YYYY-MM-DDTHH:MM)
  document.getElementById('modal-reminder').value = list.reminder
    ? new Date(list.reminder).toISOString().slice(0, 16)
    : '';
  state.selectedEmoji = list.emoji;
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

// Valida el nombre y crea una nueva lista o actualiza la existente según el modo del modal
export async function createList() {
  const nameInput     = document.getElementById('modal-name');
  const reminderInput = document.getElementById('modal-reminder');
  const name = nameInput.value.trim();
  if (!name) { nameInput.focus(); return; }

  // Convertir datetime-local a ISO string; null si no hay fecha
  const reminder = reminderInput.value ? new Date(reminderInput.value).toISOString() : null;

  closeModal();

  if (editingListId) {
    // Modo edición: actualizar nombre, emoji y recordatorio sin tocar los items
    await updateListMeta(editingListId, { name, emoji: state.selectedEmoji, reminder });
    editingListId = null;
    return;
  }

  // Modo creación: guardar en Firestore y abrir detalle
  const id   = Date.now().toString();
  const list = { id, name, emoji: state.selectedEmoji, items: [], createdAt: Date.now(), reminder };
  await saveList(list);
  openList(id);
}

// Limpia el campo de recordatorio del modal (botón ✕)
export function clearReminder() {
  document.getElementById('modal-reminder').value = '';
}
