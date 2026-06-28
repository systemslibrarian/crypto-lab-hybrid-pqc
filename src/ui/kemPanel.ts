// Interactive hybrid key exchange — three columns, one per approach, compared
// side by side. Sizes are shown immediately (real FIPS/RFC numbers); timings
// (median + range) and the live session key appear after you establish a
// session. The threat switches recolor each column and the anatomy block shows
// component-by-component WHY each one survives or falls.

import { el, clear, hexBox, announce } from './dom.ts';
import { byteBars } from './viz.ts';
import { kemAnatomy } from './anatomy.ts';
import { establishKem, establishAllKem, rebenchKemCol } from './actions.ts';
import { KEMS, classicalKem, pqKem } from '../crypto/kem.ts';
import { attackerRecoversKey } from '../crypto/session.ts';
import { status, type SecurityStatus } from '../crypto/compromise.ts';
import { formatBytes, formatMs, formatRange, toHex, type Timing } from '../crypto/metrics.ts';
import { APPROACHES, type Approach } from '../crypto/types.ts';
import type { Store } from './store.ts';

const STATUS_META: Record<SecurityStatus, { icon: string; label: string }> = {
  secure: { icon: '✅', label: 'Secure' },
  'hedge-holding': { icon: '🛡️', label: 'Hedge holding' },
  broken: { icon: '⛔', label: 'Key recovered' },
};

function metricRow(label: string, value: string, hint?: string): HTMLElement {
  return el('div', { class: 'metric' }, [
    el('span', { class: 'metric-label', title: hint }, label),
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
  const kem = KEMS[approach];
  const body = el('div', { class: 'col-body' });
  const card = el('article', { class: `col col-${approach}`, 'data-status': 'idle' }, [
    el('header', { class: 'col-head' }, [
      el('h3', {}, kem.label.replace(/ \(.*\)/, '')),
      el(
        'div',
        { class: 'chips' },
        kem.algos.map((a) => el('span', { class: `chip chip-${a.family}` }, a.name)),
      ),
    ]),
    body,
  ]);

  function paint() {
    clear(body);
    const sess = store.state.kem[approach];
    const st = status(approach, store.state.threats);
    card.setAttribute('data-status', sess ? st : 'idle');

    // Sizes are known without establishing — show them for instant comparison.
    body.append(
      el('div', { class: 'metrics' }, [
        metricRow('Public key', formatBytes(kem.sizes.publicKey), 'Bytes the recipient publishes'),
        metricRow('Ciphertext', formatBytes(kem.sizes.ciphertext), 'Bytes sent to establish the key'),
        metricRow('Shared secret', formatBytes(kem.sizes.sharedSecret)),
      ]),
    );

    if (!sess) {
      body.append(
        el('button', { class: 'btn establish', type: 'button', onclick: () => establishKem(store, approach) }, 'Establish session'),
      );
      return;
    }

    body.append(
      el('div', { class: 'metrics timings' }, [
        timingRow('Keygen', sess.timings.keygen),
        timingRow('Encapsulate', sess.timings.encapsulate),
        timingRow('Decapsulate', sess.timings.decapsulate),
      ]),
      el('div', { class: 'tm-foot' }, [
        el('span', { class: 'tm-note' }, `median of ${sess.timings.keygen.runs} runs · JS reference impl`),
        el('button', { class: 'btn tiny', type: 'button', onclick: () => rebenchKemCol(store, approach) }, '↻ re-time'),
      ]),
      hexBox('Session key', toHex(sess.senderKey)),
      el('p', { class: `match ${sess.match ? 'ok' : 'bad'}` }, [
        el('span', { 'aria-hidden': 'true' }, sess.match ? '🔑 ' : '⚠ '),
        sess.match ? 'Both sides derived the same key' : 'Key mismatch!',
      ]),
    );

    const meta = STATUS_META[st];
    const statusEl = el('div', { class: `col-status status-${st}` }, [
      el('span', { class: 'status-badge' }, [
        el('span', { 'aria-hidden': 'true' }, meta.icon + ' '),
        el('strong', {}, meta.label),
      ]),
      kemAnatomy(approach, store.state.threats),
    ]);

    const recovered = attackerRecoversKey(sess, store.state.threats);
    if (recovered) {
      statusEl.append(
        el('p', { class: 'attacker' }, 'Attacker reconstructed the session key:'),
        hexBox('Recovered', toHex(recovered)),
      );
    }
    body.append(statusEl);

    body.append(
      el('button', { class: 'btn establish ghost', type: 'button', onclick: () => establishKem(store, approach) }, 'Re-run'),
    );
  }

  // Every threat change routes through setThreat/stepper/reset, which all emit
  // 'kem', so this one channel covers both "established" and "recolor" repaints.
  store.on('kem', paint);
  paint();
  return card;
}

export function buildKemPanel(store: Store): HTMLElement {
  const grid = el(
    'div',
    { class: 'cols' },
    APPROACHES.map((a) => buildColumn(store, a)),
  );

  const cBytes = classicalKem.sizes.publicKey + classicalKem.sizes.ciphertext;
  const qBytes = pqKem.sizes.publicKey + pqKem.sizes.ciphertext;

  return el('section', { class: 'section', 'aria-labelledby': 'sec-kem' }, [
    el('h2', { id: 'sec-kem' }, '🔑 Interactive Key Exchange'),
    el('p', { class: 'lede' }, [
      'Establish a real session key three ways. Same job, very different sizes and costs. ',
      'X25519 ciphertexts are 32 bytes; ML-KEM-768 adds a full kilobyte — and hybrid pays for both.',
    ]),
    byteBars({
      caption: 'Handshake bytes on the wire (public key + ciphertext)',
      note: 'The hybrid bar is the classical bar plus the post-quantum bar, stacked — you carry both. Next to ML-KEM-768’s ~2.2 KB, the 64-byte classical half is almost free.',
      rows: [
        { approach: 'classical', label: 'Classical · X25519', classicalBytes: cBytes, pqBytes: 0 },
        { approach: 'pq', label: 'Post-quantum · ML-KEM-768', classicalBytes: 0, pqBytes: qBytes },
        { approach: 'hybrid', label: 'Hybrid · both', classicalBytes: cBytes, pqBytes: qBytes },
      ],
    }),
    el('div', { class: 'panel-actions' }, [
      el('button', { class: 'btn primary', type: 'button', onclick: () => { establishAllKem(store); announce('All three sessions established.'); } }, 'Establish all three'),
    ]),
    grid,
    el('details', { class: 'impl-note' }, [
      el('summary', {}, 'Implementation note: how this lab combines the two secrets'),
      el('p', {}, [
        'This lab derives the hybrid session key with an HKDF-SHA256 combiner that also binds both ciphertexts — a robustness-oriented construction. The deployed TLS ',
        el('code', {}, 'X25519MLKEM768'),
        ' group is simpler: it concatenates the two shared secrets (',
        el('code', {}, 'ml_kem_ss ‖ x25519_ss'),
        ') straight into the TLS 1.3 key schedule. Both share the exact property this lab demonstrates — the result is unrecoverable unless you hold ',
        el('strong', {}, 'both'),
        ' secrets. The X25519 half is modeled as a DHKEM (its ephemeral public key plays the role of a ciphertext) so all three approaches expose one encapsulate / decapsulate interface. See the protocol-fidelity table below for how real systems combine the halves.',
      ]),
    ]),
  ]);
}
