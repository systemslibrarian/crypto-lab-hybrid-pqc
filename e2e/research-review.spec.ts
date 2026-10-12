import {test,expect} from '@playwright/test';
test('research boundary is visible in the rendered lesson',async({page})=>{
 await page.goto('./');
 await expect(page.locator('.standards')).toContainText('Final NIST (2025-09-18)'); await expect(page.locator('.standards')).toContainText('Informational RFC (July 2026)'); await expect(page.locator('.standards')).toContainText('Standards Track RFC (August 2026)');
});
