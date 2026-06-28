// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { kemAnatomy, sigAnatomy } from './anatomy.ts';

const onlyClassical = { classicalBroken: true, pqBroken: false };
const onlyPq = { classicalBroken: false, pqBroken: true };
const both = { classicalBroken: true, pqBroken: true };

function gate(elm: HTMLElement) {
  const g = elm.querySelector('.an-gate')!;
  return { ok: g.classList.contains('an-ok'), text: g.querySelector('.an-state')?.textContent };
}

describe('kemAnatomy', () => {
  it('hybrid: one half broken → combiner still unrecoverable', () => {
    const c = gate(kemAnatomy('hybrid', onlyClassical));
    expect(c.ok).toBe(true);
    expect(c.text).toBe('unrecoverable');
    expect(gate(kemAnatomy('hybrid', onlyPq)).ok).toBe(true);
  });
  it('hybrid: both broken → combiner output recovered', () => {
    const g = gate(kemAnatomy('hybrid', both));
    expect(g.ok).toBe(false);
    expect(g.text).toBe('recovered');
  });
  it('single approaches have no gate row', () => {
    expect(kemAnatomy('classical', onlyClassical).querySelector('.an-gate')).toBeNull();
    expect(kemAnatomy('pq', onlyPq).querySelector('.an-gate')).toBeNull();
  });
});

describe('sigAnatomy', () => {
  it('hybrid verifier rejects forgeries unless both schemes are broken', () => {
    expect(gate(sigAnatomy('hybrid', onlyPq)).text).toBe('rejects forgeries');
    expect(gate(sigAnatomy('hybrid', both)).text).toBe('accepts forgery');
  });
});
