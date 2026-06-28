# Prompt: Create "crypto-lab-hybrid-pqc-prompt" Demo

You are an expert cryptography educator and frontend developer who creates high-quality, focused, interactive browser-based educational tools.

## Project Goal
Create a new standalone browser demo called **Hybrid PQC + Classical Migration** that helps students understand why and how real-world systems are combining classical and post-quantum cryptography during the transition to quantum-resistant algorithms.

## Why This Is Valuable for Students
The migration to post-quantum cryptography is one of the most important ongoing changes in real-world cryptography. Simply replacing classical algorithms with post-quantum ones is often not ideal due to performance, maturity, and risk considerations.

Hybrid schemes (using both classical and post-quantum algorithms together) are currently the recommended approach by many standards bodies and large organizations. Students need to understand:
- Why hybrid cryptography is being used
- How it provides security even if one algorithm is broken
- The trade-offs involved (performance, complexity, key/signature sizes)
- What “crypto-agility” really means in practice

This topic is highly relevant but rarely taught interactively.

## Learning Objectives
By using this demo, a student should be able to:
- Explain what a hybrid cryptographic scheme is
- Understand the security benefits of combining classical + post-quantum algorithms
- See the performance and size trade-offs between pure classical, pure post-quantum, and hybrid approaches
- Recognize why organizations are adopting hybrid strategies during the migration period
- Describe the concept of crypto-agility

## Required Sections & Flow

### 1. Why Hybrid Cryptography?
- Clear explanation of the current transition period.
- Risks of moving too fast to post-quantum algorithms (immaturity, performance issues, potential undiscovered weaknesses).
- Benefits of hybrid schemes: security even if one algorithm is broken (classical or post-quantum).

### 2. Interactive Hybrid Key Exchange
- Allow the user to compare three approaches side-by-side:
  - Classical only (e.g., X25519)
  - Post-Quantum only (e.g., ML-KEM / Kyber)
  - Hybrid (X25519 + ML-KEM)
- Show key sizes, ciphertext sizes, and approximate performance.
- Let the user “establish a session” using each method and compare the results.

### 3. Hybrid Digital Signatures (Optional but Recommended)
- Similar side-by-side comparison for signatures:
  - Classical (e.g., Ed25519)
  - Post-Quantum (e.g., ML-DSA / Dilithium)
  - Hybrid (Ed25519 + ML-DSA)
- Show signature sizes and verification times.

### 4. Security Model
- Explain the “defense in depth” model: the scheme remains secure as long as *at least one* of the algorithms remains unbroken.
- Discuss what happens if the classical algorithm is broken by quantum computers vs. if the post-quantum algorithm has a flaw.

### 5. Real-World Context
- Mention current standards and recommendations (NIST, IETF, hybrid TLS drafts, etc.).
- Show examples of real systems or libraries already supporting hybrid cryptography.
- Brief discussion of crypto-agility and why it matters for long-lived systems.

### 6. Trade-offs Summary
- Clear comparison table or visualization showing:
  - Security level
  - Performance
  - Bandwidth / size overhead
  - Implementation complexity
- Help students develop intuition for when hybrid is worth the cost.

## Technical Preferences
- Browser-native (HTML + TypeScript/JavaScript). WASM is acceptable and potentially preferred for realistic PQC performance numbers.
- Use real or close-to-real algorithm names and parameters (ML-KEM, ML-DSA, X25519, etc.) where possible.
- Focus on clarity and comparison rather than implementing full protocols.
- Clean, educational aesthetic consistent with Crypto Lab demos.

## Relationship to Existing Work
- This demo would complement your strong Post-Quantum collection and existing hybrid-related content (e.g., `Hybrid Wire`).
- It helps students understand the *strategic* and *practical* aspects of the PQC migration, not just the individual algorithms.

## Output Requested
Please provide:
1. A recommended final display title for the demo page
2. High-level architecture and component breakdown
3. Key interactive comparison elements
4. Suggested visualizations and layout for comparisons
5. How much realism (real algorithm implementations) vs simulation is appropriate
6. Any important pedagogical notes about the current state of PQC migration

Start with the proposed structure, then we can iterate on implementation details.
