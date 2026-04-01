// Gestiona la navegación entre pantallas: cambio de tabs y retorno desde el detalle a las listas
import { state }       from '../state/appState.js';
import { renderMain }  from './mainList.js';
import { renderLists } from './customLists.js';

// Activa la pantalla y el tab correspondiente, ocultando el resto
export function switchTab(tab) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  state.activeTab = tab;

  if (tab === 'lists') {
    document.getElementById('screen-lists').classList.add('active');
    renderLists();
  } else {
    document.getElementById('screen-main').classList.add('active');
    renderMain();
  }
}

// Oculta la pantalla de detalle y vuelve a la pantalla de listas personalizadas
export function goBackToLists() {
  document.getElementById('screen-detail').classList.remove('active');
  document.getElementById('screen-lists').classList.add('active');
  renderLists();
}
