// The survival table, computed rather than tabulated.
//
// "Who survives which break" used to be a hard-coded truth table: each cell was
// an if-chain over the two threat flags. It is now the result of running the
// attack for every (approach, threat) pair against a reference session and a
// reference signature — twelve key-recovery attempts and twelve forgeries, each
// judged by comparing bytes or by calling the honest verifier.
//
// The reference runs are built once per page load (unbenchmarked, so this costs
// a few hundred milliseconds of real crypto, not seconds) and memoized: the
// table is a property of the constructions, not of the current UI state.

import { runKem, runSig, type KemSession, type SigRun } from './session.ts';
import { attemptKeyRecovery, attemptForgery, kemStatus, sigStatus } from './attack.ts';
import type { SecurityStatus, CompromiseState } from './compromise.ts';
import { APPROACHES, type Approach } from './types.ts';
import { utf8ToBytes } from '@noble/hashes/utils.js';

export interface CellVerdict {
  kem: SecurityStatus;
  sig: SecurityStatus;
  /** The worse of the two — what the cell shows. */
  overall: SecurityStatus;
  /** Measured: the attacker's bytes equalled the session key. */
  keyRecovered: boolean;
  /** Measured: the honest verifier accepted the forged signature. */
  forgeryAccepted: boolean;
}

export const THREAT_ROWS: Array<{ key: string; label: string; state: CompromiseState }> = [
  { key: 'none', label: 'No break', state: { classicalBroken: false, pqBroken: false } },
  { key: 'q', label: 'Quantum computer', state: { classicalBroken: true, pqBroken: false } },
  { key: 'l', label: 'Lattice break', state: { classicalBroken: false, pqBroken: true } },
  { key: 'both', label: 'Both break', state: { classicalBroken: true, pqBroken: true } },
];

const RANK: Record<SecurityStatus, number> = { secure: 0, 'hedge-holding': 1, broken: 2 };
function worse(a: SecurityStatus, b: SecurityStatus): SecurityStatus {
  return RANK[a] >= RANK[b] ? a : b;
}

export type SurvivalTable = Record<string, Record<Approach, CellVerdict>>;

const REFERENCE_MESSAGE = 'Survival table reference message.';

/** Build the table from scratch. Exported so tests can compute a fresh one. */
export function computeSurvivalTable(): SurvivalTable {
  const msg = utf8ToBytes(REFERENCE_MESSAGE);
  const kem: Record<Approach, KemSession> = {} as Record<Approach, KemSession>;
  const sig: Record<Approach, SigRun> = {} as Record<Approach, SigRun>;
  for (const a of APPROACHES) {
    kem[a] = runKem(a, false);
    sig[a] = runSig(a, msg, false);
  }

  const table: SurvivalTable = {};
  for (const row of THREAT_ROWS) {
    const byApproach = {} as Record<Approach, CellVerdict>;
    for (const a of APPROACHES) {
      const recovery = attemptKeyRecovery(kem[a], row.state);
      const forgery = attemptForgery(sig[a], row.state);
      const k = kemStatus(recovery, row.state);
      const s = sigStatus(forgery, row.state);
      byApproach[a] = {
        kem: k,
        sig: s,
        overall: worse(k, s),
        keyRecovered: recovery.matches,
        forgeryAccepted: forgery.accepted,
      };
    }
    table[row.key] = byApproach;
  }
  return table;
}

let memo: SurvivalTable | null = null;

/** The memoized table for this page load. */
export function survivalTable(): SurvivalTable {
  return (memo ??= computeSurvivalTable());
}

export function rowKeyFor(state: CompromiseState): string {
  if (state.classicalBroken && state.pqBroken) return 'both';
  if (state.classicalBroken) return 'q';
  if (state.pqBroken) return 'l';
  return 'none';
}

/** Measured verdicts for the threat state currently selected. */
export function verdictsFor(state: CompromiseState): Record<Approach, CellVerdict> {
  return survivalTable()[rowKeyFor(state)];
}
