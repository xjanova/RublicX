import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { registerUpdates } from './update.js';
import { warmupKociemba } from './lib/solver.js';
import { migrateLegacy } from './lib/stats.js';
import './styles.css';

// One-time cleanup: drop legacy demo seed history from older builds.
try { migrateLegacy(); } catch {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

registerUpdates();

// Build the Kociemba pruning tables in the background so the first user solve isn't blocked.
// Runs on idle so it doesn't compete with first paint.
const kickoff = () => warmupKociemba().catch(() => {});
if (typeof requestIdleCallback === 'function') requestIdleCallback(kickoff, { timeout: 3000 });
else setTimeout(kickoff, 1500);
