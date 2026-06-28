// Byte-size comparison bars. Each approach is one horizontal bar split into a
// classical segment and a post-quantum segment, all scaled to the same axis.
// The point lands visually: the hybrid bar is exactly the classical bar plus
// the post-quantum bar stacked end to end — you pay for both. Fully accessible:
// the figure is a labelled group, every bar carries a text breakdown, and a
// legend names the colours (never colour alone).

import { el } from './dom.ts';
import { formatBytes } from '../crypto/metrics.ts';
import type { Approach } from '../crypto/types.ts';

export interface ByteRow {
  approach: Approach;
  label: string;
  classicalBytes: number;
  pqBytes: number;
}

function legend(): HTMLElement {
  return el('div', { class: 'byte-legend', 'aria-hidden': 'true' }, [
    el('span', { class: 'lg' }, [el('span', { class: 'sw sw-classical' }), 'Classical']),
    el('span', { class: 'lg' }, [el('span', { class: 'sw sw-pq' }), 'Post-quantum']),
  ]);
}

export function byteBars(opts: { caption: string; note: string; rows: ByteRow[] }): HTMLElement {
  const max = Math.max(...opts.rows.map((r) => r.classicalBytes + r.pqBytes)) || 1;

  const bars = opts.rows.map((r) => {
    const total = r.classicalBytes + r.pqBytes;
    const track = el('div', {
      class: 'byte-track',
      role: 'img',
      'aria-label': `${r.label}: ${total} bytes total — ${r.classicalBytes} classical, ${r.pqBytes} post-quantum`,
    });
    if (r.classicalBytes > 0) {
      track.append(el('span', { class: 'seg seg-classical', style: `width:${(r.classicalBytes / max) * 100}%` }));
    }
    if (r.pqBytes > 0) {
      track.append(el('span', { class: 'seg seg-pq', style: `width:${(r.pqBytes / max) * 100}%` }));
    }
    return el('li', { class: `byte-row byte-${r.approach}` }, [
      el('span', { class: 'byte-row-label' }, [
        el('span', { class: 'brl-name' }, r.label),
        el('span', { class: 'brl-total' }, formatBytes(total)),
      ]),
      track,
    ]);
  });

  return el('figure', { class: 'bytefig' }, [
    el('figcaption', {}, opts.caption),
    legend(),
    el('ul', { class: 'byte-bars' }, bars),
    el('p', { class: 'byte-note' }, opts.note),
  ]);
}
