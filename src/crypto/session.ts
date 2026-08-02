// Runs a full key establishment (or a sign/verify) for an approach, captures
// real sizes + timings, and exposes an honest attacker model for the
// break-a-half demo.
//
// What is real: every key, ciphertext, signature, shared secret, and timing.
// What is simulated: the *event* "algorithm family F has been broken". We model
// a break by granting the attacker the genuine component secret for F (you
// cannot actually solve X25519 in a browser). What the attacker then does with
// it is real: attack.ts runs the combiner and the verifier for real, so both
// "can they reconstruct the session key?" and "does a forgery verify?" are
// answered by running them, not by consulting the switches.

import { KEMS, classicalKem, pqKem, splitHybrid, type KemSizes } from './kem.ts';
import { SIGS, type SigSizes } from './sign.ts';
import { benchDist, bytesEqual, type Timing } from './metrics.ts';
import type { Approach } from './types.ts';

export interface KemTimings {
  keygen: Timing;
  encapsulate: Timing;
  decapsulate: Timing;
}

// ---------------------------------------------------------------------------
// KEM session
// ---------------------------------------------------------------------------

export interface KemSession {
  approach: Approach;
  label: string;
  sizes: KemSizes;
  timings: KemTimings;
  publicKey: Uint8Array;
  /** Kept in memory (never persisted) so timings can be re-run on this exact
   *  transcript without regenerating the keys and changing the session key. */
  secretKey: Uint8Array;
  ciphertext: Uint8Array;
  senderKey: Uint8Array;
  receiverKey: Uint8Array;
  /** Sender and receiver derived the same key (must be true for a real run). */
  match: boolean;
  /**
   * Genuine per-family component secrets, handed to the attacker in attack.ts
   * when that family is marked broken. For single-algorithm approaches this is just the session
   * key; for hybrid it is { classical: ssX, pq: ssMlkem }.
   */
  components: { classical?: Uint8Array; pq?: Uint8Array };
}

function benchKem(approach: Approach, publicKey: Uint8Array, secretKey: Uint8Array, ciphertext: Uint8Array): KemTimings {
  const kem = KEMS[approach];
  return {
    keygen: benchDist(() => void kem.keygen()),
    encapsulate: benchDist(() => void kem.encapsulate(publicKey)),
    decapsulate: benchDist(() => void kem.decapsulate(ciphertext, secretKey)),
  };
}

// Timing placeholder for runs whose purpose is the attack, not the benchmark
// (the survival matrix). Nothing displays these.
const NO_TIMING: Timing = { median: 0, min: 0, max: 0, runs: 0 };
const NO_KEM_TIMINGS: KemTimings = {
  keygen: NO_TIMING,
  encapsulate: NO_TIMING,
  decapsulate: NO_TIMING,
};
const NO_SIG_TIMINGS: SigTimings = { keygen: NO_TIMING, sign: NO_TIMING, verify: NO_TIMING };

/**
 * @param bench when false, skip the micro-benchmarks. The key material and the
 * transcript are identical either way — only the timing figures are omitted.
 */
export function runKem(approach: Approach, bench = true): KemSession {
  const kem = KEMS[approach];

  const kp = kem.keygen();
  const enc = kem.encapsulate(kp.publicKey);
  const receiverKey = kem.decapsulate(enc.ciphertext, kp.secretKey);

  // Recover the genuine component secrets from the receiver's view so the
  // attacker model is consistent with this exact transcript.
  let components: KemSession['components'];
  if (approach === 'hybrid') {
    const { ctX, ctMlkem } = splitHybrid(enc.ciphertext);
    const xSec = kp.secretKey.subarray(0, classicalKem.sizes.secretKey);
    const mlkemSec = kp.secretKey.subarray(classicalKem.sizes.secretKey);
    components = {
      classical: classicalKem.decapsulate(ctX, xSec),
      pq: pqKem.decapsulate(ctMlkem, mlkemSec),
    };
  } else if (approach === 'classical') {
    components = { classical: receiverKey };
  } else {
    components = { pq: receiverKey };
  }

  return {
    approach,
    label: kem.label,
    sizes: kem.sizes,
    timings: bench ? benchKem(approach, kp.publicKey, kp.secretKey, enc.ciphertext) : NO_KEM_TIMINGS,
    publicKey: kp.publicKey,
    secretKey: kp.secretKey,
    ciphertext: enc.ciphertext,
    senderKey: enc.sharedSecret,
    receiverKey,
    match: bytesEqual(enc.sharedSecret, receiverKey),
    components,
  };
}

/** Re-measure timings on the SAME transcript (keys/ciphertext/session key unchanged). */
export function rebenchKem(s: KemSession): KemSession {
  return { ...s, timings: benchKem(s.approach, s.publicKey, s.secretKey, s.ciphertext) };
}

// The attacker lives in attack.ts: attemptKeyRecovery() runs the real combiner
// over whatever secrets the break handed over and compares the bytes it
// produced against `senderKey`, and attemptForgery() really signs and really
// verifies. Nothing in this file decides whether an attack worked.

// ---------------------------------------------------------------------------
// Signature run
// ---------------------------------------------------------------------------

export interface SigTimings {
  keygen: Timing;
  sign: Timing;
  verify: Timing;
}

export interface SigRun {
  approach: Approach;
  label: string;
  sizes: SigSizes;
  timings: SigTimings;
  message: Uint8Array;
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  signature: Uint8Array;
  /** Honest verification of an honest signature — must be true. */
  verified: boolean;
}

function benchSig(
  approach: Approach,
  publicKey: Uint8Array,
  secretKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): SigTimings {
  const scheme = SIGS[approach];
  return {
    keygen: benchDist(() => void scheme.keygen(), 5),
    sign: benchDist(() => void scheme.sign(secretKey, message), 5),
    verify: benchDist(() => void scheme.verify(publicKey, message, signature), 5),
  };
}

/** @param bench see runKem. */
export function runSig(approach: Approach, message: Uint8Array, bench = true): SigRun {
  const scheme = SIGS[approach];
  const kp = scheme.keygen();
  const signature = scheme.sign(kp.secretKey, message);
  const verified = scheme.verify(kp.publicKey, message, signature);

  return {
    approach,
    label: scheme.label,
    sizes: scheme.sizes,
    timings: bench ? benchSig(approach, kp.publicKey, kp.secretKey, message, signature) : NO_SIG_TIMINGS,
    message,
    publicKey: kp.publicKey,
    secretKey: kp.secretKey,
    signature,
    verified,
  };
}

/** Re-measure timings on the SAME signature/keys. */
export function rebenchSig(s: SigRun): SigRun {
  return { ...s, timings: benchSig(s.approach, s.publicKey, s.secretKey, s.message, s.signature) };
}

// Whether a forgery is accepted is answered by attack.ts: it builds the forged
// signature with the keys the attacker actually holds and runs the honest
// verifier on it.
