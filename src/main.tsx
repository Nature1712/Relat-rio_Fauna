import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Completely unregister Service Worker globally to prevent any persistent caching issues on mobile/desktop
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
      console.log('ServiceWorker desativado para restaurar acesso direto.');
    }
  });
}

// Clear all cache stores to remove any persistent 404/broken pages
if (window.caches) {
  caches.keys().then((names) => {
    for (const name of names) {
      caches.delete(name);
      console.log('Cache limpo:', name);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

