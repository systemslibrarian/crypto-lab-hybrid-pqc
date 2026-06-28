// Key Encapsulation Mechanisms for the three migration approaches, all behind
// ONE uniform interface (keygen / encapsulate / decapsulate) so the UI can
// compare them apples-to-apples.
//
//   classical : X25519, wrapped as a DHKEM (RFC 9180 style) so an ephemeral
//               public key plays the role of a KEM ciphertext.
//   pq        : ML-KEM-768 (FIPS 203), used directly.
//   hybrid    : X25519 + ML-KEM-768. Public keys and ciphertexts are the
//               concatenation of both halves (the real on-the-wire encoding),
//               and the two shared secrets are fed through a KEM combiner.
//
// All key material is real and generated per call; nothing is faked. The ONLY
// thing the lab simulates is the *event* of an algorithm being broken (you
// cannot actually solve X25519 in a browser) — see compromise.ts.

import { x25519 } from '@noble/curves/ed25519';
import { ml_kem768 } from '@noble/post-quantum/ml-kem';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { concatBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils';
import type { Approach, AlgoSpec } from './types.ts';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface Encapsulation {
  /** Sent to the holder of the secret key. */
  ciphertext: Uint8Array;
  /** The 32-byte session key the sender now holds. */
  sharedSecret: Uint8Array;
}

export interface KemSizes {
  publicKey: number;
  secretKey: number;
  ciphertext: number;
  sharedSecret: number;
}

export interface Kem {
  approach: Approach;
  label: string;
  /** The underlying algorithm(s), in order. Hybrid has two. */
  algos: AlgoSpec[];
  keygen(): KeyPair;
  encapsulate(publicKey: Uint8Array): Encapsulation;
  decapsulate(ciphertext: Uint8Array, secretKey: Uint8Array): Uint8Array;
  sizes: KemSizes;
}

// ---------------------------------------------------------------------------
// Algorithm descriptors (used by tooltips and the security model).
// ---------------------------------------------------------------------------

const X25519_SPEC: AlgoSpec = {
  name: 'X25519',
  family: 'classical',
  brokenBy: "Shor's algorithm on a large-scale quantum computer",
};
const MLKEM_SPEC: AlgoSpec = {
  name: 'ML-KEM-768',
  family: 'pq',
  brokenBy: 'a future cryptanalytic break of Module-LWE',
};

// ---------------------------------------------------------------------------
// X25519 as a DHKEM. encapsulate() makes a fresh ephemeral keypair; the
// ephemeral public key IS the ciphertext. Both sides derive the same secret
// because Diffie-Hellman is symmetric.
// ---------------------------------------------------------------------------

const X_INFO = utf8ToBytes('cl-dhkem-x25519-v1');

function deriveDhSecret(dh: Uint8Array, ephPub: Uint8Array, recipPub: Uint8Array): Uint8Array {
  // Bind both public keys into the KDF context so the secret is tied to this
  // exact exchange (the "kem_context" idea from HPKE).
  return hkdf(sha256, dh, undefined, concatBytes(X_INFO, ephPub, recipPub), 32);
}

export const classicalKem: Kem = {
  approach: 'classical',
  label: 'X25519 (classical)',
  algos: [X25519_SPEC],
  sizes: { publicKey: 32, secretKey: 32, ciphertext: 32, sharedSecret: 32 },
  keygen(): KeyPair {
    const secretKey = x25519.utils.randomSecretKey();
    return { secretKey, publicKey: x25519.getPublicKey(secretKey) };
  },
  encapsulate(recipPub: Uint8Array): Encapsulation {
    const ephSec = x25519.utils.randomSecretKey();
    const ephPub = x25519.getPublicKey(ephSec);
    const dh = x25519.getSharedSecret(ephSec, recipPub);
    return { ciphertext: ephPub, sharedSecret: deriveDhSecret(dh, ephPub, recipPub) };
  },
  decapsulate(ciphertext: Uint8Array, secretKey: Uint8Array): Uint8Array {
    const ephPub = ciphertext;
    const recipPub = x25519.getPublicKey(secretKey);
    const dh = x25519.getSharedSecret(secretKey, ephPub);
    return deriveDhSecret(dh, ephPub, recipPub);
  },
};

// ---------------------------------------------------------------------------
// ML-KEM-768, used directly.
// ---------------------------------------------------------------------------

export const pqKem: Kem = {
  approach: 'pq',
  label: 'ML-KEM-768 (post-quantum)',
  algos: [MLKEM_SPEC],
  sizes: { publicKey: 1184, secretKey: 2400, ciphertext: 1088, sharedSecret: 32 },
  keygen(): KeyPair {
    const k = ml_kem768.keygen();
    return { publicKey: k.publicKey, secretKey: k.secretKey };
  },
  encapsulate(publicKey: Uint8Array): Encapsulation {
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(publicKey);
    return { ciphertext: cipherText, sharedSecret };
  },
  decapsulate(ciphertext: Uint8Array, secretKey: Uint8Array): Uint8Array {
    return ml_kem768.decapsulate(ciphertext, secretKey);
  },
};

// ---------------------------------------------------------------------------
// Hybrid: X25519 + ML-KEM-768. Concatenated keys/ciphertexts, KEM combiner.
// ---------------------------------------------------------------------------

// Fixed split offsets — the real "wire format" is just the two halves back to
// back, in this order. These constants are the seam the UI relies on too.
const H = {
  pk: { x: 32, mlkem: 1184 },
  sk: { x: 32, mlkem: 2400 },
  ct: { x: 32, mlkem: 1088 },
} as const;

const COMBINER_INFO = utf8ToBytes('cl-hybrid-kem-x25519-mlkem768-v1');

/**
 * KEM combiner. Concatenates the two shared secrets as input keying material
 * and binds BOTH ciphertexts into the KDF context, then squeezes 32 bytes.
 *
 * Security property (the whole point of the lab): HKDF is a PRF, so the output
 * is indistinguishable from random to anyone missing *either* input secret.
 * Break one algorithm and you still can't compute this — you'd have to break
 * both. This mirrors the concatenation combiners in the IETF hybrid KEX drafts.
 */
export function combineKem(
  ssX: Uint8Array,
  ssMlkem: Uint8Array,
  ctX: Uint8Array,
  ctMlkem: Uint8Array,
): Uint8Array {
  const ikm = concatBytes(ssX, ssMlkem);
  const ctx = concatBytes(COMBINER_INFO, ctX, ctMlkem);
  return hkdf(sha256, ikm, undefined, ctx, 32);
}

export const hybridKem: Kem = {
  approach: 'hybrid',
  label: 'X25519 + ML-KEM-768 (hybrid)',
  algos: [X25519_SPEC, MLKEM_SPEC],
  sizes: {
    publicKey: H.pk.x + H.pk.mlkem, // 1216
    secretKey: H.sk.x + H.sk.mlkem, // 2432
    ciphertext: H.ct.x + H.ct.mlkem, // 1120
    sharedSecret: 32,
  },
  keygen(): KeyPair {
    const xk = classicalKem.keygen();
    const pk = pqKem.keygen();
    return {
      publicKey: concatBytes(xk.publicKey, pk.publicKey),
      secretKey: concatBytes(xk.secretKey, pk.secretKey),
    };
  },
  encapsulate(publicKey: Uint8Array): Encapsulation {
    const xPub = publicKey.subarray(0, H.pk.x);
    const mlkemPub = publicKey.subarray(H.pk.x);
    const ex = classicalKem.encapsulate(xPub);
    const em = pqKem.encapsulate(mlkemPub);
    return {
      ciphertext: concatBytes(ex.ciphertext, em.ciphertext),
      sharedSecret: combineKem(ex.sharedSecret, em.sharedSecret, ex.ciphertext, em.ciphertext),
    };
  },
  decapsulate(ciphertext: Uint8Array, secretKey: Uint8Array): Uint8Array {
    const ctX = ciphertext.subarray(0, H.ct.x);
    const ctMlkem = ciphertext.subarray(H.ct.x);
    const xSec = secretKey.subarray(0, H.sk.x);
    const mlkemSec = secretKey.subarray(H.sk.x);
    const ssX = classicalKem.decapsulate(ctX, xSec);
    const ssMlkem = pqKem.decapsulate(ctMlkem, mlkemSec);
    return combineKem(ssX, ssMlkem, ctX, ctMlkem);
  },
};

export const KEMS: Record<Approach, Kem> = {
  classical: classicalKem,
  pq: pqKem,
  hybrid: hybridKem,
};

/** Split a hybrid transcript back into its classical/PQ halves (UI + attacker model). */
export function splitHybrid(ciphertext: Uint8Array): { ctX: Uint8Array; ctMlkem: Uint8Array } {
  return { ctX: ciphertext.subarray(0, H.ct.x), ctMlkem: ciphertext.subarray(H.ct.x) };
}

export { randomBytes };
