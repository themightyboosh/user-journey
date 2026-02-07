import { test } from '@playwright/test';
import { isContentCentered } from './helpers/panzoom-utils.js';

test('test reset button', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER:', msg.text()));

    await page.goto('/');
    await page.waitForSelector('#panzoomViewport');

    // Generate test journey
    await page.locator('button:has-text("TEST GEN")').click();
    await page.waitForSelector('.journey-board-container');
    await page.waitForTimeout(1000);

    // Click reset
    await page.locator('button:has-text("RST")').click();
    await page.waitForTimeout(500);

    // Check if centered
    const centered = await isContentCentered(page, 50);
    console.log('Is content centered after reset?', centered);

    // Get positions
    const positions = await page.evaluate(() => {
        const pz = window.panzoomInstance;
        const container = document.querySelector('.journey-board-container');
        const viewport = document.getElementById('panzoomViewport');
        const contRect = container.getBoundingClientRect();
        const vpRect = viewport.getBoundingClientRect();

        return {
            scale: pz.getScale(),
            pan: pz.getPan(),
            containerCenter: {
                x: (contRect.left + contRect.right) / 2,
                y: (contRect.top + contRect.bottom) / 2,
            },
            viewportCenter: {
                x: (vpRect.left + vpRect.right) / 2,
                y: (vpRect.top + vpRect.bottom) / 2,
            }
        };
    });

    console.log('After reset:', JSON.stringify(positions, null, 2));
    console.log('Center delta:', {
        x: positions.containerCenter.x - positions.viewportCenter.x,
        y: positions.containerCenter.y - positions.viewportCenter.y
    });

    await page.screenshot({ path: 'test-results/reset-test.png' });
});
