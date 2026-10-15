import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import { describe, it, expect } from 'vitest';
import { SIGS, hybridSig, classicalSig, pqSig } from './sign.ts';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import type { Approach } from './types.ts';

const APPROACHES: Approach[] = ['classical', 'pq', 'hybrid'];
const MSG = utf8ToBytes('attack at dawn');

describe('signature verify accepts honest signatures', () => {
  for (const approach of APPROACHES) {
    it(`${approach}: verifies a genuine signature`, () => {
      const s = SIGS[approach];
      const kp = s.keygen();
      const sig = s.sign(kp.secretKey, MSG);
      expect(sig.length).toBe(s.sizes.signature);
      expect(s.verify(kp.publicKey, MSG, sig)).toBe(true);
    });

    it(`${approach}: rejects a tampered message`, () => {
      const s = SIGS[approach];
      const kp = s.keygen();
      const sig = s.sign(kp.secretKey, MSG);
      expect(s.verify(kp.publicKey, utf8ToBytes('retreat at dawn'), sig)).toBe(false);
    });

    it(`${approach}: rejects a wrong public key`, () => {
      const s = SIGS[approach];
      const kp = s.keygen();
      const other = s.keygen();
      const sig = s.sign(kp.secretKey, MSG);
      expect(s.verify(other.publicKey, MSG, sig)).toBe(false);
    });
  }
});

describe('hybrid signature requires BOTH halves (AND verify)', () => {
  it('rejects when only the Ed25519 half is valid (PQ half corrupted)', () => {
    const kp = hybridSig.keygen();
    const sig = hybridSig.sign(kp.secretKey, MSG);
    // Corrupt one byte inside the ML-DSA half (after the 64-byte Ed25519 sig).
    const tampered = Uint8Array.from(sig);
    tampered[64 + 10] ^= 0xff;
    expect(hybridSig.verify(kp.publicKey, MSG, tampered)).toBe(false);
  });

  it('rejects when only the ML-DSA half is valid (Ed25519 half corrupted)', () => {
    const kp = hybridSig.keygen();
    const sig = hybridSig.sign(kp.secretKey, MSG);
    const tampered = Uint8Array.from(sig);
    tampered[5] ^= 0xff; // inside the Ed25519 sig
    expect(hybridSig.verify(kp.publicKey, MSG, tampered)).toBe(false);
  });

  it('real signature sizes', () => {
    expect(classicalSig.sizes.signature).toBe(64);
    expect(pqSig.sizes.signature).toBe(3309);
    expect(hybridSig.sizes.signature).toBe(64 + 3309);
  });
});

describe('same-message limitation after ML-DSA compromise', () => {
  it('retains the honest Ed25519 bytes and accepts a new ML-DSA signature only for the signed message', () => {
    const kp = hybridSig.keygen();
    const original = hybridSig.sign(kp.secretKey, MSG);
    // The attack helper gets only the compromised PQ secret and prior signature.
    const replacePq = (prior: Uint8Array, pqSecret: Uint8Array, message: Uint8Array) => {
      const result = prior.slice();
      result.set(ml_dsa65.sign(message, pqSecret, {
        extraEntropy: new Uint8Array(32).fill(0x42),
      }), classicalSig.sizes.signature);
      return result;
    };
    const pqSecret = kp.secretKey.slice(classicalSig.sizes.secretKey);
    const replacement = replacePq(original, pqSecret, MSG);
    expect(replacement).not.toEqual(original);
    expect(replacement.slice(0, classicalSig.sizes.signature)).toEqual(original.slice(0, classicalSig.sizes.signature));
    expect(hybridSig.verify(kp.publicKey, MSG, replacement)).toBe(true);
    const newMessage = utf8ToBytes('never approved');
    const freshForgery = replacePq(original, pqSecret, newMessage);
    expect(pqSig.verify(kp.publicKey.slice(classicalSig.sizes.publicKey), newMessage,
      freshForgery.slice(classicalSig.sizes.signature))).toBe(true);
    expect(hybridSig.verify(kp.publicKey, newMessage, freshForgery)).toBe(false);
  });
});
