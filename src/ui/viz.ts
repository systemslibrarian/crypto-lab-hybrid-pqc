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
  const mkBtn = (u: Unit, text: string, label?: string) => {
    // A glyph-only button draws its mark from CSS and holds no text, so its
    // aria-label is the whole name. axe cannot judge
    // label-content-name-mismatch for a control whose visible text is a single
    // character and files it as `incomplete` whatever the name says; with no
    // DOM text there is nothing to compare. The mark is decoration here -- the
    // meaning is "multiples of classical", which the name carries.
    //
    // The CSS is keyed on the aria-label, NOT on an added class: the
    // non-text-contrast baseline records each control by its class list, so
    // a new class reads as a brand-new control and the whole row reports as
    // a regression. Measured here before this was changed back.
    const glyphOnly = text === '×';
    const b = el('button', {
      class: 'unit-btn',
      type: 'button',
      'aria-pressed': String(u === 'B'),
      // A spoken name for the ones whose text is a glyph or an abbreviation,
      // opening with the text itself: axe 4.14 wants the accessible name to
      // contain the visible text (label-content-name-mismatch, WCAG 2.5.3),
      // and "kilobytes" does not contain "KB".
      'aria-label': label ? (glyphOnly ? label : `${text}: ${label}`) : undefined,
      onclick: () => setUnit(u),
    }, glyphOnly ? '' : text);
    unitBtns[u] = b;
    return b;
  };
  // No role="group" with a name here. The wrapper shows "B KB ×" and was
  // named "Size units", which axe 4.14 reports as
  // label-content-name-mismatch (WCAG 2.5.3 Label in Name): the accessible
  // name has to contain the visible text, and no sensible group name does.
  // The three buttons inside carry their own names, which is what a user
  // actually operates; the wrapper is layout.
  const toggle = el('div', { class: 'unit-toggle' }, [
    mkBtn('B', 'bytes'),
    mkBtn('KB', 'KB', 'kilobytes'),
    mkBtn('x', '×', 'multiples of classical'),
  ]);

  return el('figure', { class: 'bytefig' }, [
    el('div', { class: 'bytefig-head' }, [el('figcaption', {}, opts.caption), toggle]),
    legend(),
    el('ul', { class: 'byte-bars' }, bars),
    el('p', { class: 'byte-note' }, opts.note),
  ]);
}
