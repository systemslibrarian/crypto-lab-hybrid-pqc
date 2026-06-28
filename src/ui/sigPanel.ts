// Hybrid digital signatures — the same three-column comparison for signing.
// Sign a message three ways, compare signature sizes and verify times, then use
// the threat switches to see when a forged signature would be accepted.

import { el, clear, hexBox, announce } from './dom.ts';
import { SIGS } from '../crypto/sign.ts';
import { runSig, forgeryAccepted } from '../crypto/session.ts';
import { status, type SecurityStatus } from '../crypto/compromise.ts';
import { formatBytes, formatMs, toHex } from '../crypto/metrics.ts';
import { APPROACHES, type Approach } from '../crypto/types.ts';
import { utf8ToBytes } from '@noble/hashes/utils';
import type { Store } from './store.ts';

const VERDICT: Record<SecurityStatus, { icon: string; label: string }> = {
  secure: { icon: '✅', label: 'Unforgeable' },
  'hedge-holding': { icon: '🛡️', label: 'Hedge holding' },
  broken: { icon: '⛔', label: 'Forgery accepted' },
};

function metricRow(label: string, value: string): HTMLElement {
  return el('div', { class: 'metric' }, [
    el('span', { class: 'metric-label' }, label),
    el('span', { class: 'metric-value' }, value),
  ]);
}

function buildColumn(store: Store, approach: Approach): HTMLElement {
  const scheme = SIGS[approach];
  const body = el('div', { class: 'col-body' });
  const card = el('article', { class: `col col-${approach}`, 'data-status': 'idle' }, [
    el('header', { class: 'col-head' }, [
      el('h3', {}, scheme.label.replace(/ \(.*\)/, '')),
      el(
        'div',
        { class: 'chips' },
        scheme.algos.map((a) => el('span', { class: `chip chip-${a.family}` }, a.name)),
      ),
    ]),
    body,
  ]);

  function paint() {
    clear(body);
    const run = store.state.sig[approach];
    const st = status(approach, store.state.threats);
    card.setAttribute('data-status', run ? st : 'idle');

    body.append(
      el('div', { class: 'metrics' }, [
        metricRow('Public key', formatBytes(scheme.sizes.publicKey)),
        metricRow('Signature', formatBytes(scheme.sizes.signature)),
      ]),
    );

    if (!run) {
      body.append(
        el('button', { class: 'btn establish', type: 'button', onclick: () => sign() }, 'Sign message'),
      );
      return;
    }

    body.append(
      el('div', { class: 'metrics timings' }, [
        metricRow('Keygen', formatMs(run.timings.keygenMs)),
        metricRow('Sign', formatMs(run.timings.signMs)),
        metricRow('Verify', formatMs(run.timings.verifyMs)),
      ]),
      hexBox('Signature', toHex(run.signature, 24)),
      el('p', { class: `match ${run.verified ? 'ok' : 'bad'}` }, [
        el('span', { 'aria-hidden': 'true' }, run.verified ? '✍ ' : '⚠ '),
        run.verified ? 'Signature verifies' : 'Verification failed!',
      ]),
    );

    const meta = VERDICT[st];
    const statusEl = el('div', { class: `col-status status-${st}` }, [
      el('span', { class: 'status-badge' }, [
        el('span', { 'aria-hidden': 'true' }, meta.icon + ' '),
        el('strong', {}, meta.label),
      ]),
    ]);
    if (forgeryAccepted(approach, store.state.threats)) {
      statusEl.append(
        el('p', { class: 'attacker' }, 'Every algorithm this verifier checks is broken — a forged signature passes.'),
      );
    } else if (st === 'hedge-holding') {
      const survivor = store.state.threats.classicalBroken ? scheme.algos[1] : scheme.algos[0];
      statusEl.append(
        el('p', { class: 'attacker safe' }, `Verifier still requires a valid ${survivor.name} signature — forgery rejected.`),
      );
    }
    body.append(statusEl);
    body.append(el('button', { class: 'btn establish ghost', type: 'button', onclick: () => sign() }, 'Re-sign'));
  }

  function sign() {
    store.state.sig[approach] = runSig(approach, utf8ToBytes(store.state.message));
    announce(`${scheme.label} signature created, ${scheme.sizes.signature} bytes.`);
    store.emit('sig');
  }

  store.on('sig', paint);
  paint();
  return card;
}

export function buildSigPanel(store: Store): HTMLElement {
  const textarea = el('textarea', {
    id: 'sig-message',
    class: 'msg-input',
    rows: 2,
    'aria-describedby': 'sig-msg-hint',
    oninput: (e) => {
      store.state.message = (e.target as HTMLTextAreaElement).value;
      // Old signatures were over the previous message — invalidate them.
      for (const a of APPROACHES) store.state.sig[a] = null;
      store.emit('sig');
    },
  });
  textarea.value = store.state.message;

  const grid = el(
    'div',
    { class: 'cols' },
    APPROACHES.map((a) => buildColumn(store, a)),
  );

  return el('section', { class: 'section', 'aria-labelledby': 'sec-sig' }, [
    el('h2', { id: 'sec-sig' }, '✍️ Hybrid Digital Signatures'),
    el('p', { class: 'lede' }, [
      'Signatures show the size gap most starkly: an Ed25519 signature is 64 bytes; ML-DSA-65 is ~3.3 KB — over 50× larger. A hybrid signature carries both.',
    ]),
    el('div', { class: 'msg-field' }, [
      el('label', { for: 'sig-message' }, 'Message to sign'),
      textarea,
      el('span', { id: 'sig-msg-hint', class: 'hint' }, 'Edit the text, then sign — verification is over these exact bytes.'),
    ]),
    el('div', { class: 'panel-actions' }, [
      el('button', {
        class: 'btn primary',
        type: 'button',
        onclick: () => {
          const msg = utf8ToBytes(store.state.message);
          for (const a of APPROACHES) store.state.sig[a] = runSig(a, msg);
          announce('Message signed three ways.');
          store.emit('sig');
        },
      }, 'Sign with all three'),
    ]),
    grid,
  ]);
}
