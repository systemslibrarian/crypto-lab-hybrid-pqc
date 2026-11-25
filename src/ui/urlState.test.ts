// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { applyUrl, initUrlSync } from './urlState.ts';
import { Store } from './store.ts';
import { setThreat } from './actions.ts';

describe('shareable URL state', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('hydrates threats and step from the query string and populates columns', () => {
    window.history.replaceState(null, '', '/?c=1&step=2');
    const store = new Store();
    applyUrl(store);
    expect(store.state.threats.classicalBroken).toBe(true);
    expect(store.state.threats.pqBroken).toBe(false);
    expect(store.state.step).toBe(2);
    // implied-broken state means the columns are pre-populated on load
    expect(store.state.kem.hybrid).not.toBeNull();
    expect(store.state.sig.hybrid).not.toBeNull();
  });

  it('reads a custom message', () => {
    window.history.replaceState(null, '', '/?msg=hello%20world');
    const store = new Store();
    applyUrl(store);
    expect(store.state.message).toBe('hello world');
  });

  it('a link to a tour step loads the switches used by its narration', () => {
    window.history.replaceState(null, '', '/?step=4');
    const store = new Store();
    applyUrl(store);
    expect(store.state.step).toBe(4);
    expect(store.state.threats).toEqual({ classicalBroken: true, pqBroken: true });
  });

  it('keeps explicitly saved switches when old tour narration conflicts with them', () => {
    window.history.replaceState(null, '', '/?q=1&step=2');
    const store = new Store();
    applyUrl(store);
    expect(store.state.step).toBe(-1);
    expect(store.state.threats).toEqual({ classicalBroken: false, pqBroken: true });
  });

  it('a manual switch change exits the tour and shares the new situation', () => {
    window.history.replaceState(null, '', '/?c=1&step=2');
    const store = new Store();
    applyUrl(store);
    initUrlSync(store);
    setThreat(store, 'classicalBroken', true);
    expect(store.state.step).toBe(2);
    setThreat(store, 'classicalBroken', false);
    expect(store.state.step).toBe(-1);
    expect(window.location.search).toBe('');
  });

  it('writes only non-secret state to the URL on change', () => {
    const store = new Store();
    initUrlSync(store);
    store.state.threats.classicalBroken = true;
    store.state.threats.pqBroken = true;
    store.emit('threats');
    const search = window.location.search;
    expect(search).toContain('c=1');
    expect(search).toContain('q=1');
    // never serialize secrets
    expect(search).not.toContain('key');
    expect(search.toLowerCase()).not.toContain('secret');
  });

  it('keeps the URL clean when nothing differs from defaults', () => {
    const store = new Store();
    initUrlSync(store);
    store.emit('threats');
    expect(window.location.search).toBe('');
  });
});
