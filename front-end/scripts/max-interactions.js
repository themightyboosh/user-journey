/**
 * M.AX Design System — Interactive Behaviors
 * Version 1.0.0
 * 
 * Handles all interactive behaviors, animations, and state management
 * for the M.AX chat interface.
 */

/* ==========================================================================
   CONFIGURATION & CONSTANTS
   ========================================================================== */

const MAX_CONFIG = {
  /** Maximum character count for chat input */
  MAX_INPUT_CHARACTERS: 4000,
  
  /** Animation durations (ms) matching CSS tokens */
  ANIMATION_DURATION: {
    FAST: 150,
    STANDARD: 200,
    MODERATE: 300,
    SLOW: 400
  },
  
  /** Debounce delay for scroll detection (ms) */
  SCROLL_DEBOUNCE_DELAY: 100,
  
  /** Toast notification auto-dismiss delay (ms) */
  TOAST_AUTO_DISMISS_DELAY: 5000,
  
  /** Typing indicator simulation delay (ms) */
  TYPING_INDICATOR_MIN_DELAY: 1000,
  TYPING_INDICATOR_MAX_DELAY: 3000,
  
  /** Local storage keys */
  STORAGE_KEYS: {
    SIDEBAR_STATE: 'max-sidebar-state',
    THEME_PREFERENCE: 'max-theme-preference',
    SETTINGS: 'max-settings'
  }
};

/* ==========================================================================
   UTILITY FUNCTIONS
   ========================================================================== */

/**
 * Generates a unique identifier for messages and elements
 * @returns {string} Unique ID string
 */
function maxGenerateUniqueIdentifier() {
  return `max-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Debounces a function call
 * @param {Function} functionToDebounce - Function to debounce
 * @param {number} delayInMilliseconds - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function maxDebounce(functionToDebounce, delayInMilliseconds) {
  let timeoutIdentifier;
  return function executedFunction(...arguments_) {
    clearTimeout(timeoutIdentifier);
    timeoutIdentifier = setTimeout(() => functionToDebounce.apply(this, arguments_), delayInMilliseconds);
  };
}

/**
 * Throttles a function call
 * @param {Function} functionToThrottle - Function to throttle
 * @param {number} limitInMilliseconds - Minimum time between calls
 * @returns {Function} Throttled function
 */
function maxThrottle(functionToThrottle, limitInMilliseconds) {
  let isWaiting = false;
  return function executedFunction(...arguments_) {
    if (!isWaiting) {
      functionToThrottle.apply(this, arguments_);
      isWaiting = true;
      setTimeout(() => { isWaiting = false; }, limitInMilliseconds);
    }
  };
}

/**
 * Formats a timestamp for display
 * @param {Date} dateObject - Date to format
 * @returns {string} Formatted time string (e.g., "2:34 PM")
 */
function maxFormatTimestampForDisplay(dateObject = new Date()) {
  return dateObject.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Escapes HTML special characters
 * @param {string} unsafeString - String to escape
 * @returns {string} Escaped string
 */
function maxEscapeHtmlCharacters(unsafeString) {
  const htmlEntityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return unsafeString.replace(/[&<>"']/g, character => htmlEntityMap[character]);
}

/* ==========================================================================
   SIDEBAR CONTROLLER
   ========================================================================== */

const MaxSidebarController = {
  /** @type {HTMLElement|null} */
  sidebarElement: null,
  
  /** @type {HTMLElement|null} */
  collapseToggleButton: null,
  
  /** @type {HTMLElement|null} */
  mobileMenuToggleButton: null,
  
  /**
   * Initializes the sidebar controller
   */
  initialize() {
    this.sidebarElement = document.getElementById('maxConversationSidebar');
    this.collapseToggleButton = document.getElementById('maxSidebarCollapseToggle');
    this.mobileMenuToggleButton = document.getElementById('maxMobileMenuToggle');
    
    if (!this.sidebarElement) return;
    
    // Load saved state
    const savedSidebarState = localStorage.getItem(MAX_CONFIG.STORAGE_KEYS.SIDEBAR_STATE);
    if (savedSidebarState) {
      this.sidebarElement.dataset.state = savedSidebarState;
    }
    
    // Bind event listeners
    this.collapseToggleButton?.addEventListener('click', () => this.toggleSidebarState());
    this.mobileMenuToggleButton?.addEventListener('click', () => this.toggleMobileSidebar());
    
    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', (event) => this.handleOutsideClick(event));
    
    // Handle escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isMobileView() && this.sidebarElement.dataset.state === 'expanded') {
        this.closeMobileSidebar();
      }
    });
  },
  
  /**
   * Toggles the sidebar between expanded and collapsed states
   */
  toggleSidebarState() {
    if (!this.sidebarElement) return;
    
    const currentState = this.sidebarElement.dataset.state;
    const newState = currentState === 'expanded' ? 'collapsed' : 'expanded';
    
    this.sidebarElement.dataset.state = newState;
    localStorage.setItem(MAX_CONFIG.STORAGE_KEYS.SIDEBAR_STATE, newState);
    
    // Update ARIA attributes
    this.collapseToggleButton?.setAttribute(
      'aria-label',
      newState === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'
    );
  },
  
  /**
   * Toggles the mobile sidebar
   */
  toggleMobileSidebar() {
    if (!this.sidebarElement) return;
    
    const currentState = this.sidebarElement.dataset.state;
    this.sidebarElement.dataset.state = currentState === 'expanded' ? 'collapsed' : 'expanded';
  },
  
  /**
   * Closes the mobile sidebar
   */
  closeMobileSidebar() {
    if (this.sidebarElement) {
      this.sidebarElement.dataset.state = 'collapsed';
    }
  },
  
  /**
   * Handles clicks outside the sidebar on mobile
   * @param {Event} clickEvent - Click event
   */
  handleOutsideClick(clickEvent) {
    if (!this.isMobileView() || !this.sidebarElement) return;
    
    const isClickInsideSidebar = this.sidebarElement.contains(clickEvent.target);
    const isClickOnToggleButton = this.mobileMenuToggleButton?.contains(clickEvent.target);
    
    if (!isClickInsideSidebar && !isClickOnToggleButton && this.sidebarElement.dataset.state === 'expanded') {
      this.closeMobileSidebar();
    }
  },
  
  /**
   * Checks if the viewport is in mobile view
   * @returns {boolean} True if in mobile view
   */
  isMobileView() {
    return window.innerWidth <= 1024;
  }
};

/* ==========================================================================
   CHAT INPUT CONTROLLER
   ========================================================================== */

const MaxChatInputController = {
  /** @type {HTMLTextAreaElement|null} */
  textareaElement: null,
  
  /** @type {HTMLButtonElement|null} */
  submitButton: null,
  
  /** @type {HTMLElement|null} */
  characterCountElement: null,
  
  /**
   * Initializes the chat input controller
   */
  initialize() {
    this.textareaElement = document.getElementById('maxChatInputTextarea');
    this.submitButton = document.getElementById('maxChatSubmitButton');
    this.characterCountElement = document.getElementById('maxCharacterCount');
    
    if (!this.textareaElement) return;
    
    // Bind event listeners
    this.textareaElement.addEventListener('input', () => this.handleInputChange());
    this.textareaElement.addEventListener('keydown', (event) => this.handleKeyboardShortcuts(event));
    this.submitButton?.addEventListener('click', () => this.handleSubmit());
    
    // Initial state
    this.updateCharacterCount();
    this.updateSubmitButtonState();
  },
  
  /**
   * Handles input changes in the textarea
   */
  handleInputChange() {
    this.autoResizeTextarea();
    this.updateCharacterCount();
    this.updateSubmitButtonState();
  },
  
  /**
   * Auto-resizes the textarea based on content
   */
  autoResizeTextarea() {
    if (!this.textareaElement) return;
    
    // Reset height to calculate new height
    this.textareaElement.style.height = 'auto';
    
    // Calculate new height (capped at max-height via CSS)
    const scrollHeight = this.textareaElement.scrollHeight;
    this.textareaElement.style.height = `${scrollHeight}px`;
  },
  
  /**
   * Updates the character count display
   */
  updateCharacterCount() {
    if (!this.textareaElement || !this.characterCountElement) return;
    
    const currentLength = this.textareaElement.value.length;
    this.characterCountElement.textContent = `${currentLength} / ${MAX_CONFIG.MAX_INPUT_CHARACTERS}`;
    
    // Add warning state if approaching limit
    if (currentLength >= MAX_CONFIG.MAX_INPUT_CHARACTERS * 0.9) {
      this.characterCountElement.style.color = 'var(--max-color-status-warning-default)';
    } else if (currentLength >= MAX_CONFIG.MAX_INPUT_CHARACTERS) {
      this.characterCountElement.style.color = 'var(--max-color-status-error-default)';
    } else {
      this.characterCountElement.style.color = '';
    }
  },
  
  /**
   * Updates the submit button's enabled/disabled state
   */
  updateSubmitButtonState() {
    if (!this.textareaElement || !this.submitButton) return;
    
    const hasContent = this.textareaElement.value.trim().length > 0;
    const isWithinLimit = this.textareaElement.value.length <= MAX_CONFIG.MAX_INPUT_CHARACTERS;
    
    this.submitButton.disabled = !hasContent || !isWithinLimit;
  },
  
  /**
   * Handles keyboard shortcuts for the input
   * @param {KeyboardEvent} keyboardEvent - Keyboard event
   */
  handleKeyboardShortcuts(keyboardEvent) {
    // Submit on Enter (without Shift)
    if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.handleSubmit();
    }
  },
  
  /**
   * Handles message submission
   */
  handleSubmit() {
    if (!this.textareaElement || this.submitButton?.disabled) return;
    
    const messageContent = this.textareaElement.value.trim();
    if (!messageContent) return;
    
    // Create and display user message
    MaxChatMessagesController.addUserMessage(messageContent);
    
    // Clear input
    this.clearInput();
    
    // Simulate AI response
    MaxChatMessagesController.simulateAiResponse();
  },
  
  /**
   * Clears the input textarea
   */
  clearInput() {
    if (!this.textareaElement) return;
    
    this.textareaElement.value = '';
    this.autoResizeTextarea();
    this.updateCharacterCount();
    this.updateSubmitButtonState();
    this.textareaElement.focus();
  },
  
  /**
   * Gets the current input value
   * @returns {string} Current input value
   */
  getValue() {
    return this.textareaElement?.value || '';
  },
  
  /**
   * Sets the input value
   * @param {string} newValue - New value to set
   */
  setValue(newValue) {
    if (!this.textareaElement) return;
    
    this.textareaElement.value = newValue;
    this.handleInputChange();
  }
};

/* ==========================================================================
   CHAT MESSAGES CONTROLLER
   ========================================================================== */

const MaxChatMessagesController = {
  /** @type {HTMLElement|null} */
  messagesListElement: null,
  
  /** @type {HTMLElement|null} */
  messagesScrollAreaElement: null,
  
  /** @type {HTMLElement|null} */
  typingIndicatorElement: null,
  
  /** @type {HTMLElement|null} */
  scrollToBottomButton: null,
  
  /** @type {HTMLElement|null} */
  welcomeStateElement: null,
  
  /**
   * Initializes the chat messages controller
   */
  initialize() {
    this.messagesListElement = document.getElementById('maxChatMessagesList');
    this.messagesScrollAreaElement = document.getElementById('maxChatMessagesScrollArea');
    this.typingIndicatorElement = document.getElementById('maxTypingIndicator');
    this.scrollToBottomButton = document.getElementById('maxScrollToBottomButton');
    this.welcomeStateElement = document.getElementById('maxChatWelcomeState');
    
    // Bind scroll event
    this.messagesScrollAreaElement?.addEventListener('scroll', 
      maxThrottle(() => this.handleScrollPositionChange(), MAX_CONFIG.SCROLL_DEBOUNCE_DELAY)
    );
    
    // Scroll to bottom button click
    this.scrollToBottomButton?.addEventListener('click', () => this.scrollToBottom());
    
    // Initial scroll position check
    this.handleScrollPositionChange();
  },
  
  /**
   * Adds a user message to the chat
   * @param {string} messageContent - Message content
   * @returns {string} Message ID
   */
  addUserMessage(messageContent) {
    if (!this.messagesListElement) return null;
    
    // Hide welcome state
    if (this.welcomeStateElement) {
      this.welcomeStateElement.style.display = 'none';
    }
    
    const messageId = maxGenerateUniqueIdentifier();
    const timestamp = maxFormatTimestampForDisplay();
    
    const messageHtml = `
      <div class="max-message-bubble-user-container max-animation-message-appear-user" data-message-id="${messageId}">
        <div class="max-message-bubble-user-content">
          <div class="max-message-bubble-user-text">${maxEscapeHtmlCharacters(messageContent)}</div>
        </div>
        <div class="max-message-bubble-user-metadata">
          <span class="max-message-bubble-user-timestamp">${timestamp}</span>
          <span class="max-message-bubble-user-status-indicator" aria-label="Delivered">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
        </div>
      </div>
    `;
    
    // Insert before typing indicator if visible
    if (this.typingIndicatorElement && this.typingIndicatorElement.style.display !== 'none') {
      this.typingIndicatorElement.insertAdjacentHTML('beforebegin', messageHtml);
    } else {
      this.messagesListElement.insertAdjacentHTML('beforeend', messageHtml);
    }
    
    this.scrollToBottom();
    
    return messageId;
  },
  
  /**
   * Adds an AI message to the chat
   * @param {string} messageContent - Message content (can include HTML)
   * @returns {string} Message ID
   */
  addAiMessage(messageContent) {
    if (!this.messagesListElement) return null;
    
    const messageId = maxGenerateUniqueIdentifier();
    const timestamp = maxFormatTimestampForDisplay();
    
    const messageHtml = `
      <div class="max-message-bubble-ai-container max-animation-message-appear-ai" data-message-id="${messageId}">
        <div class="max-message-bubble-ai-avatar">
          <div class="max-message-bubble-ai-avatar-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
        </div>
        <div class="max-message-bubble-ai-content">
          <div class="max-message-bubble-ai-header">
            <span class="max-message-bubble-ai-header-label">M.AX</span>
          </div>
          <div class="max-message-bubble-ai-text">${messageContent}</div>
          <div class="max-message-bubble-ai-actions">
            <button class="max-button-tertiary max-button-size-small" aria-label="Copy response" onclick="MaxChatMessagesController.copyMessageContent('${messageId}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <span>Copy</span>
            </button>
            <button class="max-button-tertiary max-button-size-small" aria-label="Regenerate response">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              <span>Regenerate</span>
            </button>
            <div class="max-message-bubble-ai-feedback-controls">
              <button class="max-button-icon-only max-button-size-small max-button-tertiary" aria-label="Good response">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                </svg>
              </button>
              <button class="max-button-icon-only max-button-size-small max-button-tertiary" aria-label="Poor response">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div class="max-message-bubble-ai-metadata">
          <span class="max-message-bubble-ai-timestamp">${timestamp}</span>
        </div>
      </div>
    `;
    
    this.messagesListElement.insertAdjacentHTML('beforeend', messageHtml);
    this.scrollToBottom();
    
    return messageId;
  },
  
  /**
   * Shows the typing indicator
   */
  showTypingIndicator() {
    if (this.typingIndicatorElement) {
      this.typingIndicatorElement.style.display = 'flex';
      this.scrollToBottom();
    }
  },
  
  /**
   * Hides the typing indicator
   */
  hideTypingIndicator() {
    if (this.typingIndicatorElement) {
      this.typingIndicatorElement.style.display = 'none';
    }
  },
  
  /**
   * Simulates an AI response (demo functionality)
   */
  simulateAiResponse() {
    this.showTypingIndicator();
    
    const responseDelay = Math.random() * 
      (MAX_CONFIG.TYPING_INDICATOR_MAX_DELAY - MAX_CONFIG.TYPING_INDICATOR_MIN_DELAY) + 
      MAX_CONFIG.TYPING_INDICATOR_MIN_DELAY;
    
    setTimeout(() => {
      this.hideTypingIndicator();
      
      // Demo response
      const responses = [
        `<p>I understand your question. Let me help you with that.</p>
         <p>Based on the information provided, here are some key points to consider:</p>
         <ul>
           <li>This is a demonstration of the M.AX interface</li>
           <li>The design system includes comprehensive components</li>
           <li>All interactions are animated smoothly</li>
         </ul>
         <p>Is there anything specific you'd like me to elaborate on?</p>`,
        
        `<p>That's an interesting question! Here's what I can tell you:</p>
         <p>The M.AX design system is built with accessibility and performance in mind. It features:</p>
         <ul>
           <li><strong>Semantic naming</strong> — Every class follows a clear naming convention</li>
           <li><strong>Dark-first design</strong> — Optimized for extended use</li>
           <li><strong>Responsive layouts</strong> — Works across all device sizes</li>
         </ul>
         <p>Would you like to explore any particular component in detail?</p>`,
        
        `<p>Great question! I'm here to assist you.</p>
         <p>This interface demonstrates a modern AI chat experience with:</p>
         <ul>
           <li>Smooth animations and transitions</li>
           <li>Comprehensive component library</li>
           <li>Professional, enterprise-grade design</li>
         </ul>
         <p>Feel free to ask me anything else!</p>`
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      this.addAiMessage(randomResponse);
      
    }, responseDelay);
  },
  
  /**
   * Copies message content to clipboard
   * @param {string} messageId - ID of the message to copy
   */
  copyMessageContent(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"] .max-message-bubble-ai-text`);
    if (!messageElement) return;
    
    const textContent = messageElement.innerText;
    
    navigator.clipboard.writeText(textContent).then(() => {
      MaxToastController.showToast({
        variant: 'success',
        title: 'Message copied',
        message: 'The response has been copied to your clipboard.'
      });
    }).catch(() => {
      MaxToastController.showToast({
        variant: 'error',
        title: 'Copy failed',
        message: 'Unable to copy to clipboard. Please try again.'
      });
    });
  },
  
  /**
   * Handles scroll position changes
   */
  handleScrollPositionChange() {
    if (!this.messagesScrollAreaElement || !this.scrollToBottomButton) return;
    
    const { scrollTop, scrollHeight, clientHeight } = this.messagesScrollAreaElement;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    this.scrollToBottomButton.style.display = isNearBottom ? 'none' : 'flex';
  },
  
  /**
   * Scrolls to the bottom of the messages
   */
  scrollToBottom() {
    if (!this.messagesScrollAreaElement) return;
    
    this.messagesScrollAreaElement.scrollTo({
      top: this.messagesScrollAreaElement.scrollHeight,
      behavior: 'smooth'
    });
  }
};

/* ==========================================================================
   MODAL CONTROLLER
   ========================================================================== */

const MaxModalController = {
  /** @type {Map<string, HTMLElement>} */
  activeModals: new Map(),
  
  /**
   * Opens a modal dialog
   * @param {string} modalId - ID of the modal backdrop element
   */
  openModal(modalId) {
    const modalBackdrop = document.getElementById(modalId);
    if (!modalBackdrop) return;
    
    // Show modal
    modalBackdrop.style.display = 'flex';
    this.activeModals.set(modalId, modalBackdrop);
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Focus first focusable element
    const firstFocusable = modalBackdrop.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    firstFocusable?.focus();
    
    // Add escape key listener
    const escapeHandler = (event) => {
      if (event.key === 'Escape') {
        this.closeModal(modalId);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
    
    // Close on backdrop click
    modalBackdrop.addEventListener('click', (event) => {
      if (event.target === modalBackdrop) {
        this.closeModal(modalId);
      }
    });
  },
  
  /**
   * Closes a modal dialog
   * @param {string} modalId - ID of the modal backdrop element
   */
  closeModal(modalId) {
    const modalBackdrop = document.getElementById(modalId);
    if (!modalBackdrop) return;
    
    // Add exit animation
    const modalContent = modalBackdrop.querySelector('.max-modal-dialog-container');
    if (modalContent) {
      modalContent.style.animation = 'max-animation-modal-content-exit var(--max-animation-duration-standard) var(--max-animation-easing-accelerate) forwards';
    }
    modalBackdrop.style.animation = 'max-animation-modal-backdrop-exit var(--max-animation-duration-standard) var(--max-animation-easing-accelerate) forwards';
    
    // Hide after animation
    setTimeout(() => {
      modalBackdrop.style.display = 'none';
      modalBackdrop.style.animation = '';
      if (modalContent) {
        modalContent.style.animation = '';
      }
      this.activeModals.delete(modalId);
      
      // Restore body scroll if no modals open
      if (this.activeModals.size === 0) {
        document.body.style.overflow = '';
      }
    }, MAX_CONFIG.ANIMATION_DURATION.STANDARD);
  },
  
  /**
   * Closes all open modals
   */
  closeAllModals() {
    this.activeModals.forEach((_, modalId) => this.closeModal(modalId));
  }
};

/* ==========================================================================
   DROPDOWN CONTROLLER
   ========================================================================== */

const MaxDropdownController = {
  /** @type {HTMLElement|null} */
  activeDropdown: null,
  
  /** @type {HTMLElement|null} */
  activeTrigger: null,
  
  /**
   * Initializes dropdown functionality
   */
  initialize() {
    // Close dropdowns on outside click
    document.addEventListener('click', (event) => {
      if (this.activeDropdown && !this.activeDropdown.contains(event.target) && 
          !this.activeTrigger?.contains(event.target)) {
        this.closeDropdown();
      }
    });
    
    // Close on escape
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.activeDropdown) {
        this.closeDropdown();
      }
    });
  },
  
  /**
   * Opens a dropdown
   * @param {HTMLElement} triggerElement - Element that triggered the dropdown
   * @param {string} dropdownId - ID of the dropdown element
   */
  openDropdown(triggerElement, dropdownId) {
    // Close existing dropdown
    if (this.activeDropdown) {
      this.closeDropdown();
    }
    
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    // Position dropdown
    const triggerRect = triggerElement.getBoundingClientRect();
    dropdown.style.top = `${triggerRect.bottom + 8}px`;
    dropdown.style.left = `${triggerRect.left}px`;
    
    // Show dropdown
    dropdown.style.display = 'block';
    
    this.activeDropdown = dropdown;
    this.activeTrigger = triggerElement;
  },
  
  /**
   * Closes the active dropdown
   */
  closeDropdown() {
    if (!this.activeDropdown) return;
    
    this.activeDropdown.style.display = 'none';
    this.activeDropdown = null;
    this.activeTrigger = null;
  },
  
  /**
   * Toggles a dropdown
   * @param {HTMLElement} triggerElement - Element that triggered the dropdown
   * @param {string} dropdownId - ID of the dropdown element
   */
  toggleDropdown(triggerElement, dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    
    if (this.activeDropdown === dropdown) {
      this.closeDropdown();
    } else {
      this.openDropdown(triggerElement, dropdownId);
    }
  }
};

/* ==========================================================================
   TOAST NOTIFICATION CONTROLLER
   ========================================================================== */

const MaxToastController = {
  /** @type {HTMLElement|null} */
  toastStackElement: null,
  
  /** @type {Map<string, {element: HTMLElement, timeoutId: number}>} */
  activeToasts: new Map(),
  
  /**
   * Initializes the toast controller
   */
  initialize() {
    this.toastStackElement = document.getElementById('maxToastStack');
  },
  
  /**
   * Shows a toast notification
   * @param {Object} options - Toast options
   * @param {string} options.variant - Toast variant (success, warning, error, info)
   * @param {string} options.title - Toast title
   * @param {string} [options.message] - Toast message
   * @param {number} [options.duration] - Auto-dismiss duration in ms
   * @returns {string} Toast ID
   */
  showToast({ variant = 'info', title, message, duration = MAX_CONFIG.TOAST_AUTO_DISMISS_DELAY }) {
    if (!this.toastStackElement) return null;
    
    const toastId = maxGenerateUniqueIdentifier();
    
    const iconSvg = this.getIconForVariant(variant);
    
    const toastHtml = `
      <div class="max-toast-notification-container max-toast-notification-variant-${variant} max-animation-toast-enter" data-toast-id="${toastId}">
        <div class="max-toast-notification-icon">
          ${iconSvg}
        </div>
        <div class="max-toast-notification-content">
          <span class="max-toast-notification-title">${maxEscapeHtmlCharacters(title)}</span>
          ${message ? `<span class="max-toast-notification-message">${maxEscapeHtmlCharacters(message)}</span>` : ''}
        </div>
        <button class="max-button-icon-only max-button-size-small max-button-tertiary max-toast-notification-dismiss-button" aria-label="Dismiss" onclick="MaxToastController.dismissToast('${toastId}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;
    
    this.toastStackElement.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastElement = this.toastStackElement.querySelector(`[data-toast-id="${toastId}"]`);
    
    // Auto-dismiss
    const timeoutId = setTimeout(() => this.dismissToast(toastId), duration);
    
    this.activeToasts.set(toastId, { element: toastElement, timeoutId });
    
    return toastId;
  },
  
  /**
   * Dismisses a toast notification
   * @param {string} toastId - ID of the toast to dismiss
   */
  dismissToast(toastId) {
    const toastData = this.activeToasts.get(toastId);
    if (!toastData) return;
    
    const { element, timeoutId } = toastData;
    
    // Clear auto-dismiss timeout
    clearTimeout(timeoutId);
    
    // Add exit animation
    element.classList.remove('max-animation-toast-enter');
    element.classList.add('max-animation-toast-exit');
    
    // Remove after animation
    setTimeout(() => {
      element.remove();
      this.activeToasts.delete(toastId);
    }, MAX_CONFIG.ANIMATION_DURATION.STANDARD);
  },
  
  /**
   * Gets the SVG icon for a toast variant
   * @param {string} variant - Toast variant
   * @returns {string} SVG markup
   */
  getIconForVariant(variant) {
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    return icons[variant] || icons.info;
  }
};

/* ==========================================================================
   SETTINGS CONTROLLER
   ========================================================================== */

const MaxSettingsController = {
  /** @type {HTMLElement|null} */
  settingsButton: null,
  
  /** @type {HTMLElement|null} */
  settingsModalCloseButton: null,
  
  /**
   * Initializes the settings controller
   */
  initialize() {
    this.settingsButton = document.getElementById('maxSettingsButton');
    this.settingsModalCloseButton = document.getElementById('maxSettingsModalClose');
    
    // Open settings modal
    this.settingsButton?.addEventListener('click', () => {
      MaxModalController.openModal('maxSettingsModalBackdrop');
    });
    
    // Close settings modal
    this.settingsModalCloseButton?.addEventListener('click', () => {
      MaxModalController.closeModal('maxSettingsModalBackdrop');
    });
    
    // Save settings
    document.getElementById('maxSettingsSaveButton')?.addEventListener('click', () => {
      this.saveSettings();
      MaxModalController.closeModal('maxSettingsModalBackdrop');
      MaxToastController.showToast({
        variant: 'success',
        title: 'Settings saved',
        message: 'Your preferences have been updated.'
      });
    });
    
    // Reset settings
    document.getElementById('maxSettingsResetButton')?.addEventListener('click', () => {
      this.resetSettings();
      MaxToastController.showToast({
        variant: 'info',
        title: 'Settings reset',
        message: 'All settings have been restored to defaults.'
      });
    });
  },
  
  /**
   * Saves current settings to local storage
   */
  saveSettings() {
    // Collect settings from form
    const settings = {
      theme: document.querySelector('.max-settings-section select[value]')?.value || 'dark',
      // Add more settings as needed
    };
    
    localStorage.setItem(MAX_CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },
  
  /**
   * Resets settings to defaults
   */
  resetSettings() {
    localStorage.removeItem(MAX_CONFIG.STORAGE_KEYS.SETTINGS);
    // Reset form elements to defaults
  },
  
  /**
   * Loads settings from local storage
   */
  loadSettings() {
    const savedSettings = localStorage.getItem(MAX_CONFIG.STORAGE_KEYS.SETTINGS);
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        // Apply settings to form elements
      } catch (error) {
        console.warn('Failed to parse saved settings:', error);
      }
    }
  }
};

/* ==========================================================================
   MODEL SELECTOR CONTROLLER
   ========================================================================== */

const MaxModelSelectorController = {
  /** @type {HTMLElement|null} */
  selectorButton: null,
  
  /** @type {string} */
  currentModel: 'gemini-pro',
  
  /**
   * Initializes the model selector
   */
  initialize() {
    this.selectorButton = document.getElementById('maxModelSelectorButton');
    
    // Toggle dropdown
    this.selectorButton?.addEventListener('click', () => {
      MaxDropdownController.toggleDropdown(this.selectorButton, 'maxModelSelectorDropdown');
    });
    
    // Handle model selection
    document.querySelectorAll('#maxModelSelectorDropdown .max-dropdown-menu-item[data-model]').forEach(item => {
      item.addEventListener('click', () => {
        const model = item.dataset.model;
        if (model) {
          this.selectModel(model);
        }
      });
    });
  },
  
  /**
   * Selects a model
   * @param {string} modelId - ID of the model to select
   */
  selectModel(modelId) {
    this.currentModel = modelId;
    
    // Update button text
    const modelNames = {
      'gemini-pro': 'Gemini Pro',
      'gemini-pro-vision': 'Gemini Pro Vision',
      'gemini-ultra': 'Gemini Ultra'
    };
    
    const buttonText = this.selectorButton?.querySelector('span');
    if (buttonText) {
      buttonText.textContent = modelNames[modelId] || modelId;
    }
    
    // Update selected state in dropdown
    document.querySelectorAll('#maxModelSelectorDropdown .max-dropdown-menu-item[data-model]').forEach(item => {
      const isSelected = item.dataset.model === modelId;
      item.classList.toggle('max-dropdown-menu-item-selected', isSelected);
      
      // Toggle checkmark visibility
      const checkmark = item.querySelector('.max-dropdown-menu-item-checkmark');
      if (checkmark) {
        checkmark.style.display = isSelected ? 'block' : 'none';
      }
    });
    
    // Close dropdown
    MaxDropdownController.closeDropdown();
    
    // Show toast
    MaxToastController.showToast({
      variant: 'info',
      title: 'Model changed',
      message: `Now using ${modelNames[modelId] || modelId}`
    });
  }
};

/* ==========================================================================
   NEW CHAT CONTROLLER
   ========================================================================== */

const MaxNewChatController = {
  /** @type {HTMLElement|null} */
  newChatButton: null,
  
  /**
   * Initializes the new chat controller
   */
  initialize() {
    this.newChatButton = document.getElementById('maxNewChatButton');
    
    this.newChatButton?.addEventListener('click', () => this.startNewChat());
  },
  
  /**
   * Starts a new chat conversation
   */
  startNewChat() {
    // Clear messages
    const messagesList = document.getElementById('maxChatMessagesList');
    if (messagesList) {
      messagesList.innerHTML = '';
    }
    
    // Show welcome state
    const welcomeState = document.getElementById('maxChatWelcomeState');
    if (welcomeState) {
      welcomeState.style.display = 'flex';
    }
    
    // Hide typing indicator
    MaxChatMessagesController.hideTypingIndicator();
    
    // Clear input
    MaxChatInputController.clearInput();
    
    // Update header title
    const headerTitle = document.querySelector('.max-main-content-header-title');
    if (headerTitle) {
      headerTitle.textContent = 'New Conversation';
    }
    
    // Close mobile sidebar
    if (MaxSidebarController.isMobileView()) {
      MaxSidebarController.closeMobileSidebar();
    }
    
    // Show toast
    MaxToastController.showToast({
      variant: 'success',
      title: 'New conversation',
      message: 'Ready to start a new chat.'
    });
  }
};

/* ==========================================================================
   TOOLTIP CONTROLLER
   ========================================================================== */

const MaxTooltipController = {
  /** @type {HTMLElement|null} */
  tooltipElement: null,
  
  /**
   * Initializes tooltip functionality
   */
  initialize() {
    // Create tooltip element
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'max-tooltip-content';
    this.tooltipElement.style.cssText = `
      position: fixed;
      display: none;
      padding: 8px 12px;
      background-color: var(--max-color-surface-secondary-elevated);
      border: 1px solid var(--max-color-border-primary-default);
      border-radius: var(--max-radius-medium);
      font-size: var(--max-font-size-caption-large);
      color: var(--max-color-text-primary-default);
      box-shadow: var(--max-shadow-elevation-medium);
      z-index: var(--max-z-index-tooltip);
      pointer-events: none;
      white-space: nowrap;
    `;
    document.body.appendChild(this.tooltipElement);
    
    // Add event listeners for tooltip triggers
    document.addEventListener('mouseenter', (event) => {
      const target = event.target.closest('[data-tooltip]');
      if (target) {
        this.showTooltip(target);
      }
    }, true);
    
    document.addEventListener('mouseleave', (event) => {
      const target = event.target.closest('[data-tooltip]');
      if (target) {
        this.hideTooltip();
      }
    }, true);
  },
  
  /**
   * Shows a tooltip
   * @param {HTMLElement} triggerElement - Element with data-tooltip attribute
   */
  showTooltip(triggerElement) {
    const text = triggerElement.dataset.tooltip;
    const position = triggerElement.dataset.tooltipPosition || 'top';
    
    if (!text || !this.tooltipElement) return;
    
    this.tooltipElement.textContent = text;
    this.tooltipElement.style.display = 'block';
    
    // Position tooltip
    const triggerRect = triggerElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    
    let top, left;
    
    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - 8;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + 8;
        break;
    }
    
    this.tooltipElement.style.top = `${top}px`;
    this.tooltipElement.style.left = `${left}px`;
    
    // Add animation
    this.tooltipElement.style.animation = 'max-animation-tooltip-enter var(--max-animation-duration-fast) var(--max-animation-easing-decelerate)';
  },
  
  /**
   * Hides the tooltip
   */
  hideTooltip() {
    if (this.tooltipElement) {
      this.tooltipElement.style.display = 'none';
    }
  }
};

/* ==========================================================================
   WELCOME STATE CONTROLLER
   ========================================================================== */

const MaxWelcomeStateController = {
  /**
   * Initializes welcome state functionality
   */
  initialize() {
    // Handle suggestion chip clicks
    document.querySelectorAll('.max-chat-welcome-state-suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const suggestionText = chip.querySelector('span')?.textContent;
        if (suggestionText) {
          MaxChatInputController.setValue(suggestionText);
          document.getElementById('maxChatInputTextarea')?.focus();
        }
      });
    });
  }
};

/* ==========================================================================
   CODE BLOCK CONTROLLER
   ========================================================================== */

const MaxCodeBlockController = {
  /**
   * Initializes code block functionality
   */
  initialize() {
    // Handle copy button clicks
    document.addEventListener('click', (event) => {
      const copyButton = event.target.closest('.max-code-block-header-copy-button');
      if (copyButton) {
        this.copyCodeBlock(copyButton);
      }
    });
  },
  
  /**
   * Copies code block content to clipboard
   * @param {HTMLElement} copyButton - The copy button element
   */
  copyCodeBlock(copyButton) {
    const codeBlock = copyButton.closest('.max-code-block-container');
    const codeElement = codeBlock?.querySelector('.max-code-block-code');
    
    if (!codeElement) return;
    
    const codeText = codeElement.textContent;
    
    navigator.clipboard.writeText(codeText).then(() => {
      // Visual feedback
      const originalIcon = copyButton.innerHTML;
      copyButton.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      `;
      
      setTimeout(() => {
        copyButton.innerHTML = originalIcon;
      }, 2000);
      
      MaxToastController.showToast({
        variant: 'success',
        title: 'Code copied',
        message: 'The code has been copied to your clipboard.'
      });
    }).catch(() => {
      MaxToastController.showToast({
        variant: 'error',
        title: 'Copy failed',
        message: 'Unable to copy code. Please try again.'
      });
    });
  }
};

/* ==========================================================================
   CONVERSATION LIST CONTROLLER
   ========================================================================== */

const MaxConversationListController = {
  /**
   * Initializes conversation list functionality
   */
  initialize() {
    // Handle conversation item clicks
    document.querySelectorAll('.max-conversation-sidebar-list-item').forEach(item => {
      item.addEventListener('click', (event) => {
        // Don't trigger if clicking on actions
        if (event.target.closest('.max-conversation-sidebar-list-item-actions')) return;
        
        this.selectConversation(item);
      });
    });
  },
  
  /**
   * Selects a conversation
   * @param {HTMLElement} conversationItem - The conversation item element
   */
  selectConversation(conversationItem) {
    // Update active state
    document.querySelectorAll('.max-conversation-sidebar-list-item').forEach(item => {
      item.classList.remove('max-conversation-sidebar-list-item-active');
    });
    conversationItem.classList.add('max-conversation-sidebar-list-item-active');
    
    // Update header title
    const title = conversationItem.querySelector('.max-conversation-sidebar-list-item-title')?.textContent;
    const headerTitle = document.querySelector('.max-main-content-header-title');
    if (headerTitle && title) {
      headerTitle.textContent = title;
    }
    
    // Close mobile sidebar
    if (MaxSidebarController.isMobileView()) {
      MaxSidebarController.closeMobileSidebar();
    }
  }
};

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */

/**
 * Initializes all M.AX controllers when the DOM is ready
 */
function maxInitializeApplication() {
  // Initialize all controllers
  MaxSidebarController.initialize();
  MaxChatInputController.initialize();
  MaxChatMessagesController.initialize();
  MaxDropdownController.initialize();
  MaxToastController.initialize();
  MaxSettingsController.initialize();
  MaxModelSelectorController.initialize();
  MaxNewChatController.initialize();
  MaxTooltipController.initialize();
  MaxWelcomeStateController.initialize();
  MaxCodeBlockController.initialize();
  MaxConversationListController.initialize();
  
  // Load saved settings
  MaxSettingsController.loadSettings();
  
  console.log('M.AX Design System initialized successfully');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', maxInitializeApplication);
} else {
  maxInitializeApplication();
}

/* ==========================================================================
   EXPORT FOR EXTERNAL ACCESS (if using modules)
   ========================================================================== */

// Make controllers globally accessible for onclick handlers and debugging
window.MaxSidebarController = MaxSidebarController;
window.MaxChatInputController = MaxChatInputController;
window.MaxChatMessagesController = MaxChatMessagesController;
window.MaxModalController = MaxModalController;
window.MaxDropdownController = MaxDropdownController;
window.MaxToastController = MaxToastController;
window.MaxSettingsController = MaxSettingsController;
window.MaxModelSelectorController = MaxModelSelectorController;
window.MaxNewChatController = MaxNewChatController;
window.MaxTooltipController = MaxTooltipController;
window.MaxCodeBlockController = MaxCodeBlockController;
