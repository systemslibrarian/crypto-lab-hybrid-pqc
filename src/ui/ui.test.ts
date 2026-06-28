// @vitest-environment happy-dom
// End-to-end-ish smoke test of the UI path: build the panels, establish real
// sessions through the buttons, then flip the threat switches and assert each
// column recolors per the security model. Exercises every panel + the store
// wiring, not just the crypto.

import { describe, it, expect, beforeEach } from 'vitest';
import { Store, DEFAULT_MESSAGE } from './store.ts';
import { buildKemPanel } from './kemPanel.ts';
import { buildSigPanel } from './sigPanel.ts';
import { buildSecurityModel } from './securityModel.ts';

function mount(): { store: Store; root: HTMLElement } {
  document.body.innerHTML = '<div id="a11y-announcer"></div>';
  const root = document.createElement('div');
  root.id = 'app';
  document.body.append(root);
  const store = new Store();
  root.append(buildKemPanel(store), buildSecurityModel(store), buildSigPanel(store));
  return { store, root };
}

function clickByText(root: HTMLElement, text: string): void {
  const btn = [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
  if (!btn) throw new Error(`button "${text}" not found`);
  btn.click();
}

function colStatus(root: HTMLElement, section: 'kem' | 'sig', approach: string): string | null {
  // KEM panel is first, signatures last; scope by the closest section heading.
  const cols = [...root.querySelectorAll(`.col-${approach}`)];
  const col = section === 'kem' ? cols[0] : cols[cols.length - 1];
  return col?.getAttribute('data-status') ?? null;
}

describe('UI smoke', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('establishes all three KEM sessions and shows session keys', () => {
    const { root } = mount();
    clickByText(root, 'Establish all three');
    const keys = root.querySelectorAll('.col-classical .hex, .col-hybrid .hex');
    expect(keys.length).toBeGreaterThan(0);
    expect(colStatus(root, 'kem', 'hybrid')).toBe('secure');
  });

  it('breaking the classical half: classical broken, hybrid still holds', () => {
    const { root } = mount();
    clickByText(root, 'Establish all three');
    // flip the "quantum computer exists" switch
    (root.querySelector('#break-classical') as HTMLInputElement).checked = true;
    (root.querySelector('#break-classical') as HTMLInputElement).dispatchEvent(new Event('change'));

    expect(colStatus(root, 'kem', 'classical')).toBe('broken');
    expect(colStatus(root, 'kem', 'pq')).toBe('secure');
    expect(colStatus(root, 'kem', 'hybrid')).toBe('hedge-holding');
    // signatures recolor from the same shared state
    expect(colStatus(root, 'sig', 'hybrid')).toBe('hedge-holding');
    // the broken classical KEM column reveals a recovered key
    expect(root.querySelector('.col-classical .attacker')).not.toBeNull();
  });

  it('breaking both halves compromises hybrid too', () => {
    const { root } = mount();
    clickByText(root, 'Establish all three');
    for (const id of ['#break-classical', '#break-pq']) {
      const sw = root.querySelector(id) as HTMLInputElement;
      sw.checked = true;
      sw.dispatchEvent(new Event('change'));
    }
    expect(colStatus(root, 'kem', 'hybrid')).toBe('broken');
    expect(colStatus(root, 'sig', 'hybrid')).toBe('broken');
  });

  it('editing the message invalidates old signatures', () => {
    const { root } = mount();
    clickByText(root, 'Sign with all three');
    expect(root.querySelector('.col-hybrid .match')).not.toBeNull();
    const ta = root.querySelector('#sig-message') as HTMLTextAreaElement;
    ta.value = 'a different message';
    ta.dispatchEvent(new Event('input'));
    // signatures cleared → the sign button is back, no match line yet
    expect(colStatus(root, 'sig', 'hybrid')).toBe('idle');
  });

  it('reset clears sessions and unchecks the threat switches', () => {
    const { root } = mount();
    clickByText(root, 'Establish all three');
    const sw = root.querySelector('#break-classical') as HTMLInputElement;
    sw.checked = true;
    sw.dispatchEvent(new Event('change'));
    expect(colStatus(root, 'kem', 'classical')).toBe('broken');

    // Edit the message too, so we can confirm reset restores the default.
    const ta = root.querySelector('#sig-message') as HTMLTextAreaElement;
    ta.value = 'something else entirely';
    ta.dispatchEvent(new Event('input'));

    clickByText(root, 'Reset demo');
    expect(sw.checked).toBe(false);
    expect(colStatus(root, 'kem', 'classical')).toBe('idle');
    expect(colStatus(root, 'kem', 'hybrid')).toBe('idle');
    expect(ta.value).toBe(DEFAULT_MESSAGE);
  });

  it('shows byte-size comparison bars in both panels before establishing', () => {
    const { root } = mount();
    const figs = root.querySelectorAll('.bytefig');
    expect(figs.length).toBe(2); // KEM + signatures
    // hybrid bar's accessible label is the sum of the two halves
    const hybridTracks = [...root.querySelectorAll('.byte-hybrid .byte-track')];
    expect(hybridTracks.length).toBe(2);
    expect(hybridTracks[0].getAttribute('aria-label')).toContain('2336 bytes total'); // KEM: 64 + 2272
    expect(hybridTracks[1].getAttribute('aria-label')).toContain('5357 bytes total'); // sig: 96 + 5261
  });

  it('flipping a switch recolors every column even if only one was established by hand', () => {
    const { root } = mount();
    // Establish only the first (classical) KEM column via its own button.
    clickByText(root, 'Establish session');
    expect(colStatus(root, 'kem', 'pq')).toBe('idle');

    const sw = root.querySelector('#break-pq') as HTMLInputElement;
    sw.checked = true;
    sw.dispatchEvent(new Event('change'));

    // The un-established columns are now populated and recolor correctly.
    expect(colStatus(root, 'kem', 'pq')).toBe('broken');
    expect(colStatus(root, 'kem', 'hybrid')).toBe('hedge-holding');
    expect(colStatus(root, 'sig', 'hybrid')).toBe('hedge-holding');
  });

  it('discloses how the hybrid combiner differs from the deployed TLS construction', () => {
    const { root } = mount();
    const note = root.querySelector('.impl-note');
    expect(note).not.toBeNull();
    expect(note?.textContent).toContain('X25519MLKEM768');
    expect(note?.textContent).toContain('ml_kem_ss ‖ x25519_ss');
  });
});
