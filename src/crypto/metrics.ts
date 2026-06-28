// Small formatting + micro-benchmark helpers. Timings are honest wall-clock
// measurements of the in-browser JavaScript reference implementations — they
// are useful for *relative* comparison between approaches, not as absolute
// numbers for a tuned native/WASM build (which would be faster).

export interface Timing {
  /** Median ms per call — the headline figure (robust to outliers). */
  median: number;
  /** Fastest observed sample. */
  min: number;
  /** Slowest observed sample. */
  max: number;
  /** How many samples the median/min/max summarize. */
  runs: number;
}

/**
 * Distribution of milliseconds-per-call, reported as median + min–max so a
 * single noisy reading can't mislead. Each sample averages a calibrated batch
 * of calls, because `performance.now()` is coarse (often clamped to ~100µs) and
 * sub-millisecond primitives would otherwise read as 0.
 */
export function benchDist(fn: () => void, runs = 7): Timing {
  fn(); // warmup (JIT, allocation)
  const t0 = performance.now();
  fn();
  const cal = performance.now() - t0; // rough cost of one call
  // Aim for ~0.5 ms of work per sample so the timer can resolve it.
  const batch = Math.min(500, Math.max(1, Math.round(0.5 / Math.max(cal, 0.005))));

  const samples: number[] = [];
  for (let r = 0; r < runs; r++) {
    const s = performance.now();
    for (let i = 0; i < batch; i++) fn();
    samples.push((performance.now() - s) / batch);
  }
  samples.sort((a, b) => a - b);
  return { median: samples[(runs - 1) >> 1], min: samples[0], max: samples[runs - 1], runs };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(n < 10240 ? 2 : 1)} KB`;
}

export function formatMs(ms: number): string {
  if (ms < 0.01) return '<0.01 ms';
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 10) return `${ms.toFixed(1)} ms`;
  return `${Math.round(ms)} ms`;
}

/** A compact min–max range without the unit on the first number. */
export function formatRange(t: Timing): string {
  const n = (ms: number) => (ms < 0.01 ? '<0.01' : ms < 1 ? ms.toFixed(2) : ms < 10 ? ms.toFixed(1) : String(Math.round(ms)));
  return `${n(t.min)}–${formatMs(t.max)}`;
}

/** Hex preview of a byte array, truncated with an ellipsis past `max` bytes. */
export function toHex(bytes: Uint8Array, max = bytes.length): string {
  const shown = bytes.subarray(0, max);
  let hex = '';
  for (let i = 0; i < shown.length; i++) hex += shown[i].toString(16).padStart(2, '0');
  return bytes.length > max ? `${hex}…` : hex;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
