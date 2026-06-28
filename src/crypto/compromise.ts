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

/** Compromised iff every family the approach relies on is broken. */
export function isCompromised(approach: Approach, s: CompromiseState): boolean {
  return RELIES_ON[approach].every((f) => familyBroken(f, s));
}

export type SecurityStatus = 'secure' | 'hedge-holding' | 'broken';

/**
 * - 'broken'        : the attacker can recover the key / forge the signature.
 * - 'hedge-holding' : at least one half is broken, but the approach still holds
 *                     because another, unbroken half is doing the work. (Only
 *                     hybrid can ever be here.)
 * - 'secure'        : nothing it relies on is broken.
 */
export function status(approach: Approach, s: CompromiseState): SecurityStatus {
  if (isCompromised(approach, s)) return 'broken';
  const anyBroken = RELIES_ON[approach].some((f) => familyBroken(f, s));
  return anyBroken ? 'hedge-holding' : 'secure';
}
