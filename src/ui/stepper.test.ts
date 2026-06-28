// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { buildStepper } from './stepper.ts';
import { Store } from './store.ts';

function click(root: HTMLElement, text: string) {
  const b = [...root.querySelectorAll('button')].find((x) => x.textContent?.includes(text));
  if (!b) throw new Error(`no button "${text}"`);
  b.click();
}

describe('guided tour', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('starts on the intro, then walks through deterministic threat states', () => {
    const store = new Store();
    const sec = buildStepper(store);
    document.body.append(sec);

    expect(store.state.step).toBe(-1);
    click(sec, 'Start guided tour');
    expect(store.state.step).toBe(0);
    expect(store.state.threats).toEqual({ classicalBroken: false, pqBroken: false });

    click(sec, 'Next'); // step 1
    click(sec, 'Next'); // step 2 — quantum computer arrives
    expect(store.state.step).toBe(2);
    expect(store.state.threats).toEqual({ classicalBroken: true, pqBroken: false });

    click(sec, 'Next'); // step 3
    click(sec, 'Next'); // step 4 — lattices fall too
    expect(store.state.threats).toEqual({ classicalBroken: true, pqBroken: true });

    click(sec, 'Next'); // step 5 — recap returns to a single break (hybrid holds)
    expect(store.state.step).toBe(5);
    expect(store.state.threats).toEqual({ classicalBroken: true, pqBroken: false });
  });

  it('Back is reversible (re-derives the earlier threat state)', () => {
    const store = new Store();
    const sec = buildStepper(store);
    document.body.append(sec);
    click(sec, 'Start guided tour');
    for (let i = 0; i < 4; i++) click(sec, 'Next'); // reach step 4 (both broken)
    expect(store.state.threats.pqBroken).toBe(true);
    click(sec, 'Back'); // step 3 → only classical broken
    expect(store.state.threats).toEqual({ classicalBroken: true, pqBroken: false });
  });

  it('Exit returns to the intro', () => {
    const store = new Store();
    const sec = buildStepper(store);
    document.body.append(sec);
    click(sec, 'Start guided tour');
    click(sec, 'Exit tour');
    expect(store.state.step).toBe(-1);
    expect(sec.textContent).toContain('Start guided tour');
  });
});
