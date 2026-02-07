import { test } from '@playwright/test';

test('check panzoom transform', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER:', msg.text()));

    await page.goto('/');
    await page.waitForSelector('#panzoomViewport');

    // Generate test journey
    await page.locator('button:has-text("TEST GEN")').click();
    await page.waitForSelector('.journey-board-container');
    await page.waitForTimeout(500);

    // Check the CSS transform
    const transform = await page.evaluate(() => {
        const dashboard = document.getElementById('journeyDashboard');
        const pz = window.panzoomInstance;

        return {
            cssTransform: getComputedStyle(dashboard).transform,
            panzoomScale: pz.getScale(),
            panzoomPan: pz.getPan(),
        };
    });

    console.log('Transform Analysis:', JSON.stringify(transform, null, 2));

    // Click fit and check again
    await page.locator('button:has-text("FIT")').click();
    await page.waitForTimeout(100);

    const afterFit = await page.evaluate(() => {
        const dashboard = document.getElementById('journeyDashboard');
        const pz = window.panzoomInstance;
        const container = document.querySelector('.journey-board-container');
        const viewport = document.getElementById('panzoomViewport');

        // Test a point to see where it ends up
        const testX = 100; // Local coordinate in dashboard
        const testY = 100;

        // Get rects
        const dashRect = dashboard.getBoundingClientRect();
        const vpRect = viewport.getBoundingClientRect();
        const contRect = container.getBoundingClientRect();

        return {
            cssTransform: getComputedStyle(dashboard).transform,
            panzoomScale: pz.getScale(),
            panzoomPan: pz.getPan(),
            dashboardRect: {
                left: dashRect.left,
                top: dashRect.top,
                width: dashRect.width,
                height: dashRect.height,
            },
            viewportRect: {
                left: vpRect.left,
                top: vpRect.top,
                width: vpRect.width,
                height: vpRect.height,
            },
            containerRect: {
                left: contRect.left,
                top: contRect.top,
                width: contRect.width,
                height: contRect.height,
            }
        };
    });

    console.log('After Fit:', JSON.stringify(afterFit, null, 2));

    // Calculate where dashboard origin ends up
    const dashLeft = afterFit.dashboardRect.left - afterFit.viewportRect.left;
    const dashTop = afterFit.dashboardRect.top - afterFit.viewportRect.top;
    console.log('Dashboard origin relative to viewport:', { left: dashLeft, top: dashTop });
    console.log('Container origin relative to viewport:', {
        left: afterFit.containerRect.left - afterFit.viewportRect.left,
        top: afterFit.containerRect.top - afterFit.viewportRect.top
    });
});
