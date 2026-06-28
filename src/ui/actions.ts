// All state mutations live here so every entry point — the panels, the guided
// tour, and the URL loader — drives the exact same logic. Each action emits the
// channels the affected views listen on.

import {
  runKem,
  runSig,
  rebenchKem,
  rebenchSig,
} from '../crypto/session.ts';
import { APPROACHES, type Approach } from '../crypto/types.ts';
import { utf8ToBytes } from '@noble/hashes/utils';
import type { Store } from './store.ts';

export function establishKem(store: Store, a: Approach): void {
  store.state.kem[a] = runKem(a);
  store.emit('kem');
}

export function establishAllKem(store: Store): void {
  for (const a of APPROACHES) store.state.kem[a] = runKem(a);
  store.emit('kem');
}

export function rebenchKemCol(store: Store, a: Approach): void {
  const s = store.state.kem[a];
  if (s) store.state.kem[a] = rebenchKem(s);
  store.emit('kem');
}

export function signOne(store: Store, a: Approach): void {
  store.state.sig[a] = runSig(a, utf8ToBytes(store.state.message));
  store.emit('sig');
}

export function signAll(store: Store): void {
  const msg = utf8ToBytes(store.state.message);
  for (const a of APPROACHES) store.state.sig[a] = runSig(a, msg);
  store.emit('sig');
}

export function rebenchSigCol(store: Store, a: Approach): void {
  const s = store.state.sig[a];
  if (s) store.state.sig[a] = rebenchSig(s);
  store.emit('sig');
}

export function setMessage(store: Store, msg: string): void {
  store.state.message = msg;
  // Old signatures were over the previous message — invalidate them.
  for (const a of APPROACHES) store.state.sig[a] = null;
  store.emit('sig');
}

/** Fill any empty column so flipping a threat switch is never a no-op. */
export function ensurePopulated(store: Store): void {
  const msg = utf8ToBytes(store.state.message);
  for (const a of APPROACHES) {
    if (store.state.kem[a] === null) store.state.kem[a] = runKem(a);
    if (store.state.sig[a] === null) store.state.sig[a] = runSig(a, msg);
  }
}

export function setThreat(store: Store, which: 'classicalBroken' | 'pqBroken', value: boolean): void {
  store.state.threats[which] = value;
  ensurePopulated(store);
  store.emit('threats', 'kem', 'sig');
}

export function resetDemo(store: Store): void {
  store.state.threats.classicalBroken = false;
  store.state.threats.pqBroken = false;
  store.state.step = -1;
  for (const a of APPROACHES) {
    store.state.kem[a] = null;
    store.state.sig[a] = null;
  }
  store.emit('threats', 'kem', 'sig', 'step');
}

/** Re-run cryptographic randomness for established columns, keeping threats. */
export function rerollEstablished(store: Store): void {
  const msg = utf8ToBytes(store.state.message);
  for (const a of APPROACHES) {
    if (store.state.kem[a]) store.state.kem[a] = runKem(a);
    if (store.state.sig[a]) store.state.sig[a] = runSig(a, msg);
  }
  store.emit('kem', 'sig');
}
