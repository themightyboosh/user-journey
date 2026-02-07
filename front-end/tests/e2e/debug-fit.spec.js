import { test, expect } from '@playwright/test';

test('debug fit calculation', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('BROWSER:', msg.text()));

    await page.goto('/');
    await page.waitForSelector('#panzoomViewport', { timeout: 10000 });

    // Generate test journey
    await page.locator('button:has-text("TEST GEN")').click();
    await page.waitForSelector('.journey-board-container', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Get dimensions before fit
    const before = await page.evaluate(() => {
        const viewport = document.getElementById('panzoomViewport');
        const dashboard = document.getElementById('journeyDashboard');
        const container = document.querySelector('.journey-board-container');
        const pz = window.panzoomInstance;

        return {
            viewport: {
                clientWidth: viewport.clientWidth,
                clientHeight: viewport.clientHeight,
            },
            container: {
                offsetLeft: container.offsetLeft,
                offsetTop: container.offsetTop,
                offsetWidth: container.offsetWidth,
                offsetHeight: container.offsetHeight,
            },
            panzoomBefore: {
                scale: pz.getScale(),
                pan: pz.getPan(),
            },
            dashboardPadding: getComputedStyle(dashboard).padding
        };
    });

    console.log('BEFORE FIT:', JSON.stringify(before, null, 2));

    // Click fit
    await page.locator('button:has-text("FIT")').click();
    await page.waitForTimeout(500);

    // Get dimensions after fit
    const after = await page.evaluate(() => {
        const pz = window.panzoomInstance;
        const container = document.querySelector('.journey-board-container');
        const rect = container.getBoundingClientRect();
        const viewport = document.getElementById('panzoomViewport');
        const vpRect = viewport.getBoundingClientRect();

        return {
            panzoomAfter: {
                scale: pz.getScale(),
                pan: pz.getPan(),
            },
            containerVisual: {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            },
            viewportVisual: {
                left: vpRect.left,
                top: vpRect.top,
                right: vpRect.right,
                bottom: vpRect.bottom,
                width: vpRect.width,
                height: vpRect.height,
            }
        };
    });

    console.log('AFTER FIT:', JSON.stringify(after, null, 2));

    // Calculate if content fits
    const fitted = after.containerVisual.left >= (after.viewportVisual.left - 60) &&
                  after.containerVisual.right <= (after.viewportVisual.right + 60) &&
                  after.containerVisual.top >= (after.viewportVisual.top - 60) &&
                  after.containerVisual.bottom <= (after.viewportVisual.bottom + 60);

    console.log('FITTED:', fitted);
    console.log('Content bounds:', {
        left: after.containerVisual.left - after.viewportVisual.left,
        right: after.viewportVisual.right - after.containerVisual.right,
        top: after.containerVisual.top - after.viewportVisual.top,
        bottom: after.viewportVisual.bottom - after.containerVisual.bottom,
    });

    // Take a screenshot
    await page.screenshot({ path: 'test-results/debug-fit.png', fullPage: true });
});
