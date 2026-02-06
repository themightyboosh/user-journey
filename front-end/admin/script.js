// Config
const VERSION = '1.2';
console.log('Journey Mapper Admin v' + VERSION);

const BASE_URL = window.location.origin + '/';
const LINKS_API_URL = window.location.origin + '/api/admin/links';
const SETTINGS_API_URL = window.location.origin + '/api/admin/settings';
const KNOWLEDGE_API_URL = window.location.origin + '/api/admin/knowledge';
const JOURNEYS_API_URL = window.location.origin + '/api/admin/journeys';

// DOM Elements - Links Module
const formInputs = {
    name: document.getElementById('name'),
    role: document.getElementById('role'),
    journey: document.getElementById('journey'),
    welcomePrompt: document.getElementById('welcome-prompt'),
    journeyPrompt: document.getElementById('journey-prompt'),
    knowledgeSelector: document.getElementById('knowledgeSelector')
};
const configNameInput = document.getElementById('configName');

const swimlanesContainer = document.getElementById('swimlanesContainer');
const addSwimlaneBtn = document.getElementById('addSwimlaneBtn');
const generatedUrlCode = document.getElementById('generatedUrl');
const copyBtn = document.getElementById('copyBtn');
const testLinkBtn = document.getElementById('testLinkBtn');
const swimlaneTemplate = document.getElementById('swimlaneTemplate');
const savedLinksList = document.getElementById('savedLinksList');
const saveBtn = document.getElementById('saveBtn');
const deleteBtn = document.getElementById('deleteBtn');
const newConfigBtn = document.getElementById('newConfigBtn');

// DOM Elements - Settings Module
const agentNameInput = document.getElementById('agentName');
const activeModelInput = document.getElementById('activeModel');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// DOM Elements - Knowledge Module
const knowledgeList = document.getElementById('knowledgeList');
const newKnowledgeBtn = document.getElementById('newKnowledgeBtn');
const knowledgeTitle = document.getElementById('knowledgeTitle');
const knowledgeContent = document.getElementById('knowledgeContent');
const knowledgeActive = document.getElementById('knowledgeActive');
const saveKnowledgeBtn = document.getElementById('saveKnowledgeBtn');
const deleteKnowledgeBtn = document.getElementById('deleteKnowledgeBtn');
const knowledgeForm = document.getElementById('knowledgeForm');

// DOM Elements - Journeys Module
const journeyList = document.getElementById('journeyList');
const adminCanvas = document.getElementById('adminCanvas');
const journeyPreviewTitle = document.getElementById('journeyPreviewTitle');
const retakeBtn = document.getElementById('retakeBtn');
const clearJourneysBtn = document.getElementById('clearJourneysBtn');
const filterRadios = document.querySelectorAll('input[name="jFilter"]');

// Navigation
const navLinks = {
    links: document.getElementById('nav-links'),
    settings: document.getElementById('nav-settings'),
    knowledge: document.getElementById('nav-knowledge'),
    journeys: document.getElementById('nav-journeys')
};
const modules = {
    links: document.getElementById('module-links'),
    settings: document.getElementById('module-settings'),
    knowledge: document.getElementById('module-knowledge'),
    journeys: document.getElementById('module-journeys')
};

// State
let currentLinkId = null;
let savedLinks = [];
let currentKnowledgeId = null;
let savedKnowledge = [];
let savedJourneys = [];
let currentJourneyId = null;

// Initialization
function init() {
    // Navigation Logic
    navLinks.links.addEventListener('click', (e) => switchModule(e, 'links'));
    navLinks.settings.addEventListener('click', (e) => switchModule(e, 'settings'));
    navLinks.knowledge.addEventListener('click', (e) => switchModule(e, 'knowledge'));
    navLinks.journeys.addEventListener('click', (e) => switchModule(e, 'journeys'));

    // Links Module Init
    Object.values(formInputs).forEach(input => {
        if(input) {
            input.addEventListener('input', updateUrl);
            input.addEventListener('change', updateUrl); // Handle select changes
        }
    });
    configNameInput.addEventListener('input', () => {}); 

    addSwimlaneBtn.addEventListener('click', () => addSwimlane());
    copyBtn.addEventListener('click', copyToClipboard);
    saveBtn.addEventListener('click', saveConfiguration);
    deleteBtn.addEventListener('click', deleteConfiguration);
    newConfigBtn.addEventListener('click', resetForm);

    // Knowledge Module Init
    newKnowledgeBtn.addEventListener('click', resetKnowledgeForm);
    saveKnowledgeBtn.addEventListener('click', saveKnowledge);
    deleteKnowledgeBtn.addEventListener('click', deleteKnowledge);

    // Journeys Module Init
    filterRadios.forEach(radio => radio.addEventListener('change', renderJourneysList));
    clearJourneysBtn.addEventListener('click', clearAllJourneys);

    updateUrl();
    fetchLinks();
    
    // Fetch knowledge for both modules (management + selector)
    fetchKnowledge().then(renderKnowledgeSelector);

    // Fetch Journeys
    fetchJourneys();

    // Settings Module Init
    saveSettingsBtn.addEventListener('click', saveSettings);
    fetchSettings();
}

// Logic: Navigation
function switchModule(e, moduleName) {
    e.preventDefault();
    
    // Update Nav
    document.querySelectorAll('.admin-nav a').forEach(el => el.classList.remove('active'));
    navLinks[moduleName].classList.add('active');

    // Update Content
    Object.values(modules).forEach(el => el.style.display = 'none');
    modules[moduleName].style.display = 'block';

    // Show/Hide Sidebar (Only for Links Module)
    const sidebar = document.querySelector('.admin-sidebar');
    if (sidebar) {
        sidebar.style.display = moduleName === 'links' ? 'block' : 'none';
    }
}

// --- Journeys Logic ---

async function fetchJourneys() {
    try {
        const urlWithCache = `${JOURNEYS_API_URL}?_t=${Date.now()}`;
        console.log('Fetching journeys from:', urlWithCache);
        let res = await fetch(urlWithCache);

        // Fallback for rewrite issues
        if (res.status === 404) {
            console.warn('Primary endpoint 404, trying fallback /admin/journeys');
            res = await fetch(`/admin/journeys?_t=${Date.now()}`);
        }

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const data = await res.json();
        console.log('Journeys fetched:', data);
        
        // Ensure data is an array
        if (Array.isArray(data)) {
            savedJourneys = data;
        } else if (typeof data === 'object' && data !== null) {
            // Handle if API returns object map instead of array
            savedJourneys = Object.values(data);
        } else {
            console.error('Unexpected data format:', data);
            savedJourneys = [];
        }
        
        renderJourneysList();
    } catch (e) {
        console.error("Failed to fetch journeys", e);
        if(journeyList) journeyList.innerHTML = `<div class="empty-state">Failed to load journeys: ${e.message}</div>`;
    }
}

function renderJourneysList() {
    if (!journeyList) return;
    journeyList.innerHTML = '';

    const filterVal = document.querySelector('input[name="jFilter"]:checked').value;
    
    let filtered = savedJourneys;
    if (filterVal === 'complete') {
        filtered = savedJourneys.filter(j => j.status === 'READY_FOR_REVIEW' || j.stage === 'COMPLETE');
    }

    // Sort by updated desc
    filtered.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0);
        const dateB = new Date(b.updatedAt || b.createdAt || 0);
        return dateB - dateA;
    });

    if (filtered.length === 0) {
        journeyList.innerHTML = `<div class="empty-state">No journeys found.</div>`;
        clearJourneysBtn.style.display = 'none';
        return;
    }

    clearJourneysBtn.style.display = 'inline-flex';

    filtered.forEach(journey => {
        if (!journey) return;

        const div = document.createElement('div');
        div.className = `saved-link-item ${journey.journeyMapId === currentJourneyId ? 'active' : ''}`;
        
        let statusIcon = journey.stage === 'COMPLETE' ? '✅' : '📝';
        
        let date = 'Unknown Date';
        if (journey.updatedAt) {
            try {
                date = new Date(journey.updatedAt).toLocaleDateString();
            } catch (e) {
                console.error('Invalid date for journey:', journey.journeyMapId);
            }
        } else if (journey.createdAt) {
             try {
                date = new Date(journey.createdAt).toLocaleDateString();
            } catch (e) {}
        }

        let name = journey.userName ? `${journey.userName} (${journey.role})` : (journey.role || 'Unknown User');

        // Create inner HTML
        div.innerHTML = `
            <div class="link-content" style="flex: 1;">
                <div class="link-name">${statusIcon} ${escapeHtml(journey.name || 'Untitled')}</div>
                <div class="link-meta">${escapeHtml(name)} • ${date}</div>
            </div>
            <button class="delete-journey-btn icon-btn small danger" title="Delete" style="opacity: 0.5; margin-left: 8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        // Click on row to load
        div.addEventListener('click', (e) => {
            // Don't trigger if clicking delete button
            if (e.target.closest('.delete-journey-btn')) return;
            loadJourney(journey);
        });

        // Click on delete
        const delBtn = div.querySelector('.delete-journey-btn');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent loading
            deleteJourney(journey.journeyMapId);
        });

        // Add hover effect logic for delete button
        div.addEventListener('mouseenter', () => { delBtn.style.opacity = '1'; });
        div.addEventListener('mouseleave', () => { delBtn.style.opacity = '0.5'; });

        journeyList.appendChild(div);
    });
}

async function deleteJourney(id) {
    if (!confirm("Are you sure you want to delete this journey? This cannot be undone.")) return;

    try {
        const res = await fetch(`${JOURNEYS_API_URL}/${id}`, { method: 'DELETE' });
        if (res.ok) {
            // If deleting current, clear view
            if (id === currentJourneyId) {
                currentJourneyId = null;
                adminCanvas.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; opacity: 0.5;">Select a journey to preview</div>';
                journeyPreviewTitle.textContent = 'Select a Journey';
                retakeBtn.style.display = 'none';
            }
            fetchJourneys();
        } else {
            alert("Failed to delete journey.");
        }
    } catch (e) {
        console.error(e);
        alert("Error deleting journey.");
    }
}

async function clearAllJourneys() {
    if (!confirm("WARNING: Are you sure you want to DELETE ALL journeys? This is irreversible.")) return;
    
    // Double check
    if (!confirm("Really delete EVERYTHING?")) return;

    try {
        const res = await fetch(JOURNEYS_API_URL, { method: 'DELETE' });
        if (res.ok) {
            currentJourneyId = null;
            adminCanvas.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; opacity: 0.5;">Select a journey to preview</div>';
            journeyPreviewTitle.textContent = 'Select a Journey';
            retakeBtn.style.display = 'none';
            fetchJourneys();
        } else {
            alert("Failed to clear journeys.");
        }
    } catch (e) {
        console.error(e);
        alert("Error clearing journeys.");
    }
}

function loadJourney(journey) {
    currentJourneyId = journey.journeyMapId;
    renderJourneysList(); // Update active state

    // Title
    journeyPreviewTitle.textContent = journey.name || 'Untitled Journey';

    // Render Canvas
    // We assume the renderer.js is loaded globally
    if (typeof renderJourney === 'function') {
        renderJourney(journey, 'adminCanvas');
    } else {
        console.error("Renderer not loaded");
        adminCanvas.innerHTML = "Error: Renderer not loaded.";
    }

    // Setup Retake Button
    // We reconstruct the URL based on the journey parameters to "restart" it
    const params = new URLSearchParams();
    if (journey.userName) params.set('name', journey.userName);
    if (journey.role) params.set('role', journey.role);
    if (journey.name) params.set('journey', journey.name);
    // We don't have the original prompt configs stored in the journey object usually, 
    // unless we decide to store them. 
    // For now, we pass what we have. 
    // If specific prompts were used, they might be lost unless we add them to the JourneyMap schema.
    // However, the requirement says "links to the front-end with the same parameters".
    // Since we don't strictly persist the *input* parameters on the journey object (only the *result*),
    // we do our best.
    
    // If the journey has swimlanes, we can pre-populate them to ensure the same structure
    if (journey.swimlanes && journey.swimlanes.length > 0) {
        const swimlanes = journey.swimlanes.map(s => ({ name: s.name, description: s.description }));
        params.set('swimlanes', JSON.stringify(swimlanes));
    }

    retakeBtn.href = `${BASE_URL}?${params.toString()}`;
    retakeBtn.style.display = 'inline-flex';
}


// --- Knowledge Logic ---

async function fetchKnowledge() {
    try {
        const urlWithCache = `${KNOWLEDGE_API_URL}?_t=${Date.now()}`;
        const res = await fetch(urlWithCache);
        savedKnowledge = await res.json();
        renderKnowledgeList();
        renderKnowledgeSelector(); // Ensure selector is up to date
    } catch (e) {
        console.error("Failed to fetch knowledge", e);
        knowledgeList.innerHTML = `<div class="empty-state">Failed to load.</div>`;
    }
}

function renderKnowledgeList() {
    knowledgeList.innerHTML = '';
    
    if (savedKnowledge.length === 0) {
        knowledgeList.innerHTML = `<div class="empty-state">No knowledge bases yet.</div>`;
        return;
    }

    savedKnowledge.forEach(item => {
        const div = document.createElement('div');
        div.className = `saved-link-item ${item.id === currentKnowledgeId ? 'active' : ''}`;
        div.innerHTML = `
            <div class="link-name">${escapeHtml(item.title || 'Untitled')}</div>
            <div class="link-meta">${item.isActive ? 'Active' : 'Inactive'} • ${item.content.length} chars</div>
        `;
        div.onclick = () => loadKnowledge(item);
        knowledgeList.appendChild(div);
    });
}

function loadKnowledge(item) {
    currentKnowledgeId = item.id;
    knowledgeTitle.value = item.title || '';
    knowledgeContent.value = item.content || '';
    knowledgeActive.checked = !!item.isActive;
    
    knowledgeForm.style.display = 'block';
    deleteKnowledgeBtn.style.display = 'inline-flex';
    saveKnowledgeBtn.textContent = 'Update Knowledge Base';
    
    renderKnowledgeList();
}

function resetKnowledgeForm() {
    currentKnowledgeId = null;
    knowledgeTitle.value = '';
    knowledgeContent.value = '';
    knowledgeActive.checked = true;
    
    knowledgeForm.style.display = 'block';
    deleteKnowledgeBtn.style.display = 'none';
    saveKnowledgeBtn.textContent = 'Create Knowledge Base';
    knowledgeTitle.focus();
    renderKnowledgeList();
}

async function saveKnowledge() {
    const title = knowledgeTitle.value.trim();
    const content = knowledgeContent.value.trim();
    const isActive = knowledgeActive.checked;

    if (!title || !content) {
        alert("Title and Content are required.");
        return;
    }

    const payload = { title, content, isActive };

    try {
        saveKnowledgeBtn.disabled = true;
        saveKnowledgeBtn.textContent = 'Saving...';

        let res;
        if (currentKnowledgeId) {
            res = await fetch(`${KNOWLEDGE_API_URL}/${currentKnowledgeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch(KNOWLEDGE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (res.ok) {
            const saved = await res.json();
            currentKnowledgeId = saved.id;
            await fetchKnowledge();
            loadKnowledge(saved);
        } else {
            alert("Failed to save.");
        }
    } catch (e) {
        console.error(e);
        alert("Error saving.");
    } finally {
        saveKnowledgeBtn.disabled = false;
    }
}

async function deleteKnowledge() {
    if (!currentKnowledgeId || !confirm("Are you sure?")) return;

    try {
        await fetch(`${KNOWLEDGE_API_URL}/${currentKnowledgeId}`, { method: 'DELETE' });
        resetKnowledgeForm();
        fetchKnowledge();
    } catch(e) {
        alert("Error deleting.");
    }
}

function renderKnowledgeSelector() {
    if (!formInputs.knowledgeSelector) return;
    
    // Clear current
    formInputs.knowledgeSelector.innerHTML = '';
    
    if (savedKnowledge.length === 0) {
        formInputs.knowledgeSelector.innerHTML = '<div class="empty-state-small">No active knowledge bases found.</div>';
        return;
    }

    // Filter active only
    savedKnowledge.filter(k => k.isActive).forEach(k => {
        const wrapper = document.createElement('div');
        wrapper.className = 'checkbox-item';
        wrapper.style.marginBottom = '8px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `kb-${k.id}`;
        checkbox.value = k.id;
        checkbox.name = 'knowledgeIds';
        
        // Add event listener to update URL on change
        checkbox.addEventListener('change', updateUrl);
        
        const label = document.createElement('label');
        label.htmlFor = `kb-${k.id}`;
        label.textContent = k.title;
        label.style.marginLeft = '8px';
        
        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        formInputs.knowledgeSelector.appendChild(wrapper);
    });

    // Re-check boxes based on current state (Link or URL)
    // If we are editing a link, load its IDs
    if (currentLinkId && savedLinks.length > 0) {
        const link = savedLinks.find(l => l.id === currentLinkId);
        if (link && link.knowledgeIds && Array.isArray(link.knowledgeIds)) {
            link.knowledgeIds.forEach(id => {
                const cb = document.getElementById(`kb-${id}`);
                if (cb) cb.checked = true;
            });
        }
        // Legacy support
        else if (link && link.knowledgeId) {
             const cb = document.getElementById(`kb-${link.knowledgeId}`);
             if (cb) cb.checked = true;
        }
    }
    
    // Refresh list to show KB names if they were missing before
    renderLinksList();
}

// --- Settings Logic ---

async function fetchSettings() {
    try {
        const urlWithCache = `${SETTINGS_API_URL}?_t=${Date.now()}`;
        const res = await fetch(urlWithCache);
        const settings = await res.json();
        if (settings.agentName) {
            agentNameInput.value = settings.agentName;
        }
        if (settings.activeModel) {
            activeModelInput.value = settings.activeModel;
        }
    } catch (e) {
        console.error("Failed to fetch settings", e);
    }
}

async function saveSettings() {
    const agentName = agentNameInput.value.trim() || 'Max';
    const activeModel = activeModelInput.value;
    
    try {
        saveSettingsBtn.textContent = 'Saving...';
        saveSettingsBtn.disabled = true;

        const res = await fetch(SETTINGS_API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentName, activeModel })
        });

        if (res.ok) {
            alert('Settings saved!');
        } else {
            alert('Failed to save settings.');
        }
    } catch(e) {
        alert('Error saving settings.');
    } finally {
        saveSettingsBtn.textContent = 'Save Settings';
        saveSettingsBtn.disabled = false;
    }
}

// --- Links Logic ---

// Logic: Fetch Links
async function fetchLinks() {
    try {
        const urlWithCache = `${LINKS_API_URL}?_t=${Date.now()}`;
        const res = await fetch(urlWithCache);
        savedLinks = await res.json();
        renderLinksList();
    } catch (e) {
        console.error("Failed to fetch links", e);
        savedLinksList.innerHTML = `<div class="empty-state">Failed to load links. Ensure backend is running.</div>`;
    }
}

// Logic: Render List
function renderLinksList() {
    savedLinksList.innerHTML = '';
    
    if (savedLinks.length === 0) {
        savedLinksList.innerHTML = `<div class="empty-state">No saved links yet.</div>`;
        return;
    }

    // Sort by updated/created desc
    const sorted = [...savedLinks].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt);
        const dateB = new Date(b.updatedAt || b.createdAt);
        return dateB - dateA;
    });

    sorted.forEach(link => {
        // Find KB names
        let kbInfo = '';
        if (link.knowledgeIds && Array.isArray(link.knowledgeIds) && link.knowledgeIds.length > 0) {
             const names = link.knowledgeIds.map(id => {
                 const k = savedKnowledge.find(k => k.id === id);
                 return k ? k.title : null;
             }).filter(Boolean);
             if (names.length > 0) kbInfo = ` • 📚 ${names.join(', ')}`;
        } 
        // Legacy check
        else if (link.knowledgeId) {
             const k = savedKnowledge.find(k => k.id === link.knowledgeId);
             if (k) kbInfo = ` • 📚 ${k.title}`;
        }

        const div = document.createElement('div');
        div.className = `saved-link-item ${link.id === currentLinkId ? 'active' : ''}`;
        div.innerHTML = `
            <div class="link-name">${escapeHtml(link.configName || 'Untitled')}</div>
            <div class="link-meta">${link.journey || 'No journey specified'}${escapeHtml(kbInfo)}</div>
        `;
        div.onclick = () => loadConfiguration(link);
        savedLinksList.appendChild(div);
    });
}

// Logic: Load Config
function loadConfiguration(link) {
    currentLinkId = link.id;
    
    // Populate fields
    configNameInput.value = link.configName || '';
    formInputs.name.value = link.name || '';
    formInputs.role.value = link.role || '';
    formInputs.journey.value = link.journey || '';
    formInputs.welcomePrompt.value = link.welcomePrompt || '';
    formInputs.journeyPrompt.value = link.journeyPrompt || '';
    
    // Set Knowledge Base Selector
    // Reset all first
    const checkboxes = formInputs.knowledgeSelector.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);

    if (link.knowledgeIds && Array.isArray(link.knowledgeIds)) {
        link.knowledgeIds.forEach(id => {
            const cb = document.getElementById(`kb-${id}`);
            if (cb) cb.checked = true;
        });
    } else if (link.knowledgeId) {
        // Legacy support
        const cb = document.getElementById(`kb-${link.knowledgeId}`);
        if (cb) cb.checked = true;
    }

    // Populate Swimlanes
    swimlanesContainer.innerHTML = '';
    if (link.swimlanes && Array.isArray(link.swimlanes)) {
        link.swimlanes.forEach(sl => addSwimlane(sl.name, sl.description));
    }

    // Update UI
    deleteBtn.style.display = 'inline-flex';
    saveBtn.textContent = 'Update Configuration';
    renderLinksList(); // Re-render to show active state
    updateUrl();
}

// Logic: Reset Form
function resetForm() {
    currentLinkId = null;
    configNameInput.value = '';
    
    Object.values(formInputs).forEach(input => {
        if(input && input.value !== undefined) input.value = '';
    });
    
    // Uncheck all boxes
    if (formInputs.knowledgeSelector) {
        formInputs.knowledgeSelector.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    }

    swimlanesContainer.innerHTML = '';
    
    deleteBtn.style.display = 'none';
    saveBtn.textContent = 'Save Configuration';
    renderLinksList();
    updateUrl();
}

// Logic: Save
async function saveConfiguration() {
    const configName = configNameInput.value.trim();
    if (!configName) {
        alert("Please enter a Configuration Name.");
        configNameInput.focus();
        return;
    }

    const payload = {
        configName,
        name: formInputs.name.value.trim(),
        role: formInputs.role.value.trim(),
        journey: formInputs.journey.value.trim(),
        welcomePrompt: formInputs.welcomePrompt.value.trim(),
        journeyPrompt: formInputs.journeyPrompt.value.trim(),
        knowledgeIds: getSelectedKnowledgeIds(),
        swimlanes: getSwimlanesFromDOM()
    };

    // If creating new, generate ID from name (slug)
    if (!currentLinkId) {
        payload.id = slugify(configName);
    }

    try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        let res;
        if (currentLinkId) {
            // Update
            res = await fetch(`${LINKS_API_URL}/${currentLinkId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            // Create
            res = await fetch(LINKS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (res.ok) {
            const savedLink = await res.json();
            currentLinkId = savedLink.id; // Set ID if it was new
            await fetchLinks(); // Refresh list
            loadConfiguration(savedLink); // Ensure UI state matches
        } else {
            alert("Failed to save.");
        }
    } catch (e) {
        console.error(e);
        alert("Error saving configuration.");
    } finally {
        saveBtn.disabled = false;
        // Label sets in loadConfiguration
    }
}

// Logic: Delete
async function deleteConfiguration() {
    if (!currentLinkId || !confirm("Are you sure you want to delete this configuration?")) return;

    try {
        const res = await fetch(`${LINKS_API_URL}/${currentLinkId}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            resetForm();
            fetchLinks();
        } else {
            alert("Failed to delete.");
        }
    } catch(e) {
        alert("Error deleting.");
    }
}

// Logic: Add Swimlane
function addSwimlane(name = '', desc = '') {
    const clone = swimlaneTemplate.content.cloneNode(true);
    const container = document.createElement('div');
    container.appendChild(clone);
    const item = container.firstElementChild; 
    
    const nameInput = item.querySelector('.sw-name');
    const descInput = item.querySelector('.sw-desc');
    const removeBtn = item.querySelector('.remove-btn');

    nameInput.value = name;
    descInput.value = desc;

    // Events
    nameInput.addEventListener('input', updateUrl);
    descInput.addEventListener('input', updateUrl);
    removeBtn.addEventListener('click', () => {
        item.remove();
        updateUrl();
    });

    swimlanesContainer.appendChild(item);
    if (!name) nameInput.focus();
    updateUrl();
}

// Helper
function getSwimlanesFromDOM() {
    const swimlaneItems = Array.from(document.querySelectorAll('.swimlane-item'));
    return swimlaneItems.map(item => {
        const name = item.querySelector('.sw-name').value.trim();
        const description = item.querySelector('.sw-desc').value.trim();
        if (name) {
            return { name, description };
        }
        return null;
    }).filter(Boolean);
}

// Helper to get checked knowledge IDs
function getSelectedKnowledgeIds() {
    if (!formInputs.knowledgeSelector) return [];
    const checked = Array.from(formInputs.knowledgeSelector.querySelectorAll('input[type="checkbox"]:checked'));
    return checked.map(cb => cb.value);
}

// Logic: Generate URL
function updateUrl() {
    const params = new URLSearchParams();

    // 1. Basic Fields
    if (formInputs.name.value.trim()) params.set('name', formInputs.name.value.trim());
    if (formInputs.role.value.trim()) params.set('role', formInputs.role.value.trim());
    if (formInputs.journey.value.trim()) params.set('journey', formInputs.journey.value.trim());
    if (formInputs.welcomePrompt.value.trim()) params.set('welcome-prompt', formInputs.welcomePrompt.value.trim());
    if (formInputs.journeyPrompt.value.trim()) params.set('journey-prompt', formInputs.journeyPrompt.value.trim());
    
    // Knowledge IDs
    const kIds = getSelectedKnowledgeIds();
    if (kIds.length > 0) {
        params.set('knowledge-ids', kIds.join(','));
    }

    // 2. Swimlanes
    const validSwimlanes = getSwimlanesFromDOM();

    if (validSwimlanes.length > 0) {
        params.set('swimlanes', JSON.stringify(validSwimlanes));
    }

    // 3. Construct Final URL
    let finalUrl = '';
    
    // If we have a saved ID, use the Short URL
    if (currentLinkId) {
        finalUrl = `${BASE_URL}?id=${currentLinkId}`;
    } else {
        // Fallback to Long URL (Query Params)
        const queryString = params.toString();
        finalUrl = queryString ? `${BASE_URL}?${queryString}` : BASE_URL;
    }

    // 4. Update UI
    generatedUrlCode.innerHTML = `<a href="${finalUrl}" target="_blank">${finalUrl}</a>`;
    testLinkBtn.href = finalUrl;
}

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '_')           // Replace spaces with _
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '_')         // Replace multiple - with single _
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Logic: Copy
function copyToClipboard() {
    const url = generatedUrlCode.innerText; // Use innerText to get the text content of the link
    navigator.clipboard.writeText(url).then(() => {
        const originalHtml = copyBtn.innerHTML;
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #22c55e;"><polyline points="20 6 9 17 4 12"/></svg>`;
        setTimeout(() => {
            copyBtn.innerHTML = originalHtml;
        }, 2000);
    });
}

// Run
document.addEventListener('DOMContentLoaded', init);
