import { expect, test, type Page } from '@playwright/test';
import {
  NARROW,
  boot,
  expectBaselineNotStale,
  expectNoNewNonTextFailures,
  scan,
  settle,
} from './gate';

/**
 * WCAG regression gate.
 *
 * Deploys are already gated on the real attack behaviour by verdict.spec.ts;
 * this gates them on accessibility the same way. See gate.ts for the three
 * rules this file obeys — nothing injected, content asserted before every scan,
 * and `violations` treated as one oracle among five.
 *
 * The page is scanned in both themes, in states a visitor can actually reach,
 * at a 1280px desktop viewport and at a 380px phone one. Almost none of the
 * interesting rendering is the first-paint one: a broken comparison column
 * paints a `--bad` gradient wash and prints the attacker's recovered key, an
 * accepted hybrid forgery recolours the signature column and prints the forged
 * message, the implementation note lives in a closed `<details>`, and the
 * guided tour renders its own panel. The previous gate reached none of them: it
 * force-opened the details, stripped `[hidden]`, and "measured" gradient
 * contrast by reading CSS variables off two synthetic divs — a ratio
 * independent of the painted page that defaulted to a pass when the node was
 * absent. Here every state is driven, and every colour is measured for real.
 */

const THEMES = ['dark', 'light'] as const;

const kemCol = (page: Page, a: string) =>
  page.locator(`section[aria-labelledby="sec-kem"] .col-${a}`);
const sigCol = (page: Page, a: string) =>
  page.locator(`section[aria-labelledby="sec-sig"] .col-${a}`);

/** Establish all three KEM sessions and sign the message all three ways. */
async function populate(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Establish all three' }).click();
  await expect(kemCol(page, 'hybrid')).toHaveAttribute('data-status', 'secure');
  await page.getByRole('button', { name: 'Sign with all three' }).click();
  await expect(sigCol(page, 'hybrid')).toHaveAttribute('data-status', 'secure');
}

const breakHalf = (page: Page, which: 'classical' | 'pq') =>
  page.locator(`label[for="break-${which}"]`).click();

/**
 * A state worth scanning: how to reach it from a booted page, and what has to
 * be true once you are there. The assertion is not decoration — it is what
 * stops a scan from passing over a panel that never redrew.
 */
interface State {
  label: string;
  drive: (page: Page) => Promise<void>;
}

const STATES: State[] = [
  {
    // The default mount. Nothing established yet: every column shows its sizes
    // and an "Establish session" button, and the guided-tour intro is offering
    // the tour. data-status is idle across the board.
    label: 'first paint / idle',
    drive: async (page) => {
      await expect(kemCol(page, 'hybrid')).toHaveAttribute('data-status', 'idle');
      await expect(
        kemCol(page, 'hybrid').getByRole('button', { name: 'Establish session' })
      ).toBeVisible();
      await expect(page.getByRole('button', { name: /Start guided tour/ })).toBeVisible();
    },
  },
  {
    // Everything established, no break. Real timings fill the tiles, the session
    // keys and signatures render in their hex boxes, the anatomy checklists show
    // and every status badge is the green "secure" tone.
    label: 'established / all secure',
    drive: async (page) => {
      await populate(page);
      for (const a of ['classical', 'pq', 'hybrid']) {
        await expect(kemCol(page, a)).toHaveAttribute('data-status', 'secure');
        await expect(sigCol(page, a)).toHaveAttribute('data-status', 'secure');
      }
      await expect(kemCol(page, 'hybrid').locator('.hex').first()).toBeVisible();
    },
  },
  {
    // Classical family broken. The classical column flips to the `broken`
    // gradient wash and prints the recovered key; the hybrid column is amber
    // "hedge-holding" and prints the attacker's non-matching key in the `ok`
    // tone; the threat summary recolours amber. Three palettes at once.
    label: 'classical broken / hybrid hedge-holding',
    drive: async (page) => {
      await populate(page);
      await breakHalf(page, 'classical');
      await expect(kemCol(page, 'classical')).toHaveAttribute('data-status', 'broken');
      await expect(kemCol(page, 'hybrid')).toHaveAttribute('data-status', 'hedge-holding');
      await expect(kemCol(page, 'classical').locator('.attacker')).toContainText(
        'these bytes matched'
      );
      await expect(kemCol(page, 'hybrid').locator('.attacker-failed')).toBeVisible();
      await expect(page.locator('.threat-summary.hedge')).toBeVisible();
      await expect(page.locator('.survival-table tr.sm-current')).toBeVisible();
    },
  },
  {
    // Both families broken. The hybrid finally fails: the KEM column recovers
    // the key and the signature column prints an accepted forgery over a message
    // the key never signed, all in the `--bad` palette; the threat summary is
    // red. The signature column's `.forged-msg` only exists in this rendering.
    label: 'both broken / hybrid forged',
    drive: async (page) => {
      await populate(page);
      await breakHalf(page, 'classical');
      await breakHalf(page, 'pq');
      await expect(kemCol(page, 'hybrid')).toHaveAttribute('data-status', 'broken');
      await expect(sigCol(page, 'hybrid')).toHaveAttribute('data-status', 'broken');
      await expect(sigCol(page, 'hybrid').locator('.attacker')).toContainText(
        'ACCEPTED a forged signature'
      );
      await expect(sigCol(page, 'hybrid').locator('.forged-msg')).toBeVisible();
      await expect(page.locator('.threat-summary.broken')).toBeVisible();
    },
  },
  {
    // The only <details> on the page: the implementation note. Its body is
    // content-visibility: hidden until opened, so a first-paint scan checks
    // none of the code chips inside it.
    label: 'implementation note open',
    drive: async (page) => {
      await page.locator('details.impl-note > summary').click();
      await expect(page.locator('details.impl-note')).toHaveAttribute('open', '');
      await expect(page.locator('details.impl-note code').first()).toBeVisible();
      await expect(page.locator('details.impl-note code').first()).toContainText('X25519MLKEM768');
    },
  },
  {
    // The guided tour's own rendering: its panel, step counter, progress dots
    // and Back/Next/Exit nav. Starting it also populates every column and pulses
    // the KEM section (the `.cl-highlight` box-shadow animation `settle` drains).
    label: 'guided tour active',
    drive: async (page) => {
      await page.getByRole('button', { name: /Start guided tour/ }).click();
      await expect(page.locator('.tour-active')).toBeVisible();
      await expect(page.locator('.tour-count')).toHaveText('Step 1 of 6');
      await expect(page.getByRole('button', { name: 'Next →' })).toBeVisible();
    },
  },
];

for (const theme of THEMES) {
  for (const state of STATES) {
    test(`${theme} — ${state.label}`, async ({ page }) => {
      test.setTimeout(180_000);
      await boot(page, theme);
      await state.drive(page);
      await scan(page, `${theme} / ${state.label} / 1280px`);

      // Same state, phone width. Reflow (1.4.10) has no axe rule, and axe's
      // `scrollable-region-focusable` never fires on a container whose content
      // still fits — the tables, the hex boxes and the deploy-scheme chips only
      // overflow here, so a desktop-only gate reports nothing about any of them.
      await page.setViewportSize(NARROW);
      await settle(page);
      await scan(page, `${theme} / ${state.label} / ${NARROW.width}px`);
    });
  }
}

/**
 * The non-text baseline's third rule, which had never run.
 *
 * `nontext-baseline.ts` claims three: a finding not listed fails, a listed
 * finding that got WORSE fails, and a listed finding that has been FIXED fails
 * until its entry is deleted. The first two live in
 * `expectNoNewNonTextFailures` and fire from every `scan` above. The third is
 * `expectBaselineNotStale`, which was exported and never imported — so the
 * baseline could only ever grow.
 *
 * It gets its own test, driving the states itself, rather than a call appended
 * to the last state test. The scans above are one test per state per theme, so
 * none of them sees the whole baseline. Leaning on `nonTextSeen` accumulating
 * across them would make the verdict depend on how Playwright distributed the
 * tests — at `--workers=1` they share one module instance and the last would
 * see the union, at the config's default parallelism each gets its own and
 * would see almost nothing. An oracle whose answer changes with the worker
 * count is not an oracle, so this one depends on nothing outside itself.
 *
 * Dark alone, and measured rather than assumed: captured through the gate's own
 * path, the six states at both viewports yield all eleven baselined findings in
 * dark and only ten in light, because `button.btn.primary` clears 3:1 against
 * the light surface and fails against the dark one. Running it in light would
 * report that entry as stale on every run.
 *
 * It calls `expectNoNewNonTextFailures` rather than the whole of `scan`,
 * because that is the function that populates `nonTextSeen`; re-running axe,
 * the contrast walk and the reflow checks over states already scanned above
 * would multiply this file's cost to assert nothing new.
 */
test('the non-text baseline has no stale entries', async ({ page }) => {
  test.setTimeout(180_000);
  // One page walks every state, so the desktop width has to be restored by
  // hand — the scans above get a fresh page per test and never need to.
  const WIDE = page.viewportSize() ?? { width: 1280, height: 720 };
  for (const state of STATES) {
    await boot(page, 'dark');
    await state.drive(page);
    await expectNoNewNonTextFailures(page, `stale sweep / ${state.label} / ${WIDE.width}px`);
    await page.setViewportSize(NARROW);
    await settle(page);
    await expectNoNewNonTextFailures(page, `stale sweep / ${state.label} / ${NARROW.width}px`);
    await page.setViewportSize(WIDE);
  }
  expectBaselineNotStale();
});

/**
 * WCAG 2.1.1 (Keyboard), asserted end to end rather than per-scan.
 *
 * `scan` already refuses any scrolling container with no keyboard route, but a
 * `tabindex` on an element the sequential walk never arrives at is no better
 * than none — so walk the page with Tab and prove every scrolling container
 * that relies on a `tabindex` (rather than a focusable child) is genuinely
 * reached. At 380px the session-key and signature hex strings, the comparison
 * tables and the deploy-scheme code chips all overflow horizontally, which is
 * where these appear.
 */
test('every keyboard-only scrolling container is reachable by Tab', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page, 'dark');
  await populate(page);
  await page.locator('details.impl-note > summary').click();
  await expect(page.locator('details.impl-note')).toHaveAttribute('open', '');
  await page.setViewportSize(NARROW);
  await settle(page);

  // Containers that overflow and carry no focusable child of their own, so
  // their only keyboard route is an explicit tabindex on the container itself.
  // Each gets a UNIQUE probe id — this page has six `.hex` boxes and three
  // `.table-scroll` wrappers, so keying reachability by class name would collapse
  // nine distinct focus targets into two and never confirm the rest.
  const probeIds = await page.evaluate(() => {
    const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
    const els = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .filter((el) => {
        const cs = getComputedStyle(el);
        return (
          ['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)
        );
      })
      .filter((el) => !el.querySelector(FOCUSABLE));
    return els.map((el, i) => {
      const id = String(i);
      el.setAttribute('data-scroller-probe', id);
      return id;
    });
  });

  for (const id of probeIds) {
    await expect(page.locator(`[data-scroller-probe="${id}"]`)).toHaveAttribute('tabindex', '0');
  }

  // Prove each tabindex is actually in the tab order, not just present: Tab from
  // the top of the document until every probed container has held focus.
  if (probeIds.length > 0) {
    await page.locator('body').focus();
    const reached = new Set<string>();
    for (let i = 0; i < 400 && reached.size < probeIds.length; i++) {
      await page.keyboard.press('Tab');
      const hit = await page.evaluate(
        () => (document.activeElement as HTMLElement | null)?.getAttribute('data-scroller-probe') ?? null
      );
      if (hit !== null) reached.add(hit);
    }
    expect(reached.size, 'every keyboard-only scroller must be reached by Tab').toBe(
      probeIds.length
    );
  }
});
