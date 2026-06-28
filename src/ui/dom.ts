// Tiny DOM helpers — no framework. Everything is plain elements so the markup
// is inspectable and the crypto stays the star.

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Child[] | Child = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

/** A 1–3 dot meter with an accessible text label (never color-only). */
export function dotMeter(level: 1 | 2 | 3, label: string): HTMLElement {
  const dots = el('span', { class: 'dots', 'aria-hidden': 'true' });
  for (let i = 1; i <= 3; i++) {
    dots.append(el('span', { class: i <= level ? `dot dot-on lvl-${level}` : 'dot' }));
  }
  return el('span', { class: 'meter' }, [dots, el('span', { class: 'meter-text' }, label)]);
}

/** Monospace, horizontally-scrollable byte string with a copy button. */
export function hexBox(label: string, hex: string): HTMLElement {
  const code = el('code', { class: 'hex' }, hex);
  const copy = el(
    'button',
    {
      class: 'copy-btn',
      type: 'button',
      'aria-label': `Copy ${label}`,
      onclick: () => {
        navigator.clipboard?.writeText(hex).then(
          () => {
            copy.textContent = 'copied';
            setTimeout(() => (copy.textContent = 'copy'), 1200);
          },
          () => {},
        );
      },
    },
    'copy',
  );
  return el('div', { class: 'hexrow' }, [
    el('span', { class: 'hexrow-label' }, label),
    el('div', { class: 'hexrow-body' }, [code, copy]),
  ]);
}

export function announce(text: string): void {
  const live = document.getElementById('a11y-announcer');
  if (live) live.textContent = text;
}
