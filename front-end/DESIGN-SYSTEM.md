# M.AX Design System

> A comprehensive design system for building sophisticated, AI-powered conversational interfaces. Inspired by enterprise-grade design principles with a focus on clarity, accessibility, and professional aesthetics.

---

## Table of Contents

1. [Brand Identity](#brand-identity)
2. [Design Philosophy](#design-philosophy)
3. [Color System](#color-system)
4. [Typography](#typography)
5. [Spacing & Layout](#spacing--layout)
6. [Component Library](#component-library)
7. [Animation System](#animation-system)
8. [Accessibility Guidelines](#accessibility-guidelines)
9. [Implementation Reference](#implementation-reference)

---

## Brand Identity

### Name Origin

**M.AX** represents:
- **M** — Machine Intelligence
- **AX** — Augmented Experience

### Brand Voice

- **Precise**: Communication is clear and unambiguous
- **Intelligent**: Responses demonstrate deep understanding
- **Trustworthy**: Consistent, reliable, and secure
- **Efficient**: Optimized for productivity

### Logo Usage

The M.AX wordmark uses the primary typeface in medium weight with a distinctive period separator.

```
Typography: Inter Medium
Styling: M.AX (period after M, full caps AX)
Minimum Size: 14px
Clear Space: 8px minimum on all sides
```

---

## Design Philosophy

### Core Principles

#### 1. Semantic Clarity
Every element name should clearly communicate its purpose, state, and context.

#### 2. Dark-First Design
Optimized for extended use with reduced eye strain and professional appearance.

#### 3. Information Density
Maximize useful content while maintaining readability and visual hierarchy.

#### 4. Progressive Disclosure
Reveal complexity gradually based on user interaction and context.

#### 5. Responsive Intelligence
Adapt gracefully across devices and interaction modes.

---

## Color System

### Color Naming Convention

```
--max-color-[category]-[variant]-[state]

Categories: surface, text, border, accent, status
Variants: primary, secondary, tertiary, inverse
States: default, hover, active, disabled, focus
```

### Core Palette

#### Surface Colors (Backgrounds)

| Token | Hex | Usage |
|-------|-----|-------|
| `--max-color-surface-application-background` | `#0a0c10` | App root background |
| `--max-color-surface-primary-default` | `#12141a` | Primary containers |
| `--max-color-surface-primary-elevated` | `#1a1d26` | Elevated panels |
| `--max-color-surface-secondary-default` | `#1e222c` | Secondary containers |
| `--max-color-surface-secondary-elevated` | `#252a36` | Elevated secondary |
| `--max-color-surface-tertiary-default` | `#2a3040` | Tertiary elements |
| `--max-color-surface-interactive-hover` | `#2f364a` | Hover states |
| `--max-color-surface-interactive-active` | `#363e54` | Active/pressed states |
| `--max-color-surface-overlay-backdrop` | `rgba(0,0,0,0.75)` | Modal backdrops |

#### Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--max-color-text-primary-default` | `#f4f5f7` | Primary content |
| `--max-color-text-secondary-default` | `#a8b1c4` | Secondary content |
| `--max-color-text-tertiary-default` | `#6b7590` | Tertiary/muted content |
| `--max-color-text-disabled-default` | `#4a5268` | Disabled text |
| `--max-color-text-inverse-default` | `#0a0c10` | On light backgrounds |
| `--max-color-text-link-default` | `#4da6ff` | Interactive links |
| `--max-color-text-link-hover` | `#80c0ff` | Link hover state |

#### Border Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--max-color-border-primary-default` | `#2a3040` | Primary borders |
| `--max-color-border-primary-subtle` | `#1e222c` | Subtle dividers |
| `--max-color-border-secondary-default` | `#363e54` | Emphasized borders |
| `--max-color-border-focus-ring` | `#4da6ff` | Focus indicators |
| `--max-color-border-interactive-hover` | `#4a5268` | Hover borders |

#### Accent Colors (Brand)

| Token | Hex | Usage |
|-------|-----|-------|
| `--max-color-accent-primary-default` | `#3d8eff` | Primary actions |
| `--max-color-accent-primary-hover` | `#5a9fff` | Primary hover |
| `--max-color-accent-primary-active` | `#2a7ae6` | Primary active |
| `--max-color-accent-primary-subtle` | `rgba(61,142,255,0.15)` | Subtle highlights |
| `--max-color-accent-secondary-default` | `#00d4aa` | Secondary accent |
| `--max-color-accent-secondary-hover` | `#33debb` | Secondary hover |
| `--max-color-accent-tertiary-default` | `#a78bfa` | Tertiary accent |

#### Status Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--max-color-status-success-default` | `#34d399` | Success states |
| `--max-color-status-success-subtle` | `rgba(52,211,153,0.15)` | Success backgrounds |
| `--max-color-status-warning-default` | `#fbbf24` | Warning states |
| `--max-color-status-warning-subtle` | `rgba(251,191,36,0.15)` | Warning backgrounds |
| `--max-color-status-error-default` | `#f87171` | Error states |
| `--max-color-status-error-subtle` | `rgba(248,113,113,0.15)` | Error backgrounds |
| `--max-color-status-info-default` | `#60a5fa` | Info states |
| `--max-color-status-info-subtle` | `rgba(96,165,250,0.15)` | Info backgrounds |

#### AI-Specific Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--max-color-ai-thinking-primary` | `#a78bfa` | AI processing indicator |
| `--max-color-ai-thinking-secondary` | `#c4b5fd` | Secondary thinking |
| `--max-color-ai-response-gradient-start` | `#3d8eff` | Response bubble gradient |
| `--max-color-ai-response-gradient-end` | `#00d4aa` | Response bubble gradient end |
| `--max-color-ai-typing-cursor` | `#4da6ff` | Typing indicator cursor |

---

## Typography

### Font Stack

```css
--max-font-family-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--max-font-family-monospace: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
```

### Type Scale

| Token | Size | Line Height | Letter Spacing | Usage |
|-------|------|-------------|----------------|-------|
| `--max-typography-display-large` | 48px | 1.1 | -0.02em | Hero headers |
| `--max-typography-display-medium` | 36px | 1.15 | -0.015em | Page titles |
| `--max-typography-display-small` | 28px | 1.2 | -0.01em | Section headers |
| `--max-typography-heading-large` | 24px | 1.25 | -0.005em | Major headings |
| `--max-typography-heading-medium` | 20px | 1.3 | 0 | Subheadings |
| `--max-typography-heading-small` | 18px | 1.35 | 0 | Minor headings |
| `--max-typography-body-large` | 16px | 1.6 | 0 | Primary body text |
| `--max-typography-body-medium` | 14px | 1.5 | 0 | Secondary body text |
| `--max-typography-body-small` | 13px | 1.45 | 0 | Tertiary text |
| `--max-typography-caption-large` | 12px | 1.4 | 0.01em | Large captions |
| `--max-typography-caption-medium` | 11px | 1.35 | 0.015em | Standard captions |
| `--max-typography-caption-small` | 10px | 1.3 | 0.02em | Micro text |
| `--max-typography-code-large` | 14px | 1.5 | 0 | Code blocks |
| `--max-typography-code-medium` | 13px | 1.45 | 0 | Inline code |
| `--max-typography-code-small` | 12px | 1.4 | 0 | Small code |

### Font Weights

| Token | Weight | Usage |
|-------|--------|-------|
| `--max-font-weight-regular` | 400 | Body text |
| `--max-font-weight-medium` | 500 | Emphasis, labels |
| `--max-font-weight-semibold` | 600 | Headings, buttons |
| `--max-font-weight-bold` | 700 | Strong emphasis |

---

## Spacing & Layout

### Spacing Scale

```css
--max-spacing-none: 0;
--max-spacing-micro: 2px;
--max-spacing-tiny: 4px;
--max-spacing-small: 8px;
--max-spacing-medium: 12px;
--max-spacing-standard: 16px;
--max-spacing-large: 20px;
--max-spacing-xlarge: 24px;
--max-spacing-xxlarge: 32px;
--max-spacing-xxxlarge: 40px;
--max-spacing-huge: 48px;
--max-spacing-massive: 64px;
--max-spacing-gigantic: 80px;
```

### Border Radius

```css
--max-radius-none: 0;
--max-radius-small: 4px;
--max-radius-medium: 8px;
--max-radius-large: 12px;
--max-radius-xlarge: 16px;
--max-radius-xxlarge: 20px;
--max-radius-pill: 9999px;
--max-radius-circle: 50%;
```

### Shadows (Elevation)

```css
--max-shadow-elevation-none: none;
--max-shadow-elevation-subtle: 0 1px 2px rgba(0,0,0,0.3);
--max-shadow-elevation-low: 0 2px 4px rgba(0,0,0,0.4);
--max-shadow-elevation-medium: 0 4px 8px rgba(0,0,0,0.4);
--max-shadow-elevation-high: 0 8px 16px rgba(0,0,0,0.5);
--max-shadow-elevation-highest: 0 16px 32px rgba(0,0,0,0.6);
--max-shadow-glow-accent-primary: 0 0 20px rgba(61,142,255,0.3);
--max-shadow-glow-accent-secondary: 0 0 20px rgba(0,212,170,0.3);
--max-shadow-focus-ring: 0 0 0 3px rgba(61,142,255,0.4);
```

### Z-Index Scale

```css
--max-z-index-base: 0;
--max-z-index-dropdown: 100;
--max-z-index-sticky: 200;
--max-z-index-fixed: 300;
--max-z-index-modal-backdrop: 400;
--max-z-index-modal-content: 500;
--max-z-index-popover: 600;
--max-z-index-tooltip: 700;
--max-z-index-toast: 800;
--max-z-index-maximum: 9999;
```

---

## Component Library

### Chat Interface Components

#### Message Bubble — User (`max-message-bubble-user`)

```
Structure:
├── max-message-bubble-user-container
│   ├── max-message-bubble-user-content
│   │   ├── max-message-bubble-user-text
│   │   └── max-message-bubble-user-attachments (optional)
│   └── max-message-bubble-user-metadata
│       ├── max-message-bubble-user-timestamp
│       └── max-message-bubble-user-status-indicator
```

**Specifications:**
- Background: `--max-color-accent-primary-default`
- Border Radius: `--max-radius-large` (top-right: `--max-radius-small`)
- Padding: `--max-spacing-medium` `--max-spacing-standard`
- Max Width: 70% of container
- Text Color: `--max-color-text-inverse-default`

#### Message Bubble — AI (`max-message-bubble-ai`)

```
Structure:
├── max-message-bubble-ai-container
│   ├── max-message-bubble-ai-avatar
│   │   └── max-message-bubble-ai-avatar-icon
│   ├── max-message-bubble-ai-content
│   │   ├── max-message-bubble-ai-header
│   │   │   └── max-message-bubble-ai-header-label
│   │   ├── max-message-bubble-ai-text
│   │   ├── max-message-bubble-ai-code-block (optional)
│   │   └── max-message-bubble-ai-actions (optional)
│   └── max-message-bubble-ai-metadata
│       ├── max-message-bubble-ai-timestamp
│       └── max-message-bubble-ai-feedback-controls
```

**Specifications:**
- Background: `--max-color-surface-secondary-default`
- Border: 1px solid `--max-color-border-primary-subtle`
- Border Radius: `--max-radius-large` (top-left: `--max-radius-small`)
- Padding: `--max-spacing-standard`
- Max Width: 85% of container

#### Typing Indicator (`max-typing-indicator`)

```
Structure:
├── max-typing-indicator-container
│   ├── max-typing-indicator-dot-first
│   ├── max-typing-indicator-dot-second
│   └── max-typing-indicator-dot-third
```

**Animation:** Sequential bounce with 0.2s delay between dots

#### Input Area (`max-chat-input-area`)

```
Structure:
├── max-chat-input-area-container
│   ├── max-chat-input-area-toolbar
│   │   ├── max-chat-input-area-toolbar-attachment-button
│   │   ├── max-chat-input-area-toolbar-format-button
│   │   └── max-chat-input-area-toolbar-more-options-button
│   ├── max-chat-input-area-field-wrapper
│   │   ├── max-chat-input-area-textarea
│   │   └── max-chat-input-area-placeholder
│   └── max-chat-input-area-actions
│       ├── max-chat-input-area-character-count
│       └── max-chat-input-area-submit-button
```

#### Conversation Sidebar (`max-conversation-sidebar`)

```
Structure:
├── max-conversation-sidebar-container
│   ├── max-conversation-sidebar-header
│   │   ├── max-conversation-sidebar-header-title
│   │   └── max-conversation-sidebar-header-new-chat-button
│   ├── max-conversation-sidebar-search
│   │   └── max-conversation-sidebar-search-input
│   ├── max-conversation-sidebar-list
│   │   └── max-conversation-sidebar-list-item (repeating)
│   │       ├── max-conversation-sidebar-list-item-icon
│   │       ├── max-conversation-sidebar-list-item-content
│   │       │   ├── max-conversation-sidebar-list-item-title
│   │       │   └── max-conversation-sidebar-list-item-preview
│   │       └── max-conversation-sidebar-list-item-actions
│   └── max-conversation-sidebar-footer
│       └── max-conversation-sidebar-footer-settings-button
```

### Core UI Components

#### Button (`max-button`)

**Variants:**
- `max-button-primary` — Primary actions
- `max-button-secondary` — Secondary actions
- `max-button-tertiary` — Tertiary/ghost actions
- `max-button-danger` — Destructive actions
- `max-button-icon-only` — Icon-only buttons

**Sizes:**
- `max-button-size-small` — Height: 28px, Padding: 0 12px
- `max-button-size-medium` — Height: 36px, Padding: 0 16px
- `max-button-size-large` — Height: 44px, Padding: 0 20px

**States:**
- `max-button-state-default`
- `max-button-state-hover`
- `max-button-state-active`
- `max-button-state-disabled`
- `max-button-state-loading`

#### Input Field (`max-input-field`)

```
Structure:
├── max-input-field-container
│   ├── max-input-field-label
│   ├── max-input-field-wrapper
│   │   ├── max-input-field-prefix-icon (optional)
│   │   ├── max-input-field-element
│   │   ├── max-input-field-suffix-icon (optional)
│   │   └── max-input-field-clear-button (optional)
│   ├── max-input-field-helper-text (optional)
│   └── max-input-field-error-message (optional)
```

#### Dropdown Menu (`max-dropdown-menu`)

```
Structure:
├── max-dropdown-menu-trigger
└── max-dropdown-menu-content
    ├── max-dropdown-menu-header (optional)
    ├── max-dropdown-menu-item (repeating)
    │   ├── max-dropdown-menu-item-icon (optional)
    │   ├── max-dropdown-menu-item-label
    │   ├── max-dropdown-menu-item-description (optional)
    │   └── max-dropdown-menu-item-shortcut (optional)
    ├── max-dropdown-menu-divider (optional)
    └── max-dropdown-menu-footer (optional)
```

#### Modal Dialog (`max-modal-dialog`)

```
Structure:
├── max-modal-dialog-backdrop
└── max-modal-dialog-container
    ├── max-modal-dialog-header
    │   ├── max-modal-dialog-header-title
    │   ├── max-modal-dialog-header-description (optional)
    │   └── max-modal-dialog-header-close-button
    ├── max-modal-dialog-content
    └── max-modal-dialog-footer
        ├── max-modal-dialog-footer-secondary-action (optional)
        └── max-modal-dialog-footer-primary-action
```

#### Toast Notification (`max-toast-notification`)

```
Structure:
├── max-toast-notification-container
│   ├── max-toast-notification-icon
│   ├── max-toast-notification-content
│   │   ├── max-toast-notification-title
│   │   └── max-toast-notification-message (optional)
│   ├── max-toast-notification-action (optional)
│   └── max-toast-notification-dismiss-button
```

**Variants:**
- `max-toast-notification-variant-info`
- `max-toast-notification-variant-success`
- `max-toast-notification-variant-warning`
- `max-toast-notification-variant-error`

#### Progress Indicator (`max-progress-indicator`)

**Variants:**
- `max-progress-indicator-linear` — Horizontal progress bar
- `max-progress-indicator-circular` — Circular spinner
- `max-progress-indicator-steps` — Step-based progress

#### Tooltip (`max-tooltip`)

```
Structure:
├── max-tooltip-trigger
└── max-tooltip-content
    ├── max-tooltip-content-text
    └── max-tooltip-content-arrow
```

**Positions:** top, right, bottom, left (with -start and -end variants)

#### Avatar (`max-avatar`)

```
Structure:
├── max-avatar-container
│   ├── max-avatar-image (or)
│   ├── max-avatar-initials (or)
│   ├── max-avatar-icon
│   └── max-avatar-status-indicator (optional)
```

**Sizes:**
- `max-avatar-size-tiny` — 20px
- `max-avatar-size-small` — 28px
- `max-avatar-size-medium` — 36px
- `max-avatar-size-large` — 48px
- `max-avatar-size-xlarge` — 64px

#### Badge (`max-badge`)

**Variants:**
- `max-badge-variant-default`
- `max-badge-variant-primary`
- `max-badge-variant-success`
- `max-badge-variant-warning`
- `max-badge-variant-error`
- `max-badge-variant-info`

#### Code Block (`max-code-block`)

```
Structure:
├── max-code-block-container
│   ├── max-code-block-header
│   │   ├── max-code-block-header-language-label
│   │   ├── max-code-block-header-filename (optional)
│   │   └── max-code-block-header-copy-button
│   ├── max-code-block-content
│   │   ├── max-code-block-line-numbers
│   │   └── max-code-block-code
│   └── max-code-block-footer (optional)
│       └── max-code-block-footer-actions
```

#### Skeleton Loader (`max-skeleton-loader`)

```
Structure:
├── max-skeleton-loader-container
│   ├── max-skeleton-loader-line (repeating)
│   ├── max-skeleton-loader-circle (optional)
│   └── max-skeleton-loader-rectangle (optional)
```

---

## Animation System

### Timing Functions

```css
--max-animation-easing-standard: cubic-bezier(0.4, 0, 0.2, 1);
--max-animation-easing-decelerate: cubic-bezier(0, 0, 0.2, 1);
--max-animation-easing-accelerate: cubic-bezier(0.4, 0, 1, 1);
--max-animation-easing-sharp: cubic-bezier(0.4, 0, 0.6, 1);
--max-animation-easing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--max-animation-easing-elastic: cubic-bezier(0.68, -0.6, 0.32, 1.6);
```

### Duration Scale

```css
--max-animation-duration-instant: 50ms;
--max-animation-duration-fastest: 100ms;
--max-animation-duration-fast: 150ms;
--max-animation-duration-standard: 200ms;
--max-animation-duration-moderate: 300ms;
--max-animation-duration-slow: 400ms;
--max-animation-duration-slower: 500ms;
--max-animation-duration-slowest: 700ms;
```

### Animation Definitions

#### Fade Animations

```css
@keyframes max-animation-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes max-animation-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes max-animation-fade-in-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes max-animation-fade-in-down {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### Scale Animations

```css
@keyframes max-animation-scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes max-animation-scale-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

@keyframes max-animation-pop-in {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  70% {
    transform: scale(1.05);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
```

#### Slide Animations

```css
@keyframes max-animation-slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes max-animation-slide-out-right {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}

@keyframes max-animation-slide-in-left {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes max-animation-slide-in-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes max-animation-slide-in-down {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}
```

#### Special Effect Animations

```css
@keyframes max-animation-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes max-animation-pulse-scale {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes max-animation-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

@keyframes max-animation-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-25%); }
}

@keyframes max-animation-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes max-animation-ping {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}
```

#### Typing Indicator Animation

```css
@keyframes max-animation-typing-dot-bounce {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-8px);
    opacity: 1;
  }
}
```

#### AI Thinking Animation

```css
@keyframes max-animation-ai-thinking-pulse {
  0% {
    background-position: 200% center;
  }
  100% {
    background-position: -200% center;
  }
}

@keyframes max-animation-ai-glow {
  0%, 100% {
    box-shadow: 0 0 5px var(--max-color-ai-thinking-primary);
  }
  50% {
    box-shadow: 0 0 20px var(--max-color-ai-thinking-primary);
  }
}
```

#### Skeleton Loading Animation

```css
@keyframes max-animation-skeleton-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
```

#### Message Appearance Animation

```css
@keyframes max-animation-message-appear {
  0% {
    opacity: 0;
    transform: translateY(16px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

### Animation Utility Classes

```css
.max-animation-fade-in { animation: max-animation-fade-in var(--max-animation-duration-standard) var(--max-animation-easing-decelerate); }
.max-animation-fade-out { animation: max-animation-fade-out var(--max-animation-duration-standard) var(--max-animation-easing-accelerate); }
.max-animation-scale-in { animation: max-animation-scale-in var(--max-animation-duration-standard) var(--max-animation-easing-decelerate); }
.max-animation-slide-in-right { animation: max-animation-slide-in-right var(--max-animation-duration-moderate) var(--max-animation-easing-decelerate); }
.max-animation-pulse { animation: max-animation-pulse 2s var(--max-animation-easing-standard) infinite; }
.max-animation-spin { animation: max-animation-spin 1s linear infinite; }
.max-animation-bounce { animation: max-animation-bounce 1s var(--max-animation-easing-bounce) infinite; }
```

---

## Accessibility Guidelines

### Color Contrast Requirements

All text must meet WCAG 2.1 AA standards:
- **Normal text (< 18px):** Minimum contrast ratio 4.5:1
- **Large text (≥ 18px):** Minimum contrast ratio 3:1
- **UI components and graphics:** Minimum contrast ratio 3:1

### Focus Management

- All interactive elements must have visible focus states
- Focus order must follow logical reading order
- Focus must be trapped within modals when open
- Skip links should be provided for keyboard navigation

### Keyboard Navigation

| Element | Keys | Action |
|---------|------|--------|
| Buttons | `Enter`, `Space` | Activate |
| Links | `Enter` | Navigate |
| Dropdowns | `Enter`, `Space`, `↓` | Open |
| Dropdown items | `↑`, `↓` | Navigate |
| Modals | `Escape` | Close |
| Tabs | `←`, `→` | Switch tab |

### Screen Reader Support

- Use semantic HTML elements
- Provide ARIA labels for icon-only buttons
- Use `aria-live` regions for dynamic content
- Include `role` attributes where semantic HTML is insufficient
- Provide `aria-expanded` and `aria-haspopup` for dropdowns

### Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Implementation Reference

### File Structure

```
max-design-system/
├── index.html                    # Chat UI prototype
├── styles/
│   └── max-design-tokens.css    # All CSS custom properties
├── DESIGN-SYSTEM.md              # This documentation
└── README.md                     # Quick start guide
```

### CSS Custom Properties Usage

```css
.max-button-primary {
  background-color: var(--max-color-accent-primary-default);
  color: var(--max-color-text-inverse-default);
  font-family: var(--max-font-family-primary);
  font-size: var(--max-typography-body-medium);
  font-weight: var(--max-font-weight-semibold);
  padding: var(--max-spacing-small) var(--max-spacing-standard);
  border-radius: var(--max-radius-medium);
  transition: all var(--max-animation-duration-fast) var(--max-animation-easing-standard);
}

.max-button-primary:hover {
  background-color: var(--max-color-accent-primary-hover);
}

.max-button-primary:active {
  background-color: var(--max-color-accent-primary-active);
}

.max-button-primary:focus-visible {
  outline: none;
  box-shadow: var(--max-shadow-focus-ring);
}
```

### Component Implementation Example

```html
<!-- Message Bubble - AI Response -->
<div class="max-message-bubble-ai-container">
  <div class="max-message-bubble-ai-avatar">
    <div class="max-message-bubble-ai-avatar-icon">
      <!-- SVG icon -->
    </div>
  </div>
  <div class="max-message-bubble-ai-content">
    <div class="max-message-bubble-ai-header">
      <span class="max-message-bubble-ai-header-label">M.AX</span>
    </div>
    <div class="max-message-bubble-ai-text">
      Response content here...
    </div>
  </div>
  <div class="max-message-bubble-ai-metadata">
    <span class="max-message-bubble-ai-timestamp">Just now</span>
  </div>
</div>
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-04 | Initial release |

---

## Credits

Design system inspired by Palantir's Blueprint design language, adapted for AI conversational interfaces.

**M.AX Design System** — Built for the future of human-AI interaction.
