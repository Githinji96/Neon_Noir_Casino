import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App';

// Apply persisted theme on startup before first render
try {
  const stored = localStorage.getItem('neon-noir-settings-v2');
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed?.state?.settings?.theme === 'light') {
      document.documentElement.classList.add('theme-light');
    }
  }
} catch { /* ignore */ }

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
