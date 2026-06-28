// Shareable, reproducible demo state in the query string — for teaching. ONLY
// non-secret UI choices are serialized (threat switches, message, tour step).
// Keys, ciphertexts, signatures, and session secrets are NEVER put in the URL;
// they are recomputed locally on load. Param keys are short on purpose.

import { ensurePopulated } from './actions.ts';
import { STEP_COUNT } from './stepper.ts';
import { DEFAULT_MESSAGE, type Store } from './store.ts';

export const MAX_MSG = 280;

/** Read state from the URL into the store (call before building the UI). */
export function applyUrl(store: Store): void {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return;
  }

  if (params.get('c') === '1') store.state.threats.classicalBroken = true;
  if (params.get('q') === '1') store.state.threats.pqBroken = true;

  const msg = params.get('msg');
  if (msg !== null) store.state.message = msg.slice(0, MAX_MSG);

  const step = params.get('step');
  if (step !== null) {
    const n = parseInt(step, 10);
    if (Number.isFinite(n)) store.state.step = Math.max(-1, Math.min(STEP_COUNT - 1, n));
  }

  // If the shared state implies broken algorithms or an active tour, populate
  // the columns now so the page opens already showing that state.
  if (store.state.threats.classicalBroken || store.state.threats.pqBroken || store.state.step >= 0) {
    ensurePopulated(store);
  }
}

function writeUrl(store: Store): void {
  const p = new URLSearchParams();
  if (store.state.threats.classicalBroken) p.set('c', '1');
  if (store.state.threats.pqBroken) p.set('q', '1');
  if (store.state.message !== DEFAULT_MESSAGE) p.set('msg', store.state.message);
  if (store.state.step >= 0) p.set('step', String(store.state.step));

  const qs = p.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  try {
    window.history.replaceState(null, '', url);
  } catch {
    /* non-browser / sandboxed: ignore */
  }
}

/** Keep the URL in sync as the shareable state changes. */
export function initUrlSync(store: Store): void {
  // 'sig' fires on message edits; 'threats' on switch flips; 'step' on the tour.
  store.on('threats', () => writeUrl(store));
  store.on('sig', () => writeUrl(store));
  store.on('step', () => writeUrl(store));
}

/** The current shareable URL (absolute), for a copy-link control. */
export function shareUrl(): string {
  return window.location.href;
}
