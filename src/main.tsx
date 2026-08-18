import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setupServiceWorker } from './app/serviceWorker';
import './styles/global.css';

const container = document.querySelector('#root');
if (!container) throw new Error('Wurzelelement #root fehlt.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Precache aller Assets: nach dem ersten Laden laeuft die App ohne Netz.
setupServiceWorker();
