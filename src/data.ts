// Static educational content: the "why", real-world deployments, and the
// trade-off matrix. Kept as data (not markup) so the UI owns presentation and
// the facts live in one auditable place.

import type { Approach } from './crypto/types.ts';

export interface WhyPoint {
  heading: string;
  body: string;
}

export const WHY_HYBRID: WhyPoint[] = [
  {
    heading: 'We are mid-migration',
    body: 'A cryptographically relevant quantum computer (CRQC) does not exist yet, but encrypted traffic captured today can be stored and decrypted later once one does — the "harvest now, decrypt later" threat. So long-lived secrets need PQ protection now, even though the PQ algorithms are young.',
  },
  {
    heading: 'Pure PQ is a young bet',
    body: 'ML-KEM and ML-DSA were standardized in 2024 (FIPS 203/204). Lattice cryptanalysis is active research, and implementation bugs in new code are common. Betting a connection entirely on an algorithm with a decade of scrutiny instead of four decades is a real risk.',
  },
  {
    heading: 'Pure classical is a known-dead bet',
    body: 'X25519 and Ed25519 are battle-tested but fall completely to Shor’s algorithm on a CRQC. Against a quantum adversary they offer no asymptotic security at all.',
  },
  {
    heading: 'Hybrid hedges both ways',
    body: 'Combine the two and the connection stays secure as long as EITHER half holds: it survives a quantum computer (classical breaks, PQ holds) AND survives a surprise lattice break (PQ breaks, classical holds). You only lose if both fall at once.',
  },
];

export interface Deployment {
  system: string;
  scheme: string;
  note: string;
  /** Authoritative source so every claim here is verifiable. */
  ref: string;
}

export const DEPLOYMENTS: Deployment[] = [
  {
    system: 'TLS 1.3 (Chrome, Firefox, Cloudflare, AWS)',
    scheme: 'X25519MLKEM768',
    note: 'A hybrid key-exchange group (IANA codepoint 0x11EC) negotiated by default in current browsers and CDNs. Both sides feed ml_kem_ss ‖ x25519_ss straight into the TLS key schedule.',
    ref: 'https://datatracker.ietf.org/doc/draft-ietf-tls-ecdhe-mlkem/',
  },
  {
    system: 'OpenSSH',
    scheme: 'mlkem768x25519-sha256, sntrup761x25519-sha512',
    note: 'Post-quantum hybrid KEX has been the SSH default since 9.0 (sntrup761); the ML-KEM hybrid arrived in 9.9 and became the default in 10.0 (2025).',
    ref: 'https://www.openssh.com/pq.html',
  },
  {
    system: 'Signal',
    scheme: 'PQXDH (X25519 + ML-KEM-1024)',
    note: 'The Signal protocol’s initial key agreement (X3DH) was upgraded to the hybrid PQXDH and deployed in late 2023.',
    ref: 'https://signal.org/docs/specifications/pqxdh/',
  },
  {
    system: 'Apple iMessage',
    scheme: 'PQ3 (ECDH + ML-KEM, PQ ratchet)',
    note: 'Combines classical ECDH with ML-KEM (Kyber) for the initial key and re-establishes PQ keys continuously. Rolled out in iOS 17.4 (2024).',
    ref: 'https://security.apple.com/blog/imessage-pq3/',
  },
];

export interface Standard {
  id: string;
  title: string;
  ref: string;
}

export const STANDARDS: Standard[] = [
  {
    id: 'FIPS 203',
    title: 'ML-KEM (Module-Lattice KEM, the standardized Kyber)',
    ref: 'https://csrc.nist.gov/pubs/fips/203/final',
  },
  {
    id: 'FIPS 204',
    title: 'ML-DSA (Module-Lattice signatures, the standardized Dilithium)',
    ref: 'https://csrc.nist.gov/pubs/fips/204/final',
  },
  {
    id: 'FIPS 205',
    title: 'SLH-DSA (stateless hash-based signatures, the standardized SPHINCS+)',
    ref: 'https://csrc.nist.gov/pubs/fips/205/final',
  },
  {
    id: 'NIST SP 800-227 (draft)',
    title: 'Recommendations for Key-Encapsulation Mechanisms',
    ref: 'https://csrc.nist.gov/pubs/sp/800/227/ipd',
  },
  {
    id: 'IETF draft-ietf-tls-hybrid-design',
    title: 'Hybrid key exchange in TLS 1.3',
    ref: 'https://datatracker.ietf.org/doc/draft-ietf-tls-hybrid-design/',
  },
];

/** One qualitative rating cell in the trade-off matrix. */
export interface Rating {
  /** 1 (worst) .. 3 (best) for the dot meter; meaning depends on the column. */
  level: 1 | 2 | 3;
  text: string;
}

export interface TradeoffRow {
  approach: Approach;
  label: string;
  quantumSafe: Rating;
  classicalMaturity: Rating;
  speed: Rating;
  bandwidth: Rating;
  complexity: Rating;
}

// Bandwidth = public key + ciphertext (KEM) bytes the approach puts on the
// wire, summarized qualitatively; exact bytes are shown live in the KEM panel.
export const TRADEOFFS: TradeoffRow[] = [
  {
    approach: 'classical',
    label: 'Classical only (X25519 / Ed25519)',
    quantumSafe: { level: 1, text: 'No — broken by Shor' },
    classicalMaturity: { level: 3, text: 'Decades of scrutiny' },
    speed: { level: 3, text: 'Fastest' },
    bandwidth: { level: 3, text: 'Tiny (32–64 B)' },
    complexity: { level: 3, text: 'Ubiquitous, simple' },
  },
  {
    approach: 'pq',
    label: 'Post-quantum only (ML-KEM / ML-DSA)',
    quantumSafe: { level: 3, text: 'Yes — lattice-based' },
    classicalMaturity: { level: 1, text: 'Standardized 2024' },
    speed: { level: 2, text: 'Fast, larger ops' },
    bandwidth: { level: 1, text: 'Large (KB-scale)' },
    complexity: { level: 2, text: 'Newer code paths' },
  },
  {
    approach: 'hybrid',
    label: 'Hybrid (both)',
    quantumSafe: { level: 3, text: 'Yes — PQ half' },
    classicalMaturity: { level: 3, text: 'Classical half hedges' },
    speed: { level: 2, text: 'Both, run in parallel' },
    bandwidth: { level: 1, text: 'Largest (sum of both)' },
    complexity: { level: 1, text: 'Combiner + two stacks' },
  },
];

export interface AgilityPoint {
  heading: string;
  body: string;
}

export const CRYPTO_AGILITY: AgilityPoint[] = [
  {
    heading: 'What it is',
    body: 'Crypto-agility is the ability to swap algorithms without redesigning the system — negotiated identifiers, versioned formats, and no algorithm hard-coded into wire structures or storage.',
  },
  {
    heading: 'Why hybrids demand it',
    body: 'A hybrid is two algorithms plus a combiner, encoded as one unit. If your protocol cannot already name and negotiate algorithm suites, you cannot add (or later drop) the classical half cleanly.',
  },
  {
    heading: 'The exit ramp',
    body: 'Hybrid is a transition state, not a destination. Once PQ algorithms have earned trust, agile systems can retire the classical half and its bandwidth cost — with no new migration project.',
  },
];
