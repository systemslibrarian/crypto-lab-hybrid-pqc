// Digital signatures for the three migration approaches, behind one uniform
// interface so the UI can compare them side by side.
//
//   classical : Ed25519 (RFC 8032)
//   pq        : ML-DSA-65 (FIPS 204)
//   hybrid    : Ed25519 + ML-DSA-65 — a composite signature. Public keys,
//               secret keys, and signatures are the concatenation of both
//               halves, and verification requires BOTH halves to pass.
//
// All signing/verification is real. As with the KEMs, only the *event* of an
// algorithm being broken is simulated (compromise.ts).

import { ed25519 } from '@noble/curves/ed25519';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';
import { concatBytes, randomBytes } from '@noble/hashes/utils';
import type { Approach, AlgoSpec } from './types.ts';
import type { KeyPair } from './kem.ts';

export interface SigSizes {
  publicKey: number;
  secretKey: number;
  signature: number;
}

export interface SigScheme {
  approach: Approach;
  label: string;
  algos: AlgoSpec[];
  sizes: SigSizes;
  keygen(): KeyPair;
  sign(secretKey: Uint8Array, message: Uint8Array): Uint8Array;
  verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean;
}

const ED_SPEC: AlgoSpec = {
  name: 'Ed25519',
  family: 'classical',
  brokenBy: "Shor's algorithm on a large-scale quantum computer",
};
const MLDSA_SPEC: AlgoSpec = {
  name: 'ML-DSA-65',
  family: 'pq',
  brokenBy: 'a future cryptanalytic break of Module-LWE / Module-SIS',
};

// ---------------------------------------------------------------------------
// Ed25519
// ---------------------------------------------------------------------------

export const classicalSig: SigScheme = {
  approach: 'classical',
  label: 'Ed25519 (classical)',
  algos: [ED_SPEC],
  sizes: { publicKey: 32, secretKey: 32, signature: 64 },
  keygen(): KeyPair {
    const secretKey = ed25519.utils.randomSecretKey();
    return { secretKey, publicKey: ed25519.getPublicKey(secretKey) };
  },
  sign(secretKey, message) {
    return ed25519.sign(message, secretKey);
  },
  verify(publicKey, message, signature) {
    try {
      return ed25519.verify(signature, message, publicKey);
    } catch {
      return false;
    }
  },
};

// ---------------------------------------------------------------------------
// ML-DSA-65
// ---------------------------------------------------------------------------

export const pqSig: SigScheme = {
  approach: 'pq',
  label: 'ML-DSA-65 (post-quantum)',
  algos: [MLDSA_SPEC],
  sizes: { publicKey: 1952, secretKey: 4032, signature: 3309 },
  keygen(): KeyPair {
    const k = ml_dsa65.keygen(randomBytes(32));
    return { publicKey: k.publicKey, secretKey: k.secretKey };
  },
  sign(secretKey, message) {
    return ml_dsa65.sign(secretKey, message);
  },
  verify(publicKey, message, signature) {
    try {
      return ml_dsa65.verify(publicKey, message, signature);
    } catch {
      return false;
    }
  },
};

// ---------------------------------------------------------------------------
// Hybrid composite signature: Ed25519 || ML-DSA-65. Verify is an AND.
// ---------------------------------------------------------------------------

const HS = {
  pk: { ed: 32, mldsa: 1952 },
  sk: { ed: 32, mldsa: 4032 },
  sig: { ed: 64, mldsa: 3309 },
} as const;

export const hybridSig: SigScheme = {
  approach: 'hybrid',
  label: 'Ed25519 + ML-DSA-65 (hybrid)',
  algos: [ED_SPEC, MLDSA_SPEC],
  sizes: {
    publicKey: HS.pk.ed + HS.pk.mldsa, // 1984
    secretKey: HS.sk.ed + HS.sk.mldsa, // 4064
    signature: HS.sig.ed + HS.sig.mldsa, // 3373
  },
  keygen(): KeyPair {
    const e = classicalSig.keygen();
    const p = pqSig.keygen();
    return {
      publicKey: concatBytes(e.publicKey, p.publicKey),
      secretKey: concatBytes(e.secretKey, p.secretKey),
    };
  },
  sign(secretKey, message) {
    const edSec = secretKey.subarray(0, HS.sk.ed);
    const mldsaSec = secretKey.subarray(HS.sk.ed);
    return concatBytes(classicalSig.sign(edSec, message), pqSig.sign(mldsaSec, message));
  },
  verify(publicKey, message, signature) {
    const edPub = publicKey.subarray(0, HS.pk.ed);
    const mldsaPub = publicKey.subarray(HS.pk.ed);
    const edSig = signature.subarray(0, HS.sig.ed);
    const mldsaSig = signature.subarray(HS.sig.ed);
    // BOTH must verify. A forger has to defeat both schemes at once.
    return (
      classicalSig.verify(edPub, message, edSig) && pqSig.verify(mldsaPub, message, mldsaSig)
    );
  },
};

export const SIGS: Record<Approach, SigScheme> = {
  classical: classicalSig,
  pq: pqSig,
  hybrid: hybridSig,
};

/** Split a hybrid signature into its two halves (UI + attacker model). */
export function splitHybridSig(signature: Uint8Array): { edSig: Uint8Array; mldsaSig: Uint8Array } {
  return { edSig: signature.subarray(0, HS.sig.ed), mldsaSig: signature.subarray(HS.sig.ed) };
}
