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

  test('ACC-008: Operable on mobile phone viewport (390x844) without horizontal overflow and minimum 44px touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Adaptive Flashcards' })).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Verify touch target size of primary button
    const submitBtn = page.getByRole('button', { name: /sign in with password/i });
    await expect(submitBtn).toBeVisible();
    const box = await submitBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    // Toggle to Create Account on mobile
    const toggleBtn = page.getByRole('button', { name: /create an account/i });
    await toggleBtn.click();
    await expect(page.getByRole('heading', { name: 'Create an Account' })).toBeVisible();

    const createBtn = page.getByRole('button', { name: 'Create Account' });
    await expect(createBtn).toBeVisible();
    const createBox = await createBtn.boundingBox();
    expect(createBox).not.toBeNull();
    if (createBox) {
      expect(createBox.width).toBeGreaterThanOrEqual(44);
      expect(createBox.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('ACC-008: Operable on tablet viewport (768x1024) without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Adaptive Flashcards' })).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    await expect(page.getByRole('button', { name: /sign in with password/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /send magic sign-in link/i })).toBeVisible();
  });
});
