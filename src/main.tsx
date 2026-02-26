import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// No StrictMode — causes double-mount that breaks Three.js/r3f-globe
createRoot(document.getElementById('root')!).render(<App />)
