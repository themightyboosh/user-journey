// ===========================================
// JSON Renderer
// ===========================================

function renderJson(journey, targetElementId = 'journeyDashboard') {
    const container = document.getElementById(targetElementId);
    if (!container || !journey) return;

    // Create a container specifically for the JSON view if it doesn't exist
    // reusing the dashboard container but clearing it for this view
    
    const jsonString = JSON.stringify(journey, null, 2);
    
    // Basic syntax highlighting (optional, keep simple for now)
    // We can wrap this in a <pre> tag
    
    const html = `
        <div class="json-view-container" style="padding: 24px; height: 100%; overflow: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2 style="font-size: 18px; color: var(--max-color-accent);">Journey Data (JSON)</h2>
                <button onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText); this.innerHTML = 'Copied!';" 
                        class="max-send-button" 
                        style="width: auto; padding: 8px 16px; font-size: 12px;">
                    Copy JSON
                </button>
                <div style="display:none;">${escapeHtml(jsonString)}</div>
            </div>
            <pre style="
                background: var(--max-color-surface-secondary); 
                padding: 16px; 
                border-radius: 8px; 
                border: 1px solid var(--max-color-border);
                font-family: var(--max-font-family-mono); 
                font-size: 12px; 
                color: var(--max-color-text-secondary);
                white-space: pre-wrap;
                word-break: break-all;
            "><code>${escapeHtml(jsonString)}</code></pre>
        </div>
    `;

    container.innerHTML = html;
}
