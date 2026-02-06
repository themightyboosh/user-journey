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

    const maxLogoSvg = ``;

    let html = `
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
        // Grid Template
        const gridTemplate = `150px ${journey.phases.length > 0 ? `repeat(${journey.phases.length}, 1fr)` : '1fr'}`;
        
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
                                <div class="journey-cell complete" onclick="openCellModal('${cell.cellId}')">
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
                                <div class="mobile-card" onclick="openCellModal('${cell.cellId}')">
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

    // --- ARTIFACTS SECTION (Consolidated) ---
    // Render sections if they exist, or if the journey is complete
    
    // Auto-switch to map on mobile if complete
    if ((journey.status === 'READY_FOR_REVIEW' || journey.stage === 'COMPLETE') && window.innerWidth <= 768 && !document.body.classList.contains('show-map')) {
        setTimeout(() => { if (!document.body.classList.contains('show-map')) toggleMobileView(); }, 500);
    }

    html += `<div class="final-artifacts" style="margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--max-color-border); display: flex; flex-direction: column; gap: 24px;">`;

    // 1. Overview (Summary of Findings)
    if (journey.summaryOfFindings) {
        html += `
            <div class="context-card">
                <h3 style="color: var(--max-color-accent); margin-bottom: 8px;">Overview</h3>
                <div class="context-content">${formatMessage(journey.summaryOfFindings)}</div>
            </div>`;
    }

    // 2. Phases (Phase Summaries) - Single Container
    if (journey.phases.some(p => p.summary)) {
        html += `
            <div class="context-card">
                <h3 style="color: var(--max-color-accent); margin-bottom: 16px;">Phases</h3>
                <div class="context-content">
                    ${journey.phases.map(p => p.summary ? `
                        <div style="margin-bottom: 16px;">
                            <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 4px; color: var(--max-color-text-primary);">${escapeHtml(p.name)}</h4>
                            <div>${formatMessage(p.summary)}</div>
                        </div>
                    ` : '').join('')}
                </div>
            </div>`;
    }

    // 3. Lanes (Swimlane Summaries) - Single Container
    if (journey.swimlanes.some(s => s.summary)) {
        html += `
            <div class="context-card">
                <h3 style="color: var(--max-color-accent); margin-bottom: 16px;">Lanes</h3>
                <div class="context-content">
                    ${journey.swimlanes.map(s => s.summary ? `
                        <div style="margin-bottom: 16px;">
                            <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 4px; color: var(--max-color-text-primary);">${escapeHtml(s.name)}</h4>
                            <div>${formatMessage(s.summary)}</div>
                        </div>
                    ` : '').join('')}
                </div>
            </div>`;
    }

    // 4. Mental Models
    if (journey.mentalModels) {
        html += `
            <div class="context-card">
                <h3 style="color: var(--max-color-accent); margin-bottom: 8px;">Mental Models</h3>
                <div class="context-content">${formatMessage(journey.mentalModels)}</div>
            </div>`;
    }
    
    // 5. Additional Context (if any)
    if (journey.anythingElse) {
            html += `
            <div class="context-card">
                <h3 style="color: var(--max-color-accent); margin-bottom: 8px;">Additional Context</h3>
                <div class="context-content">${formatMessage(journey.anythingElse)}</div>
            </div>`;
    }
    
    // Buttons (Action Area) - Only when complete/ready
    if (journey.status === 'READY_FOR_REVIEW' || journey.stage === 'COMPLETE') {
        html += `
            <div class="action-area" data-html2canvas-ignore="true" style="display: flex; justify-content: center; gap: 16px; margin-top: 40px; padding-bottom: 40px; flex-wrap: wrap;">
                <button onclick="exportToPdf('${targetElementId}')" class="max-send-button secondary-action" style="width: auto; padding: 12px 24px; gap: 8px; background: var(--max-color-surface-tertiary); border: 1px solid var(--max-color-border); color: var(--max-color-text-primary);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                    </svg>
                    Export PDF
                </button>
                <button onclick="copyMermaid(this)" class="max-send-button secondary-action" style="width: auto; padding: 12px 24px; gap: 8px; background: var(--max-color-surface-tertiary); border: 1px solid var(--max-color-border); color: var(--max-color-text-primary);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    Copy as Mermaid
                </button>
                <button onclick="copyConversation()" id="copyConvBtn" class="max-send-button secondary-action" style="width: auto; padding: 12px 24px; gap: 8px; background: var(--max-color-surface-tertiary); border: 1px solid var(--max-color-border); color: var(--max-color-text-primary);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    Copy Conversation
                </button>
                <button onclick="startNewJourney()" class="max-send-button" style="width: auto; padding: 12px 24px; gap: 8px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Do Another Journey
                </button>
            </div>
        `;
    }
    
    html += `</div>`; // End artifacts container else {
        // html += `...` (REMOVED: Placeholder when journey exists but is empty)
    }

    container.innerHTML = html;
}

// Export to PDF
function exportToPdf() {
    if (!currentRenderedJourney) return;

    // 1. Prepare Container
    const printContainer = document.createElement('div');
    printContainer.id = 'pdf-export-container';
    printContainer.className = 'pdf-export-mode'; // Apply print styles
    // Positioning strategy: Fixed at 0,0 but behind everything. 
    // -9999px often causes empty renders with html2canvas as it clips to viewport.
    printContainer.style.position = 'fixed';
    printContainer.style.left = '0';
    printContainer.style.top = '0';
    printContainer.style.zIndex = '-9999'; // Way behind everything
    printContainer.style.background = '#ffffff'; // Ensure white bg
    printContainer.style.width = '1100px'; // Fixed width for Landscape Letter approx
    printContainer.style.minHeight = '100vh'; // Ensure height
    printContainer.style.overflow = 'visible'; // Allow full content flow
    
    // Print Logo SVG
    const printLogoSvg = `
    <svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 128.5 42.6" style="height: 32px; width: auto;">
      <style>.st0{fill:#ed2224;}</style>
      <path class="st0" d="M5.9,42.6c-1.5,0-2.7-.3-3.6-.9-.9-.6-1.5-1.4-1.8-2.3S0,37.5,0,36.4V9.1c0-2.9.7-5.2,2.2-6.6C3.7,1,5.9.3,9,.3s3.7.2,4.8.7c1.2.5,2.1,1.3,2.8,2.3.7,1.1,1.2,2.4,1.7,4.1l.3,1.2c.7,2.2,1.2,4,1.6,5.6.4,1.6.7,3,1,4.4.3,1.3.5,2.6.6,3.9.2,1.3.3,2.6.4,4.1.1-1.5.3-2.9.4-4.1s.4-2.6.6-3.9c.3-1.3.6-2.8,1-4.4.4-1.6,1-3.5,1.6-5.6l.3-1.2c.5-1.7,1.1-3,1.8-4.1.7-1.1,1.6-1.8,2.8-2.3,1.2-.5,2.8-.7,4.8-.7,3.1,0,5.4.7,6.8,2.2,1.4,1.5,2.2,3.7,2.2,6.6v27.2c0,1-.2,2-.5,3s-.9,1.7-1.8,2.3-2.1.9-3.6.9-2.7-.3-3.6-.9c-.9-.6-1.5-1.4-1.8-2.3s-.5-1.9-.5-3v-4.9c0-2.7.2-5.7.4-9,.2-3.3.4-7.2.5-11.5l-5.2,19.4c-.4,1.3-.8,2.4-1.3,3.2-.4.8-1,1.4-1.8,1.8-.7.4-1.8.6-3.2.6s-2.5-.2-3.2-.6c-.8-.4-1.4-1-1.8-1.8s-.9-1.9-1.3-3.2l-5.2-19.4c.1,4.3.3,8.2.5,11.5s.3,6.4.4,9v4.9c0,1-.1,2-.4,3s-.9,1.7-1.8,2.3c-.9.6-2.1.9-3.6.9h0s.2,0,.2,0Z"/>
      <path d="M54.1,42.6c-.9,0-1.8-.2-2.8-.7s-1.7-1.2-2.4-2.1c-.6-.9-1-2-1-3.4s0-1.3.2-2.1c0-.8.4-1.6.8-2.4l9.6-22.9c.6-1.5,1.2-2.9,1.7-4s1.1-2,1.7-2.8c.6-.7,1.4-1.3,2.4-1.6,1-.4,2.2-.5,3.8-.5s2.8.2,3.8.5c1,.4,1.8.9,2.4,1.6s1.2,1.7,1.7,2.8,1.1,2.4,1.7,4l9.6,22.9c.4.8.6,1.6.8,2.4,0,.8.2,1.5.2,2.1,0,1.3-.3,2.5-1,3.4-.6.9-1.4,1.6-2.3,2.1s-1.9.7-2.8.7c-1.6,0-2.8-.3-3.7-1-.9-.7-1.6-1.6-2.1-2.7-.5-1.1-1-2.3-1.4-3.5l-1.3-4.2v-3.3c0,0-3.8-10.1-3.8-10.1-.3-.8-.6-1.8-1-3s-.6-2.3-.9-3.2c-.2.9-.5,1.9-.9,3.2-.4,1.2-.7,2.2-1,3l-3.9,10.1v3.3c0,0-1.2,4.2-1.2,4.2-.4,1.2-.8,2.4-1.3,3.5s-1.2,2-2.1,2.7-2.1,1-3.7,1h.2ZM59.2,33.1v-7.6h17.7v7.6h-17.7Z"/>
      <path d="M97.8,42.6c-1.1,0-2.2-.3-3.2-.8s-1.9-1.3-2.5-2.3c-.7-1-1-2.2-1-3.7s.5-3.5,1.6-4.7c1-1.2,2.4-2.5,4.1-3.9,1.2-.9,2.4-1.7,3.5-2.6,1.2-.9,2.3-1.8,3.5-2.7-.8-.7-1.9-1.6-3.2-2.7s-2.6-2.2-3.9-3.3c-1.7-1.4-3.1-2.8-4.1-4.1s-1.5-2.9-1.5-5,.4-2.6,1-3.7c.7-1,1.5-1.8,2.5-2.3S96.7,0,97.8,0s2.5.3,3.4.8c.9.6,1.7,1.3,2.4,2.2s1.4,2,2,3.2c1,1.9,1.8,3.7,2.5,5.3s1.3,2.8,1.6,3.7c.3-.9.9-2.1,1.6-3.7s1.6-3.4,2.5-5.3c.6-1.2,1.3-2.3,2-3.2.7-.9,1.5-1.7,2.4-2.2C119.3.3,120.4,0,121.7,0s2.2.3,3.3.8c1,.5,1.9,1.3,2.5,2.4.7,1,1,2.2,1,3.7s-.5,3.7-1.5,5-2.4,2.7-4.1,4.1c-1.2,1-2.3,2-3.5,3s-2.3,2-3.5,2.9c.8.6,1.9,1.4,3.1,2.3,1.2,1,2.5,2,3.7,3,1.7,1.4,3.1,2.7,4.1,3.9s1.6,2.8,1.6,4.7-.3,2.6-1,3.7c-.7,1-1.5,1.8-2.5,2.3s-2.1.8-3.3.8-2.5-.3-3.4-.9c-.9-.5-1.7-1.3-2.4-2.2-.7-1-1.4-2-2-3.2-.9-1.7-1.7-3.3-2.4-4.7-.8-1.4-1.3-2.7-1.7-3.7-.3,1-.9,2.3-1.7,3.7-.8,1.5-1.6,3-2.4,4.6-1,1.8-2,3.3-3.1,4.5s-2.7,1.8-4.7,1.8h0q0,0,0,.1Z"/>
    </svg>`;

    // 2. Constants
    const MAX_ROWS = 3;
    const MAX_COLS = 5;
    const phases = currentRenderedJourney.phases;
    const swimlanes = currentRenderedJourney.swimlanes;

    // 3. Helper: Render Header
    const renderHeader = (subtitle = '') => {
        let heroQuote = '';
        // If we have a single hero quote (array of 1 or just a string if migrated)
        if (currentRenderedJourney.quotes && currentRenderedJourney.quotes.length > 0) {
            const quoteText = currentRenderedJourney.quotes[0];
            heroQuote = ` <span style="color: #ed2224; font-weight: normal; font-style: italic;"> — "${escapeHtml(quoteText)}"</span>`;
        }

        return `
        <div class="journey-header" style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div class="journey-title" style="display: flex; align-items: center; gap: 16px;">
                    ${printLogoSvg}
                    <span style="color: #000; font-size: 24px; font-weight: 600;">${escapeHtml(currentRenderedJourney.name)}</span>
                </div>
                <div class="journey-role" style="color: #000;">
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
                page.style.padding = '20px';
                page.style.boxSizing = 'border-box';
                page.style.width = '100%';
                
                // Page Break for subsequent pages
                if (pageCount > 0) {
                    const breakEl = document.createElement('div');
                    breakEl.className = 'html2pdf__page-break';
                    printContainer.appendChild(breakEl);
                }

                // Grid Template
                const gridTemplate = `150px ${currentPhases.length > 0 ? `repeat(${currentPhases.length}, 1fr)` : '1fr'}`;
                
                let tableHtml = `<div class="journey-table" style="grid-template-columns: ${gridTemplate}; gap: 16px; display: grid;">`;
                
                // Header Row
                tableHtml += `<div></div>`; // Top-left
                currentPhases.forEach(phase => {
                    tableHtml += `<div class="phase-header" style="background: #f3f4f6; color: #000; font-weight: 600; padding: 8px; text-align: center; border: 1px solid #e5e7eb;">${escapeHtml(phase.name)}</div>`;
                });

                // Data Rows
                currentSwimlanes.forEach(swimlane => {
                    // Row Header
                    tableHtml += `<div class="swimlane-header" style="text-align: right; padding-right: 12px; font-weight: 600; color: #000;">
                                    <div class="swimlane-name">${escapeHtml(swimlane.name)}</div>
                                    <div class="swimlane-desc" style="font-size: 11px; color: #6b7280; margin-top: 4px; font-weight: 400;">${escapeHtml(swimlane.description)}</div>
                                  </div>`;
                    
                    // Cells
                    currentPhases.forEach(phase => {
                        const cell = currentRenderedJourney.cells.find(c => c.phaseId === phase.phaseId && c.swimlaneId === swimlane.swimlaneId);
                        
                        if (cell && cell.headline) {
                            tableHtml += `
                                <div class="journey-cell" style="background: #fff; border: 1px solid #e5e7eb; padding: 12px; height: auto; min-height: 0;">
                                    <div class="cell-action" style="font-weight: 600; margin-bottom: 6px; color: #000;">${escapeHtml(cell.headline)}</div>
                                    <div class="cell-context" style="font-size: 11px; color: #333; line-height: 1.4;">${escapeHtml(cell.description)}</div>
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
    if (currentRenderedJourney.status === 'READY_FOR_REVIEW' || currentRenderedJourney.stage === 'COMPLETE') {
        const artifactsPage = document.createElement('div');
        artifactsPage.className = 'pdf-page';
        artifactsPage.style.padding = '20px';
        
        const breakEl = document.createElement('div');
        breakEl.className = 'html2pdf__page-break';
        printContainer.appendChild(breakEl);

        let artifactsHtml = renderHeader('Overview & Analysis');
        artifactsHtml += `<div style="display: flex; flex-direction: column; gap: 24px; margin-top: 20px;">`;

        // 1. Overview (Summary of Findings)
        if (currentRenderedJourney.summaryOfFindings) {
            artifactsHtml += `
                <div class="context-card" style="background: #fff; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px;">
                    <h3 style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #ed2224; margin-bottom: 8px;">Overview</h3>
                    <div class="context-content" style="color: #000;">${formatMessage(currentRenderedJourney.summaryOfFindings)}</div>
                </div>`;
        }

        // 2. Phases (Phase Summaries) - Single Container
        if (currentRenderedJourney.phases.some(p => p.summary)) {
            artifactsHtml += `
                <div class="context-card" style="background: #fff; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px; break-inside: avoid;">
                    <h3 style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #ed2224; margin-bottom: 12px; letter-spacing: 0.05em;">Phases</h3>
                    <div class="context-content" style="color: #000; font-size: 12px;">
                        ${currentRenderedJourney.phases.map(p => p.summary ? `
                            <div style="margin-bottom: 16px;">
                                <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 6px; color: #000;">${escapeHtml(p.name)}</h4>
                                <div>${formatMessage(p.summary)}</div>
                            </div>
                        ` : '').join('')}
                    </div>
                </div>`;
        }

        // 3. Lanes (Swimlane Summaries) - Single Container
        if (currentRenderedJourney.swimlanes.some(s => s.summary)) {
            artifactsHtml += `
                <div class="context-card" style="background: #fff; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px; break-inside: avoid;">
                    <h3 style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #ed2224; margin-bottom: 12px; letter-spacing: 0.05em;">Lanes</h3>
                    <div class="context-content" style="color: #000; font-size: 12px;">
                         ${currentRenderedJourney.swimlanes.map(s => s.summary ? `
                            <div style="margin-bottom: 16px;">
                                <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 6px; color: #000;">${escapeHtml(s.name)}</h4>
                                <div>${formatMessage(s.summary)}</div>
                            </div>
                        ` : '').join('')}
                    </div>
                </div>`;
        }
        
        // 4. Mental Models
        if (currentRenderedJourney.mentalModels) {
            artifactsHtml += `
                <div class="context-card" style="background: #fff; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px;">
                    <h3 style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #ed2224; margin-bottom: 8px;">Mental Models</h3>
                    <div class="context-content" style="color: #000;">${formatMessage(currentRenderedJourney.mentalModels)}</div>
                </div>`;
        }

        // 5. Additional Context
        if (currentRenderedJourney.anythingElse) {
            artifactsHtml += `
                <div class="context-card" style="background: #fff; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px;">
                    <h3 style="font-size: 14px; font-weight: 600; text-transform: uppercase; color: #ed2224; margin-bottom: 8px;">Additional Context</h3>
                    <div class="context-content" style="color: #000;">${formatMessage(currentRenderedJourney.anythingElse)}</div>
                </div>`;
        }
        
        artifactsHtml += `</div>`;
        artifactsPage.innerHTML = artifactsHtml;
        printContainer.appendChild(artifactsPage);
    }

    // 6. Generate PDF
    document.body.appendChild(printContainer);

    const opt = {
      margin:       0.2, // Small margin
      filename:     `journey-map-${new Date().toISOString().split('T')[0]}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          // Explicitly set window width/height to ensure capture
          windowWidth: 1200
      },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' },
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
