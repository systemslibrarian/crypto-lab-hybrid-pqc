// A stable mental map that sits next to the threat switches: the full truth
// table of who survives which break, with the row matching the current switch
// state highlighted live. Flipping a switch moves the highlight, so the user
// always has the whole picture, not just the columns they happen to be looking at.
//
// Every cell is computed, not tabulated: for each (approach, threat) pair the
// lab runs a real key-recovery attempt and a real signature forgery against a
// reference session and judges the cell on what they did. See proofSet.ts.

import { el, clear } from './dom.ts';
import { survivalTable, THREAT_ROWS, rowKeyFor } from '../crypto/proofSet.ts';
import type { SecurityStatus, CompromiseState } from '../crypto/compromise.ts';
import { APPROACHES } from '../crypto/types.ts';
import type { Store } from './store.ts';

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
    const table = survivalTable();
    for (const r of THREAT_ROWS) {
      const current = sameState(r.state, store.state.threats);
      const verdicts = table[rowKeyFor(r.state)];
      const cells = APPROACHES.map((a) => {
        const v = verdicts[a];
        const c = CELL[v.overall];
        return el(
          'td',
          {
            class: `sm-cell status-${v.overall}`,
            // What the run actually did, for anyone who wants the receipts.
            title: `key recovered: ${v.keyRecovered ? 'yes' : 'no'} · forgery accepted: ${
              v.forgeryAccepted ? 'yes' : 'no'
            }`,
          },
          [el('span', { 'aria-hidden': 'true' }, c.icon + ' '), el('span', {}, c.text)],
        );
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
    el('div', { class: 'table-scroll', tabindex: '0' }, [
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
    el(
      'p',
      { class: 'survival-note' },
      'Each cell is the outcome of running the attack on a reference session: the attacker reconstructs a key with the real combiner and we compare the bytes, and they sign a message of their choosing with whatever keys the break gave them and the honest verifier is run on it.',
    ),
  ]);
}
