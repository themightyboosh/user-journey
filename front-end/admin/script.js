// Config
const VERSION = '2.3';
console.log('Journey Mapper Admin v' + VERSION);

const BASE_URL = window.location.origin + '/';
const LINKS_API_URL = window.location.origin + '/api/admin/links';
const SETTINGS_API_URL = window.location.origin + '/api/admin/settings';
const JOURNEYS_API_URL = window.location.origin + '/api/admin/journeys';

// DOM Elements - Navigation & Layout
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileNavOverlay = document.getElementById('mobileNavOverlay');
const closeMobileNavBtn = document.getElementById('closeMobileNavBtn');
const adminSidebar = document.getElementById('adminSidebar');
const mobileSidebarToggleTemplates = document.getElementById('mobileSidebarToggleTemplates');
const mobileSidebarToggleJourneys = document.getElementById('mobileSidebarToggleJourneys');
const sidebarTitle = document.getElementById('sidebarTitle');

const navLinks = {
    links: document.getElementById('nav-links'),
    settings: document.getElementById('nav-settings'),
    journeys: document.getElementById('nav-journeys'),
    // Mobile links
    linksMobile: document.getElementById('nav-links-mobile'),
    settingsMobile: document.getElementById('nav-settings-mobile'),
    journeysMobile: document.getElementById('nav-journeys-mobile')
};

const modules = {
    links: document.getElementById('module-links'),
    settings: document.getElementById('module-settings'),
    journeys: document.getElementById('module-journeys')
};

// DOM Elements - Template Module
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
const globalToggle = document.getElementById('globalToggle');

const swimlanesContainer = document.getElementById('swimlanesContainer');
const phasesContainer = document.getElementById('phasesContainer');
const addSwimlaneBtn = document.getElementById('addSwimlaneBtn');
const addPhaseBtn = document.getElementById('addPhaseBtn');
const generatedUrlCode = document.getElementById('generatedUrl');
const copyBtn = document.getElementById('copyBtn');
// testLinkBtn removed — generated URL is clickable directly
const swimlaneTemplate = document.getElementById('swimlaneTemplate');
const phaseTemplate = document.getElementById('phaseTemplate');
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

// Toggle keys (order matches param rows)
const TOGGLE_KEYS = ['name', 'role', 'journey', 'welcomePrompt', 'journeyPrompt', 'ragContext', 'swimlanes', 'phases'];

// State
let currentLinkId = null;
let savedLinks = [];
let savedJourneys = [];
let currentJourneyId = null;
// Toggle states: false = "Provided by User" (default), true = admin-defined
let toggleStates = {};
TOGGLE_KEYS.forEach(k => toggleStates[k] = false);

// ========================================
// Initialization
// ========================================
function init() {
    // Navigation (Desktop)
    navLinks.links.addEventListener('click', (e) => switchModule(e, 'links'));
    navLinks.settings.addEventListener('click', (e) => switchModule(e, 'settings'));
    navLinks.journeys.addEventListener('click', (e) => switchModule(e, 'journeys'));

    // Navigation (Mobile)
    if (navLinks.linksMobile) navLinks.linksMobile.addEventListener('click', (e) => switchModule(e, 'links'));
    if (navLinks.settingsMobile) navLinks.settingsMobile.addEventListener('click', (e) => switchModule(e, 'settings'));
    if (navLinks.journeysMobile) navLinks.journeysMobile.addEventListener('click', (e) => switchModule(e, 'journeys'));

    // Mobile Menu Toggles
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    if (closeMobileNavBtn) closeMobileNavBtn.addEventListener('click', toggleMobileMenu);
    if (mobileNavOverlay) mobileNavOverlay.addEventListener('click', (e) => {
        if (e.target === mobileNavOverlay) toggleMobileMenu();
    });

    // Mobile Sidebar Toggles
    if (mobileSidebarToggleTemplates) mobileSidebarToggleTemplates.addEventListener('click', toggleSidebar);
    if (mobileSidebarToggleJourneys) mobileSidebarToggleJourneys.addEventListener('click', toggleSidebar);

    // Text field listeners for URL preview
    Object.values(formInputs).forEach(input => {
        if (input) {
            input.addEventListener('input', updateUrl);
            input.addEventListener('change', updateUrl);
        }
    });

    // RAG Character Counter
    if (formInputs.ragContext) {
        formInputs.ragContext.addEventListener('input', updateRagCharCount);
        updateRagCharCount();
    }

    // Toggle switches
    document.querySelectorAll('[data-toggle]').forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const key = e.target.getAttribute('data-toggle');
            toggleStates[key] = e.target.checked;
            applyToggleUI(key);
            updateUrl();
        });
    });

    // Swimlane & Phase buttons
    addSwimlaneBtn.addEventListener('click', () => addSwimlane());
    addPhaseBtn.addEventListener('click', () => addPhase());

    // Actions
    copyBtn.addEventListener('click', copyToClipboard);
    saveBtn.addEventListener('click', saveConfiguration);
    deleteBtn.addEventListener('click', deleteConfiguration);
    newConfigBtn.addEventListener('click', () => {
        resetForm();
        if (window.innerWidth < 1024) toggleSidebar(); // Close sidebar on mobile after new click
    });

    // Journeys Module
    if (clearJourneysBtn) clearJourneysBtn.addEventListener('click', clearAllJourneys);

    // Settings Module
    saveSettingsBtn.addEventListener('click', saveSettings);

    // Apply initial toggle UI (all off)
    TOGGLE_KEYS.forEach(applyToggleUI);

    updateUrl();
    fetchLinks();
    fetchJourneys();
    fetchSettings();
}

// ========================================
// Navigation Logic
// ========================================
function toggleMobileMenu() {
    mobileNavOverlay.classList.toggle('active');
}

function toggleSidebar() {
    adminSidebar.classList.toggle('active');
}

function switchModule(e, moduleName) {
    e.preventDefault();
    
    // Update Active State (Desktop & Mobile)
    document.querySelectorAll('.admin-nav a').forEach(el => el.classList.remove('active'));
    if (navLinks[moduleName]) navLinks[moduleName].classList.add('active');
    if (navLinks[moduleName + 'Mobile']) navLinks[moduleName + 'Mobile'].classList.add('active');

    // Show Module
    Object.values(modules).forEach(el => el.style.display = 'none');
    modules[moduleName].style.display = 'flex'; // Flex for layout

    // Sidebar Logic
    const isMobile = window.innerWidth < 1024;
    
    // Hide sidebar lists based on module
    savedLinksList.style.display = 'none';
    journeyList.style.display = 'none';
    
    if (moduleName === 'links') {
        savedLinksList.style.display = 'block';
        sidebarTitle.textContent = 'Saved Templates';
        newConfigBtn.style.display = 'flex';
        // Ensure sidebar is visible on desktop
        if (!isMobile) adminSidebar.style.display = 'flex';
    } else if (moduleName === 'journeys') {
        journeyList.style.display = 'block';
        sidebarTitle.textContent = 'Completed Journeys';
        newConfigBtn.style.display = 'none';
        if (!isMobile) adminSidebar.style.display = 'flex';
    } else {
        // Settings - hide sidebar completely on desktop too usually, or keep empty
        if (!isMobile) adminSidebar.style.display = 'none';
    }

    // Close mobile menu if open
    mobileNavOverlay.classList.remove('active');
    
    // Reset sidebar state on mobile
    if (isMobile) adminSidebar.classList.remove('active');
}

// ========================================
// Toggle Logic
// ========================================
function applyToggleUI(key) {
    const row = document.querySelector(`.param-row[data-param="${key}"]`);
    if (!row) return;

    const isOn = toggleStates[key];
    const toggle = row.querySelector(`[data-toggle="${key}"]`);
    if (toggle) toggle.checked = isOn;

    if (isOn) {
        row.classList.add('active');
    } else {
        row.classList.remove('active');
    }
}

function getActiveConfig() {
    // Returns only the fields that have their toggles ON
    const config = {};

    if (toggleStates.name && formInputs.name.value.trim()) {
        config.name = formInputs.name.value.trim();
    }
    if (toggleStates.role && formInputs.role.value.trim()) {
        config.role = formInputs.role.value.trim();
    }
    if (toggleStates.journey && formInputs.journey.value.trim()) {
        config.journey = formInputs.journey.value.trim();
    }
    if (toggleStates.welcomePrompt && formInputs.welcomePrompt.value.trim()) {
        config.welcomePrompt = formInputs.welcomePrompt.value.trim();
    }
    if (toggleStates.journeyPrompt && formInputs.journeyPrompt.value.trim()) {
        config.journeyPrompt = formInputs.journeyPrompt.value.trim();
    }
    if (toggleStates.ragContext && formInputs.ragContext.value.trim()) {
        config.ragContext = formInputs.ragContext.value.trim();
    }
    if (toggleStates.swimlanes) {
        const sw = getSwimlanesFromDOM();
        if (sw.length > 0) config.swimlanes = sw;
    }
    if (toggleStates.phases) {
        const ph = getPhasesFromDOM();
        if (ph.length > 0) config.phases = ph;
    }

    return config;
}

// ========================================
// RAG Character Count
// ========================================
function updateRagCharCount() {
    if (!formInputs.ragContext || !ragCharCount) return;
    const len = formInputs.ragContext.value.length;
    ragCharCount.textContent = len.toLocaleString();

    if (len > 3600) {
        ragCharCount.style.color = '#ed2224';
    } else if (len > 3000) {
        ragCharCount.style.color = '#f59e0b';
    } else {
        ragCharCount.style.color = '';
    }
}

// ========================================
// Journeys Logic
// ========================================
async function fetchJourneys() {
    try {
        const urlWithCache = `${JOURNEYS_API_URL}?_t=${Date.now()}`;
        let res = await fetch(urlWithCache);
        if (res.status === 404) {
            res = await fetch(`/admin/journeys?_t=${Date.now()}`);
        }
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const data = await res.json();
        if (Array.isArray(data)) {
            savedJourneys = data;
        } else if (typeof data === 'object' && data !== null) {
            savedJourneys = Object.values(data);
        } else {
            savedJourneys = [];
        }
        renderJourneysList();
    } catch (e) {
        console.error("Failed to fetch journeys", e);
        if (journeyList) journeyList.innerHTML = `<div class="empty-state">Failed to load journeys: ${e.message}</div>`;
    }
}

function renderJourneysList() {
    if (!journeyList) return;
    journeyList.innerHTML = '';

    // Only show completed journeys in admin
    const completed = savedJourneys.filter(j => j.status === 'READY_FOR_REVIEW' || j.stage === 'COMPLETE');

    completed.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0);
        const dateB = new Date(b.updatedAt || b.createdAt || 0);
        return dateB - dateA;
    });

    // Show/hide Clear All button (clears ALL journeys including partial)
    const hasAnyJourneys = savedJourneys.length > 0;
    if (clearJourneysBtn) clearJourneysBtn.style.display = hasAnyJourneys ? 'inline-flex' : 'none';

    if (completed.length === 0) {
        const partialCount = savedJourneys.length - completed.length;
        const hint = partialCount > 0 
            ? `No completed journeys yet. ${partialCount} in progress.` 
            : 'No journeys yet.';
        journeyList.innerHTML = `<div class="empty-state">${hint}</div>`;
        return;
    }

    completed.forEach(journey => {
        if (!journey) return;
        const div = document.createElement('div');
        div.className = `saved-link-item ${journey.journeyMapId === currentJourneyId ? 'active' : ''}`;
        let date = 'Unknown Date';
        try { date = new Date(journey.updatedAt || journey.createdAt).toLocaleDateString(); } catch (e) {}
        let name = journey.userName ? `${journey.userName} (${journey.role})` : (journey.role || 'Unknown User');

        div.innerHTML = `
            <div class="link-content" style="flex: 1;">
                <div class="link-name">${escapeHtml(journey.name || 'Untitled')}</div>
                <div class="link-meta">${escapeHtml(name)} • ${date}</div>
            </div>
            <button class="delete-journey-btn icon-btn small danger" title="Delete" style="opacity: 0.5; margin-left: 8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
                    <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        div.addEventListener('click', (e) => {
            if (e.target.closest('.delete-journey-btn')) return;
            loadJourney(journey);
            if (window.innerWidth < 1024) toggleSidebar(); // Close sidebar on mobile select
        });
        const delBtn = div.querySelector('.delete-journey-btn');
        delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteJourney(journey.journeyMapId); });
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
                adminCanvas.innerHTML = '<div class="empty-placeholder">Select a completed journey to preview</div>';
                journeyPreviewTitle.textContent = 'Select a Journey';
                retakeBtn.style.display = 'none';
            }
            fetchJourneys();
        } else { alert("Failed to delete journey."); }
    } catch (e) { console.error(e); alert("Error deleting journey."); }
}

async function clearAllJourneys() {
    const partialCount = savedJourneys.filter(j => j.stage !== 'COMPLETE' && j.status !== 'READY_FOR_REVIEW').length;
    const completeCount = savedJourneys.length - partialCount;
    const msg = `This will delete ALL journeys (${completeCount} completed, ${partialCount} in-progress). This is irreversible.`;
    if (!confirm(msg)) return;
    if (!confirm("Really delete EVERYTHING?")) return;
    try {
        const res = await fetch(JOURNEYS_API_URL, { method: 'DELETE' });
        if (res.ok) {
            currentJourneyId = null;
            adminCanvas.innerHTML = '<div class="empty-placeholder">Select a completed journey to preview</div>';
            journeyPreviewTitle.textContent = 'Select a Journey';
            retakeBtn.style.display = 'none';
            fetchJourneys();
        } else { alert("Failed to clear journeys."); }
    } catch (e) { console.error(e); alert("Error clearing journeys."); }
}

function loadJourney(journey) {
    currentJourneyId = journey.journeyMapId;
    renderJourneysList();
    journeyPreviewTitle.textContent = journey.name || 'Untitled Journey';
    if (typeof renderMap === 'function') {
        renderMap(journey, 'adminCanvas');
    } else {
        adminCanvas.innerHTML = "Error: Renderer not loaded.";
    }
    const params = new URLSearchParams();
    if (journey.userName) params.set('name', journey.userName);
    if (journey.role) params.set('role', journey.role);
    if (journey.name) params.set('journey', journey.name);
    if (journey.swimlanes && journey.swimlanes.length > 0) {
        params.set('swimlanes', JSON.stringify(journey.swimlanes.map(s => ({ name: s.name, description: s.description }))));
    }
    retakeBtn.href = `${BASE_URL}?${params.toString()}`;
    retakeBtn.style.display = 'inline-flex';
}

// ========================================
// Settings Logic
// ========================================
async function fetchSettings() {
    try {
        const res = await fetch(`${SETTINGS_API_URL}?_t=${Date.now()}`);
        const settings = await res.json();
        if (settings.agentName) agentNameInput.value = settings.agentName;
        if (settings.activeModel) activeModelInput.value = settings.activeModel;
    } catch (e) { console.error("Failed to fetch settings", e); }
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
        if (res.ok) { alert('Settings saved!'); } else { alert('Failed to save settings.'); }
    } catch (e) { alert('Error saving settings.'); }
    finally {
        saveSettingsBtn.textContent = 'Save Settings';
        saveSettingsBtn.disabled = false;
    }
}

// ========================================
// Templates (Links) Logic
// ========================================
async function fetchLinks() {
    try {
        const res = await fetch(`${LINKS_API_URL}?_t=${Date.now()}`);
        savedLinks = await res.json();
        renderLinksList();
    } catch (e) {
        console.error("Failed to fetch links", e);
        savedLinksList.innerHTML = `<div class="empty-state">Failed to load templates. Ensure backend is running.</div>`;
    }
}

function renderLinksList() {
    savedLinksList.innerHTML = '';
    if (savedLinks.length === 0) {
        savedLinksList.innerHTML = `<div class="empty-state">No saved templates yet.</div>`;
        return;
    }

    const sorted = [...savedLinks].sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt);
        const dateB = new Date(b.updatedAt || b.createdAt);
        return dateB - dateA;
    });

    sorted.forEach(link => {
        // Count active toggles
        const toggles = link.toggles || {};
        const activeCount = TOGGLE_KEYS.filter(k => toggles[k]).length;
        const globalBadge = link.global ? ' • 🌐' : '';

        const div = document.createElement('div');
        div.className = `saved-link-item ${link.id === currentLinkId ? 'active' : ''}`;
        div.innerHTML = `
            <div class="link-name">${escapeHtml(link.configName || 'Untitled')}</div>
            <div class="link-meta">${activeCount} param${activeCount !== 1 ? 's' : ''} defined${globalBadge}</div>
        `;
        div.onclick = () => {
            loadConfiguration(link);
            if (window.innerWidth < 1024) toggleSidebar(); // Close sidebar on mobile select
        };
        savedLinksList.appendChild(div);
    });
}

function loadConfiguration(link) {
    currentLinkId = link.id;

    configNameInput.value = link.configName || '';
    globalToggle.checked = !!link.global;

    // Load field values (always load, regardless of toggle state)
    formInputs.name.value = link.name || '';
    formInputs.role.value = link.role || '';
    formInputs.journey.value = link.journey || '';
    formInputs.welcomePrompt.value = link.welcomePrompt || '';
    formInputs.journeyPrompt.value = link.journeyPrompt || '';
    formInputs.ragContext.value = link.ragContext || '';
    updateRagCharCount();

    // Load swimlanes
    swimlanesContainer.innerHTML = '';
    if (link.swimlanes && Array.isArray(link.swimlanes)) {
        link.swimlanes.forEach(sl => addSwimlane(sl.name, sl.description));
    }

    // Load phases
    phasesContainer.innerHTML = '';
    if (link.phases && Array.isArray(link.phases)) {
        link.phases.forEach(ph => addPhase(ph.name, ph.description));
    }

    // Load toggle states
    const savedToggles = link.toggles || {};
    TOGGLE_KEYS.forEach(k => {
        toggleStates[k] = !!savedToggles[k];
        applyToggleUI(k);
    });

    deleteBtn.style.display = 'inline-flex';
    saveBtn.textContent = 'Update';
    renderLinksList();
    updateUrl();
}

function resetForm() {
    currentLinkId = null;
    configNameInput.value = '';
    globalToggle.checked = false;

    Object.values(formInputs).forEach(input => {
        if (input && input.value !== undefined) input.value = '';
    });

    swimlanesContainer.innerHTML = '';
    phasesContainer.innerHTML = '';
    updateRagCharCount();

    // Reset all toggles to off
    TOGGLE_KEYS.forEach(k => {
        toggleStates[k] = false;
        applyToggleUI(k);
    });

    deleteBtn.style.display = 'none';
    saveBtn.textContent = 'Save';
    renderLinksList();
    updateUrl();
}

async function saveConfiguration() {
    const configName = configNameInput.value.trim();
    if (!configName) {
        alert("Please enter a Template Name.");
        configNameInput.focus();
        return;
    }

    // Save ALL values (even if toggle is off) so they persist for toggling
    const payload = {
        configName,
        global: globalToggle.checked,
        name: formInputs.name.value.trim(),
        role: formInputs.role.value.trim(),
        journey: formInputs.journey.value.trim(),
        welcomePrompt: formInputs.welcomePrompt.value.trim(),
        journeyPrompt: formInputs.journeyPrompt.value.trim(),
        ragContext: formInputs.ragContext.value.trim(),
        swimlanes: getSwimlanesFromDOM(),
        phases: getPhasesFromDOM(),
        toggles: { ...toggleStates }
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
        alert("Error saving template.");
    } finally {
        saveBtn.disabled = false;
        // reset logic sets text to Save, but here we want Update if it was an update or create
        if (currentLinkId) saveBtn.textContent = 'Update';
        else saveBtn.textContent = 'Save';
    }
}

async function deleteConfiguration() {
    if (!currentLinkId || !confirm("Are you sure you want to delete this template?")) return;
    try {
        const res = await fetch(`${LINKS_API_URL}/${currentLinkId}`, { method: 'DELETE' });
        if (res.ok) { resetForm(); fetchLinks(); } else { alert("Failed to delete."); }
    } catch (e) { alert("Error deleting."); }
}

// ========================================
// Swimlane CRUD
// ========================================
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
    removeBtn.addEventListener('click', () => { item.remove(); updateUrl(); });

    swimlanesContainer.appendChild(item);
    // Only focus if adding interactively (empty params)
    if (!name && !desc) nameInput.focus();
    updateUrl();
}

function getSwimlanesFromDOM() {
    return Array.from(document.querySelectorAll('#swimlanesContainer .swimlane-item')).map(item => {
        const name = item.querySelector('.sw-name').value.trim();
        const description = item.querySelector('.sw-desc').value.trim();
        return name ? { name, description } : null;
    }).filter(Boolean);
}

// ========================================
// Phase CRUD
// ========================================
function addPhase(name = '', desc = '') {
    const clone = phaseTemplate.content.cloneNode(true);
    const container = document.createElement('div');
    container.appendChild(clone);
    const item = container.firstElementChild;

    const nameInput = item.querySelector('.ph-name');
    const descInput = item.querySelector('.ph-desc');
    const removeBtn = item.querySelector('.remove-btn');

    nameInput.value = name;
    descInput.value = desc;

    nameInput.addEventListener('input', updateUrl);
    descInput.addEventListener('input', updateUrl);
    removeBtn.addEventListener('click', () => { item.remove(); updateUrl(); });

    phasesContainer.appendChild(item);
    // Only focus if adding interactively
    if (!name && !desc) nameInput.focus();
    updateUrl();
}

function getPhasesFromDOM() {
    return Array.from(document.querySelectorAll('#phasesContainer .phase-item')).map(item => {
        const name = item.querySelector('.ph-name').value.trim();
        const description = item.querySelector('.ph-desc').value.trim();
        return name ? { name, description } : null;
    }).filter(Boolean);
}

// ========================================
// URL Generation
// ========================================
function updateUrl() {
    let finalUrl = '';
    if (currentLinkId) {
        finalUrl = `${BASE_URL}?id=${currentLinkId}`;
    } else {
        // Build URL from active (toggled-on) params only
        const params = new URLSearchParams();
        const active = getActiveConfig();

        if (active.name) params.set('name', active.name);
        if (active.role) params.set('role', active.role);
        if (active.journey) params.set('journey', active.journey);
        if (active.welcomePrompt) params.set('welcome-prompt', active.welcomePrompt);
        if (active.journeyPrompt) params.set('journey-prompt', active.journeyPrompt);
        // RAG & phases too large for URL; only available via ?id= link
        if (active.swimlanes) params.set('swimlanes', JSON.stringify(active.swimlanes));
        if (active.phases) params.set('phases', JSON.stringify(active.phases));

        const queryString = params.toString();
        finalUrl = queryString ? `${BASE_URL}?${queryString}` : BASE_URL;
    }

    generatedUrlCode.innerHTML = `<a href="${finalUrl}" target="_blank">${finalUrl}</a>`;
}

// ========================================
// Helpers
// ========================================
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
        setTimeout(() => { copyBtn.innerHTML = originalHtml; }, 2000);
    });
}

// Run
document.addEventListener('DOMContentLoaded', init);
