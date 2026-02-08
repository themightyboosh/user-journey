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
function formatMessage(text, highlightQuotes = false) {
        if (!text) return '';
        
        let processedText = text;

        // Quote highlighting pre-processing
        // We use temporary tokens to survive markdown parsing
        // Detect "text" and replace with tokens
        if (highlightQuotes) {
            processedText = processedText.replace(/"([^"]+)"/g, '红QSTART$1红QEND');
        }

        let html = '';
        
        // Use marked library if available for robust parsing (RECOMMENDED)
        if (typeof marked !== 'undefined') {
            try {
                // Ensure breaks are handled
                marked.setOptions({ breaks: true, gfm: true });
                html = marked.parse(processedText);
            } catch (e) {
                console.error('Markdown parsing error:', e);
                // Fallback to manual if marked fails
                html = manualFormat(processedText);
            }
        } else {
            // Fallback manual formatting (Legacy)
            html = manualFormat(processedText);
        }

        // Post-process: Replace tokens with Red Text span
        if (highlightQuotes) {
            html = html.replace(/红QSTART(.*?)红QEND/g, '<span style="color: var(--max-color-accent);">$1</span>');
        }

        return html;
    }

    // Helper for manual formatting fallback
    function manualFormat(text) {
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
        // Line breaks to paragraphs
        formatted = formatted
          .split(/\n\n+/)
          .map(para => para.trim())
          .filter(para => para)
          .map(para => {
            if (para.match(/^[-*•]\s/m)) {
              const items = para.split(/\n/).map(item => `<li>${item.replace(/^[-*•]\s*/, '')}</li>`).join('');
              return `<ul>${items}</ul>`;
            }
            if (para.match(/^\d+\.\s/m)) {
              const items = para.split(/\n/).map(item => `<li>${item.replace(/^\d+\.\s*/, '')}</li>`).join('');
              return `<ol>${items}</ol>`;
            }
            return `<p style="margin-bottom: 1.5em; line-height: 1.6;">${para.replace(/\n/g, '<br>')}</p>`;
          })
          .join('');
        return formatted;
    }

// Make globally available (explicit for safety)
window.formatMessage = formatMessage;
window.manualFormat = manualFormat;

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

    const maxLogoSvg = '<img src="/max_header.svg" style="height: 56px; width: auto; display: block;" alt="M.AX Journey">';

    // Parse Models for Semantics
    const getSematicIcon = (text) => {
        const lower = text.toLowerCase();
        let icon = ''; // Default path (Brain/Idea)
        
        // Semantic Mapping
        if (lower.includes('money') || lower.includes('cost') || lower.includes('price') || lower.includes('budget') || lower.includes('pay')) {
            // Dollar Sign
            icon = `<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`;
        } else if (lower.includes('time') || lower.includes('wait') || lower.includes('speed') || lower.includes('fast') || lower.includes('slow')) {
            // Clock
            icon = `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`;
        } else if (lower.includes('team') || lower.includes('people') || lower.includes('user') || lower.includes('staff')) {
            // Users
            icon = `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`;
        } else if (lower.includes('risk') || lower.includes('fear') || lower.includes('worry') || lower.includes('security')) {
            // Shield
            icon = `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`;
        } else if (lower.includes('data') || lower.includes('info') || lower.includes('research') || lower.includes('analysis')) {
            // File Search
            icon = `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`;
        } else if (lower.includes('goal') || lower.includes('target') || lower.includes('success') || lower.includes('win')) {
            // Target
            icon = `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`;
        } else if (lower.includes('problem') || lower.includes('issue') || lower.includes('error') || lower.includes('pain')) {
             // Alert Triangle
             icon = `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`;
        } else if (lower.includes('process') || lower.includes('flow') || lower.includes('steps') || lower.includes('journey')) {
            // Activity / Process (Pulse/Activity)
            icon = `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`;
        } else if (lower.includes('learn') || lower.includes('grow') || lower.includes('scale') || lower.includes('expand')) {
            // Trending Up
            icon = `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>`;
        } else if (lower.includes('connect') || lower.includes('network') || lower.includes('share') || lower.includes('community')) {
             // Share
             icon = `<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>`;
        } else if (lower.includes('tool') || lower.includes('tech') || lower.includes('system') || lower.includes('platform')) {
             // CPU / Server
             icon = `<rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>`;
        } else {
            // Default: Lightbulb / Idea
            icon = `<line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 16.5 8 4.5 4.5 0 0 0 12 3.5 4.5 4.5 0 0 0 7.5 8c0 1.62.66 3.03 1.41 2.5.76.76 1.23 1.52 1.41 2.5"/>`;
        }
        
        return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ed2224" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
    };

    // Prepare Header Components
    let quoteHtml = '';
    if (journey.quotes && journey.quotes.length > 0) {
        quoteHtml = `<div style="font-family: 'Sorts Mill Goudy', serif; font-weight: 400; font-style: italic; font-size: 64px; line-height: 1.2; color: #ffffff; max-width: 800px;">
                    "${escapeHtml(journey.quotes[0])}"
                 </div>`;
    }

    // Construct Main HTML
    
    // Calculate strict width based on phases
    // 150px (Header) + N * 300px (Phases) + 300px (Lane Labels Correction) + 120px (Padding)
    const minBoardWidth = 1200;
    const calculatedWidth = 150 + (journey.phases.length * 300) + 300; 
    
    // Let's set the width to the larger of minBoardWidth or calculatedWidth + padding
    const finalWidth = Math.max(minBoardWidth, calculatedWidth + 120); // 120px buffer for container padding

    const hasContent = journey.phases.length > 0 || journey.swimlanes.length > 0;
    
    // Title & Quote Logic — with template icon
    const templateIcon = journey.templateIcon || null;
    const iconHtml = templateIcon
        ? '<i data-lucide="' + escapeHtml(templateIcon) + '" style="color: #ffffff; width: 48px; height: 48px; flex-shrink: 0; margin-right: 16px; margin-top: 6px;"></i>'
        : '';

    let titleRowHtml = '<div style="display: flex; align-items: flex-start;">'
        + iconHtml
        + '<div><span style="font-size: 64px; line-height: 1.1; font-weight: 600; color: var(--max-color-accent);">'
        + (escapeHtml(journey.name) || 'Untitled Journey') + '</span>'
        + '</div></div>';

    let html = `
        <div class="journey-board-container" style="width: ${finalWidth}px; max-width: none;">
        <div class="journey-header" style="display: flex; flex-direction: column; gap: 32px; align-items: flex-start; margin-bottom: 60px; padding-bottom: 40px; ${hasContent ? 'border-bottom: 1px solid var(--max-color-border);' : 'border-bottom: none;'}">
            
            <!-- Row 1: Max Logo -->
            <div style="transform: scale(1.6); transform-origin: left center; margin-bottom: 8px;">${maxLogoSvg}</div>

            <!-- Row 2: Title + Quote -->
            <div style="width: 100%;">
                ${titleRowHtml}
            </div>

            <!-- Row 3: Name & Role -->
            <div class="journey-role" style="font-size: 32px; font-weight: 500; color: var(--max-color-text-secondary);">
                ${journey.userName ? `<span style="font-weight: 700; color: var(--max-color-text-primary);">${escapeHtml(journey.userName)}</span>, ` : ''}
                ${escapeHtml(journey.role)}
            </div>

            <!-- Row 4: Description -->
            ${journey.description ? `<div style="font-size: 48px; line-height: 1.3; color: var(--max-color-text-primary); max-width: 90%; font-weight: 600;">${escapeHtml(journey.description)}</div>` : ''}
        </div>
    `;

    // Always render table if we have phases or swimlanes
    if (journey.phases.length > 0 || journey.swimlanes.length > 0) {
        // Grid Template: STRICT FIXED WIDTHS
        // 150px for header, then 300px fixed for each phase
        const colWidth = '300px';
        const gridTemplate = `150px ${journey.phases.length > 0 ? `repeat(${journey.phases.length}, ${colWidth})` : '1fr'}`;
        
        html += `<div class="journey-table" style="grid-template-columns: ${gridTemplate};">`;

        // 1. Header Row
        html += `<div></div>`; // Top-left corner empty
        
        // 1. Phase Headers
        journey.phases.forEach(phase => {
            const desc = phase.description ? ` title="${escapeHtml(phase.description)}"` : '';
            html += `<div class="phase-header"${desc}>
                        ${escapeHtml(phase.name)}
                     </div>`;
        });

        // 2. Swimlane Rows (only render rows that exist)
        journey.swimlanes.forEach(swimlane => {
            // Row Header
            const desc = swimlane.description ? ` title="${escapeHtml(swimlane.description)}"` : '';
            html += `<div class="swimlane-header"${desc}>
                        <div class="swimlane-name">${escapeHtml(swimlane.name)}</div>
                        ${swimlane.description ? `<div class="swimlane-desc">${escapeHtml(swimlane.description)}</div>` : ''}
                     </div>`;

            // Cells — only render filled ones, skip empty
            journey.phases.forEach(phase => {
                const cell = journey.cells.find(c => c.phaseId === phase.phaseId && c.swimlaneId === swimlane.swimlaneId);
                
                if (cell && cell.headline) {
                    html += `
                        <div class="journey-cell complete">
                            <div class="cell-action">${escapeHtml(cell.headline)}</div>
                            <div class="cell-context">${escapeHtml(cell.description)}</div>
                        </div>
                    `;
                } else {
                    // Empty grid slot to maintain table alignment
                    html += `<div></div>`;
                }
            });
        });

        html += `</div>`; // End table

        /* --- MOBILE VIEW REMOVED ---
           We now rely on the main table + Panzoom for all devices to ensure parity.
        */
    }

    // --- ARTIFACTS SECTION (Consolidated 50/50 Split) ---
    // Render sections if they exist, or if the journey is complete
    
    // Auto-switch to map on mobile if complete
    const isComplete = journey.status === 'READY_FOR_REVIEW' || journey.stage === 'COMPLETE' || (journey.mentalModels && journey.mentalModels.length > 10) || (journey.summaryOfFindings && journey.summaryOfFindings.length > 10);

    if (isComplete) {
        // Add complete class to body for full takeover (host may style this)
        document.body.classList.add('journey-complete');
        
        // Auto-switch mobile view if the host provides toggleMobileView
        if (window.innerWidth <= 768 && !document.body.classList.contains('show-map') && typeof toggleMobileView === 'function') {
            setTimeout(() => { if (!document.body.classList.contains('show-map')) toggleMobileView(); }, 500);
        }
    } else {
        document.body.classList.remove('journey-complete');
    }

    
    // Calculate hasSummaries before using it
    const hasSummaries = journey.phases.some(p => p.summary) || journey.swimlanes.some(s => s.summary);
    const hasArtifacts = journey.summaryOfFindings || journey.mentalModels || journey.anythingElse || hasSummaries;
    
    if (hasArtifacts) {
        html += `<div class="final-artifacts" style="margin-top: 60px; padding-top: 40px; border-top: 1px solid var(--max-color-border); display: flex; flex-direction: column; gap: 60px; width: 100%;">`;

    // --- SECTION 1: OVERVIEW (Full Width) ---
    if (journey.summaryOfFindings) {
        html += `
            <div class="artifact-section overview-section" style="width: 100%;">
                <h3 style="color: var(--max-color-accent); margin-bottom: 24px; font-size: 24px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Summary</h3>
                <div style="font-size: 24px; line-height: 1.6; color: var(--max-color-text-primary);">${formatMessage(journey.summaryOfFindings, true)}</div>
            </div>`;
    }

    // --- SECTION 2: MENTAL MODELS (Grid) ---
    if (journey.mentalModels) {
        html += `
            <div class="artifact-section models-section" style="width: 100%;">
                <h3 style="color: var(--max-color-accent); margin-bottom: 24px; font-size: 24px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Mental Models</h3>
        `;
        
        const rawModels = journey.mentalModels;
        let models = [];
        if (rawModels.match(/^\d+\./m)) {
            models = rawModels.split(/^\d+\.\s*/m).filter(m => m.trim().length > 0);
        } else if (rawModels.match(/^[-*•]\s/m)) {
            models = rawModels.split(/^[-*•]\s*/m).filter(m => m.trim().length > 0);
        } else {
            // Fallback: Split by single newline if double newline doesn't exist, assuming list format
            // If the content is just one block, this might split paragraphs, but usually mental models are distinct items.
            // Check if we have double newlines first
            if (rawModels.includes('\n\n')) {
                models = rawModels.split(/\n\n+/).filter(m => m.trim().length > 0);
            } else {
                models = rawModels.split(/\n+/).filter(m => m.trim().length > 0);
            }
        }
        
        if (models.length > 0) {
            // Grid Layout for Models
            html += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(450px, 1fr)); gap: 24px;">`;
            
            models.forEach((model, index) => {
                let title = '';
                let content = model.trim();
                
                // Strategy 1: **Bold Title:** rest  OR  **Bold Title.** rest  OR  **Bold Title** rest
                const boldMatch = content.match(/^\*\*(.+?)\*\*[:\.\s]*(.*)/s);
                if (boldMatch) {
                    title = boldMatch[1].replace(/[:\.]$/, '').trim();
                    content = boldMatch[2].trim();
                }
                
                // Strategy 2: Title: rest (colon-separated, title < 80 chars)
                if (!title) {
                    const colonMatch = content.match(/^([^:\n]{3,80}):\s*(.*)/s);
                    if (colonMatch) {
                        title = colonMatch[1].trim();
                        content = colonMatch[2].trim();
                    }
                }
                
                // Strategy 3: Short first sentence as title (period within first 80 chars)
                if (!title) {
                    const dotIdx = content.indexOf('.');
                    if (dotIdx > 2 && dotIdx < 80) {
                        title = content.substring(0, dotIdx).trim();
                        content = content.substring(dotIdx + 1).trim();
                    }
                }
                
                // Fallback
                if (!title) {
                    title = `Insight ${index + 1}`;
                }

                // Strip any remaining ** or * markdown artifacts from both
                let cleanTitle = title.replace(/\*\*/g, '').replace(/^\*|\*$/g, '').trim();
                let cleanContent = content.replace(/^\*\*\s*/, '').trim();

                const formattedTitle = formatMessage(cleanTitle).replace(/^<p>|<\/p>$/g, ''); 

                html += `
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--max-color-border); padding: 32px; border-radius: 16px; display: flex; gap: 24px; align-items: flex-start;">
                        <div style="flex-shrink: 0; margin-top: 4px;">
                            ${getSematicIcon(cleanTitle + ' ' + cleanContent)}
                        </div>
                        <div>
                            <h4 style="font-size: 20px; font-weight: 700; color: var(--max-color-text-primary); margin-bottom: 8px;">${formattedTitle}</h4>
                            <div style="font-size: 16px; line-height: 1.6; color: var(--max-color-text-secondary);">${formatMessage(cleanContent)}</div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        } else {
            html += `<div>${formatMessage(journey.mentalModels)}</div>`;
        }
        html += `</div>`;
    }

    // --- SECTION 3: PHASES & LANES (Grid) ---
    if (hasSummaries) {
        html += `
            <div class="artifact-section summaries-section" style="width: 100%;">
                 <h3 style="color: var(--max-color-accent); margin-bottom: 24px; font-size: 24px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Key Takeaways</h3>
                 <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 24px;">
        `;

        // 1. Phase Summaries
        if (journey.phases.some(p => p.summary)) {
            journey.phases.forEach(p => {
                if (p.summary) {
                    html += `
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--max-color-border); padding: 24px; border-radius: 16px; display: flex; flex-direction: column;">
                            <div style="font-family: var(--max-font-family); font-weight: 700; font-size: 15px; color: #ffffff; background-color: var(--max-color-accent); padding: 4px 8px; border-radius: 4px; display: inline-block; width: fit-content; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Phase</div>
                            <h4 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: var(--max-color-text-primary);">${escapeHtml(p.name)}</h4>
                            <div style="font-size: 16px; line-height: 1.6; color: var(--max-color-text-secondary); flex-grow: 1;">${formatMessage(p.summary)}</div>
                        </div>
                    `;
                }
            });
        }

        // 2. Lane Summaries
        if (journey.swimlanes.some(s => s.summary)) {
            journey.swimlanes.forEach(s => {
                if (s.summary) {
                    html += `
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--max-color-border); padding: 24px; border-radius: 16px; display: flex; flex-direction: column;">
                            <div style="font-family: var(--max-font-family); font-weight: 700; font-size: 15px; color: #ffffff; background-color: var(--max-color-accent); padding: 4px 8px; border-radius: 4px; display: inline-block; width: fit-content; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Lane</div>
                            <h4 style="font-size: 20px; font-weight: 700; margin-bottom: 12px; color: var(--max-color-text-primary);">${escapeHtml(s.name)}</h4>
                            <div style="font-size: 16px; line-height: 1.6; color: var(--max-color-text-secondary); flex-grow: 1;">${formatMessage(s.summary)}</div>
                        </div>
                    `;
                }
            });
        }
        
        html += `</div></div>`;
    }
    
    // Additional Context (Full Width) — hide if trivially short (<20 chars ≈ filler like "None", "N/A")
    if (journey.anythingElse && journey.anythingElse.trim().length >= 20) {
            html += `
            <div class="context-card">
                <h3 style="color: var(--max-color-accent); font-size: 24px; margin-bottom: 16px;">Additional Context</h3>
                <div class="context-content" style="font-size: 18px;">${formatMessage(journey.anythingElse)}</div>
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
    }
 
    // --- USER QUOTE (Very Bottom) ---
    if (journey.quotes && journey.quotes.length > 0) {
        html += `
            <div style="margin-top: 60px; padding-top: 40px; border-top: 1px solid var(--max-color-border);">
                <div style="font-family: var(--max-font-family-mono, monospace); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--max-color-accent, #ed2224); margin-bottom: 16px;">User Quote</div>
                <div style="display: flex; align-items: flex-start; gap: 16px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ed2224" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
                    <div style="font-family: 'Sorts Mill Goudy', serif; font-weight: 400; font-style: italic; font-size: 128px; line-height: 1.2; color: #ffffff;">
                        ${escapeHtml(journey.quotes[0])}
                    </div>
                </div>
            </div>`;
    }

    html += `</div>`; // End board container

    container.innerHTML = html;

    // Initialize Lucide icons inside the rendered container
    if (typeof lucide !== 'undefined') {
        lucide.createIcons({ root: container });
    }
    
    // Dispatch event to notify Panzoom
    window.dispatchEvent(new CustomEvent('journeyRendered', { 
        detail: { width: container.scrollWidth, height: container.scrollHeight } 
    }));

    // Signal MAP button if user is in chat view (mobile)
    if (!document.body.classList.contains('show-map')) {
        const mapBtn = document.getElementById('mobileToggleBtn');
        if (mapBtn) mapBtn.classList.add('map-updated');
    }
}

// ===========================================
// Font Embedding for PDF
// ===========================================
let areFontsEmbedded = false;

async function embedFontsForPdf() {
    if (areFontsEmbedded) return;
    
    const fontConfig = [
        { family: 'Messina Sans', style: 'normal', weight: 300, url: '/fonts/Messina%20Sans/MessinaSans-Light.otf' },
        { family: 'Messina Sans', style: 'italic', weight: 300, url: '/fonts/Messina%20Sans/MessinaSans-LightItalic.otf' },
        { family: 'Messina Sans', style: 'normal', weight: 400, url: '/fonts/Messina%20Sans/MessinaSans-Regular.otf' },
        { family: 'Messina Sans', style: 'italic', weight: 400, url: '/fonts/Messina%20Sans/MessinaSans-Italic.otf' },
        { family: 'Messina Sans', style: 'normal', weight: 700, url: '/fonts/Messina%20Sans/MessinaSans-Bold.otf' },
        { family: 'Messina Sans', style: 'italic', weight: 700, url: '/fonts/Messina%20Sans/MessinaSans-BoldItalic.otf' },
        
        { family: 'Messina Sans Mono', style: 'normal', weight: 300, url: '/fonts/Messina%20Sans%20Mono/MessinaSansMono-Light.otf' },
        { family: 'Messina Sans Mono', style: 'normal', weight: 350, url: '/fonts/Messina%20Sans%20Mono/MessinaSansMono-Book.otf' },
        { family: 'Messina Sans Mono', style: 'normal', weight: 400, url: '/fonts/Messina%20Sans%20Mono/MessinaSansMono-Regular.otf' },
        { family: 'Messina Sans Mono', style: 'normal', weight: 600, url: '/fonts/Messina%20Sans%20Mono/MessinaSansMono-SemiBold.otf' },
        { family: 'Messina Sans Mono', style: 'normal', weight: 700, url: '/fonts/Messina%20Sans%20Mono/MessinaSansMono-Bold.otf' },
        { family: 'Messina Sans Mono', style: 'normal', weight: 900, url: '/fonts/Messina%20Sans%20Mono/MessinaSansMono-Black.otf' },
    ];

    let css = '';
    
    console.log("Embedding fonts for PDF...");
    
    // We can run these in parallel
    await Promise.all(fontConfig.map(async (font) => {
        try {
            const resp = await fetch(font.url);
            const blob = await resp.blob();
            
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result; 
                    const b64Data = base64.split(',')[1];
                    const url = `data:font/opentype;base64,${b64Data}`;
                    
                    css += `
                        @font-face {
                            font-family: '${font.family}';
                            src: url('${url}') format('opentype');
                            font-weight: ${font.weight};
                            font-style: ${font.style};
                        }
                    `;
                    resolve();
                };
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Failed to embed font:", font.url, e);
        }
    }));
    
    const style = document.createElement('style');
    style.id = 'embedded-pdf-fonts';
    style.textContent = css;
    document.head.appendChild(style);
    
    // Wait for fonts to be parsed and ready
    await document.fonts.ready;
    
    // Extra safety buffer for layout/paint
    await new Promise(resolve => setTimeout(resolve, 500));
    
    areFontsEmbedded = true;
    console.log("Fonts embedded successfully.");
}

// Export to PDF
async function exportToPdf() {
    if (!currentRenderedJourney) return;

    // Use the container logic from exportToImage, but save as PDF
    const element = document.querySelector('.journey-board-container');
    if (!element) return;
    
    // Ensure fonts are embedded
    await embedFontsForPdf();

    // 1. Reset Transform to ensure full capture (on parent)
    const parent = document.getElementById('journeyDashboard');
    const originalTransform = parent.style.transform;
    parent.style.transform = 'none'; 
    
    // 2. Calculate Full Dimensions
    const width = element.scrollWidth;
    const height = element.scrollHeight;
    
    // 3. Configure html2pdf to use html2canvas with full dimensions
    // We set windowWidth/windowHeight to ensure it renders at full size
    // We set jsPDF format to custom [width, height] in pixels/points to fit everything on one page
    const opt = {
        margin: 0,
        filename: `journey-map-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, // High res
            useCORS: true,
            backgroundColor: '#0a0c10', // Match background
            windowWidth: width,
            windowHeight: height,
            width: width,
            height: height,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0
        },
        jsPDF: { 
            unit: 'px', 
            format: [width, height], 
            orientation: width > height ? 'landscape' : 'portrait' 
        }
    };
    
    // 4. Capture and Save
    html2pdf().set(opt).from(element).save().then(() => {
        // Restore transform
        parent.style.transform = originalTransform;
    }).catch(err => {
        console.error("PDF export failed:", err);
        parent.style.transform = originalTransform;
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
