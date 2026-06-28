// The break-a-half control. Two switches simulate "this algorithm family has
// fallen". They mutate shared state and emit so every comparison column in the
// page recolors at once. This is the control that drives the lab's core "aha".

import { el, clear } from './dom.ts';
import { runKem, runSig } from '../crypto/session.ts';
import { APPROACHES } from '../crypto/types.ts';
import { utf8ToBytes } from '@noble/hashes/utils';
import type { Store } from './store.ts';

/** Ensure every column has something to recolor, so flipping a switch is never a no-op. */
function ensurePopulated(store: Store): void {
  if (APPROACHES.every((a) => store.state.kem[a] === null)) {
    for (const a of APPROACHES) store.state.kem[a] = runKem(a);
  }
  if (APPROACHES.every((a) => store.state.sig[a] === null)) {
    const msg = utf8ToBytes(store.state.message);
    for (const a of APPROACHES) store.state.sig[a] = runSig(a, msg);
  }
}

export function buildSecurityModel(store: Store): HTMLElement {
  const summary = el('p', { class: 'threat-summary', role: 'status', 'aria-live': 'polite' });

  const toggle = (
    id: string,
    label: string,
    sub: string,
    set: (v: boolean) => void,
  ) => {
    const input = el('input', {
      type: 'checkbox',
      id,
      class: 'switch-input',
      onchange: (e) => {
        set((e.target as HTMLInputElement).checked);
        ensurePopulated(store);
        store.emit('threats', 'kem', 'sig');
        paint();
      },
    });
    return el('label', { class: 'switch', for: id }, [
      input,
      el('span', { class: 'switch-track', 'aria-hidden': 'true' }, el('span', { class: 'switch-thumb' })),
      el('span', { class: 'switch-label' }, [
        el('span', { class: 'switch-title' }, label),
        el('span', { class: 'switch-sub' }, sub),
      ]),
    ]);
  };

  function paint() {
    const { classicalBroken, pqBroken } = store.state.threats;
    clear(summary);
    let icon: string, cls: string, text: string;
    if (classicalBroken && pqBroken) {
      icon = '⛔';
      cls = 'broken';
      text =
        'Both families are broken. Nothing survives — hybrid included. The hedge only buys time against ONE break at a time, which is the realistic threat.';
    } else if (classicalBroken) {
      icon = '🛡️';
      cls = 'hedge';
      text =
        'A quantum computer broke X25519 / Ed25519. Classical-only is gone. Hybrid HOLDS — its ML-KEM / ML-DSA half still requires a lattice break.';
    } else if (pqBroken) {
      icon = '🛡️';
      cls = 'hedge';
      text =
        'A lattice break defeated ML-KEM / ML-DSA. Pure post-quantum is gone. Hybrid HOLDS — its classical half still requires breaking discrete log.';
    } else {
      icon = '✅';
      cls = 'secure';
      text = 'No algorithm is broken. All three approaches are secure today. Flip a switch to simulate a break.';
    }
    summary.className = `threat-summary ${cls}`;
    summary.append(el('span', { class: 'ts-icon', 'aria-hidden': 'true' }, icon), el('span', {}, text));
  }

  paint();

  return el('section', { class: 'section', 'aria-labelledby': 'sec-threat' }, [
    el('h2', { id: 'sec-threat' }, '🧪 The Security Model — break a half'),
    el('p', { class: 'lede' }, [
      'Hybrid’s promise: the session key and the signature stay secure as long as ',
      el('strong', {}, 'at least one'),
      ' of the two algorithms is unbroken. Flip these switches and watch the columns below react in real time.',
    ]),
    el('div', { class: 'switches' }, [
      toggle(
        'break-classical',
        'Quantum computer exists',
        'Breaks X25519 & Ed25519 (Shor)',
        (v) => (store.state.threats.classicalBroken = v),
      ),
      toggle(
        'break-pq',
        'Lattices fall',
        'Breaks ML-KEM & ML-DSA',
        (v) => (store.state.threats.pqBroken = v),
      ),
    ]),
    summary,
  ]);
}
