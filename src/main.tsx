import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
 // Phase 3: Register PWA if supported (handled by Vite plugin, but manual check for custom logic)
 if ('serviceWorker' in navigator) {
   window.addEventListener('load', () => {
     navigator.serviceWorker.register('/sw.js')
       .then(() => console.log('✅ SW registered'))
       .catch(err => console.error('❌ SW registration failed', err));
   });
 }
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
