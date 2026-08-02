import { describe, it, expect } from 'vitest';
import { isCompromised, type CompromiseState } from './compromise.ts';
import { runKem, runSig } from './session.ts';
import {
  attemptKeyRecovery,
  attemptForgery,
  forgedMessage,
  kemStatus,
  sigStatus,
} from './attack.ts';
import { computeSurvivalTable, THREAT_ROWS } from './proofSet.ts';
import { SIGS } from './sign.ts';
import { bytesEqual } from './metrics.ts';
import { APPROACHES } from './types.ts';
import { utf8ToBytes } from '@noble/hashes/utils';

const NONE: CompromiseState = { classicalBroken: false, pqBroken: false };
const CLASSICAL: CompromiseState = { classicalBroken: true, pqBroken: false };
const PQ: CompromiseState = { classicalBroken: false, pqBroken: true };
const BOTH: CompromiseState = { classicalBroken: true, pqBroken: true };
const MSG = utf8ToBytes('Transfer $10,000 to account 4471-9920.');

describe('compromise model (the prediction the runs are checked against)', () => {
  it('classical-only: broken exactly when classical is broken', () => {
    expect(isCompromised('classical', NONE)).toBe(false);
    expect(isCompromised('classical', CLASSICAL)).toBe(true);
    expect(isCompromised('classical', PQ)).toBe(false);
    expect(isCompromised('classical', BOTH)).toBe(true);
  });

  it('pq-only: broken exactly when pq is broken', () => {
    expect(isCompromised('pq', NONE)).toBe(false);
    expect(isCompromised('pq', CLASSICAL)).toBe(false);
    expect(isCompromised('pq', PQ)).toBe(true);
    expect(isCompromised('pq', BOTH)).toBe(true);
  });

  it('hybrid: broken ONLY when both halves are broken', () => {
    expect(isCompromised('hybrid', NONE)).toBe(false);
    expect(isCompromised('hybrid', CLASSICAL)).toBe(false);
    expect(isCompromised('hybrid', PQ)).toBe(false);
    expect(isCompromised('hybrid', BOTH)).toBe(true);
  });
});

describe('attacker key recovery is backed by real combiner code', () => {
  it('classical session: the attacker only reproduces the key when handed the secret', () => {
    const s = runKem('classical');
    expect(attemptKeyRecovery(s, NONE).matches).toBe(false);
    expect(attemptKeyRecovery(s, PQ).matches).toBe(false);
    const got = attemptKeyRecovery(s, CLASSICAL);
    expect(got.matches).toBe(true);
    expect(bytesEqual(got.candidate, s.senderKey)).toBe(true);
  });

  it('pq session: recovered iff pq broken', () => {
    const s = runKem('pq');
    expect(attemptKeyRecovery(s, NONE).matches).toBe(false);
    expect(attemptKeyRecovery(s, CLASSICAL).matches).toBe(false);
    expect(bytesEqual(attemptKeyRecovery(s, PQ).candidate, s.senderKey)).toBe(true);
  });

  it('hybrid: one break still runs the combiner — it just produces the wrong key', () => {
    const s = runKem('hybrid');
    for (const state of [NONE, CLASSICAL, PQ]) {
      const r = attemptKeyRecovery(s, state);
      // A full 32-byte key really was derived; it simply is not the right one.
      expect(r.candidate.length).toBe(32);
      expect(r.matches).toBe(false);
      expect(bytesEqual(r.candidate, s.senderKey)).toBe(false);
    }
    const got = attemptKeyRecovery(s, BOTH);
    expect(got.matches).toBe(true);
    expect(bytesEqual(got.candidate, s.senderKey)).toBe(true);
    expect(got.guessed).toEqual([]);
  });

  it('hybrid with one half held: the held secret really is the honest one', () => {
    const s = runKem('hybrid');
    const r = attemptKeyRecovery(s, CLASSICAL);
    expect(r.held).toEqual(['classical']);
    expect(r.guessed).toEqual(['pq']);
  });

  it('every honest hybrid session matches sender/receiver keys', () => {
    expect(runKem('hybrid').match).toBe(true);
  });
});

// The forgery used to be asserted from the threat flags and never produced.
// These tests build the signature bytes and run the honest verifier on them.
describe('signature forgery is actually produced and actually verified', () => {
  it('forges over a message the honest key never signed', () => {
    const run = runSig('classical', MSG);
    const f = attemptForgery(run, CLASSICAL);
    expect(bytesEqual(f.message, run.message)).toBe(false);
    expect(new TextDecoder().decode(f.message)).toContain('wire the balance to the attacker');
    // ...and the honest signature does NOT cover that message.
    expect(SIGS.classical.verify(run.publicKey, f.message, run.signature)).toBe(false);
  });

  it('classical: forgery accepted only once the attacker holds the Ed25519 key', () => {
    const run = runSig('classical', MSG);
    expect(attemptForgery(run, NONE).accepted).toBe(false);
    expect(attemptForgery(run, PQ).accepted).toBe(false);
    const f = attemptForgery(run, CLASSICAL);
    expect(f.accepted).toBe(true);
    expect(f.signature.length).toBe(SIGS.classical.sizes.signature);
    // The verdict is reproducible by calling the verifier independently.
    expect(SIGS.classical.verify(run.publicKey, f.message, f.signature)).toBe(true);
  });

  it('pq: forgery accepted only once the attacker holds the ML-DSA key', () => {
    const run = runSig('pq', MSG);
    expect(attemptForgery(run, NONE).accepted).toBe(false);
    expect(attemptForgery(run, CLASSICAL).accepted).toBe(false);
    expect(attemptForgery(run, PQ).accepted).toBe(true);
  });

  it('hybrid: a real forged signature is built for every state, and only one passes', () => {
    const run = runSig('hybrid', MSG);
    for (const state of [NONE, CLASSICAL, PQ]) {
      const f = attemptForgery(run, state);
      expect(f.signature.length).toBe(SIGS.hybrid.sizes.signature);
      expect(f.accepted).toBe(false);
      // Independently re-run the verifier on the exact bytes produced.
      expect(SIGS.hybrid.verify(run.publicKey, f.message, f.signature)).toBe(false);
    }
    const f = attemptForgery(run, BOTH);
    expect(f.accepted).toBe(true);
    expect(SIGS.hybrid.verify(run.publicKey, f.message, f.signature)).toBe(true);
  });

  it('hybrid with one half broken: that half verifies, the other does not', () => {
    const run = runSig('hybrid', MSG);
    const f = attemptForgery(run, CLASSICAL);
    const ed = f.halves.find((h) => h.family === 'classical')!;
    const mldsa = f.halves.find((h) => h.family === 'pq')!;
    // The forger really did produce a valid Ed25519 signature...
    expect(ed.usedHonestKey).toBe(true);
    expect(ed.verified).toBe(true);
    // ...and really failed on ML-DSA, which is why the AND rejects.
    expect(mldsa.usedHonestKey).toBe(false);
    expect(mldsa.verified).toBe(false);
    expect(f.accepted).toBe(false);
  });

  it('forgedMessage is a strict extension of the honest one', () => {
    const m = forgedMessage(MSG);
    expect(m.length).toBeGreaterThan(MSG.length);
    expect(bytesEqual(m.subarray(0, MSG.length), MSG)).toBe(true);
  });
});

describe('badges are the run outcome', () => {
  it('kemStatus / sigStatus: hedge-holding only when the attack ran and failed', () => {
    const kem = runKem('hybrid');
    const sig = runSig('hybrid', MSG);
    expect(kemStatus(attemptKeyRecovery(kem, NONE), NONE)).toBe('secure');
    expect(kemStatus(attemptKeyRecovery(kem, CLASSICAL), CLASSICAL)).toBe('hedge-holding');
    expect(kemStatus(attemptKeyRecovery(kem, BOTH), BOTH)).toBe('broken');
    expect(sigStatus(attemptForgery(sig, NONE), NONE)).toBe('secure');
    expect(sigStatus(attemptForgery(sig, PQ), PQ)).toBe('hedge-holding');
    expect(sigStatus(attemptForgery(sig, BOTH), BOTH)).toBe('broken');
  });

  it('single-algorithm approaches are never "hedge-holding"', () => {
    const kem = runKem('classical');
    for (const state of [NONE, CLASSICAL, PQ, BOTH]) {
      expect(kemStatus(attemptKeyRecovery(kem, state), state)).not.toBe('hedge-holding');
    }
  });
});

// The survival table is now twelve real attacks. This test says the computed
// table reproduces the theory in compromise.ts — if the runs and the model ever
// disagree, this fails instead of the page quietly asserting the model.
describe('survival table is computed and agrees with the model', () => {
  const table = computeSurvivalTable();

  it('every cell matches isCompromised for that approach and threat', () => {
    for (const row of THREAT_ROWS) {
      for (const a of APPROACHES) {
        const cell = table[row.key][a];
        const predicted = isCompromised(a, row.state);
        expect({ row: row.key, a, broken: cell.overall === 'broken' }).toEqual({
          row: row.key,
          a,
          broken: predicted,
        });
        expect(cell.keyRecovered).toBe(predicted);
        expect(cell.forgeryAccepted).toBe(predicted);
      }
    }
  });

  it('hybrid holds under each single break and falls under both', () => {
    expect(table.q.hybrid.overall).toBe('hedge-holding');
    expect(table.l.hybrid.overall).toBe('hedge-holding');
    expect(table.both.hybrid.overall).toBe('broken');
    expect(table.none.hybrid.overall).toBe('secure');
    expect(table.q.classical.overall).toBe('broken');
    expect(table.l.pq.overall).toBe('broken');
  });
});
