// Byte-size comparison bars. Each approach is one horizontal bar split into a
// classical segment and a post-quantum segment, all scaled to the same axis.
// The point lands visually: the hybrid bar is exactly the classical bar plus
// the post-quantum bar stacked end to end — you pay for both. A unit toggle
// switches the labels between bytes, KB, and a ×-factor relative to classical,
// without changing the (byte-proportional) bar widths. Fully accessible: the
// figure is a labelled group, every bar carries a text breakdown, and a legend
// names the colours (never colour alone).

import { el } from './dom.ts';
import type { Approach } from '../crypto/types.ts';

export interface ByteRow {
  approach: Approach;
  label: string;
  classicalBytes: number;
  pqBytes: number;
}

type Unit = 'B' | 'KB' | 'x';

function legend(): HTMLElement {
  return el('div', { class: 'byte-legend', 'aria-hidden': 'true' }, [
    el('span', { class: 'lg' }, [el('span', { class: 'sw sw-classical' }), 'Classical']),
    el('span', { class: 'lg' }, [el('span', { class: 'sw sw-pq' }), 'Post-quantum']),
  ]);
}

export function byteBars(opts: { caption: string; note: string; rows: ByteRow[] }): HTMLElement {
  const totals = opts.rows.map((r) => r.classicalBytes + r.pqBytes);
  const max = Math.max(...totals) || 1;
  const ref = opts.rows.find((r) => r.approach === 'classical');
  const refTotal = (ref ? ref.classicalBytes + ref.pqBytes : Math.min(...totals)) || 1;

  let unit: Unit = 'B';
  const fmt = (total: number): string => {
    if (unit === 'KB') return `${(total / 1024).toFixed(2)} KB`;
    if (unit === 'x') {
      const f = total / refTotal;
      return `${f.toFixed(f < 10 ? 2 : 1)}×`;
    }
    return `${total.toLocaleString('en-US')} B`;
  };

  const totalSpans: Array<{ span: HTMLElement; total: number }> = [];

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
    const totalSpan = el('span', { class: 'brl-total' }, fmt(total));
    totalSpans.push({ span: totalSpan, total });
    return el('li', { class: `byte-row byte-${r.approach}` }, [
      el('span', { class: 'byte-row-label' }, [el('span', { class: 'brl-name' }, r.label), totalSpan]),
      track,
    ]);
  });

  const unitBtns: Record<Unit, HTMLButtonElement> = {} as Record<Unit, HTMLButtonElement>;
  const setUnit = (u: Unit) => {
    unit = u;
    for (const { span, total } of totalSpans) span.textContent = fmt(total);
    (['B', 'KB', 'x'] as Unit[]).forEach((k) => unitBtns[k].setAttribute('aria-pressed', String(k === u)));
  };
  const mkBtn = (u: Unit, text: string) => {
    const b = el('button', {
      class: 'unit-btn',
      type: 'button',
      'aria-pressed': String(u === 'B'),
      onclick: () => setUnit(u),
    }, text);
    unitBtns[u] = b;
    return b;
  };
  const toggle = el('div', { class: 'unit-toggle', role: 'group', 'aria-label': 'Size units' }, [
    mkBtn('B', 'bytes'),
    mkBtn('KB', 'KB'),
    mkBtn('x', '×'),
  ]);

  return el('figure', { class: 'bytefig' }, [
    el('div', { class: 'bytefig-head' }, [el('figcaption', {}, opts.caption), toggle]),
    legend(),
    el('ul', { class: 'byte-bars' }, bars),
    el('p', { class: 'byte-note' }, opts.note),
  ]);
}
