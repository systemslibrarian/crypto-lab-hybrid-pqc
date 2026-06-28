// Component-level "why" for each column. Instead of only asserting the hybrid
// holds, this shows the parts: which underlying secret/verification the attacker
// has, and how the combiner / AND-verify turns "one survivor" into safety. The
// data is the same model the crypto code uses (compromise.ts), surfaced so the
// claim reads as proven, not stated.

import { el } from './dom.ts';
import type { Approach } from '../crypto/types.ts';
import type { CompromiseState } from '../crypto/compromise.ts';

interface Row {
  label: string;
  ok: boolean;
  okText: string;
  badText: string;
  /** 'secret' rows use lock icons; 'gate' rows (combiner / AND-verify) use shield. */
  gate?: boolean;
}

function row(r: Row): HTMLElement {
  const icon = r.gate ? (r.ok ? '🛡️' : '⛔') : r.ok ? '🔒' : '🔓';
  return el('li', { class: `an-row ${r.ok ? 'an-ok' : 'an-bad'}${r.gate ? ' an-gate' : ''}` }, [
    el('span', { class: 'an-icon', 'aria-hidden': 'true' }, icon),
    el('span', { class: 'an-label' }, r.label),
    el('span', { class: 'an-state' }, r.ok ? r.okText : r.badText),
  ]);
}

function list(caption: string, rows: Row[]): HTMLElement {
  return el('div', { class: 'anatomy' }, [
    el('p', { class: 'anatomy-cap' }, caption),
    el('ul', { class: 'an-list' }, rows.map(row)),
  ]);
}

/** Key-exchange anatomy: component shared secrets + the combiner gate. */
export function kemAnatomy(approach: Approach, t: CompromiseState): HTMLElement {
  if (approach === 'classical') {
    return list('Attacker’s view', [
      { label: 'X25519 shared secret', ok: !t.classicalBroken, okText: 'secret', badText: 'recovered' },
    ]);
  }
  if (approach === 'pq') {
    return list('Attacker’s view', [
      { label: 'ML-KEM-768 shared secret', ok: !t.pqBroken, okText: 'secret', badText: 'recovered' },
    ]);
  }
  return list('Attacker’s view', [
    { label: 'X25519 shared secret', ok: !t.classicalBroken, okText: 'secret', badText: 'recovered' },
    { label: 'ML-KEM-768 shared secret', ok: !t.pqBroken, okText: 'secret', badText: 'recovered' },
    {
      label: 'Combiner output (needs both)',
      ok: !(t.classicalBroken && t.pqBroken),
      okText: 'unrecoverable',
      badText: 'recovered',
      gate: true,
    },
  ]);
}

/** Signature anatomy: per-scheme verification + the hybrid AND gate. */
export function sigAnatomy(approach: Approach, t: CompromiseState): HTMLElement {
  if (approach === 'classical') {
    return list('Verifier checklist', [
      { label: 'Ed25519 signature', ok: !t.classicalBroken, okText: 'unforgeable', badText: 'forgeable' },
    ]);
  }
  if (approach === 'pq') {
    return list('Verifier checklist', [
      { label: 'ML-DSA-65 signature', ok: !t.pqBroken, okText: 'unforgeable', badText: 'forgeable' },
    ]);
  }
  return list('Verifier checklist', [
    { label: 'Ed25519 signature', ok: !t.classicalBroken, okText: 'unforgeable', badText: 'forgeable' },
    { label: 'ML-DSA-65 signature', ok: !t.pqBroken, okText: 'unforgeable', badText: 'forgeable' },
    {
      label: 'Hybrid verifier (requires both)',
      ok: !(t.classicalBroken && t.pqBroken),
      okText: 'rejects forgeries',
      badText: 'accepts forgery',
      gate: true,
    },
  ]);
}
