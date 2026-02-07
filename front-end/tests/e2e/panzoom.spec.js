import { test, expect } from '@playwright/test';
import {
    getPanzoomState,
    isContentFittedInViewport,
    isContentCentered,
    waitForPanzoomSettle,
} from './helpers/panzoom-utils.js';

test.describe('Panzoom Fit Functionality', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#panzoomViewport', { timeout: 10000 });
    });

    test('should initialize panzoom instance', async ({ page }) => {
        const state = await getPanzoomState(page);
        expect(state).not.toBeNull();
        expect(state.scale).toBeGreaterThan(0);
    });

    test('fit button should exist and be clickable', async ({ page }) => {
        const fitButton = page.locator('button:has-text("FIT")');
        await expect(fitButton).toBeVisible();
        await fitButton.click();
    });

    test('fit should work with TEST GEN journey', async ({ page }) => {
        // Use the built-in TEST GEN feature
        const testGenButton = page.locator('button:has-text("TEST GEN")');
        await testGenButton.click();

        // Wait for journey to render
        await page.waitForSelector('.journey-board-container', { timeout: 10000 });
        await page.waitForTimeout(500); // Let layout settle

        // Click fit
        await page.locator('button:has-text("FIT")').click();
        await waitForPanzoomSettle(page);

        // Verify content is fitted and centered
        const fitted = await isContentFittedInViewport(page);
        const centered = await isContentCentered(page);

        expect(fitted).toBe(true);
        expect(centered).toBe(true);
    });

    test('fit should handle multiple TEST GEN calls', async ({ page }) => {
        // Generate multiple journeys in sequence
        for (let i = 0; i < 3; i++) {
            await page.locator('button:has-text("TEST GEN")').click();
            await page.waitForTimeout(800); // Wait for generation

            await page.locator('button:has-text("FIT")').click();
            await waitForPanzoomSettle(page);

            const fitted = await isContentFittedInViewport(page);
            expect(fitted).toBe(true);
        }
    });

    test('fit should handle viewport resize', async ({ page }) => {
        // Generate journey
        await page.locator('button:has-text("TEST GEN")').click();
        await page.waitForSelector('.journey-board-container');

        // Fit to initial viewport
        await page.locator('button:has-text("FIT")').click();
        await waitForPanzoomSettle(page);

        // Resize viewport
        await page.setViewportSize({ width: 1600, height: 900 });
        await page.waitForTimeout(300);

        // Fit again
        await page.locator('button:has-text("FIT")').click();
        await waitForPanzoomSettle(page);

        // Should still be fitted
        const fitted = await isContentFittedInViewport(page);
        expect(fitted).toBe(true);
    });

    test('zoom in/out should not affect fit accuracy', async ({ page }) => {
        // Generate journey
        await page.locator('button:has-text("TEST GEN")').click();
        await page.waitForSelector('.journey-board-container');

        // Zoom in
        await page.locator('button:has-text("(+)")').click();
        await page.locator('button:has-text("(+)")').click();
        await waitForPanzoomSettle(page);

        // Zoom out
        await page.locator('button:has-text("(-)")').click();
        await waitForPanzoomSettle(page);

        // Fit should work correctly regardless of previous zoom
        await page.locator('button:has-text("FIT")').click();
        await waitForPanzoomSettle(page);

        const fitted = await isContentFittedInViewport(page);
        const centered = await isContentCentered(page);

        expect(fitted).toBe(true);
        expect(centered).toBe(true);
    });

    test('rapid fit clicks should not cause instability', async ({ page }) => {
        // Generate journey
        await page.locator('button:has-text("TEST GEN")').click();
        await page.waitForSelector('.journey-board-container');

        const fitButton = page.locator('button:has-text("FIT")');

        // Rapidly click fit multiple times
        for (let i = 0; i < 5; i++) {
            await fitButton.click();
            await page.waitForTimeout(50);
        }

        // Wait for everything to settle
        await waitForPanzoomSettle(page);

        // Should end in a stable, correct fit
        const fitted = await isContentFittedInViewport(page);
        const centered = await isContentCentered(page);

        expect(fitted).toBe(true);
        expect(centered).toBe(true);
    });

    test('fit maintains aspect ratio', async ({ page }) => {
        // Generate journey
        await page.locator('button:has-text("TEST GEN")').click();
        await page.waitForSelector('.journey-board-container');

        // Fit
        await page.locator('button:has-text("FIT")').click();
        await waitForPanzoomSettle(page);

        const state = await getPanzoomState(page);
        const content = state.container;
        const viewport = state.viewport;

        // Calculate expected scale based on aspect ratios
        const scaleX = (viewport.width - 80) / content.offsetWidth;
        const scaleY = (viewport.height - 80) / content.offsetHeight;
        const expectedScale = Math.min(scaleX, scaleY);

        // Allow 10% tolerance for padding calculation differences
        expect(state.scale).toBeGreaterThan(expectedScale * 0.85);
        expect(state.scale).toBeLessThan(expectedScale * 1.15);
    });

    test('debug fit button provides useful output', async ({ page }) => {
        // Generate journey
        await page.locator('button:has-text("TEST GEN")').click();
        await page.waitForSelector('.journey-board-container');

        // Capture console logs
        const logs = [];
        page.on('console', msg => logs.push(msg.text()));

        // Click debug fit (the "?" button)
        await page.locator('button[title="Debug Fit"]').click();

        // Should have logged debug info
        await page.waitForTimeout(100);
        expect(logs.some(log => log.includes('Viewport'))).toBe(true);
    });
});

test.describe('Panzoom Zoom Functionality (Preserve Working Features)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#panzoomViewport');

        // Generate a test journey
        await page.locator('button:has-text("TEST GEN")').click();
        await page.waitForSelector('.journey-board-container');

        // Wait for auto-fit to complete
        await page.waitForTimeout(500);
        await waitForPanzoomSettle(page);
    });

    test('zoom in button should increase scale', async ({ page }) => {
        const initialState = await getPanzoomState(page);

        await page.locator('button:has-text("(+)")').click();
        await waitForPanzoomSettle(page);

        const finalState = await getPanzoomState(page);
        expect(finalState.scale).toBeGreaterThan(initialState.scale);
    });

    test('zoom out button should decrease scale', async ({ page }) => {
        const initialState = await getPanzoomState(page);

        await page.locator('button:has-text("(-)")').click();
        await waitForPanzoomSettle(page);

        const finalState = await getPanzoomState(page);
        expect(finalState.scale).toBeLessThan(initialState.scale);
    });

    test('reset button should return to scale 1 and center', async ({ page }) => {
        // Zoom in and pan around
        await page.locator('button:has-text("(+)")').click();
        await page.locator('button:has-text("(+)")').click();
        await waitForPanzoomSettle(page);

        // Reset
        await page.locator('button:has-text("RST")').click();
        await waitForPanzoomSettle(page);

        const state = await getPanzoomState(page);
        expect(state.scale).toBeCloseTo(1, 1);

        // Should be centered
        const centered = await isContentCentered(page, 30);
        expect(centered).toBe(true);
    });
});
