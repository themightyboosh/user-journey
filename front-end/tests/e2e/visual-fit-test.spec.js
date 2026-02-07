import { test } from '@playwright/test';

test('visual verification of fit functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#panzoomViewport');

    // Generate test journey
    await page.locator('button:has-text("TEST GEN")').click();
    await page.waitForSelector('.journey-board-container');
    await page.waitForTimeout(800); // Wait for auto-fit

    // Take screenshot after auto-fit
    await page.screenshot({
        path: 'test-results/01-after-test-gen-auto-fit.png',
        fullPage: false
    });

    // Zoom in a couple times
    await page.locator('button:has-text("(+)")').click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("(+)")').click();
    await page.waitForTimeout(300);

    await page.screenshot({
        path: 'test-results/02-after-zoom-in.png',
        fullPage: false
    });

    // Click FIT button
    await page.locator('button:has-text("FIT")').click();
    await page.waitForTimeout(500);

    await page.screenshot({
        path: 'test-results/03-after-manual-fit.png',
        fullPage: false
    });

    // Zoom out
    await page.locator('button:has-text("(-)")').click();
    await page.waitForTimeout(300);
    await page.locator('button:has-text("(-)")').click();
    await page.waitForTimeout(300);

    await page.screenshot({
        path: 'test-results/04-after-zoom-out.png',
        fullPage: false
    });

    // Fit again
    await page.locator('button:has-text("FIT")').click();
    await page.waitForTimeout(500);

    await page.screenshot({
        path: 'test-results/05-after-fit-again.png',
        fullPage: false
    });

    console.log('\n✅ Visual test complete! Check screenshots in test-results/');
    console.log('   - 01-after-test-gen-auto-fit.png: Content should be centered and fit to viewport');
    console.log('   - 02-after-zoom-in.png: Content should be zoomed in');
    console.log('   - 03-after-manual-fit.png: Content should be re-centered and fit');
    console.log('   - 04-after-zoom-out.png: Content should be zoomed out');
    console.log('   - 05-after-fit-again.png: Content should be re-centered and fit\n');
});
