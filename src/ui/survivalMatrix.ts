// A stable mental map that sits next to the threat switches: the full truth
// table of who survives which break, with the row matching the current switch
// state highlighted live. Flipping a switch moves the highlight, so the user
// always has the whole picture, not just the columns they happen to be looking at.

import { el, clear } from './dom.ts';
import { status, type SecurityStatus, type CompromiseState } from '../crypto/compromise.ts';
import { APPROACHES } from '../crypto/types.ts';
import type { Store } from './store.ts';

const ROWS: Array<{ key: string; label: string; state: CompromiseState }> = [
  { key: 'none', label: 'No break', state: { classicalBroken: false, pqBroken: false } },
  { key: 'q', label: 'Quantum computer', state: { classicalBroken: true, pqBroken: false } },
  { key: 'l', label: 'Lattice break', state: { classicalBroken: false, pqBroken: true } },
  { key: 'both', label: 'Both break', state: { classicalBroken: true, pqBroken: true } },
];

const CELL: Record<SecurityStatus, { icon: string; text: string }> = {
  secure: { icon: '✅', text: 'Secure' },
  'hedge-holding': { icon: '🛡️', text: 'Holds' },
  broken: { icon: '⛔', text: 'Broken' },
};

const COL_LABEL = { classical: 'Classical', pq: 'PQ only', hybrid: 'Hybrid' } as const;

function sameState(a: CompromiseState, b: CompromiseState): boolean {
  return a.classicalBroken === b.classicalBroken && a.pqBroken === b.pqBroken;
}

export function buildSurvivalMatrix(store: Store): HTMLElement {
  const tbody = el('tbody', {});

  function paint() {
    clear(tbody);
    for (const r of ROWS) {
      const current = sameState(r.state, store.state.threats);
      const cells = APPROACHES.map((a) => {
        const st = status(a, r.state);
        const c = CELL[st];
        return el('td', { class: `sm-cell status-${st}` }, [
          el('span', { 'aria-hidden': 'true' }, c.icon + ' '),
          el('span', {}, c.text),
        ]);
      });
      tbody.append(
        el('tr', { class: current ? 'sm-current' : '', 'aria-current': current ? 'true' : undefined }, [
          el('th', { scope: 'row' }, [r.label, current ? el('span', { class: 'sm-now' }, ' ← now') : null]),
          ...cells,
        ]),
      );
    }
  }

  paint();
  store.on('threats', paint);

  return el('figure', { class: 'survival' }, [
    el('figcaption', {}, 'Who survives which break'),
    el('div', { class: 'table-scroll' }, [
      el('table', { class: 'survival-table' }, [
        el(
          'thead',
          {},
          el('tr', {}, [
            el('th', { scope: 'col' }, 'Threat'),
            ...APPROACHES.map((a) => el('th', { scope: 'col' }, COL_LABEL[a])),
          ]),
        ),
        tbody,
      ]),
    ]),
  ]);
}
