/**
 * JourneyViewer - Unified journey map viewer component.
 *
 * Provides:
 *  - Panzoom viewport with focal-point wheel zoom and pinch-to-zoom
 *  - Floating control bar (zoom in, zoom out, fit)
 *  - Auto-fit on render
 *  - Optional extra buttons (transcript, PDF, GEN)
 *
 * Usage:
 *   var viewer = JourneyViewer.init('myContainer', { showDebugGen: false });
 *   viewer.render(journeyObject);
 *   viewer.fit();
 *   viewer.destroy();
 */
window.JourneyViewer = (function () {
    'use strict';

    function init(containerId, options) {
        var opts = Object.assign({
            showDebugGen: false,
            showTranscript: false,
            showPdf: false,
            onDebugGen: null,
            onTranscript: null,
            onPdf: null
        }, options || {});

        var root = document.getElementById(containerId);
        if (!root) { console.error('JourneyViewer: container not found:', containerId); return null; }

        var viewportId = containerId + '_vp';
        var canvasId   = containerId + '_cv';
        var controlsId = containerId + '_ct';

        root.innerHTML =
            '<div id="' + viewportId + '" class="panzoom-viewport">' +
                '<div id="' + canvasId + '" class="journey-dashboard"></div>' +
            '</div>' +
            '<div id="' + controlsId + '" class="panzoom-controls">' +
                '<button class="panzoom-btn jv-zoom-in" title="Zoom In">(+)</button>' +
                '<button class="panzoom-btn jv-zoom-out" title="Zoom Out">(-)</button>' +
                '<button class="panzoom-btn jv-fit" title="Fit to Screen">FIT</button>' +
            '</div>';

        var viewport = document.getElementById(viewportId);
        var canvas   = document.getElementById(canvasId);
        var controls = document.getElementById(controlsId);

        if (opts.showTranscript) {
            var tBtn = _makeBtn('TRANSCRIPT', 'jv-transcript', opts.onTranscript);
            tBtn.style.display = 'none';
            controls.appendChild(tBtn);
        }
        if (opts.showPdf) {
            var pBtn = _makeBtn('PDF', 'jv-pdf', opts.onPdf);
            pBtn.style.display = 'none';
            controls.appendChild(pBtn);
        }
        if (opts.showDebugGen) {
            var gBtn = _makeBtn('GEN', 'jv-gen', opts.onDebugGen);
            gBtn.style.color = 'var(--max-color-accent)';
            controls.appendChild(gBtn);
        }

        var pz = null;

        function initPanzoom() {
            if (pz) { pz.destroy(); pz = null; }
            if (typeof Panzoom === 'undefined') { console.warn('JourneyViewer: Panzoom not loaded'); return; }

            pz = Panzoom(canvas, {
                maxScale: 5,
                minScale: 0.1,
                canvas: true,
                contain: false,
                cursor: 'grab',
                startScale: 1,
                animate: true,
                disableZoom: true
            });

            function focalZoom(fx, fy, newScale) {
                var s = pz.getScale();
                var p = pz.getPan();
                var clamped = Math.max(0.1, Math.min(5, newScale));
                var lx = (fx / s) - p.x;
                var ly = (fy / s) - p.y;
                pz.zoom(clamped, { animate: false });
                pz.pan((fx / clamped) - lx, (fy / clamped) - ly, { animate: false });
            }

            viewport.addEventListener('wheel', function (e) {
                e.preventDefault();
                var s = pz.getScale();
                var delta = e.deltaY > 0 ? -0.1 : 0.1;
                var rect = viewport.getBoundingClientRect();
                focalZoom(e.clientX - rect.left, e.clientY - rect.top, s + delta);
            }, { passive: false });

            var pinchDist = 0, pinchScale = 1;

            viewport.addEventListener('touchstart', function (e) {
                if (e.touches.length === 2) {
                    var t0 = e.touches[0], t1 = e.touches[1];
                    pinchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
                    pinchScale = pz.getScale();
                }
            }, { passive: true });

            viewport.addEventListener('touchmove', function (e) {
                if (e.touches.length === 2 && pinchDist > 0) {
                    e.preventDefault();
                    var t0 = e.touches[0], t1 = e.touches[1];
                    var dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
                    var rect = viewport.getBoundingClientRect();
                    var mx = ((t0.clientX + t1.clientX) / 2) - rect.left;
                    var my = ((t0.clientY + t1.clientY) / 2) - rect.top;
                    focalZoom(mx, my, pinchScale * (dist / pinchDist));
                }
            }, { passive: false });

            viewport.addEventListener('touchend', function () { pinchDist = 0; }, { passive: true });

            canvas.addEventListener('panzoomchange', function (e) {
                var d = e.detail;
                var g = 20 * d.scale;
                viewport.style.backgroundSize = g + 'px ' + g + 'px';
                viewport.style.backgroundPosition = d.x + 'px ' + d.y + 'px';
            });
        }

        function zoomIn() {
            if (!pz) return;
            var rect = viewport.getBoundingClientRect();
            pz.zoomIn({ step: 0.3, focal: { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 } });
        }

        function zoomOut() {
            if (!pz) return;
            var rect = viewport.getBoundingClientRect();
            pz.zoomOut({ step: 0.3, focal: { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 } });
        }

        function fit() {
            if (!pz) return;
            var board = canvas.querySelector('.journey-board-container');
            if (!board) return;

            // Reset transform first so offset measurements are accurate
            pz.setOptions({ animate: false });
            pz.zoom(1);
            pz.pan(0, 0);

            // Force reflow so measurements reflect the reset
            void canvas.offsetHeight;

            canvas.style.transformOrigin = '0 0';

            var vw = viewport.clientWidth;
            var vh = viewport.clientHeight;
            var bx = board.offsetLeft;
            var by = board.offsetTop;
            var bw = board.offsetWidth;
            var bh = board.offsetHeight;

            console.log('JourneyViewer.fit:', { vw: vw, vh: vh, bx: bx, by: by, bw: bw, bh: bh });

            if (!bw || !bh || !vw || !vh) return;

            var pad = 40;
            var s = Math.min((vw - pad * 2) / bw, (vh - pad * 2) / bh);
            s = Math.max(0.1, Math.min(5, s));

            var cx = bx + bw / 2;
            var cy = by + bh / 2;
            var px = (vw / (2 * s)) - cx;
            var py = (vh / (2 * s)) - cy;

            console.log('JourneyViewer.fit result:', { scale: s, panX: px, panY: py });

            pz.zoom(s);
            pz.pan(px, py);
            requestAnimationFrame(function () { pz.setOptions({ animate: true }); });
        }

        controls.querySelector('.jv-zoom-in').addEventListener('click', zoomIn);
        controls.querySelector('.jv-zoom-out').addEventListener('click', zoomOut);
        controls.querySelector('.jv-fit').addEventListener('click', fit);

        initPanzoom();

        return {
            canvasId: canvasId,
            get panzoom() { return pz; },
            render: function (journey) {
                if (typeof renderMap === 'function') {
                    renderMap(journey, canvasId);
                } else {
                    canvas.innerHTML = '<div class="empty-placeholder">Error: renderer not loaded.</div>';
                }
                setTimeout(function () { fit(); }, 150);
            },
            fit: fit,
            zoomIn: zoomIn,
            zoomOut: zoomOut,
            getButton: function (cls) { return controls.querySelector('.' + cls); },
            showButton: function (cls) { var b = controls.querySelector('.' + cls); if (b) b.style.display = ''; },
            hideButton: function (cls) { var b = controls.querySelector('.' + cls); if (b) b.style.display = 'none'; },
            pause: function () { if (pz) pz.pause(); controls.style.display = 'none'; },
            resume: function () { if (pz) pz.resume(); controls.style.display = 'flex'; },
            reinit: function () { initPanzoom(); },
            destroy: function () { if (pz) { pz.destroy(); pz = null; } root.innerHTML = ''; }
        };
    }

    function _makeBtn(label, cls, onClick) {
        var btn = document.createElement('button');
        btn.className = 'panzoom-btn ' + cls;
        btn.title = label;
        btn.textContent = label;
        if (onClick) btn.addEventListener('click', onClick);
        return btn;
    }

    return { init: init };
})();
