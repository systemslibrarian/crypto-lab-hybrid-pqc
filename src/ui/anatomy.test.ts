// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { kemAnatomy, sigAnatomy } from './anatomy.ts';
import { runKem, runSig } from '../crypto/session.ts';
import { attemptKeyRecovery, attemptForgery } from '../crypto/attack.ts';
import { utf8ToBytes } from '@noble/hashes/utils.js';

const onlyClassical = { classicalBroken: true, pqBroken: false };
const onlyPq = { classicalBroken: false, pqBroken: true };
const both = { classicalBroken: true, pqBroken: true };
const MSG = utf8ToBytes('anatomy test message');

function gate(elm: HTMLElement) {
  const g = elm.querySelector('.an-gate')!;
  return { ok: g.classList.contains('an-ok'), text: g.querySelector('.an-state')?.textContent };
}

// These rows are now rendered from completed attacks, so each assertion below
// is downstream of a real combiner run or a real verify().
describe('kemAnatomy', () => {
  const session = runKem('hybrid', false);
  const anatomy = (state: typeof both) => kemAnatomy('hybrid', attemptKeyRecovery(session, state));

  it('hybrid: one half broken → the derived key did not match', () => {
    const c = gate(anatomy(onlyClassical));
    expect(c.ok).toBe(true);
    expect(c.text).toBe('did not match the session key');
    expect(gate(anatomy(onlyPq)).ok).toBe(true);
  });

  it('hybrid: both broken → the derived key matched', () => {
    const g = gate(anatomy(both));
    expect(g.ok).toBe(false);
    expect(g.text).toBe('matched the session key');
  });

  it('single approaches have no gate row', () => {
    const c = runKem('classical', false);
    const p = runKem('pq', false);
    expect(
      kemAnatomy('classical', attemptKeyRecovery(c, onlyClassical)).querySelector('.an-gate'),
    ).toBeNull();
    expect(kemAnatomy('pq', attemptKeyRecovery(p, onlyPq)).querySelector('.an-gate')).toBeNull();
  });
});

describe('sigAnatomy', () => {
  const run = runSig('hybrid', MSG, false);
  const anatomy = (state: typeof both) => sigAnatomy('hybrid', attemptForgery(run, state));

  it('hybrid verifier rejects real forgeries unless both schemes are broken', () => {
    expect(gate(anatomy(onlyPq)).text).toBe('rejected the forgery');
    expect(gate(anatomy(both)).text).toBe('accepted the forgery');
  });

  it('the per-half rows report each verifier’s answer on the forged bytes', () => {
    const rows = anatomy(onlyClassical).querySelectorAll('.an-row:not(.an-gate)');
    // Ed25519 half was forged with the honest key, so it verified.
    expect(rows[0].querySelector('.an-state')?.textContent).toBe('forgery verified');
    // ML-DSA half was forged with the attacker's own key, so it did not.
    expect(rows[1].querySelector('.an-state')?.textContent).toBe('forgery rejected');
  });
});
