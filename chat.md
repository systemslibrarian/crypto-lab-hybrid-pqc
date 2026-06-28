# What Would Make This Demo a 10/10

## Current Read

This is already a strong demo. It uses real X25519, ML-KEM-768, Ed25519, and ML-DSA-65 primitives in the browser; it compares classical-only, PQ-only, and hybrid side by side; it has a shared break-a-half threat model; and the tests/build are healthy.

Validation performed:

- `npx vitest run --reporter=verbose`: 7 test files passed, 55 tests passed.
- `npm run build`: TypeScript and Vite production build completed successfully.
- Browser smoke check: establishing/signing all three approaches works, and flipping "Quantum computer exists" makes classical break, PQ stay secure, and hybrid enter hedge-holding as intended.

My current score: 8.5/10. The crypto model and teaching premise are much stronger than the average browser crypto demo. The remaining path to 10/10 is mostly about making the insight impossible to miss, improving protocol fidelity/context, and polishing mobile/teaching ergonomics.

## Highest-Impact Upgrades

### 1. Add a Guided Scenario Mode

Right now the page has the right pieces, but a first-time visitor still has to infer the ideal path: establish keys, sign, flip one threat, inspect hybrid, then flip both. A 10/10 demo should choreograph that first aha moment.

Add a compact guided rail or stepper:

1. Establish all sessions.
2. Sign the sample message.
3. Flip "Quantum computer exists".
4. Observe classical failure and hybrid survival.
5. Flip "Lattices fall".
6. Observe that hybrid only fails when both halves fail.

Each step should highlight the exact UI region that changed and include a one-sentence takeaway. This would turn the demo from "accurate interactive lab" into "teaching instrument."

### 2. Show the Hybrid Anatomy Explicitly

The current status blocks say the hybrid holds, but the best possible version would show why in a concrete, component-level way.

For KEMs, add an expandable or side-by-side transcript view:

- X25519 shared secret: available/unavailable to attacker.
- ML-KEM shared secret: available/unavailable to attacker.
- Combiner output: recoverable only if both inputs are available.
- Ciphertext binding: show both ciphertext halves are included in the combiner context.

For signatures, show the verifier checklist:

- Ed25519 verification: pass/fail/forgeable.
- ML-DSA verification: pass/fail/forgeable.
- Hybrid verifier result: accepted only when both checks pass.

The repo already has the right model in `session.ts`; surfacing it visually would make the core security claim feel proven instead of merely stated.

### 3. Make Protocol Fidelity More Visible

The implementation note correctly discloses that the lab's HKDF combiner differs from deployed TLS `X25519MLKEM768`, where the two shared secrets are concatenated into the TLS 1.3 key schedule. That note is currently hidden behind `<details>`.

For a 10/10 demo, make this a visible comparison table:

- Lab construction: HKDF-SHA256 combiner binding both ciphertexts.
- TLS 1.3 hybrid group: `ml_kem_ss || x25519_ss` into the TLS key schedule.
- OpenSSH: named hybrid KEX algorithms.
- Signal/iMessage: hybrid agreement inside larger protocol designs.

This prevents a sophisticated viewer from thinking the lab is claiming to be a production protocol, while also teaching the important distinction between educational model and deployed construction.

### 4. Add Shareable Demo States

For teaching, reproducibility matters. Add query-string state for non-secret UI choices:

- selected threat switches;
- current signed message;
- expanded/collapsed explanation panels;
- guided scenario step;
- theme.

Example: `?classicalBroken=1&pqBroken=0&step=hybrid-holds`.

Do not serialize keys, ciphertexts, signatures, or session secrets. Recompute those locally on load. The goal is shareable pedagogy, not shareable cryptographic material.

### 5. Upgrade Timing Displays from One-Off Numbers to Mini Benchmarks

The timings are honest relative measurements, but a visitor can overread single values. Make timing more robust and self-explanatory:

- show median over N runs instead of only an average;
- show a tiny range, such as p10-p90 or min-max;
- label the environment: browser JS reference implementation, not native/WASM or production-tuned code;
- add a "run benchmark again" control that updates only timings, not the whole transcript.

This would make the performance story more defensible under scrutiny.

### 6. Fix the Mobile Horizontal Overflow

Browser inspection at 390px wide reported `scrollWidth: 407`, so there is a small horizontal overflow on mobile. The visible culprits are near the standards/source-link/table area; the trade-off table is intentionally scrollable, but the page root should not overflow.

10/10 polish means no accidental page-wide horizontal scroll. Keep the table's local horizontal scroll, but ensure source links and table wrappers cannot expand the document width.

### 7. Add a Persistent "What Changed?" Summary

When a threat switch flips, many cards recolor at once. That is good, but a persistent summary would make the comparison easier to scan:

| Threat state | Classical | PQ only | Hybrid |
| --- | --- | --- | --- |
| No break | secure | secure | secure |
| Quantum computer | broken | secure | holds |
| Lattice break | secure | broken | holds |
| Both breaks | broken | broken | broken |

This should update live and sit close to the switches. It would give visitors a stable mental map before they inspect detailed keys/signatures.

### 8. Add an Adversary Timeline for Harvest-Now-Decrypt-Later

The README and intro mention HNDL, but the interactive model is mostly instantaneous. Add a simple timeline:

- 2026: attacker records traffic.
- 203X: quantum computer breaks classical DH.
- Outcome: classical transcript decrypts; PQ and hybrid transcripts still resist unless lattice assumptions also fail.

This would connect the abstract switch model to the actual migration urgency.

### 9. Strengthen Source Provenance

The real-world section already links to primary sources. To make it excellent, add small metadata:

- source type: NIST, IETF draft, vendor deployment note, protocol spec;
- last verified date;
- standard/deployment status: final, draft, default-on, announced, experimental.

This matters because PQC deployment facts change quickly. A demo about migration should look maintained and auditable.

### 10. Add a Short Threat-Model Caveats Panel

The lab is clear that it simulates the event of a cryptographic break, not the break itself. A 10/10 version should also name what is intentionally out of scope:

- side channels;
- RNG failure;
- downgrade attacks;
- malformed ciphertext/signature handling;
- protocol transcript binding beyond this educational model;
- authentication, certificates, and PKI;
- production-safe composite signature formats.

That caveat panel would increase trust without weakening the demo.

## Smaller Polish Wins

- Replace emoji-heavy headings/statuses with icons plus text where the shared design system allows it, while preserving the accessible text that is already present.
- Add a compact glossary for CRQC, KEM, ciphertext, shared secret, combiner, and composite signature.
- Add a "compare bytes" toggle that switches between bytes, KB, and multiplicative factors such as "35.5x larger."
- Add copy buttons for public keys/ciphertexts/signatures separately, not only displayed key/signature snippets.
- Add a reset mode that keeps threat switches but reruns cryptographic randomness, useful for live teaching.
- Add visual diff animation when a switch changes a column from secure to broken or hedge-holding.
- Add screenshot/visual regression checks for desktop and mobile so the mobile overflow does not return.

## Bottom Line

Do not spend the next effort on more algorithms first. The current algorithm set is the right teaching set. The path to 10/10 is to make the existing insight sharper:

- guided first-run story;
- explicit component-level proof of why hybrid holds;
- visible production-protocol comparison;
- shareable teaching states;
- more defensible timing presentation;
- mobile polish.

With those changes, this would feel less like a good standalone demo and more like the canonical browser explainer for hybrid PQC migration.