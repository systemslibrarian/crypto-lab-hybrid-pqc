// Small formatting + micro-benchmark helpers. Timings are honest wall-clock
// measurements of the in-browser JavaScript reference implementations — they
// are useful for *relative* comparison between approaches, not as absolute
// numbers for a tuned native/WASM build (which would be faster).

/** Average milliseconds per call over `iters` runs, after one warmup. */
export function bench(fn: () => void, iters = 12): number {
  fn(); // warmup (JIT, allocation)
  const start = performance.now();
  for (let i = 0; i < iters; i++) fn();
  return (performance.now() - start) / iters;
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
