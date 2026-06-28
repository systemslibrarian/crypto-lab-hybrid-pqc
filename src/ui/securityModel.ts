// The break-a-half control. Two switches simulate "this algorithm family has
// fallen". They mutate shared state and emit so every comparison column in the
// page recolors at once, and the survival matrix below gives the whole truth
// table at a glance. This is the control that drives the lab's core "aha".

import { el, clear } from './dom.ts';
import { setThreat, resetDemo } from './actions.ts';
import { buildSurvivalMatrix } from './survivalMatrix.ts';
import { shareUrl } from './urlState.ts';
import type { Store } from './store.ts';

export function buildSecurityModel(store: Store): HTMLElement {
  const summary = el('p', { class: 'threat-summary', role: 'status', 'aria-live': 'polite' });
  const inputs: Record<'classicalBroken' | 'pqBroken', HTMLInputElement> = {} as Record<
    'classicalBroken' | 'pqBroken',
    HTMLInputElement
  >;

  const toggle = (id: string, which: 'classicalBroken' | 'pqBroken', label: string, sub: string) => {
    const input = el('input', {
      type: 'checkbox',
      id,
      class: 'switch-input',
      onchange: (e) => setThreat(store, which, (e.target as HTMLInputElement).checked),
    });
    inputs[which] = input;
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
    // Keep the switches in sync with state (the tour / URL / reset move them).
    inputs.classicalBroken.checked = store.state.threats.classicalBroken;
    inputs.pqBroken.checked = store.state.threats.pqBroken;

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

  const copyBtn = el(
    'button',
    {
      class: 'btn tiny',
      type: 'button',
      onclick: () => {
        navigator.clipboard?.writeText(shareUrl()).then(
          () => {
            copyBtn.textContent = '✓ link copied';
            setTimeout(() => (copyBtn.textContent = '🔗 Copy link to this state'), 1400);
          },
          () => {},
        );
      },
    },
    '🔗 Copy link to this state',
  );

  const legend = el('div', { class: 'status-legend', 'aria-hidden': 'true' }, [
    el('span', { class: 'sl' }, [el('span', { class: 'sl-dot sl-secure' }), '✅ Secure']),
    el('span', { class: 'sl' }, [el('span', { class: 'sl-dot sl-hedge' }), '🛡️ Hedge holding (one half down)']),
    el('span', { class: 'sl' }, [el('span', { class: 'sl-dot sl-broken' }), '⛔ Broken']),
  ]);

  const section = el('section', { class: 'section', 'aria-labelledby': 'sec-threat' }, [
    el('div', { class: 'model-head' }, [
      el('h2', { id: 'sec-threat' }, '🧪 The Security Model — break a half'),
      el('button', { class: 'btn reset', type: 'button', onclick: () => resetDemo(store) }, '↺ Reset demo'),
    ]),
    el('p', { class: 'lede' }, [
      'Hybrid’s promise: the session key and the signature stay secure as long as ',
      el('strong', {}, 'at least one'),
      ' of the two algorithms is unbroken. Flip these switches and watch the key-exchange columns above and the signature columns below react in real time.',
    ]),
    legend,
    el('div', { class: 'switches' }, [
      toggle('break-classical', 'classicalBroken', 'Quantum computer exists', 'Breaks X25519 & Ed25519 (Shor)'),
      toggle('break-pq', 'pqBroken', 'Lattices fall', 'Breaks ML-KEM & ML-DSA'),
    ]),
    summary,
    buildSurvivalMatrix(store),
    el('div', { class: 'share-row' }, [copyBtn]),
  ]);

  paint();
  store.on('threats', paint);

  return section;
}
