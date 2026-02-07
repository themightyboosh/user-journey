/**
 * Get the current panzoom state
 */
export async function getPanzoomState(page) {
    return await page.evaluate(() => {
        const pz = window.panzoomInstance;
        if (!pz) return null;

        const scale = pz.getScale();
        const pan = pz.getPan();

        const viewport = document.getElementById('panzoomViewport');
        const dashboard = document.getElementById('journeyDashboard');
        const container = document.querySelector('.journey-board-container');

        return {
            scale,
            pan,
            viewport: {
                width: viewport.clientWidth,
                height: viewport.clientHeight,
            },
            dashboard: {
                transform: getComputedStyle(dashboard).transform,
            },
            container: container ? {
                offsetLeft: container.offsetLeft,
                offsetTop: container.offsetTop,
                offsetWidth: container.offsetWidth,
                offsetHeight: container.offsetHeight,
            } : null,
        };
    });
}

/**
 * Get the visual bounds of the journey content on screen
 */
export async function getContentVisualBounds(page) {
    return await page.evaluate(() => {
        const container = document.querySelector('.journey-board-container');
        if (!container) return null;

        const rect = container.getBoundingClientRect();
        return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
        };
    });
}

/**
 * Check if content is fully visible within viewport with padding
 */
export async function isContentFittedInViewport(page, paddingTolerance = 60) {
    const content = await getContentVisualBounds(page);
    const viewport = await page.evaluate(() => {
        const vp = document.getElementById('panzoomViewport');
        const rect = vp.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    });

    if (!content || !viewport) return false;

    const fitsHorizontally =
        content.left >= (viewport.left - paddingTolerance) &&
        content.right <= (viewport.right + paddingTolerance);

    const fitsVertically =
        content.top >= (viewport.top - paddingTolerance) &&
        content.bottom <= (viewport.bottom + paddingTolerance);

    return fitsHorizontally && fitsVertically;
}

/**
 * Calculate if content is centered in viewport
 */
export async function isContentCentered(page, tolerance = 20) {
    const content = await getContentVisualBounds(page);
    const viewport = await page.evaluate(() => {
        const vp = document.getElementById('panzoomViewport');
        const rect = vp.getBoundingClientRect();
        return {
            centerX: (rect.left + rect.right) / 2,
            centerY: (rect.top + rect.bottom) / 2
        };
    });

    if (!content || !viewport) return false;

    const contentCenterX = (content.left + content.right) / 2;
    const contentCenterY = (content.top + content.bottom) / 2;

    const deltaX = Math.abs(contentCenterX - viewport.centerX);
    const deltaY = Math.abs(contentCenterY - viewport.centerY);

    return deltaX <= tolerance && deltaY <= tolerance;
}

/**
 * Wait for panzoom to settle after transformation
 */
export async function waitForPanzoomSettle(page, timeout = 1000) {
    await page.waitForTimeout(300); // Wait for animation

    // Wait for transform to stabilize
    await page.evaluate(() => {
        return new Promise((resolve) => {
            let lastTransform = null;
            let stableCount = 0;

            const checkStable = () => {
                const dashboard = document.getElementById('journeyDashboard');
                const currentTransform = getComputedStyle(dashboard).transform;

                if (currentTransform === lastTransform) {
                    stableCount++;
                    if (stableCount >= 3) {
                        resolve();
                        return;
                    }
                } else {
                    stableCount = 0;
                }

                lastTransform = currentTransform;
                requestAnimationFrame(checkStable);
            };

            checkStable();
        });
    });
}
