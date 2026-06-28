// Shared app state. The break-a-half threat toggles live here because BOTH the
// KEM panel and the signature panel recolor themselves from the same state —
// that shared state is what makes "flip one switch, watch every column react"
// feel like one coherent model rather than two demos.

import type { Approach } from '../crypto/types.ts';
import type { CompromiseState } from '../crypto/compromise.ts';
import type { KemSession, SigRun } from '../crypto/session.ts';

export interface AppState {
  threats: CompromiseState;
  kem: Record<Approach, KemSession | null>;
  sig: Record<Approach, SigRun | null>;
  message: string;
  /** Active guided-tour step index, or -1 when the tour isn't running. */
  step: number;
}

type Listener = () => void;

export const DEFAULT_MESSAGE = 'Transfer $10,000 to account 4471-9920.';

export class Store {
  state: AppState = {
    threats: { classicalBroken: false, pqBroken: false },
    kem: { classical: null, pq: null, hybrid: null },
    sig: { classical: null, pq: null, hybrid: null },
    message: DEFAULT_MESSAGE,
    step: -1,
  };

  private listeners = new Map<string, Set<Listener>>();

  /** Subscribe to a named channel ('kem', 'sig', 'threats'). */
  on(channel: string, fn: Listener): void {
    if (!this.listeners.has(channel)) this.listeners.set(channel, new Set());
    this.listeners.get(channel)!.add(fn);
  }

  emit(...channels: string[]): void {
    for (const c of channels) this.listeners.get(c)?.forEach((fn) => fn());
  }
}
