// Shared types for the three migration approaches the lab compares.
//
// The whole demo is built around ONE invariant: a "session key" or a
// "verified signature" is the unit of security, and an approach is COMPROMISED
// only when every algorithm it relies on is broken. Hybrid exists precisely so
// that "every algorithm" requires breaking two unrelated math problems at once.

/** The three columns compared everywhere in the UI. */
export type Approach = 'classical' | 'pq' | 'hybrid';

export const APPROACHES: Approach[] = ['classical', 'pq', 'hybrid'];

/** Which algorithm family an attacker has learned to break. */
export type Threat = 'classical-broken' | 'pq-broken';

export interface AlgoSpec {
  /** Human label, e.g. "X25519". */
  name: string;
  /** Security family this algorithm rests on. */
  family: 'classical' | 'pq';
  /** What breaks it, in one phrase (for tooltips). */
  brokenBy: string;
}

/** A measured size/time figure, kept as raw numbers so the UI owns formatting. */
export interface Metric {
  /** Bytes on the wire / at rest. */
  bytes: number;
  /** Wall-clock milliseconds for the timed operation (browser/JS reference impl). */
  ms: number;
}
