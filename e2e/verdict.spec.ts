import { expect, test, type Page, type Locator } from '@playwright/test';

/**
 * Verdict regression gate.
 *
 * The column badges, the threat summary and the survival matrix used to be
 * selected from the two threat switches: status() was an if-chain over the
 * flags and forgeryAccepted() was isCompromised(). No forgery was ever built.
 *
 * They now come from attack.ts, which runs the attack: the key-recovery badge
 * is a byte comparison against the session key that was actually derived, and
 * the signature badge is the honest verifier's answer on a signature the
 * attacker really produced over a message the honest key never signed.
 *
 * Every assertion here has to survive the negative case as well as the
 * positive: the forgery must genuinely be accepted when both halves fall.
 */

const kemCol = (page: Page, approach: string): Locator =>
  page.locator(`section[aria-labelledby="sec-kem"] .col-${approach}`);
const sigCol = (page: Page, approach: string): Locator =>
  page.locator(`section[aria-labelledby="sec-sig"] .col-${approach}`);
const summary = (page: Page): Locator => page.locator('.threat-summary');

async function breakHalf(page: Page, which: 'classical' | 'pq'): Promise<void> {
  await page.locator(`label[for="break-${which}"]`).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('.');
  await page.getByRole('button', { name: 'Establish all three' }).click();
  await page.getByRole('button', { name: 'Sign with all three' }).click();
  await expect(kemCol(page, 'hybrid')).toHaveAttribute('data-status', 'secure');
});

test('no break: the attacks are run anyway and all of them fail', async ({ page }) => {
  for (const a of ['classical', 'pq', 'hybrid']) {
    await expect(kemCol(page, a)).toHaveAttribute('data-status', 'secure');
    await expect(sigCol(page, a)).toHaveAttribute('data-status', 'secure');
    // A forgery was produced for every column and every one was rejected.
    await expect(sigCol(page, a).locator('.attacker')).toContainText('verifier rejected it');
  }
  await expect(summary(page)).toContainText('no reconstructed key matched');
});

test('quantum break: classical falls by measurement, hybrid holds by measurement', async ({
  page,
}) => {
  await breakHalf(page, 'classical');

  // Classical KEM: the attacker's bytes matched the session key.
  await expect(kemCol(page, 'classical')).toHaveAttribute('data-status', 'broken');
  await expect(kemCol(page, 'classical').locator('.attacker')).toContainText(
    'these bytes matched',
  );

  // Hybrid KEM: the combiner ran with the held secret and produced the wrong key.
  await expect(kemCol(page, 'hybrid')).toHaveAttribute('data-status', 'hedge-holding');
  await expect(kemCol(page, 'hybrid').locator('.attacker')).toContainText(
    'do not match the session key',
  );
  await expect(kemCol(page, 'hybrid').locator('.an-gate .an-state')).toHaveText(
    'did not match the session key',
  );

  // Classical signature: the verifier really accepted a forgery.
  await expect(sigCol(page, 'classical')).toHaveAttribute('data-status', 'broken');
  await expect(sigCol(page, 'classical').locator('.attacker')).toContainText(
    'verifier ACCEPTED a forged signature',
  );

  // Hybrid signature: the Ed25519 half verified, the ML-DSA half did not, so
  // the AND rejected — all three facts read off the run.
  await expect(sigCol(page, 'hybrid')).toHaveAttribute('data-status', 'hedge-holding');
  const halves = sigCol(page, 'hybrid').locator('.an-row:not(.an-gate) .an-state');
  await expect(halves.nth(0)).toHaveText('forgery verified');
  await expect(halves.nth(1)).toHaveText('forgery rejected');
  await expect(sigCol(page, 'hybrid').locator('.an-gate .an-state')).toHaveText(
    'rejected the forgery',
  );

  // PQ-only relies on neither broken family.
  await expect(kemCol(page, 'pq')).toHaveAttribute('data-status', 'secure');
  await expect(summary(page)).toContainText('It was run against hybrid too and failed');
});

test('lattice break: PQ falls, hybrid holds on its classical half', async ({ page }) => {
  await breakHalf(page, 'pq');
  await expect(kemCol(page, 'pq')).toHaveAttribute('data-status', 'broken');
  await expect(sigCol(page, 'pq').locator('.attacker')).toContainText(
    'verifier ACCEPTED a forged signature',
  );
  await expect(kemCol(page, 'hybrid')).toHaveAttribute('data-status', 'hedge-holding');
  const halves = sigCol(page, 'hybrid').locator('.an-row:not(.an-gate) .an-state');
  await expect(halves.nth(0)).toHaveText('forgery rejected');
  await expect(halves.nth(1)).toHaveText('forgery verified');
});

// The negative verdict for the hedge itself. This can only pass if a forged
// hybrid signature was actually built and actually accepted by the verifier.
test('both broken: the hybrid forgery is really produced and really accepted', async ({
  page,
}) => {
  await breakHalf(page, 'classical');
  await breakHalf(page, 'pq');

  await expect(kemCol(page, 'hybrid')).toHaveAttribute('data-status', 'broken');
  await expect(kemCol(page, 'hybrid').locator('.attacker')).toContainText('these bytes matched');
  await expect(kemCol(page, 'hybrid').locator('.an-gate .an-state')).toHaveText(
    'matched the session key',
  );

  await expect(sigCol(page, 'hybrid')).toHaveAttribute('data-status', 'broken');
  await expect(sigCol(page, 'hybrid').locator('.attacker')).toContainText(
    'verifier ACCEPTED a forged signature',
  );
  await expect(sigCol(page, 'hybrid').locator('.an-gate .an-state')).toHaveText(
    'accepted the forgery',
  );
  const halves = sigCol(page, 'hybrid').locator('.an-row:not(.an-gate) .an-state');
  await expect(halves.nth(0)).toHaveText('forgery verified');
  await expect(halves.nth(1)).toHaveText('forgery verified');
  await expect(summary(page)).toContainText('hybrid included');
});

test('the forged signature shown is not the honest signature', async ({ page }) => {
  const honest = await sigCol(page, 'hybrid').locator('code.hex').first().textContent();
  await breakHalf(page, 'classical');
  await breakHalf(page, 'pq');
  const forged = await sigCol(page, 'hybrid').locator('code.hex').last().textContent();
  expect(forged).not.toBe(honest);
  expect((forged ?? '').length).toBeGreaterThan(10);
});

test('the survival matrix cells carry the outcome of their own run', async ({ page }) => {
  const rows = page.locator('.survival-table tbody tr');
  // Row 0 = no break, row 3 = both. Column 3 (index 2 of .sm-cell) = hybrid.
  await expect(rows.nth(0).locator('.sm-cell').nth(2)).toHaveClass(/status-secure/);
  await expect(rows.nth(1).locator('.sm-cell').nth(2)).toHaveClass(/status-hedge-holding/);
  await expect(rows.nth(3).locator('.sm-cell').nth(2)).toHaveClass(/status-broken/);
  // The receipts: what the cell's own run did.
  await expect(rows.nth(1).locator('.sm-cell').nth(2)).toHaveAttribute(
    'title',
    'key recovered: no · forgery accepted: no',
  );
  await expect(rows.nth(3).locator('.sm-cell').nth(2)).toHaveAttribute(
    'title',
    'key recovered: yes · forgery accepted: yes',
  );
  await expect(rows.nth(1).locator('.sm-cell').nth(0)).toHaveAttribute(
    'title',
    'key recovered: yes · forgery accepted: yes',
  );
});
