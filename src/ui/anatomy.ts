// Component-level "why" for each column. Instead of only asserting the hybrid
// holds, this shows the parts: which underlying secret the attacker actually
// held, and what happened when the combiner / AND-verify ran with it.
//
// Every row is read off a completed attack (attack.ts): the gate rows report
// whether the reconstructed key matched and whether the verifier accepted the
// forgery, and the per-half signature rows report what each half's verifier
// said about the bytes the attacker submitted.

import { el } from './dom.ts';
import type { Approach } from '../crypto/types.ts';
import type { KeyRecovery, Forgery } from '../crypto/attack.ts';

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

const SECRET_LABEL: Record<'classical' | 'pq', string> = {
  classical: 'X25519 shared secret',
  pq: 'ML-KEM-768 shared secret',
};

/** Key-exchange anatomy: what the attacker held, and what the combiner produced. */
export function kemAnatomy(approach: Approach, r: KeyRecovery): HTMLElement {
  const secretRows: Row[] = [];
  for (const family of ['classical', 'pq'] as const) {
    if (!r.held.includes(family) && !r.guessed.includes(family)) continue;
    secretRows.push({
      label: SECRET_LABEL[family],
      ok: !r.held.includes(family),
      okText: 'secret — attacker guessed',
      badText: 'recovered',
    });
  }
  if (approach !== 'hybrid') return list('Attacker’s view', secretRows);

  return list('Attacker’s view', [
    ...secretRows,
    {
      label: 'Combiner output (needs both)',
      // Measured: did the bytes the attacker derived equal the session key?
      ok: !r.matches,
      okText: 'did not match the session key',
      badText: 'matched the session key',
      gate: true,
    },
  ]);
}

/** Signature anatomy: what each half's verifier said about the forged bytes. */
export function sigAnatomy(approach: Approach, f: Forgery): HTMLElement {
  const halfRows: Row[] = f.halves.map((h) => ({
    label: `${h.algo} signature`,
    // Measured: this half's verifier ran on the attacker's bytes and answered.
    ok: !h.verified,
    okText: 'forgery rejected',
    badText: 'forgery verified',
  }));
  if (approach !== 'hybrid') return list('Verifier checklist', halfRows);

  return list('Verifier checklist', [
    ...halfRows,
    {
      label: 'Hybrid verifier (requires both)',
      ok: !f.accepted,
      okText: 'rejected the forgery',
      badText: 'accepted the forgery',
      gate: true,
    },
  ]);
}
