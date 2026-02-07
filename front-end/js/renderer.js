// ===========================================
// Shared Journey Renderer
// ===========================================

// Helper: Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make globally available
window.escapeHtml = escapeHtml;

// Helper: Format Markdown-like text
function formatMessage(text) {
        if (!text) return '';
        
        // Basic markdown-like formatting
        let formatted = escapeHtml(text);
        
        // Code blocks
        formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        
        // Inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Headers (###)
        formatted = formatted.replace(/^###\s+(.*$)/gm, '<h3>$1</h3>');
        
        // Bold
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Italic
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        // Line breaks to paragraphs with extra spacing
        formatted = formatted
          .split(/\n\n+/)
          .map(para => para.trim())
          .filter(para => para)
          .map(para => {
            // Check if it's a list
            if (para.match(/^[-*•]\s/m)) {
              const items = para.split(/\n/).map(item => 
                `<li>${item.replace(/^[-*•]\s*/, '')}</li>`
              ).join('');
              return `<ul>${items}</ul>`;
            }
            // Check if it's a numbered list
            if (para.match(/^\d+\.\s/m)) {
              const items = para.split(/\n/).map(item => 
                `<li>${item.replace(/^\d+\.\s*/, '')}</li>`
              ).join('');
              return `<ol>${items}</ol>`;
            }
            return `<p style="margin-bottom: 1.5em; line-height: 1.6;">${para.replace(/\n/g, '<br>')}</p>`;
          })
          .join('');
        
        return formatted;
    }

// Global state for modal
let currentRenderedJourney = null;

// Modal Logic
function openCellModal(cellId) {
    if (!currentRenderedJourney) return;
    const cell = currentRenderedJourney.cells.find(c => c.cellId === cellId);
    if (!cell) return;

    const titleEl = document.getElementById('modalTitle');
    const contextEl = document.getElementById('modalContext');
    const modal = document.getElementById('cellModal');

    if (titleEl) titleEl.textContent = cell.headline;
    
    if (contextEl) {
        const descHtml = formatMessage(cell.description);
        const contextHtml = cell.context ? `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--max-color-border); font-size: 13px; color: var(--max-color-text-tertiary);"><strong>Notes:</strong><br>${formatMessage(cell.context)}</div>` : '';
        contextEl.innerHTML = descHtml + contextHtml;
    }
    
    if (modal) modal.style.display = 'flex';
}

function closeCellModal(event) {
    // If event is provided (click outside), check target
    if (event && event.target.id !== 'cellModal') return;
    
    const modal = document.getElementById('cellModal');
    if (modal) modal.style.display = 'none';
}

// Main Render Function
function renderMap(journey, targetElementId = 'journeyDashboard') {
    const container = document.getElementById(targetElementId);
    if (!container || !journey) return;

    // Update global state for modals
    currentRenderedJourney = journey;

    let roleDisplay = escapeHtml(journey.role) || 'Unknown Role';
    if (journey.userName) {
        roleDisplay = `<span style="font-weight: 700; color: var(--max-color-text-primary);">${escapeHtml(journey.userName)}</span>, ${roleDisplay}`;
    }

    // Hero Quote Logic
    if (journey.quotes && journey.quotes.length > 0) {
        const quoteText = journey.quotes[0];
        roleDisplay += `<span style="color: var(--max-color-accent); font-weight: 400; font-style: italic; margin-left: 8px;"> — "${escapeHtml(quoteText)}"</span>`;
    }

    const maxLogoSvg = ``;

    let html = `
        <div class="journey-board-container">
        <div class="journey-header">
            <div class="journey-title" style="display: flex; align-items: center; gap: 16px;">
                ${maxLogoSvg}
                <span>${escapeHtml(journey.name) || 'Untitled Journey'}</span>
            </div>
            <div class="journey-role">${roleDisplay}</div>
        </div>
    `;

    if (journey.description) {
        html += `
            <div class="context-card">
                <h3 style="color: var(--max-color-accent);">Journey</h3>
                <div class="context-content">${escapeHtml(journey.description)}</div>
            </div>
        `;
    }

    // Always render table if we have phases or swimlanes
    if (journey.phases.length > 0 || journey.swimlanes.length > 0) {
        // Grid Template: STRICT FIXED WIDTHS
        // 200px for header, then 400px fixed for each phase
        const colWidth = '400px';
        const gridTemplate = `200px ${journey.phases.length > 0 ? `repeat(${journey.phases.length}, ${colWidth})` : '1fr'}`;
        
        html += `<div class="journey-table" style="grid-template-columns: ${gridTemplate};">`;

        // 1. Header Row
        html += `<div></div>`; // Top-left corner empty
        
        if (journey.phases.length > 0) {
            journey.phases.forEach(phase => {
                const desc = phase.description ? ` title="${escapeHtml(phase.description)}"` : '';
                html += `<div class="phase-header"${desc}>
                            ${escapeHtml(phase.name)}
                         </div>`;
            });
        } else {
            html += `<div class="phase-header" style="opacity: 0.5; font-style: italic;">Phases pending...</div>`;
        }

        // 2. Rows
        if (journey.swimlanes.length > 0) {
            journey.swimlanes.forEach(swimlane => {
                // Row Header
                const desc = swimlane.description ? ` title="${escapeHtml(swimlane.description)}"` : '';
                html += `<div class="swimlane-header"${desc}>
                            <div class="swimlane-name">${escapeHtml(swimlane.name)}</div>
                            ${swimlane.description ? `<div class="swimlane-desc">${escapeHtml(swimlane.description)}</div>` : ''}
                         </div>`;

                // Cells
                if (journey.phases.length > 0) {
                    journey.phases.forEach(phase => {
                        const cell = journey.cells.find(c => c.phaseId === phase.phaseId && c.swimlaneId === swimlane.swimlaneId);
                        
                        if (cell && cell.headline) {
                            html += `
                                <div class="journey-cell complete">
                                    <div class="cell-action">${escapeHtml(cell.headline)}</div>
                                    <div class="cell-context">${escapeHtml(cell.description)}</div>
                                </div>
                            `;
                        } else if (cell) {
                            html += `<div class="journey-cell empty"></div>`;
                        } else {
                            html += `<div class="journey-cell empty" style="border-style: none; background: rgba(255,255,255,0.02)"></div>`;
                        }
                    });
                } else {
                     html += `<div class="journey-cell empty" style="border-style: none;"></div>`;
                }
            });
        } else {
             if (journey.phases.length > 0) {
                 html += `<div class="swimlane-header" style="opacity: 0.5; font-style: italic;">Swimlanes pending...</div>`;
                 journey.phases.forEach(() => {
                     html += `<div class="journey-cell empty" style="border-style: none;"></div>`;
                 });
             }
        }

        html += `</div>`; // End table

        // --- MOBILE VIEW (List by Phase) ---
        html += `<div class="journey-mobile-list">`;
        
        if (journey.phases.length > 0) {
            journey.phases.forEach(phase => {
                html += `<div class="mobile-phase-group">`;
                html += `<div class="mobile-phase-header">${escapeHtml(phase.name)}</div>`;
                
                if (journey.swimlanes.length > 0) {
                    journey.swimlanes.forEach(swimlane => {
                        const cell = journey.cells.find(c => c.phaseId === phase.phaseId && c.swimlaneId === swimlane.swimlaneId);
                        
                        if (cell) {
                            let contentHtml = '';
                            if (cell.headline) {
                                contentHtml = `
                                    <div class="cell-action">${escapeHtml(cell.headline)}</div>
                                    <div class="cell-context">${escapeHtml(cell.description)}</div>
                                `;
                            } else {
                                contentHtml = `<div style="font-style: italic; opacity: 0.5;">Pending...</div>`;
                            }

                            html += `
                                <div class="mobile-card">
                                    <div class="mobile-card-label">${escapeHtml(swimlane.name)}</div>
                                    ${contentHtml}
                                </div>
                            `;
                        }
                    });
                } else {
                     html += `<div style="padding: 16px; opacity: 0.5;">No swimlanes yet.</div>`;
                }
                html += `</div>`; // End group
            });
        } else {
             html += `<div style="padding: 16px; opacity: 0.5;">Phases pending...</div>`;
        }
        html += `</div>`;
    }

    // --- ARTIFACTS SECTION (Consolidated 50/50 Split) ---
    // Render sections if they exist, or if the journey is complete
    
    // Auto-switch to map on mobile if complete
    const isComplete = journey.status === 'READY_FOR_REVIEW' || journey.stage === 'COMPLETE' || (journey.mentalModels && journey.mentalModels.length > 10) || (journey.summaryOfFindings && journey.summaryOfFindings.length > 10);

    if (isComplete) {
        // Add complete class to body for full takeover
        document.body.classList.add('journey-complete');
        
        if (window.innerWidth <= 768 && !document.body.classList.contains('show-map')) {
            setTimeout(() => { if (!document.body.classList.contains('show-map')) toggleMobileView(); }, 500);
        }
    } else {
        document.body.classList.remove('journey-complete');
    }

    html += `<div class="final-artifacts" style="margin-top: 60px; padding-top: 40px; border-top: 1px solid var(--max-color-border); display: flex; flex-direction: column; gap: 60px;">`;

    // --- ROW 1: Overview | Mental Models (50/50) ---
    html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start;">`;
    
    // Column 1: Overview
    html += `<div>`;
    if (journey.summaryOfFindings) {
        html += `
            <div class="context-card" style="height: 100%;">
                <h3 style="color: var(--max-color-accent); margin-bottom: 8px;">Overview</h3>
                <div class="context-content">${formatMessage(journey.summaryOfFindings)}</div>
            </div>`;
    } else {
        html += `<div style="opacity: 0.5; font-style: italic;">Overview pending...</div>`;
    }
    html += `</div>`;

    // Column 2: Mental Models
    html += `<div>`;
    if (journey.mentalModels) {
        html += `
            <div>
                <h3 style="color: var(--max-color-accent); margin-bottom: 16px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Mental Models</h3>
        `;
        
        const rawModels = journey.mentalModels;
        let models = [];
        if (rawModels.match(/^\d+\./m)) {
            models = rawModels.split(/^\d+\.\s*/m).filter(m => m.trim().length > 0);
        } else if (rawModels.match(/^[-*•]\s/m)) {
            models = rawModels.split(/^[-*•]\s*/m).filter(m => m.trim().length > 0);
        } else {
            models = rawModels.split(/\n\n+/).filter(m => m.trim().length > 0);
        }
        
        if (models.length > 0) {
            html += `<div style="display: flex; flex-direction: column; gap: 12px;">`;
            models.forEach((model, index) => {
                let title = `Model ${index + 1}`;
                let content = model;
                const colonMatch = model.match(/^([^:]+):\s*(.*)/s);
                if (colonMatch) {
                    title = colonMatch[1];
                    content = colonMatch[2];
                } else {
                    const dotIdx = model.indexOf('.');
                    if (dotIdx > 0 && dotIdx < 50) {
                         title = model.substring(0, dotIdx);
                         content = model.substring(dotIdx + 1);
                    }
                }
                
                html += `
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--max-color-border); padding: 20px; border-radius: 8px;">
                        <h4 style="font-size: 16px; font-weight: 700; color: var(--max-color-text-primary); margin-bottom: 8px;">${escapeHtml(title)}</h4>
                        <div style="font-size: 14px; line-height: 1.6; color: var(--max-color-text-secondary);">${formatMessage(content)}</div>
                    </div>
                `;
            });
            html += `</div>`;
        } else {
            html += `<div>${formatMessage(journey.mentalModels)}</div>`;
        }
        html += `</div>`;
    } else {
        html += `<div style="opacity: 0.5; font-style: italic;">Mental Models pending...</div>`;
    }
    html += `</div>`; // End Row 1


    // --- ROW 2: Phases | Lanes (50/50) ---
    html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start;">`;

    // Column 1: Phase Summaries
    html += `<div>`;
    if (journey.phases.some(p => p.summary)) {
        html += `
            <div>
                <h3 style="color: var(--max-color-accent); margin-bottom: 16px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Phases</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${journey.phases.map(p => p.summary ? `
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--max-color-border); padding: 20px; border-radius: 8px;">
                            <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 8px; color: var(--max-color-text-primary);">${escapeHtml(p.name)}</h4>
                            <div style="font-size: 14px; line-height: 1.6; color: var(--max-color-text-secondary);">${formatMessage(p.summary)}</div>
                        </div>
                    ` : '').join('')}
                </div>
            </div>`;
    }
    html += `</div>`;

    // Column 2: Lane Summaries
    html += `<div>`;
    if (journey.swimlanes.some(s => s.summary)) {
        html += `
            <div>
                <h3 style="color: var(--max-color-accent); margin-bottom: 16px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Lanes</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${journey.swimlanes.map(s => s.summary ? `
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--max-color-border); padding: 20px; border-radius: 8px;">
                            <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 8px; color: var(--max-color-text-primary);">${escapeHtml(s.name)}</h4>
                            <div style="font-size: 14px; line-height: 1.6; color: var(--max-color-text-secondary);">${formatMessage(s.summary)}</div>
                        </div>
                    ` : '').join('')}
                </div>
            </div>`;
    }
    html += `</div>`; // End Row 2
    
    // Additional Context (Full Width)
    if (journey.anythingElse) {
            html += `
            <div class="context-card">
                <h3 style="color: var(--max-color-accent); margin-bottom: 8px;">Additional Context</h3>
                <div class="context-content">${formatMessage(journey.anythingElse)}</div>
            </div>`;
    }
    
    // Buttons (Action Area) - Show when complete OR if we have artifacts
    if (isComplete) {
        const btnCopy = document.getElementById('btnCopyConv');
        const btnPdf = document.getElementById('btnExportPdf');
        const btnImg = document.getElementById('btnExportImg');
        
        if (btnCopy) btnCopy.style.display = 'flex';
        if (btnPdf) btnPdf.style.display = 'flex';
        if (btnImg) btnImg.style.display = 'flex';
    } else {
        const btnCopy = document.getElementById('btnCopyConv');
        const btnPdf = document.getElementById('btnExportPdf');
        const btnImg = document.getElementById('btnExportImg');
        
        if (btnCopy) btnCopy.style.display = 'none';
        if (btnPdf) btnPdf.style.display = 'none';
        if (btnImg) btnImg.style.display = 'none';
    }
    
    html += `</div>`; // End artifacts container 
    html += `</div>`; // End board container

    container.innerHTML = html;
    
    // Dispatch event to notify Panzoom
    window.dispatchEvent(new CustomEvent('journeyRendered', { 
        detail: { width: container.scrollWidth, height: container.scrollHeight } 
    }));
}

// Export to PDF
function exportToPdf() {
    if (!currentRenderedJourney) return;

    // 1. Prepare Container
    const printContainer = document.createElement('div');
    printContainer.id = 'pdf-export-container';
    printContainer.className = 'pdf-export-mode'; 
    
    // Positioning: Fixed offscreen, but with distinct z-index
    printContainer.style.position = 'fixed';
    printContainer.style.left = '-9999px';
    printContainer.style.top = '0';
    printContainer.style.zIndex = '9999'; 
    printContainer.style.background = '#ffffff';
    printContainer.style.width = '1400px'; // Wider base for better layout
    printContainer.style.minHeight = '100vh';
    
    // Print Logo SVG (Same as before)
    const printLogoSvg = `
    <svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 128.5 42.6" style="height: 48px; width: auto;">
      <style>.st0{fill:#ed2224;}</style>
      <path class="st0" d="M5.9,42.6c-1.5,0-2.7-.3-3.6-.9-.9-.6-1.5-1.4-1.8-2.3S0,37.5,0,36.4V9.1c0-2.9.7-5.2,2.2-6.6C3.7,1,5.9.3,9,.3s3.7.2,4.8.7c1.2.5,2.1,1.3,2.8,2.3.7,1.1,1.2,2.4,1.7,4.1l.3,1.2c.7,2.2,1.2,4,1.6,5.6.4,1.6.7,3,1,4.4.3,1.3.5,2.6.6,3.9.2,1.3.3,2.6.4,4.1.1-1.5.3-2.9.4-4.1s.4-2.6.6-3.9c.3-1.3.6-2.8,1-4.4.4-1.6,1-3.5,1.6-5.6l.3-1.2c.5-1.7,1.1-3,1.8-4.1.7-1.1,1.6-1.8,2.8-2.3,1.2-.5,2.8-.7,4.8-.7,3.1,0,5.4.7,6.8,2.2,1.4,1.5,2.2,3.7,2.2,6.6v27.2c0,1-.2,2-.5,3s-.9,1.7-1.8,2.3-2.1.9-3.6.9-2.7-.3-3.6-.9c-.9-.6-1.5-1.4-1.8-2.3s-.5-1.9-.5-3v-4.9c0-2.7.2-5.7.4-9,.2-3.3.4-7.2.5-11.5l-5.2,19.4c-.4,1.3-.8,2.4-1.3,3.2-.4.8-1,1.4-1.8,1.8-.7.4-1.8.6-3.2.6s-2.5-.2-3.2-.6c-.8-.4-1.4-1-1.8-1.8s-.9-1.9-1.3-3.2l-5.2-19.4c.1,4.3.3,8.2.5,11.5s.3,6.4.4,9v4.9c0,1-.1,2-.4,3s-.9,1.7-1.8,2.3c-.9.6-2.1.9-3.6.9h0s.2,0,.2,0Z"/>
      <path d="M54.1,42.6c-.9,0-1.8-.2-2.8-.7s-1.7-1.2-2.4-2.1c-.6-.9-1-2-1-3.4s0-1.3.2-2.1c0-.8.4-1.6.8-2.4l9.6-22.9c.6-1.5,1.2-2.9,1.7-4s1.1-2,1.7-2.8c.6-.7,1.4-1.3,2.4-1.6,1-.4,2.2-.5,3.8-.5s2.8.2,3.8.5c1,.4,1.8.9,2.4,1.6s1.2,1.7,1.7,2.8,1.1,2.4,1.7,4l9.6,22.9c.4.8.6,1.6.8,2.4,0,.8.2,1.5.2,2.1,0,1.3-.3,2.5-1,3.4-.6.9-1.4,1.6-2.3,2.1s-1.9.7-2.8.7c-1.6,0-2.8-.3-3.7-1-.9-.7-1.6-1.6-2.1-2.7-.5-1.1-1-2.3-1.4-3.5l-1.3-4.2v-3.3c0,0-3.8-10.1-3.8-10.1-.3-.8-.6-1.8-1-3s-.6-2.3-.9-3.2c-.2.9-.5,1.9-.9,3.2-.4,1.2-.7,2.2-1,3l-3.9,10.1v3.3c0,0-1.2,4.2-1.2,4.2-.4,1.2-.8,2.4-1.3,3.5s-1.2,2-2.1,2.7-2.1,1-3.7,1h.2ZM59.2,33.1v-7.6h17.7v7.6h-17.7Z"/>
      <path d="M97.8,42.6c-1.1,0-2.2-.3-3.2-.8s-1.9-1.3-2.5-2.3c-.7-1-1-2.2-1-3.7s.5-3.5,1.6-4.7c1-1.2,2.4-2.5,4.1-3.9,1.2-.9,2.4-1.7,3.5-2.6,1.2-.9,2.3-1.8,3.5-2.7-.8-.7-1.9-1.6-3.2-2.7s-2.6-2.2-3.9-3.3c-1.7-1.4-3.1-2.8-4.1-4.1s-1.5-2.9-1.5-5,.4-2.6,1-3.7c.7-1,1.5-1.8,2.5-2.3S96.7,0,97.8,0s2.5.3,3.4.8c.9.6,1.7,1.3,2.4,2.2s1.4,2,2,3.2c1,1.9,1.8,3.7,2.5,5.3s1.3,2.8,1.6,3.7c.3-.9.9-2.1,1.6-3.7s1.6-3.4,2.5-5.3c.6-1.2,1.3-2.3,2-3.2.7-.9,1.5-1.7,2.4-2.2C119.3.3,120.4,0,121.7,0s2.2.3,3.3.8c1,.5,1.9,1.3,2.5,2.4.7,1,1,2.2,1,3.7s-.5,3.7-1.5,5-2.4,2.7-4.1,4.1c-1.2,1-2.3,2-3.5,3s-2.3,2-3.5,2.9c.8.6,1.9,1.4,3.1,2.3,1.2,1,2.5,2,3.7,3,1.7,1.4,3.1,2.7,4.1,3.9s1.6,2.8,1.6,4.7-.3,2.6-1,3.7c-.7,1-1.5,1.8-2.5,2.3s-2.1.8-3.3.8-2.5-.3-3.4-.9c-.9-.5-1.7-1.3-2.4-2.2-.7-1-1.4-2-2-3.2-.9-1.7-1.7-3.3-2.4-4.7-.8-1.4-1.3-2.7-1.7-3.7-.3,1-.9,2.3-1.7,3.7-.8,1.5-1.6,3-2.4,4.6-1,1.8-2,3.3-3.1,4.5s-2.7,1.8-4.7,1.8h0q0,0,0,.1Z"/>
    </svg>`;

    // 2. Constants
    const MAX_ROWS = 3;
    const MAX_COLS = 4; // Reduced slightly to ensure fit
    const phases = currentRenderedJourney.phases;
    const swimlanes = currentRenderedJourney.swimlanes;

    // 3. Helper: Render Header
    const renderHeader = (subtitle = '') => {
        let heroQuote = '';
        if (currentRenderedJourney.quotes && currentRenderedJourney.quotes.length > 0) {
            const quoteText = currentRenderedJourney.quotes[0];
            heroQuote = ` <span style="color: #ed2224; font-weight: normal; font-style: italic;"> — "${escapeHtml(quoteText)}"</span>`;
        }

        return `
        <div class="journey-header" style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div class="journey-title" style="display: flex; align-items: center; gap: 16px;">
                    ${printLogoSvg}
                    <span style="color: #000; font-size: 32px; font-weight: 600;">${escapeHtml(currentRenderedJourney.name)}</span>
                </div>
                <div class="journey-role" style="color: #000; font-size: 14px;">
                    ${currentRenderedJourney.userName ? `<span style="font-weight: 700;">${escapeHtml(currentRenderedJourney.userName)}</span>, ` : ''}
                    ${escapeHtml(currentRenderedJourney.role)}
                    ${heroQuote}
                    ${subtitle ? ` <span style="color: #6b7280; font-weight: normal;">| ${subtitle}</span>` : ''}
                </div>
            </div>
        </div>
    `;
    };

    // 4. Chunk & Render Pages
    let pageCount = 0;

    // If no phases/swimlanes, just render description
    if (phases.length === 0 && swimlanes.length === 0) {
        const page = document.createElement('div');
        page.style.padding = '40px';
        page.innerHTML = renderHeader() + `
            <div class="context-card" style="margin-bottom: 20px;">
                <h3 style="color: #ed2224;">Journey</h3>
                <div class="context-content">${escapeHtml(currentRenderedJourney.description)}</div>
            </div>`;
        printContainer.appendChild(page);
    } else {
        // Loop Rows
        for (let rowStart = 0; rowStart < swimlanes.length; rowStart += MAX_ROWS) {
            const currentSwimlanes = swimlanes.slice(rowStart, rowStart + MAX_ROWS);
            
            // Loop Columns
            for (let colStart = 0; colStart < phases.length; colStart += MAX_COLS) {
                const currentPhases = phases.slice(colStart, colStart + MAX_COLS);
                
                const page = document.createElement('div');
                page.className = 'pdf-page';
                page.style.padding = '30px';
                page.style.boxSizing = 'border-box';
                page.style.width = '100%';
                page.style.breakAfter = 'always';
                page.style.pageBreakAfter = 'always';
                
                // Grid Template for PDF - Fixed widths are safer for html2canvas
                const gridTemplate = `200px ${currentPhases.length > 0 ? `repeat(${currentPhases.length}, 1fr)` : '1fr'}`;
                
                let tableHtml = `<div class="journey-table" style="grid-template-columns: ${gridTemplate}; gap: 10px; display: grid;">`;
                
                // Header Row
                tableHtml += `<div></div>`; // Top-left
                currentPhases.forEach(phase => {
                    tableHtml += `<div class="phase-header" style="background: #f3f4f6; color: #000; font-weight: 600; padding: 12px; text-align: center; border: 1px solid #e5e7eb; font-size: 14px;">${escapeHtml(phase.name)}</div>`;
                });

                // Data Rows
                currentSwimlanes.forEach(swimlane => {
                    // Row Header
                    tableHtml += `<div class="swimlane-header" style="text-align: right; padding-right: 16px; font-weight: 600; color: #000; font-size: 14px;">
                                    <div class="swimlane-name">${escapeHtml(swimlane.name)}</div>
                                    <div class="swimlane-desc" style="font-size: 10px; color: #6b7280; margin-top: 6px; font-weight: 400;">${escapeHtml(swimlane.description)}</div>
                                  </div>`;
                    
                    // Cells
                    currentPhases.forEach(phase => {
                        const cell = currentRenderedJourney.cells.find(c => c.phaseId === phase.phaseId && c.swimlaneId === swimlane.swimlaneId);
                        
                        if (cell && cell.headline) {
                            tableHtml += `
                                <div class="journey-cell" style="background: #fff; border: 1px solid #e5e7eb; padding: 12px; height: auto; min-height: 100px;">
                                    <div class="cell-action" style="font-weight: 600; margin-bottom: 8px; color: #000; font-size: 12px;">${escapeHtml(cell.headline)}</div>
                                    <div class="cell-context" style="font-size: 10px; color: #333; line-height: 1.4;">${escapeHtml(cell.description)}</div>
                                </div>
                            `;
                        } else {
                            tableHtml += `<div class="journey-cell empty" style="border: 1px dashed #e5e7eb;"></div>`;
                        }
                    });
                });

                tableHtml += `</div>`;

                page.innerHTML = renderHeader(`Part ${pageCount + 1}`) + tableHtml;
                printContainer.appendChild(page);
                pageCount++;
            }
        }
    }

    // 5. Final Artifacts Page
    if (currentRenderedJourney.status === 'READY_FOR_REVIEW' || currentRenderedJourney.stage === 'COMPLETE' || currentRenderedJourney.mentalModels) {
        const artifactsPage = document.createElement('div');
        artifactsPage.className = 'pdf-page';
        artifactsPage.style.padding = '30px';
        artifactsPage.style.breakBefore = 'always';
        artifactsPage.style.pageBreakBefore = 'always';

        let artifactsHtml = renderHeader('Overview & Analysis');
        artifactsHtml += `<div style="display: flex; flex-direction: column; gap: 30px; margin-top: 20px;">`;

        // --- ROW 1: Overview | Mental Models (50/50 Grid) ---
        artifactsHtml += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; align-items: start;">`;
        
        // Col 1: Overview
        artifactsHtml += `<div>`;
        if (currentRenderedJourney.summaryOfFindings) {
            artifactsHtml += `
                <div class="context-card" style="background: #fff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px;">
                    <h3 style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #ed2224; margin-bottom: 12px;">Overview</h3>
                    <div class="context-content" style="color: #000; font-size: 11px;">${formatMessage(currentRenderedJourney.summaryOfFindings)}</div>
                </div>`;
        }
        artifactsHtml += `</div>`;

        // Col 2: Mental Models
        artifactsHtml += `<div>`;
        if (currentRenderedJourney.mentalModels) {
             artifactsHtml += `
                <div class="context-card" style="background: #fff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px;">
                    <h3 style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #ed2224; margin-bottom: 12px;">Mental Models</h3>
                    <div class="context-content" style="color: #000; font-size: 11px;">${formatMessage(currentRenderedJourney.mentalModels)}</div>
                </div>`;
        }
        artifactsHtml += `</div>`;
        artifactsHtml += `</div>`; // End Row 1

        // --- ROW 2: Phases | Lanes (50/50 Grid) ---
        artifactsHtml += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; align-items: start;">`;

        // Col 1: Phases
        artifactsHtml += `<div>`;
        if (currentRenderedJourney.phases.some(p => p.summary)) {
            artifactsHtml += `
                <div class="context-card" style="background: #fff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; break-inside: avoid;">
                    <h3 style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #ed2224; margin-bottom: 12px; letter-spacing: 0.05em;">Phases</h3>
                    <div class="context-content" style="color: #000; font-size: 11px;">
                        ${currentRenderedJourney.phases.map(p => p.summary ? `
                            <div style="margin-bottom: 16px;">
                                <h4 style="font-size: 12px; font-weight: 700; margin-bottom: 6px; color: #000;">${escapeHtml(p.name)}</h4>
                                <div>${formatMessage(p.summary)}</div>
                            </div>
                        ` : '').join('')}
                    </div>
                </div>`;
        }
        artifactsHtml += `</div>`;

        // Col 2: Lanes
        artifactsHtml += `<div>`;
        if (currentRenderedJourney.swimlanes.some(s => s.summary)) {
            artifactsHtml += `
                <div class="context-card" style="background: #fff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; break-inside: avoid;">
                    <h3 style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #ed2224; margin-bottom: 12px; letter-spacing: 0.05em;">Lanes</h3>
                    <div class="context-content" style="color: #000; font-size: 11px;">
                         ${currentRenderedJourney.swimlanes.map(s => s.summary ? `
                            <div style="margin-bottom: 16px;">
                                <h4 style="font-size: 12px; font-weight: 700; margin-bottom: 6px; color: #000;">${escapeHtml(s.name)}</h4>
                                <div>${formatMessage(s.summary)}</div>
                            </div>
                        ` : '').join('')}
                    </div>
                </div>`;
        }
        artifactsHtml += `</div>`;
        artifactsHtml += `</div>`; // End Row 2

        // Additional Context
        if (currentRenderedJourney.anythingElse) {
             artifactsHtml += `
                <div class="context-card" style="background: #fff; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-top: 24px;">
                    <h3 style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #ed2224; margin-bottom: 8px;">Additional Context</h3>
                    <div class="context-content" style="color: #000; font-size: 11px;">${formatMessage(currentRenderedJourney.anythingElse)}</div>
                </div>`;
        }
        
        artifactsPage.innerHTML = artifactsHtml;
        printContainer.appendChild(artifactsPage);
    }

    // 6. Generate PDF
    document.body.appendChild(printContainer);

    const opt = {
      margin:       [0.2, 0.2], 
      filename:     `journey-map-${new Date().toISOString().split('T')[0]}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          windowWidth: 1400, // Match container width
          scrollY: 0
      },
      jsPDF:        { unit: 'in', format: 'legal', orientation: 'landscape' }, // Use Legal for more width
      pagebreak:    { mode: ['css', 'legacy'] }
    };

    html2pdf().set(opt).from(printContainer).save().then(() => {
        document.body.removeChild(printContainer);
    });
}

// Copy Mermaid Code
function copyMermaid(btn) {
    if (!currentRenderedJourney || !currentRenderedJourney.mermaid || !currentRenderedJourney.mermaid.code) {
        alert("Mermaid code not generated yet.");
        return;
    }
    
    navigator.clipboard.writeText(currentRenderedJourney.mermaid.code).then(() => {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #22c55e; width: 20px; height: 20px;">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            Copied!
        `;
        setTimeout(() => {
            btn.innerHTML = originalHtml;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy mermaid code', err);
        alert('Failed to copy code.');
    });
}
