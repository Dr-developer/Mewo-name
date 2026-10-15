import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Block browser gestures that would zoom or scroll the page while playing.
// Scrollable areas (the final letter) opt back in with the `.scrollable` class.
const blockGesture = (e: Event) => e.preventDefault();
document.addEventListener('gesturestart', blockGesture, { passive: false }); // iOS pinch
document.addEventListener('dblclick', blockGesture, { passive: false });
document.addEventListener(
  'touchmove',
  (e) => {
    const target = e.target as Element | null;
    if (!target?.closest?.('.scrollable')) e.preventDefault();
  },
  { passive: false },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
