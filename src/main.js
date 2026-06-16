/**
 * main.js — punto de entrada de la aplicación.
 *
 * Monta el componente <App/> en el elemento #app del HTML.
 * Importa los estilos globales.
 */
import { render } from 'preact';
import { html } from 'htm/preact';
import { App } from './components/App.js';
import 'leaflet/dist/leaflet.css';
import './styles/global.css';

render(html`<${App} />`, document.getElementById('app'));
