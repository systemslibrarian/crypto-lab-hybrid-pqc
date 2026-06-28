// Runs a full key establishment (or a sign/verify) for an approach, captures
// real sizes + timings, and exposes an honest attacker model for the
// break-a-half demo.
//
// What is real: every key, ciphertext, signature, shared secret, and timing.
// What is simulated: the *event* "algorithm family F has been broken". We model
// a break by granting the attacker the genuine component secret for F (you
// cannot actually solve X25519 in a browser). The combiner / AND-verify logic
// the attacker then runs is the real thing, so "can the attacker reconstruct
// the session key?" is answered by real cryptographic code, not a hand-wave.

import { KEMS, classicalKem, pqKem, combineKem, splitHybrid, type KemSizes } from './kem.ts';
import { SIGS, type SigSizes } from './sign.ts';
import { bench, bytesEqual } from './metrics.ts';
import { isCompromised, type CompromiseState } from './compromise.ts';
import type { Approach } from './types.ts';

// ---------------------------------------------------------------------------
// KEM session
// ---------------------------------------------------------------------------

export interface KemSession {
  approach: Approach;
  label: string;
  sizes: KemSizes;
  timings: { keygenMs: number; encapsulateMs: number; decapsulateMs: number };
  publicKey: Uint8Array;
  ciphertext: Uint8Array;
  senderKey: Uint8Array;
  receiverKey: Uint8Array;
  /** Sender and receiver derived the same key (must be true for a real run). */
  match: boolean;
  /**
   * Genuine per-family component secrets, used ONLY by attackerRecoversKey to
   * simulate a break. For single-algorithm approaches this is just the session
   * key; for hybrid it is { classical: ssX, pq: ssMlkem }.
   */
  components: { classical?: Uint8Array; pq?: Uint8Array };
}

export function runKem(approach: Approach): KemSession {
  const kem = KEMS[approach];

  const kp = kem.keygen();
  const enc = kem.encapsulate(kp.publicKey);
  const receiverKey = kem.decapsulate(enc.ciphertext, kp.secretKey);

  const timings = {
    keygenMs: bench(() => void kem.keygen()),
    encapsulateMs: bench(() => void kem.encapsulate(kp.publicKey)),
    decapsulateMs: bench(() => void kem.decapsulate(enc.ciphertext, kp.secretKey)),
  };

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
    timings,
    publicKey: kp.publicKey,
    ciphertext: enc.ciphertext,
    senderKey: enc.sharedSecret,
    receiverKey,
    match: bytesEqual(enc.sharedSecret, receiverKey),
    components,
  };
}

/**
 * The session key the attacker can reconstruct under the given threat state, or
 * null if they cannot. For hybrid, recovery needs BOTH component secrets, so a
 * single break yields null — that is the hedge, demonstrated by real code.
 */
export function attackerRecoversKey(s: KemSession, state: CompromiseState): Uint8Array | null {
  if (s.approach === 'hybrid') {
    if (!(state.classicalBroken && state.pqBroken)) return null;
    const { ctX, ctMlkem } = splitHybrid(s.ciphertext);
    return combineKem(s.components.classical!, s.components.pq!, ctX, ctMlkem);
  }
  if (s.approach === 'classical') return state.classicalBroken ? s.components.classical! : null;
  return state.pqBroken ? s.components.pq! : null;
}

// ---------------------------------------------------------------------------
// Signature run
// ---------------------------------------------------------------------------

export interface SigRun {
  approach: Approach;
  label: string;
  sizes: SigSizes;
  timings: { keygenMs: number; signMs: number; verifyMs: number };
  message: Uint8Array;
  signature: Uint8Array;
  /** Honest verification of an honest signature — must be true. */
  verified: boolean;
}

export function runSig(approach: Approach, message: Uint8Array): SigRun {
  const scheme = SIGS[approach];
  const kp = scheme.keygen();
  const signature = scheme.sign(kp.secretKey, message);
  const verified = scheme.verify(kp.publicKey, message, signature);

  const timings = {
    keygenMs: bench(() => void scheme.keygen(), 6),
    signMs: bench(() => void scheme.sign(kp.secretKey, message), 6),
    verifyMs: bench(() => void scheme.verify(kp.publicKey, message, signature), 6),
  };

  return { approach, label: scheme.label, sizes: scheme.sizes, timings, message, signature, verified };
}

/**
 * Would a forged signature be accepted under the given threat state? A forger
 * must defeat every algorithm the verifier checks. For hybrid the verifier ANDs
 * both halves, so forgery is accepted only when both families are broken.
 */
export function forgeryAccepted(approach: Approach, state: CompromiseState): boolean {
  return isCompromised(approach, state);
}
