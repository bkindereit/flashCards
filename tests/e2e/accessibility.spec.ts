import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Audits (ACC-006, ACC-007)', () => {
  test('ACC-006: Sign-in view passes automated WCAG 2.1 AA axe audit', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Adaptive Flashcards' })).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page: page as any })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('ACC-007: Layout remains operable at 1280x720 viewport and 200% zoom without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Adaptive Flashcards' })).toBeVisible();

    // Simulate 200% zoom
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
    await expect(page.getByRole('button', { name: /send magic sign-in link/i })).toBeVisible();
  });
});
