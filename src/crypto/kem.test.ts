import { describe, it, expect } from 'vitest';
import { KEMS, combineKem, splitHybrid, classicalKem, pqKem } from './kem.ts';
import { bytesEqual } from './metrics.ts';
import type { Approach } from './types.ts';

const APPROACHES: Approach[] = ['classical', 'pq', 'hybrid'];

describe('KEM round-trips', () => {
  for (const approach of APPROACHES) {
    it(`${approach}: sender and receiver derive the same 32-byte key`, () => {
      const kem = KEMS[approach];
      const kp = kem.keygen();
      const enc = kem.encapsulate(kp.publicKey);
      const recv = kem.decapsulate(enc.ciphertext, kp.secretKey);
      expect(enc.sharedSecret.length).toBe(32);
      expect(bytesEqual(enc.sharedSecret, recv)).toBe(true);
    });

    it(`${approach}: a different keypair does NOT derive the same key`, () => {
      const kem = KEMS[approach];
      const kp = kem.keygen();
      const other = kem.keygen();
      const enc = kem.encapsulate(kp.publicKey);
      const wrong = kem.decapsulate(enc.ciphertext, other.secretKey);
      expect(bytesEqual(enc.sharedSecret, wrong)).toBe(false);
    });
  }
});

describe('real wire sizes (FIPS 203 / RFC 7748)', () => {
  it('classical sizes', () => {
    expect(classicalKem.sizes).toEqual({ publicKey: 32, secretKey: 32, ciphertext: 32, sharedSecret: 32 });
  });
  it('ML-KEM-768 sizes', () => {
    expect(pqKem.sizes).toEqual({ publicKey: 1184, secretKey: 2400, ciphertext: 1088, sharedSecret: 32 });
  });
  it('hybrid sizes are the sum of both halves', () => {
    expect(KEMS.hybrid.sizes.publicKey).toBe(32 + 1184);
    expect(KEMS.hybrid.sizes.ciphertext).toBe(32 + 1088);
  });
  it('declared sizes match what keygen/encapsulate actually produce', () => {
    for (const approach of APPROACHES) {
      const kem = KEMS[approach];
      const kp = kem.keygen();
      const enc = kem.encapsulate(kp.publicKey);
      expect(kp.publicKey.length).toBe(kem.sizes.publicKey);
      expect(kp.secretKey.length).toBe(kem.sizes.secretKey);
      expect(enc.ciphertext.length).toBe(kem.sizes.ciphertext);
    }
  });
});

describe('hybrid combiner', () => {
  it('is deterministic for the same inputs', () => {
    const a = new Uint8Array(32).fill(1);
    const b = new Uint8Array(32).fill(2);
    const ctA = new Uint8Array(32).fill(3);
    const ctB = new Uint8Array(1088).fill(4);
    expect(bytesEqual(combineKem(a, b, ctA, ctB), combineKem(a, b, ctA, ctB))).toBe(true);
  });

  it('changes if EITHER shared secret changes (needs both inputs)', () => {
    const a = new Uint8Array(32).fill(1);
    const b = new Uint8Array(32).fill(2);
    const ctA = new Uint8Array(32).fill(3);
    const ctB = new Uint8Array(1088).fill(4);
    const base = combineKem(a, b, ctA, ctB);
    const flipA = combineKem(new Uint8Array(32).fill(9), b, ctA, ctB);
    const flipB = combineKem(a, new Uint8Array(32).fill(9), ctA, ctB);
    expect(bytesEqual(base, flipA)).toBe(false);
    expect(bytesEqual(base, flipB)).toBe(false);
  });

  it('is bound to the ciphertexts (transcript binding)', () => {
    const a = new Uint8Array(32).fill(1);
    const b = new Uint8Array(32).fill(2);
    const base = combineKem(a, b, new Uint8Array(32).fill(3), new Uint8Array(1088).fill(4));
    const tampered = combineKem(a, b, new Uint8Array(32).fill(7), new Uint8Array(1088).fill(4));
    expect(bytesEqual(base, tampered)).toBe(false);
  });

  it('equals the live hybrid session key when fed the genuine halves', () => {
    const kp = KEMS.hybrid.keygen();
    const enc = KEMS.hybrid.encapsulate(kp.publicKey);
    const { ctX, ctMlkem } = splitHybrid(enc.ciphertext);
    const xSec = kp.secretKey.subarray(0, classicalKem.sizes.secretKey);
    const mlkemSec = kp.secretKey.subarray(classicalKem.sizes.secretKey);
    const ssX = classicalKem.decapsulate(ctX, xSec);
    const ssMlkem = pqKem.decapsulate(ctMlkem, mlkemSec);
    expect(bytesEqual(combineKem(ssX, ssMlkem, ctX, ctMlkem), enc.sharedSecret)).toBe(true);
  });
});
