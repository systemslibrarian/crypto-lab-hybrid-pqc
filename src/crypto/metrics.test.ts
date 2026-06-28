import { describe, it, expect } from 'vitest';
import { formatBytes, formatMs, toHex, bytesEqual } from './metrics.ts';

describe('formatBytes', () => {
  it('shows raw bytes under 1 KB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(64)).toBe('64 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });
  it('shows KB with appropriate precision above 1 KB', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(2272)).toBe('2.22 KB');
    expect(formatBytes(3309)).toBe('3.23 KB');
    expect(formatBytes(20480)).toBe('20.0 KB');
  });
});

describe('formatMs', () => {
  it('buckets by magnitude', () => {
    expect(formatMs(0.004)).toBe('<0.01 ms');
    expect(formatMs(0.5)).toBe('0.50 ms');
    expect(formatMs(4.2)).toBe('4.2 ms');
    expect(formatMs(42)).toBe('42 ms');
  });
});

describe('toHex', () => {
  it('renders full hex without ellipsis', () => {
    expect(toHex(new Uint8Array([0, 255, 16]))).toBe('00ff10');
  });
  it('truncates with an ellipsis past max', () => {
    const out = toHex(new Uint8Array([1, 2, 3, 4]), 2);
    expect(out).toBe('0102…');
  });
});

describe('bytesEqual', () => {
  it('is true only for identical arrays', () => {
    expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(bytesEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });
});
