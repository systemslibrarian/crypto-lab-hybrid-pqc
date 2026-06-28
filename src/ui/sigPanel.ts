// Hybrid digital signatures — the same three-column comparison for signing.
// Sign a message three ways, compare signature sizes and verify times, then use
// the threat switches to see when a forged signature would be accepted. The
// anatomy block shows the per-scheme verifier checks behind each verdict.

import { el, clear, hexBox, announce } from './dom.ts';
import { byteBars } from './viz.ts';
import { sigAnatomy } from './anatomy.ts';
import { signOne, signAll, rebenchSigCol, setMessage } from './actions.ts';
import { MAX_MSG } from './urlState.ts';
import { SIGS, classicalSig, pqSig } from '../crypto/sign.ts';
import { forgeryAccepted } from '../crypto/session.ts';
import { status, type SecurityStatus } from '../crypto/compromise.ts';
import { formatBytes, formatMs, formatRange, toHex, type Timing } from '../crypto/metrics.ts';
import { APPROACHES, type Approach } from '../crypto/types.ts';
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

function timingRow(label: string, t: Timing): HTMLElement {
  return el('div', { class: 'metric' }, [
    el('span', { class: 'metric-label' }, label),
    el('span', { class: 'metric-value' }, [
      formatMs(t.median),
      el('span', { class: 'tm-range' }, ` (${formatRange(t)})`),
    ]),
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
        el('button', { class: 'btn establish', type: 'button', onclick: () => signOne(store, approach) }, 'Sign message'),
      );
      return;
    }

    body.append(
      el('div', { class: 'metrics timings' }, [
        timingRow('Keygen', run.timings.keygen),
        timingRow('Sign', run.timings.sign),
        timingRow('Verify', run.timings.verify),
      ]),
      el('div', { class: 'tm-foot' }, [
        el('span', { class: 'tm-note' }, `median of ${run.timings.sign.runs} runs · JS reference impl`),
        el('button', { class: 'btn tiny', type: 'button', onclick: () => rebenchSigCol(store, approach) }, '↻ re-time'),
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
      sigAnatomy(approach, store.state.threats),
    ]);
    if (forgeryAccepted(approach, store.state.threats)) {
      statusEl.append(
        el('p', { class: 'attacker' }, 'Every algorithm this verifier checks is broken — a forged signature passes.'),
      );
    }
    body.append(statusEl);
    body.append(el('button', { class: 'btn establish ghost', type: 'button', onclick: () => signOne(store, approach) }, 'Re-sign'));
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
    // Capped so a message always fits in a shareable URL and the reloaded
    // session signs the exact same bytes (see urlState MAX_MSG).
    maxlength: MAX_MSG,
    'aria-describedby': 'sig-msg-hint',
    oninput: (e) => setMessage(store, (e.target as HTMLTextAreaElement).value),
  });
  textarea.value = store.state.message;
  // Keep the field in sync if the message changes elsewhere (URL load / reset).
  store.on('sig', () => {
    if (textarea.value !== store.state.message) textarea.value = store.state.message;
  });

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
    byteBars({
      caption: 'Verification material per message (public key + signature)',
      note: 'A hybrid signature ships an Ed25519 signature and an ML-DSA-65 signature side by side; the verifier requires both, so both bytes travel.',
      rows: [
        {
          approach: 'classical',
          label: 'Classical · Ed25519',
          classicalBytes: classicalSig.sizes.publicKey + classicalSig.sizes.signature,
          pqBytes: 0,
        },
        {
          approach: 'pq',
          label: 'Post-quantum · ML-DSA-65',
          classicalBytes: 0,
          pqBytes: pqSig.sizes.publicKey + pqSig.sizes.signature,
        },
        {
          approach: 'hybrid',
          label: 'Hybrid · both',
          classicalBytes: classicalSig.sizes.publicKey + classicalSig.sizes.signature,
          pqBytes: pqSig.sizes.publicKey + pqSig.sizes.signature,
        },
      ],
    }),
    el('div', { class: 'msg-field' }, [
      el('label', { for: 'sig-message' }, 'Message to sign'),
      textarea,
      el('span', { id: 'sig-msg-hint', class: 'hint' }, 'Edit the text, then sign — verification is over these exact bytes.'),
    ]),
    el('div', { class: 'panel-actions' }, [
      el('button', { class: 'btn primary', type: 'button', onclick: () => { signAll(store); announce('Message signed three ways.'); } }, 'Sign with all three'),
    ]),
    grid,
  ]);
}
