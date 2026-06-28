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
import { benchDist, bytesEqual, type Timing } from './metrics.ts';
import { isCompromised, type CompromiseState } from './compromise.ts';
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
   * Genuine per-family component secrets, used ONLY by attackerRecoversKey to
   * simulate a break. For single-algorithm approaches this is just the session
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

export function runKem(approach: Approach): KemSession {
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
    timings: benchKem(approach, kp.publicKey, kp.secretKey, enc.ciphertext),
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

export function runSig(approach: Approach, message: Uint8Array): SigRun {
  const scheme = SIGS[approach];
  const kp = scheme.keygen();
  const signature = scheme.sign(kp.secretKey, message);
  const verified = scheme.verify(kp.publicKey, message, signature);

  return {
    approach,
    label: scheme.label,
    sizes: scheme.sizes,
    timings: benchSig(approach, kp.publicKey, kp.secretKey, message, signature),
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

/**
 * Would a forged signature be accepted under the given threat state? A forger
 * must defeat every algorithm the verifier checks. For hybrid the verifier ANDs
 * both halves, so forgery is accepted only when both families are broken.
 */
export function forgeryAccepted(approach: Approach, state: CompromiseState): boolean {
  return isCompromised(approach, state);
}
