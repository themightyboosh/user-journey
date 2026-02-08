// Config
const VERSION = '3.0';
console.log('Journey Mapper Admin v' + VERSION);

const BASE_URL = window.location.origin + '/';
const LINKS_API_URL = window.location.origin + '/api/admin/links';
const SETTINGS_API_URL = window.location.origin + '/api/admin/settings';
const JOURNEYS_API_URL = window.location.origin + '/api/admin/journeys';
const USERS_API_URL = window.location.origin + '/api/admin/users';
const ME_API_URL = window.location.origin + '/api/admin/me';

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyA4kA1WHUfHAqznL-Us-d8-whjpkr_D4a0",
    authDomain: "journey-mapper-ai-8822.firebaseapp.com",
    projectId: "journey-mapper-ai-8822",
    storageBucket: "journey-mapper-ai-8822.firebasestorage.app",
    messagingSenderId: "98598658832",
    appId: "1:98598658832:web:a7199d2b48d46914167b95"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Auth State
let currentUser = null; // Firebase user
let currentAppUser = null; // Our app user record (from /api/admin/me)
let authToken = null; // Firebase ID token

// DOM Elements - Auth
const loginOverlay = document.getElementById('loginOverlay');
const adminApp = document.getElementById('adminApp');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const loginError = document.getElementById('loginError');
const loginPending = document.getElementById('loginPending');
const logoutBtn = document.getElementById('logoutBtn');
const headerLogoutBtn = document.getElementById('headerLogoutBtn');
const adminUserEmail = document.getElementById('adminUserEmail');

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
    users: document.getElementById('nav-users'),
    // Mobile links
    linksMobile: document.getElementById('nav-links-mobile'),
    settingsMobile: document.getElementById('nav-settings-mobile'),
    journeysMobile: document.getElementById('nav-journeys-mobile'),
    usersMobile: document.getElementById('nav-users-mobile')
};

const modules = {
    links: document.getElementById('module-links'),
    settings: document.getElementById('module-settings'),
    journeys: document.getElementById('module-journeys'),
    users: document.getElementById('module-users')
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
const templateDescriptionInput = document.getElementById('templateDescription');
const ragCharCount = document.getElementById('ragCharCount');
const globalToggle = document.getElementById('globalToggle');
const requireAuthToggle = document.getElementById('requireAuthToggle');

// Icon Picker
const iconPickerBtn = document.getElementById('iconPickerBtn');
const iconPickerDropdown = document.getElementById('iconPickerDropdown');
const iconPickerLabel = document.getElementById('iconPickerLabel');
const selectedIconPreview = document.getElementById('selectedIconPreview');
const iconSearchInput = document.getElementById('iconSearchInput');
const iconGrid = document.getElementById('iconGrid');
let selectedIcon = 'file-text'; // Default icon

// Icon library loaded from ../js/lucide-icons.js (LUCIDE_ICONS global — 1906 icons)
const ICON_LIBRARY = (typeof LUCIDE_ICONS !== 'undefined') ? LUCIDE_ICONS : {};

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
const clearJourneysBtn = document.getElementById('clearJourneysBtn');
let currentConversationHistory = null;

// DOM Elements - Users Module
const usersTableBody = document.getElementById('usersTableBody');

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
// Auth Helpers
// ========================================
function authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    return headers;
}

async function refreshToken() {
    if (currentUser) {
        try {
            authToken = await currentUser.getIdToken(true);
        } catch (e) {
            console.warn('Token refresh failed', e);
        }
    }
}

// ========================================
// Firebase Auth Flow
// ========================================
async function handleSignIn() {
    try {
        loginError.style.display = 'none';
        googleSignInBtn.disabled = true;
        googleSignInBtn.textContent = 'Signing in...';
        
        const result = await auth.signInWithPopup(googleProvider);
        // Auth state observer will handle the rest
    } catch (err) {
        console.error('Sign-in error', err);
        loginError.textContent = err.message || 'Sign-in failed. Please try again.';
        loginError.style.display = 'block';
        googleSignInBtn.disabled = false;
        googleSignInBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Sign in with Google`;
    }
}

async function handleSignOut() {
    await auth.signOut();
    currentUser = null;
    currentAppUser = null;
    authToken = null;
    loginOverlay.style.display = 'flex';
    adminApp.style.display = 'none';
    loginPending.style.display = 'none';
    loginError.style.display = 'none';
    googleSignInBtn.style.display = 'flex';
    googleSignInBtn.disabled = false;
    googleSignInBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#34A853" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Sign in with Google`;
}

function showAdminApp() {
    loginOverlay.style.display = 'none';
    adminApp.style.display = 'flex';
    
    // Show user email in header
    if (adminUserEmail && currentAppUser) {
        adminUserEmail.textContent = currentAppUser.email;
    }
    
    // Role-based visibility
    const isSuperAdmin = currentAppUser && currentAppUser.role === 'super_admin';
    document.querySelectorAll('.super-admin-only').forEach(el => {
        el.style.display = isSuperAdmin ? '' : 'none';
    });
    
    // Initialize app
    initApp();
}

// Firebase auth state observer
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        authToken = await user.getIdToken();
        
        try {
            const res = await fetch(ME_API_URL, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (res.status === 403) {
                // Account inactive
                googleSignInBtn.style.display = 'none';
                loginPending.style.display = 'block';
                return;
            }
            
            if (!res.ok) throw new Error('Auth verification failed');
            
            currentAppUser = await res.json();
            showAdminApp();
        } catch (err) {
            console.error('Auth verification error', err);
            loginError.textContent = 'Authentication failed. Please try again.';
            loginError.style.display = 'block';
            await auth.signOut();
        }
    } else {
        // Not signed in - show login
        loginOverlay.style.display = 'flex';
        adminApp.style.display = 'none';
    }
});

// ========================================
// Initialization
// ========================================
function initApp() {
    // Navigation (Desktop)
    navLinks.links.addEventListener('click', (e) => switchModule(e, 'links'));
    if (navLinks.settings) navLinks.settings.addEventListener('click', (e) => switchModule(e, 'settings'));
    navLinks.journeys.addEventListener('click', (e) => switchModule(e, 'journeys'));
    if (navLinks.users) navLinks.users.addEventListener('click', (e) => switchModule(e, 'users'));

    // Navigation (Mobile)
    if (navLinks.linksMobile) navLinks.linksMobile.addEventListener('click', (e) => switchModule(e, 'links'));
    if (navLinks.settingsMobile) navLinks.settingsMobile.addEventListener('click', (e) => switchModule(e, 'settings'));
    if (navLinks.journeysMobile) navLinks.journeysMobile.addEventListener('click', (e) => switchModule(e, 'journeys'));
    if (navLinks.usersMobile) navLinks.usersMobile.addEventListener('click', (e) => switchModule(e, 'users'));

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

    // Icon Picker
    initIconPicker();

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
    } else if (moduleName === 'users') {
        if (!isMobile) adminSidebar.style.display = 'none';
        fetchUsers();
    } else {
        // Settings - hide sidebar
        if (!isMobile) adminSidebar.style.display = 'none';
    }

    // Close mobile menu if open
    mobileNavOverlay.classList.remove('active');
    
    // Reset sidebar state on mobile
    if (isMobile) adminSidebar.classList.remove('active');
}

// ========================================
// Icon Picker
// ========================================
function getIconSvg(name, size = 20) {
    const paths = ICON_LIBRARY[name] || ICON_LIBRARY['file-text'];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function initIconPicker() {
    if (!iconPickerBtn || !iconPickerDropdown) return;
    
    // Build grid
    renderIconGrid('');

    // Toggle dropdown
    iconPickerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = iconPickerDropdown.style.display !== 'none';
        iconPickerDropdown.style.display = isOpen ? 'none' : 'flex';
        if (!isOpen) {
            iconSearchInput.value = '';
            renderIconGrid('');
            iconSearchInput.focus();
        }
    });

    // Search
    iconSearchInput.addEventListener('input', (e) => {
        renderIconGrid(e.target.value.toLowerCase());
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!iconPickerDropdown.contains(e.target) && e.target !== iconPickerBtn) {
            iconPickerDropdown.style.display = 'none';
        }
    });
}

function renderIconGrid(filter) {
    if (!iconGrid) return;
    iconGrid.innerHTML = '';
    Object.keys(ICON_LIBRARY).forEach(name => {
        if (filter && !name.includes(filter)) return;
        const item = document.createElement('div');
        item.className = `icon-grid-item ${name === selectedIcon ? 'active' : ''}`;
        item.title = name;
        item.innerHTML = getIconSvg(name, 20);
        item.addEventListener('click', () => selectIcon(name));
        iconGrid.appendChild(item);
    });
}

function selectIcon(name) {
    selectedIcon = name;
    const preview = document.getElementById('selectedIconPreview');
    if (preview) {
        preview.outerHTML = getIconSvg(name, 20).replace('<svg ', '<svg id="selectedIconPreview" ');
    }
    if (iconPickerLabel) iconPickerLabel.textContent = name;
    if (iconPickerDropdown) iconPickerDropdown.style.display = 'none';
    renderIconGrid('');
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
        await refreshToken();
        const urlWithCache = `${JOURNEYS_API_URL}?_t=${Date.now()}`;
        let res = await fetch(urlWithCache, { headers: authHeaders() });
        if (res.status === 401) { handleSignOut(); return; }
        if (res.status === 404) {
            res = await fetch(`/admin/journeys?_t=${Date.now()}`, { headers: authHeaders() });
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
    const isSuperAdmin = currentAppUser && currentAppUser.role === 'super_admin';
    if (clearJourneysBtn) clearJourneysBtn.style.display = (hasAnyJourneys && isSuperAdmin) ? 'inline-flex' : 'none';

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

        // Permission: only creator or super admin can delete journeys
        const journeyCreator = journey.userEmail || journey.createdBy || null;
        const canDelete = currentAppUser && (
            currentAppUser.role === 'super_admin' || 
            (journeyCreator && currentAppUser.email === journeyCreator)
        );

        div.innerHTML = `
            <div class="link-content" style="flex: 1;">
                <div class="link-name">${escapeHtml(journey.name || 'Untitled')}</div>
                <div class="link-meta">${escapeHtml(name)} • ${date}${journeyCreator ? ' | ' + escapeHtml(journeyCreator) : ''}</div>
            </div>
            ${canDelete ? `<button class="delete-journey-btn icon-btn small danger" title="Delete" style="opacity: 0.5; margin-left: 8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
                    <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>` : ''}
        `;
        div.addEventListener('click', (e) => {
            if (e.target.closest('.delete-journey-btn')) return;
            loadJourney(journey);
            if (window.innerWidth < 1024) toggleSidebar(); // Close sidebar on mobile select
        });
        if (canDelete) {
            const delBtn = div.querySelector('.delete-journey-btn');
            delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteJourney(journey.journeyMapId); });
            div.addEventListener('mouseenter', () => { delBtn.style.opacity = '1'; });
            div.addEventListener('mouseleave', () => { delBtn.style.opacity = '0.5'; });
        }
        journeyList.appendChild(div);
    });
}

async function deleteJourney(id) {
    if (!confirm("Are you sure you want to delete this journey? This cannot be undone.")) return;
    try {
        await refreshToken();
        const res = await fetch(`${JOURNEYS_API_URL}/${id}`, { method: 'DELETE', headers: authHeaders() });
        if (res.ok) {
            if (id === currentJourneyId) {
                currentJourneyId = null;
                adminCanvas.innerHTML = '<div class="empty-placeholder">Select a completed journey to preview</div>';
                journeyPreviewTitle.textContent = 'Select a Journey';
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
        await refreshToken();
        const res = await fetch(JOURNEYS_API_URL, { method: 'DELETE', headers: authHeaders() });
        if (res.ok) {
            currentJourneyId = null;
            adminCanvas.innerHTML = '<div class="empty-placeholder">Select a completed journey to preview</div>';
            journeyPreviewTitle.textContent = 'Select a Journey';
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

    // Show chat history button if conversation data exists
    const chatHistoryBtn = document.getElementById('chatHistoryBtn');
    const chatHistoryPanel = document.getElementById('chatHistoryPanel');
    if (chatHistoryBtn) {
        if (journey.conversationHistory && journey.conversationHistory.length > 0) {
            chatHistoryBtn.style.display = 'inline-flex';
            currentConversationHistory = journey.conversationHistory;
        } else {
            chatHistoryBtn.style.display = 'none';
            currentConversationHistory = null;
            if (chatHistoryPanel) chatHistoryPanel.style.display = 'none';
        }
    }

    // Initialize admin Panzoom after render
    setTimeout(() => initAdminPanzoom(), 100);
}

// ========================================
// Admin Panzoom
// ========================================
let adminPanzoomInstance = null;

function initAdminPanzoom() {
    const elem = document.getElementById('adminCanvas');
    const viewport = document.getElementById('adminCanvasContainer');
    if (!elem || !viewport || typeof Panzoom === 'undefined') return;

    // Destroy previous instance
    if (adminPanzoomInstance) {
        adminPanzoomInstance.destroy();
        adminPanzoomInstance = null;
    }

    adminPanzoomInstance = Panzoom(elem, {
        maxScale: 5,
        minScale: 0.1,
        canvas: true,
        contain: false,
        cursor: 'grab',
        startScale: 1,
        animate: true,
        pinchAndPan: true
    });

    // Mouse wheel zooms at cursor position
    viewport.addEventListener('wheel', (event) => {
        event.preventDefault();
        const pz = adminPanzoomInstance;
        if (!pz) return;
        const currentScale = pz.getScale();
        const currentPan = pz.getPan();
        const delta = event.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(0.1, Math.min(5, currentScale + delta));
        const rect = viewport.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const localX = (mouseX / currentScale) - currentPan.x;
        const localY = (mouseY / currentScale) - currentPan.y;
        const newPanX = (mouseX / newScale) - localX;
        const newPanY = (mouseY / newScale) - localY;
        pz.zoom(newScale, { animate: false });
        pz.pan(newPanX, newPanY, { animate: false });
    }, { passive: false });

    // Fit to view
    setTimeout(() => fitAdminCanvas(), 200);
}

function fitAdminCanvas() {
    if (!adminPanzoomInstance) return;
    const elem = document.getElementById('adminCanvas');
    const viewport = document.getElementById('adminCanvasContainer');
    if (!elem || !viewport) return;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const cw = elem.scrollWidth;
    const ch = elem.scrollHeight;
    if (cw === 0 || ch === 0) return;
    const scale = Math.min(vw / cw, vh / ch, 1) * 0.95;
    const panX = (vw - cw * scale) / (2 * scale);
    const panY = (vh - ch * scale) / (2 * scale);
    adminPanzoomInstance.zoom(scale, { animate: true });
    adminPanzoomInstance.pan(panX, panY, { animate: true });
}

// ========================================
// Chat History Viewer
// ========================================
function toggleChatHistory() {
    const panel = document.getElementById('chatHistoryPanel');
    if (!panel) return;
    const isVisible = panel.style.display !== 'none';
    if (isVisible) {
        panel.style.display = 'none';
        return;
    }
    if (!currentConversationHistory || currentConversationHistory.length === 0) return;
    const messagesEl = document.getElementById('chatHistoryMessages');
    messagesEl.innerHTML = '';
    currentConversationHistory.forEach(msg => {
        const role = msg.role || 'unknown';
        const div = document.createElement('div');
        div.className = `chat-msg chat-msg-${role === 'user' ? 'user' : 'assistant'}`;
        const label = role === 'user' ? 'User' : 'M.AX';
        const content = (msg.parts || []).map(p => p.text || '').join('');
        div.innerHTML = `<div class="chat-msg-role">${escapeHtml(label)}</div><div class="chat-msg-text">${escapeHtml(content)}</div>`;
        messagesEl.appendChild(div);
    });
    panel.style.display = 'flex';
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ========================================
// Settings Logic
// ========================================
async function fetchSettings() {
    try {
        await refreshToken();
        const res = await fetch(`${SETTINGS_API_URL}?_t=${Date.now()}`, { headers: authHeaders() });
        if (res.status === 401 || res.status === 403) return; // Not super admin, silently skip
        const settings = await res.json();
        if (settings.agentName) agentNameInput.value = settings.agentName;
        if (settings.activeModel) activeModelInput.value = settings.activeModel;
        const autoToggle = document.getElementById('autoActivateToggle');
        if (autoToggle) autoToggle.checked = !!settings.autoActivate;
    } catch (e) { console.error("Failed to fetch settings", e); }
}

async function saveSettings() {
    const agentName = agentNameInput.value.trim() || 'Max';
    const activeModel = activeModelInput.value;
    const autoToggle = document.getElementById('autoActivateToggle');
    const autoActivate = autoToggle ? autoToggle.checked : false;
    try {
        saveSettingsBtn.textContent = 'Saving...';
        saveSettingsBtn.disabled = true;
        await refreshToken();
        const res = await fetch(SETTINGS_API_URL, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ agentName, activeModel, autoActivate })
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
        await refreshToken();
        const res = await fetch(`${LINKS_API_URL}?_t=${Date.now()}`, { headers: authHeaders() });
        if (res.status === 401) { handleSignOut(); return; }
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
        const globalTag = link.global ? '<span class="global-tag">GLOBAL</span>' : '';

        const createdByText = link.createdBy ? ` | ${link.createdBy}` : '';
        const descriptionText = link.description 
            ? `<div class="link-description">${escapeHtml(link.description.length > 80 ? link.description.substring(0, 80) + '...' : link.description)}</div>` 
            : '';
        const div = document.createElement('div');
        div.className = `saved-link-item ${link.id === currentLinkId ? 'active' : ''}`;
        div.style.position = 'relative';
        const iconHtml = getIconSvg(link.icon || 'file-text', 18);
        div.innerHTML = `
            ${globalTag}
            <div class="link-icon" style="color: var(--max-color-accent);">${iconHtml}</div>
            <div class="link-info">
                <div class="link-name">${escapeHtml(link.configName || 'Untitled')}</div>
                ${descriptionText}
                <div class="link-meta">${activeCount} param${activeCount !== 1 ? 's' : ''} defined${escapeHtml(createdByText)}</div>
            </div>
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
    templateDescriptionInput.value = link.description || '';
    globalToggle.checked = !!link.global;
    if (requireAuthToggle) requireAuthToggle.checked = !!link.requireAuth;
    selectIcon(link.icon || 'file-text');

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

    // Show delete button only if creator or super admin
    const canDelete = !link.createdBy || 
                      (currentAppUser && (currentAppUser.role === 'super_admin' || currentAppUser.email === link.createdBy));
    deleteBtn.style.display = canDelete ? 'inline-flex' : 'none';
    saveBtn.textContent = 'Update';
    renderLinksList();
    updateUrl();
}

function resetForm() {
    currentLinkId = null;
    configNameInput.value = '';
    templateDescriptionInput.value = '';
    globalToggle.checked = false;
    if (requireAuthToggle) requireAuthToggle.checked = false;
    selectIcon('file-text');

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
    const description = templateDescriptionInput.value.trim();
    if (!description) {
        alert("Please enter a Description.");
        templateDescriptionInput.focus();
        return;
    }

    // Save ALL values (even if toggle is off) so they persist for toggling
    const payload = {
        configName,
        description,
        icon: selectedIcon,
        global: globalToggle.checked,
        requireAuth: requireAuthToggle ? requireAuthToggle.checked : false,
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
        await refreshToken();

        let res;
        if (currentLinkId) {
            res = await fetch(`${LINKS_API_URL}/${currentLinkId}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch(LINKS_API_URL, {
                method: 'POST',
                headers: authHeaders(),
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
        await refreshToken();
        const res = await fetch(`${LINKS_API_URL}/${currentLinkId}`, { method: 'DELETE', headers: authHeaders() });
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

// ========================================
// Users Management (Super Admin)
// ========================================
async function fetchUsers() {
    if (!usersTableBody) return;
    try {
        await refreshToken();
        const res = await fetch(`${USERS_API_URL}?_t=${Date.now()}`, { headers: authHeaders() });
        if (!res.ok) { usersTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">Failed to load users.</td></tr>'; return; }
        const users = await res.json();
        renderUsersTable(users);
    } catch (e) {
        console.error('Failed to fetch users', e);
        usersTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">Error loading users.</td></tr>';
    }
}

function renderUsersTable(users) {
    if (!usersTableBody) return;
    usersTableBody.innerHTML = '';
    
    if (!users || users.length === 0) {
        usersTableBody.innerHTML = '<tr><td colspan="5" class="empty-state">No users registered yet.</td></tr>';
        return;
    }

    const sorted = [...users].sort((a, b) => {
        if (a.role === 'super_admin') return -1;
        if (b.role === 'super_admin') return 1;
        return new Date(b.lastLoginAt || 0) - new Date(a.lastLoginAt || 0);
    });

    sorted.forEach(user => {
        const tr = document.createElement('tr');
        const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never';
        const isSuperAdmin = user.role === 'super_admin';
        const statusClass = user.active ? 'status-active' : 'status-inactive';
        const statusText = user.active ? 'Active' : 'Inactive';
        
        tr.innerHTML = `
            <td><strong>${escapeHtml(user.displayName || 'Unknown')}</strong></td>
            <td>${escapeHtml(user.email || '')}</td>
            <td><span class="role-badge ${user.role}">${user.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span></td>
            <td>${lastLogin}</td>
            <td>
                ${isSuperAdmin 
                    ? `<span class="status-badge status-active">Always Active</span>` 
                    : `<button class="status-toggle-btn ${statusClass}" data-uid="${user.uid}">${statusText}</button>`
                }
            </td>
        `;
        usersTableBody.appendChild(tr);
    });

    // Bind toggle buttons
    usersTableBody.querySelectorAll('.status-toggle-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid;
            try {
                await refreshToken();
                const res = await fetch(`${USERS_API_URL}/${uid}/active`, { method: 'PUT', headers: authHeaders() });
                if (res.ok) fetchUsers();
                else alert('Failed to toggle user status.');
            } catch (e) { alert('Error toggling user.'); }
        });
    });
}

// Run - Set up auth UI listeners, then wait for Firebase auth state
document.addEventListener('DOMContentLoaded', () => {
    if (googleSignInBtn) googleSignInBtn.addEventListener('click', handleSignIn);
    if (logoutBtn) logoutBtn.addEventListener('click', handleSignOut);
    if (headerLogoutBtn) headerLogoutBtn.addEventListener('click', handleSignOut);

    // Auto-activate toggle saves immediately
    const autoActivateToggle = document.getElementById('autoActivateToggle');
    if (autoActivateToggle) {
        autoActivateToggle.addEventListener('change', async () => {
            try {
                await refreshToken();
                await fetch(SETTINGS_API_URL, {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify({ autoActivate: autoActivateToggle.checked })
                });
            } catch (e) { console.error('Failed to save auto-activate setting', e); }
        });
    }
});
