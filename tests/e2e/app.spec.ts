import { test, expect } from '@playwright/test';

test.describe('Adaptive Flashcard Application E2E (VA-ARC-002, VA-AUT-001)', () => {
  test('ARC-004: Manifest and PWA metadata are served correctly', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.name).toBe('Adaptive Flashcards');
    expect(manifest.display).toBe('standalone');
  });

  test('AUT-002: Unauthenticated users are presented with Sign-in view', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Adaptive Flashcards' })).toBeVisible();
    await expect(page.getByPlaceholder('Enter your email address')).toBeVisible();
    await expect(page.getByRole('button', { name: /send magic sign-in link/i })).toBeVisible();
  });

  test('AUT-001: Submitting email OTP triggers sign-in confirmation', async ({ page }) => {
    await page.goto('/');
    const emailInput = page.getByPlaceholder('Enter your email address');
    await emailInput.fill(`e2e-learner-${Date.now()}@example.com`);
    await page.getByRole('button', { name: /send magic sign-in link/i }).click();

    // Verify feedback alert appears
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/magic sign-in link/i);
  });
});
