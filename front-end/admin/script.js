// Config
const VERSION = '1.3';
console.log('Journey Mapper Admin v' + VERSION);

const BASE_URL = window.location.origin + '/';
const LINKS_API_URL = window.location.origin + '/api/admin/links';
const SETTINGS_API_URL = window.location.origin + '/api/admin/settings';
const JOURNEYS_API_URL = window.location.origin + '/api/admin/journeys';

// DOM Elements - Links Module
const formInputs = {
    name: document.getElementById('name'),
    role: document.getElementById('role'),
    journey: document.getElementById('journey'),
    welcomePrompt: document.getElementById('welcome-prompt'),
    journeyPrompt: document.getElementById('journey-prompt'),
    ragContext: document.getElementById('ragContext')
};
const configNameInput = document.getElementById('configName');
const ragCharCount = document.getElementById('ragCharCount');

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
    journeys: document.getElementById('nav-journeys')
};
const modules = {
    links: document.getElementById('module-links'),
    settings: document.getElementById('module-settings'),
    journeys: document.getElementById('module-journeys')
};

// State
let currentLinkId = null;
let savedLinks = [];
let savedJourneys = [];
let currentJourneyId = null;

// Initialization
function init() {
    // Navigation Logic
    navLinks.links.addEventListener('click', (e) => switchModule(e, 'links'));
    navLinks.settings.addEventListener('click', (e) => switchModule(e, 'settings'));
    navLinks.journeys.addEventListener('click', (e) => switchModule(e, 'journeys'));

    // Links Module Init
    Object.values(formInputs).forEach(input => {
        if(input) {
            input.addEventListener('input', updateUrl);
            input.addEventListener('change', updateUrl);
        }
    });
    configNameInput.addEventListener('input', () => {}); 

    // RAG Character Counter
    if (formInputs.ragContext) {
        formInputs.ragContext.addEventListener('input', updateRagCharCount);
        updateRagCharCount(); // Initialize count
    }

    addSwimlaneBtn.addEventListener('click', () => addSwimlane());
    copyBtn.addEventListener('click', copyToClipboard);
    saveBtn.addEventListener('click', saveConfiguration);
    deleteBtn.addEventListener('click', deleteConfiguration);
    newConfigBtn.addEventListener('click', resetForm);

    // Journeys Module Init
    filterRadios.forEach(radio => radio.addEventListener('change', renderJourneysList));
    clearJourneysBtn.addEventListener('click', clearAllJourneys);

    updateUrl();
    fetchLinks();

    // Fetch Journeys
    fetchJourneys();

    // Settings Module Init
    saveSettingsBtn.addEventListener('click', saveSettings);
    fetchSettings();
}

// RAG Character Count
function updateRagCharCount() {
    if (!formInputs.ragContext || !ragCharCount) return;
    const len = formInputs.ragContext.value.length;
    ragCharCount.textContent = len.toLocaleString();
    
    // Visual feedback when approaching limit
    if (len > 3600) {
        ragCharCount.style.color = '#ed2224';
    } else if (len > 3000) {
        ragCharCount.style.color = '#f59e0b';
    } else {
        ragCharCount.style.color = '';
    }
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
        
        div.addEventListener('click', (e) => {
            if (e.target.closest('.delete-journey-btn')) return;
            loadJourney(journey);
        });

        const delBtn = div.querySelector('.delete-journey-btn');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteJourney(journey.journeyMapId);
        });

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
    renderJourneysList();

    journeyPreviewTitle.textContent = journey.name || 'Untitled Journey';

    if (typeof renderMap === 'function') {
        renderMap(journey, 'adminCanvas');
    } else {
        console.error("Renderer not loaded");
        adminCanvas.innerHTML = "Error: Renderer not loaded.";
    }

    const params = new URLSearchParams();
    if (journey.userName) params.set('name', journey.userName);
    if (journey.role) params.set('role', journey.role);
    if (journey.name) params.set('journey', journey.name);
    
    if (journey.swimlanes && journey.swimlanes.length > 0) {
        const swimlanes = journey.swimlanes.map(s => ({ name: s.name, description: s.description }));
        params.set('swimlanes', JSON.stringify(swimlanes));
    }

    retakeBtn.href = `${BASE_URL}?${params.toString()}`;
    retakeBtn.style.display = 'inline-flex';
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

function renderLinksList() {
    savedLinksList.innerHTML = '';
    
    if (savedLinks.length === 0) {
        savedLinksList.innerHTML = `<div class="empty-state">No saved links yet.</div>`;
        return;
    }

    const sorted = [...savedLinks].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt);
        const dateB = new Date(b.updatedAt || b.createdAt);
        return dateB - dateA;
    });

    sorted.forEach(link => {
        let ragInfo = '';
        if (link.ragContext && link.ragContext.trim().length > 0) {
            ragInfo = ` • 📄 RAG (${link.ragContext.length} chars)`;
        }

        const div = document.createElement('div');
        div.className = `saved-link-item ${link.id === currentLinkId ? 'active' : ''}`;
        div.innerHTML = `
            <div class="link-name">${escapeHtml(link.configName || 'Untitled')}</div>
            <div class="link-meta">${link.journey || 'No journey specified'}${escapeHtml(ragInfo)}</div>
        `;
        div.onclick = () => loadConfiguration(link);
        savedLinksList.appendChild(div);
    });
}

function loadConfiguration(link) {
    currentLinkId = link.id;
    
    configNameInput.value = link.configName || '';
    formInputs.name.value = link.name || '';
    formInputs.role.value = link.role || '';
    formInputs.journey.value = link.journey || '';
    formInputs.welcomePrompt.value = link.welcomePrompt || '';
    formInputs.journeyPrompt.value = link.journeyPrompt || '';
    formInputs.ragContext.value = link.ragContext || '';

    // Update char count
    updateRagCharCount();

    // Populate Swimlanes
    swimlanesContainer.innerHTML = '';
    if (link.swimlanes && Array.isArray(link.swimlanes)) {
        link.swimlanes.forEach(sl => addSwimlane(sl.name, sl.description));
    }

    deleteBtn.style.display = 'inline-flex';
    saveBtn.textContent = 'Update Configuration';
    renderLinksList();
    updateUrl();
}

function resetForm() {
    currentLinkId = null;
    configNameInput.value = '';
    
    Object.values(formInputs).forEach(input => {
        if(input && input.value !== undefined) input.value = '';
    });

    swimlanesContainer.innerHTML = '';
    
    // Reset char count
    updateRagCharCount();

    deleteBtn.style.display = 'none';
    saveBtn.textContent = 'Save Configuration';
    renderLinksList();
    updateUrl();
}

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
        ragContext: formInputs.ragContext.value.trim(),
        swimlanes: getSwimlanesFromDOM()
    };

    if (!currentLinkId) {
        payload.id = slugify(configName);
    }

    try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        let res;
        if (currentLinkId) {
            res = await fetch(`${LINKS_API_URL}/${currentLinkId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch(LINKS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (res.ok) {
            const savedLink = await res.json();
            currentLinkId = savedLink.id;
            await fetchLinks();
            loadConfiguration(savedLink);
        } else {
            alert("Failed to save.");
        }
    } catch (e) {
        console.error(e);
        alert("Error saving configuration.");
    } finally {
        saveBtn.disabled = false;
    }
}

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

// Logic: Generate URL
function updateUrl() {
    const params = new URLSearchParams();

    if (formInputs.name.value.trim()) params.set('name', formInputs.name.value.trim());
    if (formInputs.role.value.trim()) params.set('role', formInputs.role.value.trim());
    if (formInputs.journey.value.trim()) params.set('journey', formInputs.journey.value.trim());
    if (formInputs.welcomePrompt.value.trim()) params.set('welcome-prompt', formInputs.welcomePrompt.value.trim());
    if (formInputs.journeyPrompt.value.trim()) params.set('journey-prompt', formInputs.journeyPrompt.value.trim());
    
    // RAG context is stored on the link config, not in the URL (too large for query params)
    // It's passed to the AI via the link's saved config when loaded via ?id=

    const validSwimlanes = getSwimlanesFromDOM();
    if (validSwimlanes.length > 0) {
        params.set('swimlanes', JSON.stringify(validSwimlanes));
    }

    let finalUrl = '';
    if (currentLinkId) {
        finalUrl = `${BASE_URL}?id=${currentLinkId}`;
    } else {
        const queryString = params.toString();
        finalUrl = queryString ? `${BASE_URL}?${queryString}` : BASE_URL;
    }

    generatedUrlCode.innerHTML = `<a href="${finalUrl}" target="_blank">${finalUrl}</a>`;
    testLinkBtn.href = finalUrl;
}

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '_')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copyToClipboard() {
    const url = generatedUrlCode.innerText;
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
