# Hybrid PQC Migration

## 1. What It Is

An interactive lab for **hybrid post-quantum cryptography** — the practice of running a classical and a post-quantum algorithm together so a connection stays secure as long as *either* one holds. It compares three approaches side by side, for both key exchange and signatures, using real primitives in the browser: **X25519** and **Ed25519** (classical), **ML-KEM-768** (FIPS 203) and **ML-DSA-65** (FIPS 204) (post-quantum), and hybrids that pair them — X25519 + ML-KEM-768 behind an **HKDF-SHA256 KEM combiner**, and an Ed25519 + ML-DSA-65 composite signature verified with AND. The security model is asymmetric-/post-quantum-asymmetric: hybrid is compromised only when *both* underlying hard problems are broken, which is the whole reason standards bodies recommend it during the migration. Nothing is faked — only the *event* of an algorithm being broken is simulated, since you cannot actually solve X25519 in a browser.

## 2. When to Use It

- **Teaching why hybrid exists** — the break-a-half switches show, with real combiner code, that one broken algorithm leaves the hybrid session key intact while the pure approach collapses.
- **Comparing sizes and costs honestly** — it surfaces the real wire sizes (a 32-byte X25519 ciphertext vs. a 1088-byte ML-KEM-768 one; a 64-byte Ed25519 signature vs. a 3309-byte ML-DSA-65 one) and live timings, so the bandwidth trade-off is concrete, not hand-waved.
- **Explaining "harvest now, decrypt later"** — it motivates why long-lived secrets need post-quantum protection today even though the PQ algorithms are young.
- **Introducing crypto-agility** — it frames hybrid as a transition state with an exit ramp, not a permanent destination.
- **When NOT to use it** — this is an educational comparison, not a protocol or a library. Do not lift its combiner or composite-signature encoding into production; use a vetted implementation of the relevant IETF/NIST construction instead.

## 3. Live Demo

**https://systemslibrarian.github.io/crypto-lab-hybrid-pqc/**

Establish a real session key three ways (classical / post-quantum / hybrid) and sign a message you type three ways, then flip the two threat switches — "quantum computer exists" and "lattices fall" — to watch every column recolor in real time. When an approach is fully broken the demo shows the attacker reconstructing the exact session key; when only one half of a hybrid falls, it shows the key surviving. Controls include per-approach and all-at-once buttons for key exchange and signing, an editable message for the signatures, and a trade-off matrix summarizing security, maturity, speed, bandwidth, and complexity.

## 4. How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-hybrid-pqc
cd crypto-lab-hybrid-pqc
npm install
npm run dev
```

No environment variables are needed — everything runs client-side with no backend. Run the test suite with `npm test`.

## 5. Part of the Crypto-Lab Suite

> One of 60+ live browser demos at
> [systemslibrarian.github.io/crypto-lab](https://systemslibrarian.github.io/crypto-lab/)
> — spanning Atbash (600 BCE) through NIST FIPS 203/204/205 (2024).

---

*"Whether you eat or drink, or whatever you do, do all to the glory of God." — 1 Corinthians 10:31*
