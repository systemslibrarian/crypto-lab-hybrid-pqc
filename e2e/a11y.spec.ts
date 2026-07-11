import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * WCAG regression gate. Scans the full page with every collapsible expanded,
 * in both the dark (default) and light themes. Modeled on the ascon lab gate.
 *
 * The page is entirely static-visible (no tabs/modals); the only collapsible
 * is the KEM panel's <details class="impl-note">. We still generically reveal
 * every <details>, drop [hidden], and neutralize animation/opacity so nothing
 * is mid-fade (e.g. the guided-tour .cl-highlight pulse) when axe measures.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function revealAll(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation: none !important;
      transition: none !important;
      opacity: 1 !important;
    }`,
  });
  await page.evaluate(() => {
    for (const details of Array.from(document.querySelectorAll('details'))) {
      (details as HTMLDetailsElement).open = true;
    }
    for (const el of Array.from(document.querySelectorAll('[hidden]'))) {
      el.removeAttribute('hidden');
    }
    for (const el of Array.from(
      document.querySelectorAll<HTMLElement>('[style*="display: none"], [style*="display:none"]'),
    )) {
      el.style.display = '';
    }
  });
}

async function scan(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
  }));
  expect(summary).toEqual([]);
}

test('no WCAG A/AA violations in dark theme', async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await revealAll(page);
  await scan(page);
});

test('no WCAG A/AA violations in light theme', async ({ page }) => {
  await page.goto('.');
  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await revealAll(page);
  await scan(page);
});
