// Interactive hybrid key exchange — three columns, one per approach, compared
// side by side. Sizes are shown immediately (real FIPS/RFC numbers); timings
// and the live session key appear after you establish a session. The threat
// switches recolor each column to show who survives.

import { el, clear, hexBox, announce } from './dom.ts';
import { KEMS } from '../crypto/kem.ts';
import { runKem, attackerRecoversKey } from '../crypto/session.ts';
import { status, type SecurityStatus } from '../crypto/compromise.ts';
import { formatBytes, formatMs, toHex } from '../crypto/metrics.ts';
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
        el('button', {
          class: 'btn establish',
          type: 'button',
          onclick: () => establish(),
        }, 'Establish session'),
      );
      return;
    }

    body.append(
      el('div', { class: 'metrics timings' }, [
        metricRow('Keygen', formatMs(sess.timings.keygenMs)),
        metricRow('Encapsulate', formatMs(sess.timings.encapsulateMs)),
        metricRow('Decapsulate', formatMs(sess.timings.decapsulateMs)),
      ]),
      hexBox('Session key', toHex(sess.senderKey)),
      el('p', { class: `match ${sess.match ? 'ok' : 'bad'}` }, [
        el('span', { 'aria-hidden': 'true' }, sess.match ? '🔑 ' : '⚠ '),
        sess.match ? 'Both sides derived the same key' : 'Key mismatch!',
      ]),
    );

    // Status under the current threat model.
    const meta = STATUS_META[st];
    const statusEl = el('div', { class: `col-status status-${st}` }, [
      el('span', { class: 'status-badge' }, [
        el('span', { 'aria-hidden': 'true' }, meta.icon + ' '),
        el('strong', {}, meta.label),
      ]),
    ]);

    const recovered = attackerRecoversKey(sess, store.state.threats);
    if (recovered) {
      statusEl.append(
        el('p', { class: 'attacker' }, 'Attacker reconstructed the session key:'),
        hexBox('Recovered', toHex(recovered)),
      );
    } else if (st === 'hedge-holding') {
      const survivor = store.state.threats.classicalBroken ? kem.algos[1] : kem.algos[0];
      statusEl.append(
        el('p', { class: 'attacker safe' }, `One half fell, but ${survivor.name} still protects the key.`),
      );
    }
    body.append(statusEl);

    // Re-show the button so re-running with fresh randomness is easy.
    body.append(
      el('button', { class: 'btn establish ghost', type: 'button', onclick: () => establish() }, 'Re-run'),
    );
  }

  function establish() {
    store.state.kem[approach] = runKem(approach);
    announce(`${kem.label} session established. Key size ${kem.sizes.sharedSecret} bytes.`);
    store.emit('kem');
  }

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

  return el('section', { class: 'section', 'aria-labelledby': 'sec-kem' }, [
    el('h2', { id: 'sec-kem' }, '🔑 Interactive Key Exchange'),
    el('p', { class: 'lede' }, [
      'Establish a real session key three ways. Same job, very different sizes and costs. ',
      'X25519 ciphertexts are 32 bytes; ML-KEM-768 adds a full kilobyte — and hybrid pays for both.',
    ]),
    el('div', { class: 'panel-actions' }, [
      el('button', {
        class: 'btn primary',
        type: 'button',
        onclick: () => {
          for (const a of APPROACHES) store.state.kem[a] = runKem(a);
          announce('All three sessions established.');
          store.emit('kem');
        },
      }, 'Establish all three'),
    ]),
    grid,
  ]);
}
