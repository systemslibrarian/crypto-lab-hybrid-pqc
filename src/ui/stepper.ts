// Guided scenario tour. Choreographs the intended first-run story so the core
// insight is impossible to miss. Each step sets a DETERMINISTIC target state
// (so Back/Next are reversible), highlights the region that changed, and shows
// a one-line takeaway. It drives the same shared state the panels read, so the
// columns react exactly as a hand-driven session would.

import { el, clear } from './dom.ts';
import { ensurePopulated, resetDemo } from './actions.ts';
import type { Store } from './store.ts';

interface Step {
  title: string;
  takeaway: string;
  /** Section to spotlight (element id of its heading). */
  target: string;
}

const STEPS: Step[] = [
  { title: 'Establish a session key all three ways.', target: 'sec-kem', takeaway: 'Same job, wildly different sizes — the hybrid carries both halves on the wire.' },
  { title: 'Sign the message all three ways.', target: 'sec-sig', takeaway: 'An ML-DSA-65 signature is ~50× an Ed25519 one; the hybrid ships both.' },
  { title: 'A quantum computer arrives (classical falls).', target: 'sec-threat', takeaway: 'Classical-only collapses. Pure PQ is untouched. The hybrid is now hedge-holding.' },
  { title: 'Look at the key-exchange columns.', target: 'sec-kem', takeaway: 'The classical key is recovered — but the hybrid’s ML-KEM half still protects its session key.' },
  { title: 'Now lattices fall too (PQ also breaks).', target: 'sec-threat', takeaway: 'Only with BOTH halves broken does the hybrid finally fail.' },
  { title: 'That’s the hedge.', target: 'sec-kem', takeaway: 'A hybrid stays secure against any single break — the realistic threat during the migration.' },
];

/** The cumulative threat state implied by reaching step i. */
function threatFor(i: number): { classicalBroken: boolean; pqBroken: boolean } {
  return { classicalBroken: i >= 2, pqBroken: i >= 4 };
}

function highlight(id: string): void {
  const sec = document.getElementById(id)?.closest('section');
  if (!sec) return;
  sec.classList.add('cl-highlight');
  (sec as HTMLElement).scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => sec.classList.remove('cl-highlight'), 2200);
}

export function buildStepper(store: Store): HTMLElement {
  const panel = el('div', { class: 'tour-panel' });

  function go(i: number): void {
    store.state.step = i;
    const t = threatFor(i);
    store.state.threats.classicalBroken = t.classicalBroken;
    store.state.threats.pqBroken = t.pqBroken;
    ensurePopulated(store);
    store.emit('threats', 'kem', 'sig', 'step');
    highlight(STEPS[i].target);
  }

  function render(): void {
    clear(panel);
    const i = store.state.step;

    if (i < 0) {
      panel.append(
        el('div', { class: 'tour-intro' }, [
          el('div', {}, [
            el('strong', {}, 'New here? '),
            'Take the 6-step tour — it walks you to the “aha” and narrates what changes.',
          ]),
          el('button', { class: 'btn primary', type: 'button', onclick: () => go(0) }, '▶ Start guided tour'),
        ]),
      );
      return;
    }

    const step = STEPS[i];
    panel.append(
      el('div', { class: 'tour-active' }, [
        el('div', { class: 'tour-progress' }, [
          el('span', { class: 'tour-count' }, `Step ${i + 1} of ${STEPS.length}`),
          el('div', { class: 'tour-dots', 'aria-hidden': 'true' },
            STEPS.map((_, j) => el('span', { class: `tour-dot ${j <= i ? 'on' : ''}` }))),
        ]),
        el('p', { class: 'tour-title' }, step.title),
        el('p', { class: 'tour-takeaway' }, [el('span', { 'aria-hidden': 'true' }, '💡 '), step.takeaway]),
        el('div', { class: 'tour-nav' }, [
          el('button', { class: 'btn', type: 'button', disabled: i === 0, onclick: () => go(i - 1) }, '← Back'),
          i < STEPS.length - 1
            ? el('button', { class: 'btn primary', type: 'button', onclick: () => go(i + 1) }, 'Next →')
            : el('button', { class: 'btn primary', type: 'button', onclick: () => resetDemo(store) }, '↺ Finish & reset'),
          el('button', { class: 'btn ghost', type: 'button', onclick: () => { store.state.step = -1; store.emit('step'); } }, 'Exit tour'),
        ]),
      ]),
    );
  }

  render();
  store.on('step', render);

  return el('section', { class: 'section tour', 'aria-label': 'Guided tour' }, [panel]);
}
