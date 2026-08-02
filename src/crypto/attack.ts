// The attacker, run for real.
//
// The lab simulates exactly one thing: the *event* "algorithm family F has
// fallen". We model that the only way a browser can — by handing the attacker
// the genuine component secret for F. Everything the attacker does with it is
// real code against real key material:
//
//   * key recovery  — they run the real KEM combiner over the secrets they
//     hold, substituting a guess for anything they do not, and we compare the
//     bytes they produced against the session key that was actually derived.
//   * signature forgery — they really sign a message of their choosing with
//     whichever component signing keys they hold, filling the halves they do
//     not hold with signatures under their own unrelated keys, and the honest
//     verifier is really run against the result.
//
// So "key recovered" means the bytes matched, and "forgery accepted" means
// verify() returned true. Neither is read off the threat switches.

import { concatBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils';
import { combineKem, splitHybrid } from './kem.ts';
import { SIGS, classicalSig, pqSig, splitHybridSig } from './sign.ts';
import { bytesEqual } from './metrics.ts';
import { RELIES_ON, type CompromiseState, type SecurityStatus } from './compromise.ts';
import type { Approach } from './types.ts';
import type { KemSession, SigRun } from './session.ts';

// ---------------------------------------------------------------------------
// Key recovery
// ---------------------------------------------------------------------------

export interface KeyRecovery {
  approach: Approach;
  /** The bytes the attacker actually produced by running the real combiner. */
  candidate: Uint8Array;
  /** Component secrets they were handed (a break) rather than guessed. */
  held: Array<'classical' | 'pq'>;
  /** Component secrets they had to guess. */
  guessed: Array<'classical' | 'pq'>;
  /** Measured: candidate === the session key both parties derived. */
  matches: boolean;
}

/**
 * Run the recovery. The attacker always produces *something* — that is the
 * point: a guess run through the combiner is a well-formed 32-byte key that
 * simply is not the right one, and the comparison is what decides the verdict.
 */
export function attemptKeyRecovery(s: KemSession, state: CompromiseState): KeyRecovery {
  const held: Array<'classical' | 'pq'> = [];
  const guessed: Array<'classical' | 'pq'> = [];
  const take = (family: 'classical' | 'pq', broken: boolean, real: Uint8Array): Uint8Array => {
    if (broken) {
      held.push(family);
      return real;
    }
    guessed.push(family);
    return randomBytes(real.length);
  };

  let candidate: Uint8Array;
  if (s.approach === 'hybrid') {
    const { ctX, ctMlkem } = splitHybrid(s.ciphertext);
    const ssX = take('classical', state.classicalBroken, s.components.classical!);
    const ssMlkem = take('pq', state.pqBroken, s.components.pq!);
    // The real combiner, over whatever the attacker actually has.
    candidate = combineKem(ssX, ssMlkem, ctX, ctMlkem);
  } else if (s.approach === 'classical') {
    candidate = take('classical', state.classicalBroken, s.components.classical!);
  } else {
    candidate = take('pq', state.pqBroken, s.components.pq!);
  }

  return {
    approach: s.approach,
    candidate,
    held,
    guessed,
    matches: bytesEqual(candidate, s.senderKey),
  };
}

// ---------------------------------------------------------------------------
// Signature forgery
// ---------------------------------------------------------------------------

/** The attacker signs a message the honest key holder never agreed to. */
export function forgedMessage(honest: Uint8Array): Uint8Array {
  return concatBytes(honest, utf8ToBytes(' — and wire the balance to the attacker.'));
}

export interface ForgedHalf {
  algo: string;
  family: 'classical' | 'pq';
  /** True when the attacker signed with the honest signing key (that family fell). */
  usedHonestKey: boolean;
  /** Measured: this half's real verifier accepted the bytes the attacker sent. */
  verified: boolean;
}

export interface Forgery {
  approach: Approach;
  message: Uint8Array;
  /** The signature bytes the attacker actually produced. */
  signature: Uint8Array;
  halves: ForgedHalf[];
  /** Measured: the honest verifier accepted the forgery under the honest key. */
  accepted: boolean;
}

// The attacker's own key material. Generated once and reused — these are the
// keys they forge with when a family has NOT fallen, so the signature is
// well-formed but under the wrong key.
let attackerEd: { publicKey: Uint8Array; secretKey: Uint8Array } | null = null;
let attackerMlDsa: { publicKey: Uint8Array; secretKey: Uint8Array } | null = null;
function attackerEdKey() {
  return (attackerEd ??= classicalSig.keygen());
}
function attackerMlDsaKey() {
  return (attackerMlDsa ??= pqSig.keygen());
}

const ED_SK = 32;
const ED_PK = 32;

/**
 * Produce a forgery and run the honest verifier on it. Nothing here is
 * conditional on the threat switches except *which signing key the attacker
 * gets to use* — the signing, the concatenation, and the verification are the
 * lab's real code paths.
 */
export function attemptForgery(run: SigRun, state: CompromiseState): Forgery {
  const message = forgedMessage(run.message);
  const halves: ForgedHalf[] = [];
  let signature: Uint8Array;

  if (run.approach === 'classical') {
    const secret = state.classicalBroken ? run.secretKey : attackerEdKey().secretKey;
    signature = classicalSig.sign(secret, message);
    halves.push({
      algo: 'Ed25519',
      family: 'classical',
      usedHonestKey: state.classicalBroken,
      verified: classicalSig.verify(run.publicKey, message, signature),
    });
  } else if (run.approach === 'pq') {
    const secret = state.pqBroken ? run.secretKey : attackerMlDsaKey().secretKey;
    signature = pqSig.sign(secret, message);
    halves.push({
      algo: 'ML-DSA-65',
      family: 'pq',
      usedHonestKey: state.pqBroken,
      verified: pqSig.verify(run.publicKey, message, signature),
    });
  } else {
    const edSecret = state.classicalBroken
      ? run.secretKey.subarray(0, ED_SK)
      : attackerEdKey().secretKey;
    const mlDsaSecret = state.pqBroken ? run.secretKey.subarray(ED_SK) : attackerMlDsaKey().secretKey;
    signature = concatBytes(
      classicalSig.sign(edSecret, message),
      pqSig.sign(mlDsaSecret, message),
    );
    const edPub = run.publicKey.subarray(0, ED_PK);
    const mlDsaPub = run.publicKey.subarray(ED_PK);
    const { edSig, mldsaSig } = splitHybridSig(signature);
    halves.push(
      {
        algo: 'Ed25519',
        family: 'classical',
        usedHonestKey: state.classicalBroken,
        verified: classicalSig.verify(edPub, message, edSig),
      },
      {
        algo: 'ML-DSA-65',
        family: 'pq',
        usedHonestKey: state.pqBroken,
        verified: pqSig.verify(mlDsaPub, message, mldsaSig),
      },
    );
  }

  return {
    approach: run.approach,
    message,
    signature,
    halves,
    // The verdict: the honest verifier, run for real on the forged bytes.
    accepted: SIGS[run.approach].verify(run.publicKey, message, signature),
  };
}

// ---------------------------------------------------------------------------
// Verdicts, derived from the runs above
// ---------------------------------------------------------------------------

export type { SecurityStatus };

function degraded(approach: Approach, state: CompromiseState): boolean {
  return RELIES_ON[approach].some((f) =>
    f === 'classical' ? state.classicalBroken : state.pqBroken,
  );
}

/** 'broken' iff the attacker's bytes actually equalled the session key. */
export function kemStatus(r: KeyRecovery, state: CompromiseState): SecurityStatus {
  if (r.matches) return 'broken';
  return degraded(r.approach, state) ? 'hedge-holding' : 'secure';
}

/** 'broken' iff the honest verifier actually accepted the forged signature. */
export function sigStatus(f: Forgery, state: CompromiseState): SecurityStatus {
  if (f.accepted) return 'broken';
  return degraded(f.approach, state) ? 'hedge-holding' : 'secure';
}

// Kept so callers that only need "did the forgery land" do not have to reach
// into the Forgery object; it is still the verifier's answer, not a lookup.
export function forgeryAccepted(f: Forgery): boolean {
  return f.accepted;
}
