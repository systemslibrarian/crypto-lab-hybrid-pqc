// The security model — the lesson of the whole lab in ~30 lines.
//
// An approach relies on one or more algorithm families. It is COMPROMISED only
// when EVERY family it relies on has been broken. Hybrid relies on two
// unrelated families, so a single break leaves it "hedge-holding" — degraded in
// the sense that one of its two guarantees is gone, but the session key /
// signature is still secure because the other half still requires breaking a
// hard problem.

import type { Approach } from './types.ts';

export interface CompromiseState {
  /** An attacker can now break classical (X25519 / Ed25519) — e.g. a CRQC exists. */
  classicalBroken: boolean;
  /** An attacker can now break the PQ scheme (ML-KEM / ML-DSA) — e.g. a lattice break. */
  pqBroken: boolean;
}

export const NO_THREAT: CompromiseState = { classicalBroken: false, pqBroken: false };

/** Algorithm families each approach depends on. */
export const RELIES_ON: Record<Approach, Array<'classical' | 'pq'>> = {
  classical: ['classical'],
  pq: ['pq'],
  hybrid: ['classical', 'pq'],
};

function familyBroken(family: 'classical' | 'pq', s: CompromiseState): boolean {
  return family === 'classical' ? s.classicalBroken : s.pqBroken;
}

/**
 * The model's *prediction*: compromised iff every family the approach relies on
 * is broken.
 *
 * This is deliberately no longer what the page reports. The badges, the
 * attacker panels and the survival matrix all come from attack.ts, which
 * actually runs the combiner and the verifier; this function survives as the
 * claim those runs are checked against (see compromise.test.ts). If the theory
 * and the runs ever disagree, the tests fail rather than the page lying.
 */
export function isCompromised(approach: Approach, s: CompromiseState): boolean {
  return RELIES_ON[approach].every((f) => familyBroken(f, s));
}

/**
 * - 'broken'        : the attacker recovered the key / the verifier accepted a
 *                     forgery — both established by running them.
 * - 'hedge-holding' : an algorithm the approach relies on has fallen, but the
 *                     attack still failed because another half did the work.
 *                     (Only hybrid can ever be here.)
 * - 'secure'        : nothing it relies on is broken, and the attack failed.
 */
export type SecurityStatus = 'secure' | 'hedge-holding' | 'broken';
