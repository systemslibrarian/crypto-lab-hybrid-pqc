import { describe, it, expect } from 'vitest';
import { isCompromised, status, type CompromiseState } from './compromise.ts';
import { runKem, attackerRecoversKey, forgeryAccepted } from './session.ts';
import { bytesEqual } from './metrics.ts';

const NONE: CompromiseState = { classicalBroken: false, pqBroken: false };
const CLASSICAL: CompromiseState = { classicalBroken: true, pqBroken: false };
const PQ: CompromiseState = { classicalBroken: false, pqBroken: true };
const BOTH: CompromiseState = { classicalBroken: true, pqBroken: true };

describe('compromise model', () => {
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

  it('status: only hybrid is ever "hedge-holding"', () => {
    expect(status('hybrid', CLASSICAL)).toBe('hedge-holding');
    expect(status('hybrid', PQ)).toBe('hedge-holding');
    expect(status('hybrid', BOTH)).toBe('broken');
    expect(status('hybrid', NONE)).toBe('secure');
    expect(status('classical', CLASSICAL)).toBe('broken');
    expect(status('pq', PQ)).toBe('broken');
  });
});

describe('attacker key recovery is backed by real combiner code', () => {
  it('classical session: recovered iff classical broken, and equals the real key', () => {
    const s = runKem('classical');
    expect(attackerRecoversKey(s, NONE)).toBeNull();
    expect(attackerRecoversKey(s, PQ)).toBeNull();
    const got = attackerRecoversKey(s, CLASSICAL);
    expect(got).not.toBeNull();
    expect(bytesEqual(got!, s.senderKey)).toBe(true);
  });

  it('pq session: recovered iff pq broken', () => {
    const s = runKem('pq');
    expect(attackerRecoversKey(s, NONE)).toBeNull();
    expect(attackerRecoversKey(s, CLASSICAL)).toBeNull();
    expect(bytesEqual(attackerRecoversKey(s, PQ)!, s.senderKey)).toBe(true);
  });

  it('hybrid session: the hedge holds — one break recovers nothing', () => {
    const s = runKem('hybrid');
    expect(attackerRecoversKey(s, NONE)).toBeNull();
    expect(attackerRecoversKey(s, CLASSICAL)).toBeNull();
    expect(attackerRecoversKey(s, PQ)).toBeNull();
    // Only when BOTH are broken can the attacker rebuild the exact session key.
    const got = attackerRecoversKey(s, BOTH);
    expect(got).not.toBeNull();
    expect(bytesEqual(got!, s.senderKey)).toBe(true);
  });

  it('every honest hybrid session matches sender/receiver keys', () => {
    const s = runKem('hybrid');
    expect(s.match).toBe(true);
  });
});

describe('signature forgery acceptance follows the same rule', () => {
  it('hybrid forgery accepted only when both broken', () => {
    expect(forgeryAccepted('hybrid', CLASSICAL)).toBe(false);
    expect(forgeryAccepted('hybrid', PQ)).toBe(false);
    expect(forgeryAccepted('hybrid', BOTH)).toBe(true);
    expect(forgeryAccepted('classical', CLASSICAL)).toBe(true);
    expect(forgeryAccepted('pq', PQ)).toBe(true);
  });
});
