// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { buildSurvivalMatrix } from './survivalMatrix.ts';
import { Store } from './store.ts';

describe('survival matrix', () => {
  it('renders the full truth table with correct cell statuses', () => {
    const fig = buildSurvivalMatrix(new Store());
    const rows = [...fig.querySelectorAll('tbody tr')];
    expect(rows.length).toBe(4);

    // Row order: none, quantum, lattice, both. Columns: classical, pq, hybrid.
    const cellClass = (r: number, c: number) =>
      rows[r].querySelectorAll('.sm-cell')[c].className;

    // No break → all secure.
    expect(cellClass(0, 0)).toContain('status-secure');
    expect(cellClass(0, 2)).toContain('status-secure');
    // Quantum computer → classical broken, hybrid holds.
    expect(cellClass(1, 0)).toContain('status-broken');
    expect(cellClass(1, 2)).toContain('status-hedge-holding');
    // Both → hybrid broken too.
    expect(cellClass(3, 2)).toContain('status-broken');
  });

  it('highlights the row matching the current threat state, live', () => {
    const store = new Store();
    const fig = buildSurvivalMatrix(store);
    const rows = () => [...fig.querySelectorAll('tbody tr')];
    expect(rows()[0].classList.contains('sm-current')).toBe(true); // none

    store.state.threats.classicalBroken = true;
    store.emit('threats');
    expect(rows()[1].classList.contains('sm-current')).toBe(true); // quantum
    expect(rows()[0].classList.contains('sm-current')).toBe(false);
  });
});
