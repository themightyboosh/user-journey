# M.AX Design System & Chat UI Prototype

A comprehensive design system and fully interactive chat UI reference implementation for AI-powered conversational interfaces, inspired by Palantir's enterprise-grade design language.

## Overview

**M.AX** (Machine Intelligence · Augmented Experience) is a complete design system featuring:

- Dark-first, professional aesthetic optimized for extended use
- Semantically clear naming conventions throughout
- Full component library with animated interactions
- Accessibility-compliant design tokens
- Ready for Gemini backend integration

## Quick Start

1. Open `index.html` in a modern web browser
2. The prototype is fully functional with simulated AI responses
3. Explore all components and interactions

```bash
# Using a local server (recommended)
npx serve .

# Or simply open directly
open index.html
```

## File Structure

```
max-design-system/
├── index.html                          # Complete chat UI prototype
├── styles/
│   ├── max-design-tokens.css          # CSS custom properties & animations
│   └── max-components.css             # Component styling
├── scripts/
│   └── max-interactions.js            # Interactive behaviors
├── DESIGN-SYSTEM.md                    # Complete design documentation
└── README.md                           # This file
```

## Design System Documentation

See [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) for comprehensive documentation including:

- Brand identity guidelines
- Color system with semantic tokens
- Typography scale
- Spacing and layout systems
- Complete component library specifications
- Animation system with keyframes
- Accessibility guidelines

## Key Features

### Chat Interface Components

| Component | Description |
|-----------|-------------|
| `max-message-bubble-user-*` | User message bubbles with status indicators |
| `max-message-bubble-ai-*` | AI response bubbles with actions |
| `max-typing-indicator-*` | Animated typing indicator |
| `max-chat-input-area-*` | Auto-expanding input with toolbar |
| `max-conversation-sidebar-*` | Collapsible conversation navigation |

### Core UI Components

| Component | Description |
|-----------|-------------|
| `max-button-*` | Primary, secondary, tertiary, danger variants |
| `max-input-field-*` | Text inputs with validation states |
| `max-dropdown-menu-*` | Animated dropdown menus |
| `max-modal-dialog-*` | Accessible modal dialogs |
| `max-toast-notification-*` | Auto-dismissing notifications |
| `max-code-block-*` | Syntax-highlighted code display |
| `max-skeleton-loader-*` | Loading state placeholders |
| `max-progress-indicator-*` | Linear and circular progress |

### Animation System

All animations use consistent timing functions and durations:

```css
/* Timing Functions */
--max-animation-easing-standard: cubic-bezier(0.4, 0, 0.2, 1);
--max-animation-easing-decelerate: cubic-bezier(0, 0, 0.2, 1);
--max-animation-easing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

/* Duration Scale */
--max-animation-duration-fast: 150ms;
--max-animation-duration-standard: 200ms;
--max-animation-duration-moderate: 300ms;
```

## Naming Convention

All classes follow the pattern:

```
max-[component]-[element]-[variant]-[state]
```

Examples:
- `max-button-primary` — Primary button
- `max-message-bubble-user-container` — User message container
- `max-input-field-state-error` — Input in error state
- `max-animation-fade-in-up` — Fade in with upward motion

## Gemini Integration

The prototype is structured for easy Gemini backend integration:

```javascript
// Replace the simulation in max-interactions.js
MaxChatMessagesController.simulateAiResponse = async function() {
  this.showTypingIndicator();
  
  const response = await fetch('/api/gemini', {
    method: 'POST',
    body: JSON.stringify({ 
      message: MaxChatInputController.getValue(),
      model: MaxModelSelectorController.currentModel 
    })
  });
  
  const data = await response.json();
  
  this.hideTypingIndicator();
  this.addAiMessage(data.response);
};
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Accessibility

The design system meets WCAG 2.1 AA standards:

- Minimum 4.5:1 contrast ratio for text
- Keyboard navigation support
- ARIA labels and roles
- Reduced motion support via `prefers-reduced-motion`
- Focus indicators on all interactive elements

## Color Palette

| Category | Primary | Secondary |
|----------|---------|-----------|
| Accent | `#3d8eff` | `#00d4aa` |
| Surface | `#12141a` | `#1e222c` |
| Text | `#f4f5f7` | `#a8b1c4` |
| Success | `#34d399` | — |
| Warning | `#fbbf24` | — |
| Error | `#f87171` | — |

## License

MIT License — Free for personal and commercial use.

---

**M.AX Design System** — Built for the future of human-AI interaction.
