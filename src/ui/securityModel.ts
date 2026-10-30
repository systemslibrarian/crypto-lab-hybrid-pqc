// The break-a-half control. Two switches simulate "this algorithm family has
// fallen". They mutate shared state and emit so every comparison column in the
// page recolors at once, and the survival matrix below gives the whole truth
// table at a glance. This is the control that drives the lab's core "aha".

import { el, clear } from './dom.ts';
import { setThreat, resetDemo } from './actions.ts';
import { buildSurvivalMatrix } from './survivalMatrix.ts';
import { shareUrl } from './urlState.ts';
import { verdictsFor } from '../crypto/proofSet.ts';
import { APPROACHES, type Approach } from '../crypto/types.ts';
import type { Store } from './store.ts';

const APPROACH_NAME: Record<Approach, string> = {
  classical: 'classical-only',
  pq: 'PQ-only',
  hybrid: 'hybrid',
};

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

    const { classicalBroken } = store.state.threats;
    clear(summary);

    // What fell and what held is read off the runs in the survival table: each
    // verdict there is a real key-recovery attempt and a real forgery.
    const verdicts = verdictsFor(store.state.threats);
    const fell = APPROACHES.filter((a) => verdicts[a].overall === 'broken');
    const held = APPROACHES.filter((a) => verdicts[a].overall === 'hedge-holding');
    const names = (list: Approach[]) => list.map((a) => APPROACH_NAME[a]).join(' and ');

    let icon: string, cls: string, text: string;
    if (fell.length === 0 && held.length === 0) {
      icon = '✅';
      cls = 'secure';
      text =
        'No component secret is disclosed. The attacker ran anyway: no reconstructed key matched, and every forged signature was rejected. Flip a switch to simulate a break.';
    } else if (fell.length === APPROACHES.length) {
      icon = '⛔';
      cls = 'broken';
      text = `Both families are modeled as compromised. The attacker reconstructed the session key and the verifier accepted a forgery for all three approaches — hybrid included. This records the outcome under the selected secret-disclosure model.`;
    } else {
      const cause = classicalBroken
        ? 'The classical X25519 / Ed25519 secrets are disclosed'
        : 'The post-quantum ML-KEM / ML-DSA secrets are disclosed';
      const survivor = classicalBroken
        ? 'the attacker did not receive the ML-KEM / ML-DSA secrets'
        : 'the attacker did not receive the X25519 / Ed25519 secrets';
      icon = '🛡️';
      cls = 'hedge';
      text = `${cause}. The attack succeeded against ${names(fell) || 'nothing'} — key recovered, forgery accepted. It was run against ${names(
        held,
      )} too and failed: the reconstructed key did not match and the verifier rejected the forgery, because ${survivor}.`;
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
    el('span', { class: 'sl' }, [el('span', { class: 'sl-dot sl-secure' }), '✅ Attempts failed']),
    el('span', { class: 'sl' }, [el('span', { class: 'sl-dot sl-hedge' }), '🛡️ Hedge holding (one half down)']),
    el('span', { class: 'sl' }, [el('span', { class: 'sl-dot sl-broken' }), '⛔ Attacks succeeded']),
  ]);

  const section = el('section', { class: 'section', 'aria-labelledby': 'sec-threat' }, [
    el('div', { class: 'model-head' }, [
      el('h2', { id: 'sec-threat' }, '🧪 The Security Model — break a half'),
      el('button', { class: 'btn reset', type: 'button', onclick: () => resetDemo(store) }, '↺ Reset demo'),
    ]),
    el('p', { class: 'lede' }, [
      'This model runs specific session-key recovery and new-message forgery attempts. A robust hybrid aims to preserve the relevant security property while ',
      el('strong', {}, 'at least one'),
      ' component remains secure, under the combiner and protocol assumptions. The displayed failures are not a general security proof. Flip these switches to disclose component secrets and inspect the resulting attempts.',
    ]),
    el('p', { class: 'lede', id: 'signature-security-scope' }, [
      'Both component signatures must verify: that is the acceptance rule. A suitably constructed hybrid can retain new-message unforgeability when one component remains unforgeable. New-message unforgeability (EUF-CMA) is different from strong unforgeability (SUF-CMA), which also forbids a different valid signature for an already-signed message. After one component is compromised, an attacker can retain the intact signature and replace the compromised component on that same message. The AND verifier can accept it; this does not authorize a new message. ',
      el('a', { href: 'https://datatracker.ietf.org/doc/html/draft-ietf-lamps-pq-composite-sigs-16#section-9.2.2' }, 'Composite ML-DSA §9.2.2'),
      ' explains this limitation. Applications requiring SUF-CMA should not use Composite ML-DSA. The ',
      el('a', { href: 'https://mailarchive.ietf.org/arch/msg/cfrg/HaPTmTOFZSBSjw1vbhXCeya0tH8/' }, 'CFRG discussion of 14 October 2026'),
      ' is not an adoption call or a final standard.',
    ]),
    legend,
    el('div', { class: 'switches' }, [
      toggle('break-classical', 'classicalBroken', 'Quantum computer exists', 'Models a Shor-capable computer: discloses classical secrets'),
      toggle('break-pq', 'pqBroken', 'Lattices fall', 'Models a component compromise: discloses PQ secrets'),
    ]),
    summary,
    buildSurvivalMatrix(store),
    el('div', { class: 'share-row' }, [copyBtn]),
  ]);

  paint();
  store.on('threats', paint);

  return section;
}
