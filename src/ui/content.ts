// The narrative sections that frame the interactive panels: why hybrids exist,
// the trade-off matrix, real-world deployments, standards, and crypto-agility.

import { el, dotMeter } from './dom.ts';
import {
  WHY_HYBRID,
  TRADEOFFS,
  DEPLOYMENTS,
  STANDARDS,
  CRYPTO_AGILITY,
  PROTOCOL_FIDELITY,
  CAVEATS,
} from '../data.ts';

export function buildHero(): HTMLElement {
  return el('header', { class: 'hero', role: 'group' }, [
    el('p', { class: 'eyebrow' }, 'Crypto Lab · PQC Migration'),
    el('h1', {}, 'Hybrid PQC + Classical Migration'),
    el('p', { class: 'tagline' }, [
      'Why real systems are pairing ',
      el('strong', {}, 'classical'),
      ' and ',
      el('strong', {}, 'post-quantum'),
      ' algorithms during the migration — compared side by side, with real X25519, ML-KEM-768, Ed25519, and ML-DSA-65 primitives running in your browser.',
    ]),
  ]);
}

export function buildWhy(): HTMLElement {
  return el('section', { class: 'section', 'aria-labelledby': 'sec-why' }, [
    el('h2', { id: 'sec-why' }, '🧭 Why Hybrid Cryptography?'),
    el(
      'div',
      { class: 'why-grid' },
      WHY_HYBRID.map((p) =>
        el('div', { class: 'why-card' }, [el('h3', {}, p.heading), el('p', {}, p.body)]),
      ),
    ),
  ]);
}

export function buildTradeoffs(): HTMLElement {
  const cols = ['Approach', 'Quantum-safe', 'Classical maturity', 'Speed', 'Bandwidth', 'Complexity'];
  const head = el('tr', {}, cols.map((c, i) => el('th', { scope: 'col', class: i === 0 ? 'rowhead' : '' }, c)));

  const rows = TRADEOFFS.map((r) =>
    el('tr', { class: `tr-${r.approach}` }, [
      el('th', { scope: 'row', class: 'rowhead' }, r.label),
      el('td', {}, dotMeter(r.quantumSafe.level, r.quantumSafe.text)),
      el('td', {}, dotMeter(r.classicalMaturity.level, r.classicalMaturity.text)),
      el('td', {}, dotMeter(r.speed.level, r.speed.text)),
      el('td', {}, dotMeter(r.bandwidth.level, r.bandwidth.text)),
      el('td', {}, dotMeter(r.complexity.level, r.complexity.text)),
    ]),
  );

  return el('section', { class: 'section', 'aria-labelledby': 'sec-trade' }, [
    el('h2', { id: 'sec-trade' }, '⚖️ Trade-offs at a Glance'),
    el('p', { class: 'lede' }, 'More dots = better on that axis. Hybrid wins on security by giving up bandwidth and simplicity — the bet that the safety margin is worth the cost during the transition.'),
    el('div', { class: 'table-scroll' }, [
      el('table', { class: 'tradeoff' }, [el('thead', {}, head), el('tbody', {}, rows)]),
    ]),
  ]);
}

export function buildRealWorld(): HTMLElement {
  const refLink = (href: string, label: string) =>
    el('a', { class: 'ref-link', href, target: '_blank', rel: 'noopener', 'aria-label': `${label} (source, opens in new tab)` }, [
      'source ',
      el('span', { 'aria-hidden': 'true' }, '↗'),
    ]);

  const badges = (kind: string, statusLabel: string, verified: string) =>
    el('div', { class: 'prov' }, [
      el('span', { class: 'prov-kind' }, kind),
      el('span', { class: 'prov-status' }, statusLabel),
      el('span', { class: 'prov-date', title: 'Last verified' }, `verified ${verified}`),
    ]);

  const deployments = el(
    'div',
    { class: 'deploy-grid' },
    DEPLOYMENTS.map((d) =>
      el('div', { class: 'deploy-card' }, [
        el('h4', {}, d.system),
        el('code', { class: 'deploy-scheme' }, d.scheme),
        el('p', {}, d.note),
        badges(d.kind, d.status, d.verified),
        refLink(d.ref, d.system),
      ]),
    ),
  );

  const standards = el(
    'ul',
    { class: 'standards' },
    STANDARDS.map((s) =>
      el('li', {}, [
        el('span', { class: 'std-id' }, s.id),
        el('span', { class: 'std-title' }, s.title),
        el('span', { class: 'std-status' }, s.status),
        refLink(s.ref, s.id),
      ]),
    ),
  );

  const agility = el(
    'div',
    { class: 'why-grid' },
    CRYPTO_AGILITY.map((p) => el('div', { class: 'why-card' }, [el('h3', {}, p.heading), el('p', {}, p.body)])),
  );

  return el('section', { class: 'section', 'aria-labelledby': 'sec-real' }, [
    el('h2', { id: 'sec-real' }, '🌐 Real-World Context'),
    el('p', { class: 'lede' }, 'Hybrid is not theoretical — it is already the default in the protocols you used to load this page.'),
    el('h3', { class: 'subhead' }, 'Deployed today'),
    deployments,
    el('h3', { class: 'subhead' }, 'Standards'),
    standards,
    el('h3', { class: 'subhead' }, 'Crypto-agility — why hybrid is a transition, not a destination'),
    agility,
  ]);
}

export function buildProtocolFidelity(): HTMLElement {
  const head = el('tr', {}, [
    el('th', { scope: 'col' }, 'Construction'),
    el('th', { scope: 'col' }, 'How the two secrets combine'),
    el('th', { scope: 'col' }, 'Notes'),
  ]);
  const rows = PROTOCOL_FIDELITY.map((r) =>
    el('tr', { class: r.lab ? 'pf-lab' : '' }, [
      el('th', { scope: 'row' }, [r.system, r.lab ? el('span', { class: 'pf-tag' }, ' this lab') : null]),
      el('td', {}, el('code', {}, r.combine)),
      el('td', {}, r.note),
    ]),
  );
  return el('section', { class: 'section', 'aria-labelledby': 'sec-fidelity' }, [
    el('h2', { id: 'sec-fidelity' }, '🔬 Lab vs. Real Protocols'),
    el('p', { class: 'lede' }, 'This is a teaching model, not a wire format. Here is exactly how its combiner differs from the constructions deployed in production — all of which share the property that both secrets are required.'),
    el('div', { class: 'table-scroll' }, [
      el('table', { class: 'fidelity' }, [el('thead', {}, head), el('tbody', {}, rows)]),
    ]),
  ]);
}

export function buildCaveats(): HTMLElement {
  return el('section', { class: 'section', 'aria-labelledby': 'sec-scope' }, [
    el('h2', { id: 'sec-scope' }, '⚠️ Scope & Honest Caveats'),
    el('p', { class: 'lede' }, 'What this lab deliberately does not model — stated so its claims aren’t over-read.'),
    el(
      'ul',
      { class: 'caveats' },
      CAVEATS.map((c) => el('li', {}, [el('span', { class: 'cav-mark', 'aria-hidden': 'true' }, '•'), c])),
    ),
  ]);
}
