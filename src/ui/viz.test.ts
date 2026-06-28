// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { byteBars } from './viz.ts';

describe('byteBars', () => {
  const fig = byteBars({
    caption: 'Handshake bytes',
    note: 'note',
    rows: [
      { approach: 'classical', label: 'Classical', classicalBytes: 64, pqBytes: 0 },
      { approach: 'pq', label: 'Post-quantum', classicalBytes: 0, pqBytes: 2272 },
      { approach: 'hybrid', label: 'Hybrid', classicalBytes: 64, pqBytes: 2272 },
    ],
  });

  it('renders one bar per approach with a legend and caption', () => {
    expect(fig.querySelector('figcaption')?.textContent).toBe('Handshake bytes');
    expect(fig.querySelectorAll('.byte-row').length).toBe(3);
    expect(fig.querySelectorAll('.byte-legend .lg').length).toBe(2);
  });

  it('each track carries an accessible byte breakdown', () => {
    const tracks = [...fig.querySelectorAll('.byte-track')];
    expect(tracks[0].getAttribute('aria-label')).toContain('64 bytes total — 64 classical, 0 post-quantum');
    expect(tracks[2].getAttribute('aria-label')).toContain('2336 bytes total — 64 classical, 2272 post-quantum');
  });

  it('scales widths to the largest bar (hybrid = 100%)', () => {
    // Hybrid row has both segments; their widths sum to 100% of the track.
    const hybrid = fig.querySelectorAll('.byte-hybrid .seg');
    const sum = [...hybrid].reduce((acc, s) => acc + parseFloat((s as HTMLElement).style.width), 0);
    expect(Math.round(sum)).toBe(100);
    // The lone classical bar is a small fraction of that same axis.
    const classical = fig.querySelector('.byte-classical .seg') as HTMLElement;
    expect(parseFloat(classical.style.width)).toBeCloseTo((64 / 2336) * 100, 1);
  });

  it('omits a zero-width segment', () => {
    expect(fig.querySelectorAll('.byte-classical .seg').length).toBe(1); // no PQ segment
    expect(fig.querySelectorAll('.byte-pq .seg').length).toBe(1); // no classical segment
  });
});
