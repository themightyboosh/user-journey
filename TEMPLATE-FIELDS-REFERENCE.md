# Journey Template Fields Reference

**Version:** 3.0 (Post-Refactor)
**Last Updated:** 2026-02-09

This document describes each field in the Journey Template admin UI, explaining what happens when the field is present vs absent, which interview gates are affected, and how the AI behavior changes.

---

## Table of Contents

1. [Metadata Fields](#metadata-fields)
2. [Identity Pre-fill Fields](#identity-pre-fill-fields)
3. [Journey Pre-fill Fields](#journey-pre-fill-fields)
4. [AI Behavior Override Fields](#ai-behavior-override-fields)
5. [Structure Pre-fill Fields](#structure-pre-fill-fields)
6. [Field Interaction Matrix](#field-interaction-matrix)

---

## Metadata Fields

### 1. Template Name
**Field Type:** Text Input (Required)
**Toggle:** N/A (Always required)
**Database Field:** `configName`

#### Purpose
Human-readable identifier for the template shown in the admin UI sidebar.

#### When Present
- Template appears in the "Saved Templates" list with this name
- Used to generate slugified ID for template (e.g., "Employee Onboarding" → `employee_onboarding`)

#### When Not Present
- Save operation blocked with alert: "Please enter a Template Name"

#### Gates Impacted
None (metadata only)

#### Implementation Notes
```typescript
// admin/script.js:903-908
const configName = configNameInput.value.trim();
if (!configName) {
    alert("Please enter a Template Name.");
    return;
}
```

---

### 2. Description
**Field Type:** Textarea (Required)
**Toggle:** N/A (Always required)
**Database Field:** `description`

#### Purpose
Brief explanation of the template's purpose, shown to users when selecting a template.

#### When Present
- Displayed in admin sidebar under template name (truncated to 80 chars)
- Helps admins differentiate between similar templates

#### When Not Present
- Save operation blocked with alert: "Please enter a Description"

#### Gates Impacted
None (metadata only)

#### Implementation Notes
```typescript
// admin/script.js:909-914
const description = templateDescriptionInput.value.trim();
if (!description) {
    alert("Please enter a Description.");
    return;
}
```

---

### 3. Icon
**Field Type:** Icon Picker (Optional, Default: `file-text`)
**Toggle:** N/A
**Database Field:** `icon`

#### Purpose
Visual identifier for the template in the admin UI sidebar (uses Lucide icon library - 1906 icons).

#### When Present
- Selected icon displays next to template name in sidebar
- Provides quick visual recognition

#### When Not Present
- Defaults to `file-text` icon

#### Gates Impacted
None (metadata only)

---

### 4. Global Template
**Field Type:** Checkbox Toggle
**Toggle:** N/A (Always available)
**Database Field:** `global`

#### Purpose
Makes template accessible for demos and shared public access (no auth required unless Require Sign-In is also enabled).

#### When Enabled
- Template marked with "GLOBAL" tag in admin sidebar
- URL `/?id=<templateId>` works for any user
- Template accessible without authentication (unless `requireAuth` is also true)

#### When Disabled
- Template only accessible by creator and super admins
- URL requires authentication to load

#### Gates Impacted
None (access control only)

---

### 5. Require Google Sign-In
**Field Type:** Checkbox Toggle
**Toggle:** N/A (Always available)
**Database Field:** `requireAuth`

#### Purpose
Forces users to authenticate with Google before starting the interview. User email is captured with the journey.

#### When Enabled
- User must complete Google OAuth before interview starts
- User email stored in `journeyState.userEmail`
- Admin can see who created each journey

#### When Disabled
- Anonymous access allowed
- No email capture

#### Gates Impacted
- **Step 1 (Identity):** User must authenticate BEFORE welcome step begins

#### Implementation Notes
```typescript
// front-end/js/chat.js (conceptual)
if (sessionConfig.requireAuth && !currentUser) {
    showAuthModal();
    return;
}
```

---

## Identity Pre-fill Fields

### 6. Name (User Name)
**Field Type:** Text Input
**Toggle:** On/Off (Default: Off = "Provided by User")
**Database Field:** `name`

#### Purpose
Pre-fills the user's first name to bypass identity collection.

#### When Toggle OFF (Not Present)
- **Step 1 Behavior:** AI asks for user's name during welcome
- **Context Injection:** No name appears in context
- **Mode:** `[BOTH UNKNOWN]` or `[ROLE ONLY]` (if role is present)

#### When Toggle ON + Value Present
- **Step 1 Behavior:**
  - If **both name and role** present → `[BOTH KNOWN]` mode: AI greets by name, asks for confirmation
  - If **only name** present → `[NAME ONLY]` mode: AI greets by name, asks only for role
- **Context Injection:** `- User Name: [value]`
- **Gate Bypass:** Partial bypass of identity collection (skips name question)

#### Gates Impacted
- **Step 1 (Welcome & Identity Check):** Changes prompt mode based on presence
- **Step 2 (Capture Identity):** Name value used directly in `create_journey_map` tool call

#### Prompt Logic
```typescript
// prompts.ts:429-434
let contextInjection = "\n\n=== CONTEXT FROM URL/SYSTEM ===\n";
contextInjection += `- AGENT NAME: ${agentName}\n`;

// Identity (appears ONCE, not three times)
if (config.name) contextInjection += `- User Name: ${config.name}\n`;
if (config.role) contextInjection += `- User Role: ${config.role}\n`;
```

#### Step 1 Mode Detection
```typescript
// prompts.ts:6-27 (STEP_1_DEFAULT)
*   **Logic**: Look at the CONTEXT FROM URL/SYSTEM section below. Check if "User Name" and/or "User Role" fields exist there.
*   **Mode [BOTH KNOWN] (Name AND Role both found)**:
    - GREET by name, confirm both
*   **Mode [NAME ONLY] (Name found, Role missing)**:
    - GREET by name, ask only for role
    - **CRITICAL**: Do NOT ask for name again
*   **Mode [ROLE ONLY] (Role found, Name missing)**:
    - Acknowledge role, ask only for name
*   **Mode [BOTH UNKNOWN] (Neither found)**:
    - Ask for both name and role
```

---

### 7. Role (User Role)
**Field Type:** Text Input
**Toggle:** On/Off (Default: Off = "Provided by User")
**Database Field:** `role`

#### Purpose
Pre-fills the user's job title or role to bypass role collection.

#### When Toggle OFF (Not Present)
- **Step 1 Behavior:** AI asks for user's role during welcome
- **Context Injection:** No role appears in context
- **Mode:** `[BOTH UNKNOWN]` or `[NAME ONLY]` (if name is present)

#### When Toggle ON + Value Present
- **Step 1 Behavior:**
  - If **both name and role** present → `[BOTH KNOWN]` mode: AI confirms both
  - If **only role** present → `[ROLE ONLY]` mode: AI acknowledges role, asks only for name (**Bernadoodle case**)
- **Context Injection:** `- User Role: [value]`
- **Gate Bypass:** Partial bypass of identity collection (skips role question)

#### Gates Impacted
- **Step 1 (Welcome & Identity Check):** Changes prompt mode based on presence
- **Step 2 (Capture Identity):** Role value used directly in `create_journey_map` tool call

#### Example: Bernadoodle Template
```javascript
// Config
{
    role: "bernadoodle parent",
    name: undefined,
    welcomePrompt: "Welcome! I'm excited to learn about your experience..."
}

// Result: [ROLE ONLY] mode
// AI Output: "Welcome! I'm excited to learn about your experience...
//            I understand you're a bernadoodle parent. What's your name so I know who I'm chatting with?"
```

---

## Journey Pre-fill Fields

### 8. Journey Name
**Field Type:** Text Input
**Toggle:** On/Off (Default: Off = "Provided by User")
**Database Field:** `journey`

#### Purpose
Pre-fills the journey name to bypass Step 3 journey definition (when used with `journeyDescription`).

#### When Toggle OFF (Not Present)
- **Step 3 Behavior:** AI executes `journeyPrompt` (or default) to ask about the activity
- **Step 3 Mode:** `[BOTH UNKNOWN]` - AI deduces journey name from user's description
- **Gate:** User must describe their activity before proceeding

#### When Toggle ON + Value Present (Name Only, No Description)
- **Step 3 Behavior:** `[NAME ONLY]` mode
  - AI acknowledges journey name (e.g., "I see this is about Employee Onboarding")
  - AI executes `journeyPrompt` to capture description
  - AI calls `update_journey_metadata` with known name + user's description
- **Context Injection:** `- Journey Name: [value]`
- **Gate:** User must provide description, but name is pre-filled

#### When Toggle ON + Value Present + `journeyDescription` Present
- **Step 3 Behavior:** `[FULL BYPASS]` mode (**NEW in refactor**)
  - AI briefly acknowledges (e.g., "I see this is about [Journey Name]—got it.")
  - AI immediately calls `update_journey_metadata` with both values
  - AI **JUMPS directly to Step 5 (Phase Inquiry)** - skips entire Step 3 gate
- **Context Injection:**
  ```
  - Journey Name: [value]
  - Journey Description: [description]
  ```
- **Gate Bypass:** Complete bypass of Step 3

#### Gates Impacted
- **Step 3 (Journey Setup):** Partial or full bypass depending on description presence
- **Step 4 (Capture Journey):** Name used directly in `update_journey_metadata` tool

#### Prompt Logic
```typescript
// prompts.ts:305-320
let step3 = STEP_3_DEFAULT;

// Check if BOTH journeyName AND journeyDescription are provided
if (config.journeyName && config.journeyDescription) {
    // FULL BYPASS - Skip Step 3 entirely
    step3 = `3.  **Journey Setup (FULL BYPASS)**:
        *   **Signpost**: Briefly acknowledge (e.g. "I see this is about ${config.journeyName}—got it.").
        *   **Action**: Immediately call \`update_journey_metadata\` with both values from context.
        *   **Transition**: JUMP directly to Step 5 (Phase Inquiry).`;
}
```

#### Bypass Scenarios
| journeyName | journeyDescription | Mode | AI Behavior |
|-------------|-------------------|------|-------------|
| ✗ | ✗ | `[BOTH UNKNOWN]` | Ask for activity, deduce name |
| ✓ | ✗ | `[NAME ONLY]` | Acknowledge name, ask for description |
| ✓ | ✓ | `[FULL BYPASS]` | Signpost → Call tool → Jump to Step 5 |

---

## AI Behavior Override Fields

### 9. Welcome Prompt Override
**Field Type:** Textarea (6 rows)
**Toggle:** On/Off (Default: Off = "Provided by User")
**Database Field:** `welcomePrompt`

#### Purpose
Customizes the AI's initial greeting to match specific persona, tone, or domain context.

#### When Toggle OFF (Not Present)
- **Default Welcome:**
  ```
  "Welcome the user by name if known, introduce yourself as a researcher
   here to understand their daily work and experiences."
  ```
- **Step 1 Behavior:** Standard professional research greeting

#### When Toggle ON + Value Present
- **Custom Welcome:** Replaces default greeting text in Step 1
- **Step 1 Behavior:** AI follows custom instruction while maintaining identity mode logic
- **Placeholder Injection:** Value replaces `{{WELCOME_PROMPT}}` in `STEP_1_DEFAULT`

#### Gates Impacted
- **Step 1 (Welcome & Identity Check):** Changes greeting text only, not identity logic

#### Prompt Logic
```typescript
// prompts.ts:299-302
// Replace agent name and welcome prompt placeholders
step1 = step1.replace(/{{AGENT_NAME}}/g, config.agentName || "Max");
step1 = step1.replace(/{{WELCOME_PROMPT}}/g, config.welcomePrompt || defaultWelcome);
```

#### Example: Bernadoodle Template
```javascript
// Config
{
    welcomePrompt: "Welcome! 🐾 I'm Max, and I'm excited to learn about your experience as a bernadoodle parent...",
    role: "bernadoodle parent"
}

// Result
// AI Output: "Welcome! 🐾 I'm Max, and I'm excited to learn about your experience as a bernadoodle parent...
//            What's your name so I know who I'm chatting with?"
```

#### Critical Note
**Before Refactor:** This field caused a race condition - templates with `welcomePrompt` used old override logic, bypassing the placeholder system.

**After Refactor:** This field now flows through the unified placeholder system (`STEP_1_DEFAULT`), ensuring consistent behavior across all templates.

---

### 10. Journey Description Prompt Override
**Field Type:** Textarea (6 rows)
**Toggle:** On/Off (Default: Off = "Provided by User")
**Database Field:** `journeyPrompt`

#### Purpose
Customizes the AI's inquiry about the journey description (Step 3) to ask domain-specific questions.

#### When Toggle OFF (Not Present)
- **Default Journey Prompt:**
  ```
  "Ask the user to tell you about an important activity they perform
   and why it matters."
  ```
- **Step 3 Behavior:** Generic activity inquiry

#### When Toggle ON + Value Present
- **Custom Journey Prompt:** Replaces default inquiry in Step 3
- **Step 3 Behavior:** AI executes custom prompt instead of default
- **Placeholder Injection:** Value replaces `{{JOURNEY_PROMPT}}` in `STEP_3_DEFAULT`

#### Gates Impacted
- **Step 3 (Journey Setup):** Changes question asked, not gate logic
- Only impacts behavior when `journeyName` is NOT pre-filled (or description is missing)

#### Prompt Logic
```typescript
// prompts.ts:415-416
instruction = instruction.replace('{{JOURNEY_PROMPT}}', journeyPrompt);

// STEP_3_DEFAULT uses this placeholder:
// "Execute {{JOURNEY_PROMPT}} to ask about their activity."
```

#### Example: Healthcare Template
```javascript
// Config
{
    journeyPrompt: "Tell me about a specific patient interaction or care process you want to map. What makes this process challenging?"
}

// Result
// AI Output: "Tell me about a specific patient interaction or care process you want to map.
//            What makes this process challenging?"
```

---

### 11. Additional Context (RAG)
**Field Type:** Textarea (10 rows, 4000 char limit)
**Toggle:** On/Off (Default: Off = "None")
**Database Field:** `ragContext`

#### Purpose
Injects domain-specific knowledge into the AI's system prompt for context-aware synthesis during Step 13 (artifact generation).

#### When Toggle OFF (Not Present)
- **RAG Constraint:** No special RAG instruction in Step 13
- **Step 13 Behavior:** AI generates artifacts based only on conversation data
- **Context Injection:** No additional context section

#### When Toggle ON + Value Present
- **RAG Constraint Injection:** Special instruction added to Step 13:
  ```
  **RAG Integration (Organic Expertise)**: Since ADDITIONAL CONTEXT is provided below,
  you MUST weave that knowledge into your 'Summary of Findings' and 'Mental Models'.

  **Style Rule**: Do NOT explicitly cite the context (e.g. "According to the context...").
  Instead, synthesize it so it feels like your own organic expertise. Use the context to
  explain *why* the user's journey matters or how it fits into the broader picture.
  ```
- **Context Injection:**
  ```
  --- ADDITIONAL CONTEXT (Knowledge Base) ---
  [ragContext value]
  --- End of Additional Context ---
  ```
- **Step 13 Behavior:** AI synthesizes RAG knowledge with conversation data

#### Gates Impacted
- **Step 13 (Completion & Analysis):** RAG knowledge woven into artifacts

#### Prompt Logic
```typescript
// prompts.ts:418-424
let ragConstraint = "";
if (config.knowledgeContext) {
    ragConstraint = `*   **RAG Integration (Organic Expertise)**: Since ADDITIONAL CONTEXT is provided below...`;
}
instruction = instruction.replace('{{RAG_CONSTRAINT}}', ragConstraint);

// Context injection: prompts.ts:462-467
if (config.knowledgeContext) {
    contextInjection += `\n--- ADDITIONAL CONTEXT (Knowledge Base) ---\n`;
    contextInjection += `${config.knowledgeContext}\n`;
    contextInjection += `--- End of Additional Context ---\n`;
}
```

#### Example: Product Documentation RAG
```javascript
// Config
{
    ragContext: `Our product is a SaaS platform for inventory management...
                 Key terminology: "Stock Units" = physical items, "SKUs" = product variants...`
}

// Result in Step 13
// AI Output: "The user's journey reveals a common pattern in inventory management workflows...
//            Their struggle with Stock Unit tracking aligns with industry challenges around SKU proliferation..."
// (Notice: No explicit citation, knowledge synthesized organically)
```

#### Character Limit
- **Soft Limit:** 3000 chars (warning color: orange)
- **Hard Limit:** 4000 chars (character counter turns red at 3600)
- **Rationale:** Keep context concise for token efficiency

---

### 12. Persona Frame
**Field Type:** Textarea (3 rows)
**Toggle:** On/Off (Default: Off = "Default")
**Database Field:** `personaFrame`

#### Purpose
Defines the AI's research framing - how it approaches the interview conceptually.

#### When Toggle OFF (Not Present)
- **Default Frame:**
  ```
  'Treat this as a research interview to understand the user\'s "jobs to be done",
   tools, and feelings.'
  ```
- **AI Mindset:** Jobs-to-be-done framework

#### When Toggle ON + Value Present
- **Custom Frame:** Replaces default framing instruction
- **Placeholder Injection:** Value replaces `{{PERSONA_FRAME}}` in `BASE_SYSTEM_INSTRUCTION`
- **AI Mindset:** Custom conceptual approach

#### Gates Impacted
None directly - affects overall interview approach and question framing

#### Prompt Logic
```typescript
// prompts.ts:406-407
instruction = instruction.replace('{{PERSONA_FRAME}}', config.personaFrame || defaultFrame);

// BASE_SYSTEM_INSTRUCTION:92-93
**PERSONA**:
- **Frame**: {{PERSONA_FRAME}}
```

#### Example: Ethnographic Research Frame
```javascript
// Config
{
    personaFrame: "Approach this as a cultural anthropologist studying workplace rituals and social dynamics."
}

// Result
// AI adopts ethnographic lens, asking about social context, rituals, power dynamics
```

---

### 13. Persona Language
**Field Type:** Textarea (3 rows)
**Toggle:** On/Off (Default: Off = "Default")
**Database Field:** `personaLanguage`

#### Purpose
Controls the vocabulary and terminology the AI uses with the user (what to avoid, what to prefer).

#### When Toggle OFF (Not Present)
- **Default Language:**
  ```
  'Avoid using technical mapping terms like "Journey Map", "Swimlane", "Phase", or "Matrix".
   Instead use natural terms like "stages", "activities", "what happens next", "who is involved".'
  ```
- **AI Vocabulary:** Non-technical, user-friendly

#### When Toggle ON + Value Present
- **Custom Language:** Replaces default terminology guide
- **Placeholder Injection:** Value replaces `{{PERSONA_LANGUAGE}}` in `BASE_SYSTEM_INSTRUCTION`
- **AI Vocabulary:** Custom domain-specific terms

#### Gates Impacted
None directly - affects language choices throughout entire interview

#### Prompt Logic
```typescript
// prompts.ts:407
instruction = instruction.replace('{{PERSONA_LANGUAGE}}', config.personaLanguage || defaultLanguage);

// BASE_SYSTEM_INSTRUCTION:94
- **Language**: {{PERSONA_LANGUAGE}}
```

#### Example: Healthcare Terminology
```javascript
// Config
{
    personaLanguage: "Use clinical terminology: 'patient encounter', 'care episode', 'clinical workflow'. Avoid business jargon like 'customer journey'."
}

// Result
// AI Output: "What are the key milestones in this care episode?"
// (Instead of: "What are the key stages in this customer journey?")
```

---

## Structure Pre-fill Fields

### 14. Phases (Horizontal Axis)
**Field Type:** Dynamic List (Add/Remove)
**Toggle:** On/Off (Default: Off = "Provided by User")
**Database Field:** `phases` (Array of `{ name: string, description?: string }`)

#### Purpose
Pre-defines the horizontal axis (time periods / stages) of the journey map to bypass Step 5-6 phase inquiry.

#### When Toggle OFF (Not Present)
- **Step 5 Behavior:** `[UNKNOWN]` mode
  - AI asks user to identify high-level stages/steps
  - AI summarizes and asks "Does this flow look right?"
  - After confirmation, AI probes for description of EACH phase
  - AI calls `set_phases_bulk` after collecting all descriptions
- **Context Injection:** No phases in context
- **Gate:** User must confirm phase list AND provide descriptions

#### When Toggle ON + All Phases Have Descriptions
- **Step 5 Behavior:** `[FULL BYPASS]` mode
  - AI briefly acknowledges (e.g., "I see we're mapping Research, Design, Test—got it.")
  - AI immediately calls `set_phases_bulk` with EXACT array from context
  - AI **JUMPS directly to Step 7 (Swimlane Inquiry)**
- **Context Injection:**
  ```
  - PHASES (PRE-DEFINED) (COMPLETE): [{"name":"Research","description":"..."},...]
  ```
- **Gate Bypass:** Complete bypass of Steps 5-6

#### When Toggle ON + Some Phases Missing Descriptions
- **Step 5 Behavior:** `[PARTIAL PRE-FILL]` mode (**NEW in refactor**)
  - AI acknowledges phase names (e.g., "I see we have Research, Design, Test.")
  - AI identifies which phases are missing descriptions
  - AI asks ONE question per missing description (e.g., "What does Design involve?")
  - AI accumulates name + description for each
  - AI summarizes and asks "Does this flow look right?"
  - AI calls `set_phases_bulk` ONLY after user confirms AND all descriptions collected
- **Context Injection:**
  ```
  - PHASES (PRE-DEFINED) (PARTIAL - some descriptions missing):
    [{"name":"Research","description":"..."},{"name":"Design"}]
  ```
- **Gate:** User must confirm AND provide missing descriptions

#### Gates Impacted
- **Step 5 (Phase Inquiry):** Partial or full bypass depending on description completeness
- **Step 6 (Capture Phases):** Phase data used directly in `set_phases_bulk` tool

#### Prompt Logic
```typescript
// prompts.ts:322-360
let step5 = STEP_5_DEFAULT;

if (config.phases && Array.isArray(config.phases) && config.phases.length > 0) {
    const allHaveDescriptions = config.phases.every(p => p.description && p.description.trim().length > 0);

    if (allHaveDescriptions) {
        // FULL BYPASS - All phases complete
        step5 = `5.  **Phase Inquiry (FULL BYPASS)**:
            *   **Pre-populated Phases**: The following phases are already defined:
                \`\`\`json
                ${JSON.stringify(config.phases, null, 2)}
                \`\`\`
            *   **Action**: Immediately call \`set_phases_bulk\` with the EXACT array shown above.`;
    } else {
        // PARTIAL PRE-FILL - Names provided, some descriptions missing
        const missingDescriptions = config.phases.filter(p => !p.description || p.description.trim().length === 0).map(p => p.name);

        step5 = `5.  **Phase Inquiry (PARTIAL PRE-FILL)**:
            *   **Phases with Missing Descriptions**: ${JSON.stringify(missingDescriptions)}
            *   **Probe**: For EACH phase in the "Missing Descriptions" list, ask ONE question...`;
    }
}
```

#### Bypass Scenarios
| Phases Array | All Descriptions? | Mode | AI Behavior |
|-------------|-------------------|------|-------------|
| ✗ (empty) | N/A | `[UNKNOWN]` | Ask user, confirm, probe all, call tool |
| ✓ (has items) | ✗ (some missing) | `[PARTIAL PRE-FILL]` | Acknowledge names, probe missing, confirm, call tool |
| ✓ (has items) | ✓ (all complete) | `[FULL BYPASS]` | Signpost → Call tool → Jump to Step 7 |

#### Example: FULL BYPASS
```javascript
// Config
{
    phases: [
        { name: "Research", description: "Initial discovery and user interviews" },
        { name: "Design", description: "Wireframing and prototyping solutions" },
        { name: "Test", description: "Usability testing with target users" }
    ]
}

// Result
// AI Output: "I see we're mapping Research, Design, Test—got it."
// [Immediately calls set_phases_bulk, jumps to Step 7]
```

#### Example: PARTIAL PRE-FILL
```javascript
// Config
{
    phases: [
        { name: "Research", description: "Initial discovery and user interviews" },
        { name: "Design" }, // Missing description
        { name: "Test", description: "Usability testing with target users" }
    ]
}

// Result
// AI Output: "I see we have Research, Design, Test. What does Design involve?"
// [User responds: "Creating wireframes and prototypes"]
// AI Output: "Great. So we have Research, Design (creating wireframes and prototypes), and Test. Does this flow look right?"
// [User confirms: "Yes"]
// [AI calls set_phases_bulk with complete array including user's description for Design]
```

---

### 15. Swimlanes (Vertical Axis)
**Field Type:** Dynamic List (Add/Remove)
**Toggle:** On/Off (Default: Off = "Provided by User")
**Database Field:** `swimlanes` (Array of `{ name: string, description?: string }`)

#### Purpose
Pre-defines the vertical axis (experience layers) of the journey map to bypass Step 7-8 swimlane inquiry.

#### When Toggle OFF (Not Present)
- **Step 7 Behavior:** `[UNKNOWN]` mode
  - **Step 7a:** AI explains concept, asks "what layers should we track for *every* stage?"
  - AI provides examples: "Actions, Thinking, Feeling, Pain Points, Tools"
  - AI summarizes and asks "Are these the right layers?"
  - **Step 7b:** After confirmation, AI probes for description of EACH swimlane
  - AI calls `set_swimlanes_bulk` after collecting all descriptions
- **Context Injection:** No swimlanes in context
- **Gate:** User must confirm swimlane list AND provide descriptions

#### When Toggle ON + All Swimlanes Have Descriptions
- **Step 7 Behavior:** `[FULL BYPASS]` mode
  - AI briefly confirms (e.g., "We'll be tracking Actions, Tools, Feelings across each stage.")
  - AI immediately calls `set_swimlanes_bulk` with EXACT array from context
  - **Note:** This tool automatically calls `generate_matrix` internally
  - AI **JUMPS directly to Step 9 (Matrix Verification)**
- **Context Injection:**
  ```
  - SWIMLANES (PRE-DEFINED) (COMPLETE): [{"name":"Actions","description":"..."},...]
  ```
- **Gate Bypass:** Complete bypass of Steps 7-8

#### When Toggle ON + Some Swimlanes Missing Descriptions
- **Step 7 Behavior:** `[PARTIAL PRE-FILL]` mode (**NEW in refactor**)
  - AI acknowledges swimlane names (e.g., "I see we're tracking Actions, Tools, Feelings.")
  - AI identifies which swimlanes are missing descriptions
  - AI asks ONE question per missing description (e.g., "What does Actions mean in this context?")
  - AI accumulates name + description for each
  - AI summarizes and asks "Are these the right layers to track?"
  - AI calls `set_swimlanes_bulk` ONLY after user confirms AND all descriptions collected
- **Context Injection:**
  ```
  - SWIMLANES (PRE-DEFINED) (PARTIAL - some descriptions missing):
    [{"name":"Actions","description":"..."},{"name":"Tools"}]
  ```
- **Gate:** User must confirm AND provide missing descriptions

#### Gates Impacted
- **Step 7 (Swimlane Inquiry):** Partial or full bypass depending on description completeness
- **Step 8 (Capture Swimlanes):** Swimlane data used directly in `set_swimlanes_bulk` tool
- **Step 9 (Matrix Verification):** `generate_matrix` called automatically by `set_swimlanes_bulk`

#### Prompt Logic
```typescript
// prompts.ts:362-400 (identical pattern to phases)
let step7 = STEP_7_DEFAULT;

if (config.swimlanes && Array.isArray(config.swimlanes) && config.swimlanes.length > 0) {
    const allHaveDescriptions = config.swimlanes.every(s => s.description && s.description.trim().length > 0);

    if (allHaveDescriptions) {
        // FULL BYPASS - All swimlanes complete
        step7 = `7.  **Swimlane Inquiry (FULL BYPASS)**:
            *   **Pre-populated Swimlanes**: ${JSON.stringify(config.swimlanes, null, 2)}
            *   **Action**: Immediately call \`set_swimlanes_bulk\` with the EXACT array shown above.`;
    } else {
        // PARTIAL PRE-FILL - Names provided, some descriptions missing
        step7 = `7.  **Swimlane Inquiry (PARTIAL PRE-FILL)**:
            *   **Swimlanes with Missing Descriptions**: ${JSON.stringify(missingDescriptions)}
            *   **Probe**: For EACH swimlane in the "Missing Descriptions" list, ask ONE question...`;
    }
}
```

#### Bypass Scenarios
| Swimlanes Array | All Descriptions? | Mode | AI Behavior |
|-----------------|-------------------|------|-------------|
| ✗ (empty) | N/A | `[UNKNOWN]` | Ask user, confirm, probe all, call tool |
| ✓ (has items) | ✗ (some missing) | `[PARTIAL PRE-FILL]` | Acknowledge names, probe missing, confirm, call tool |
| ✓ (has items) | ✓ (all complete) | `[FULL BYPASS]` | Signpost → Call tool → Jump to Step 9 |

#### Example: FULL BYPASS
```javascript
// Config
{
    swimlanes: [
        { name: "Actions", description: "What the user physically does" },
        { name: "Tools", description: "Software or hardware used" },
        { name: "Feelings", description: "Emotional state during this phase" }
    ]
}

// Result
// AI Output: "We'll be tracking Actions, Tools, Feelings across each stage."
// [Immediately calls set_swimlanes_bulk → auto-calls generate_matrix → jumps to Step 9]
```

#### Example: PARTIAL PRE-FILL
```javascript
// Config
{
    swimlanes: [
        { name: "Actions", description: "What the user physically does" },
        { name: "Tools" }, // Missing description
        { name: "Feelings", description: "Emotional state during this phase" }
    ]
}

// Result
// AI Output: "I see we're tracking Actions, Tools, Feelings. What does Tools mean in this context?"
// [User responds: "Any software or hardware they use"]
// AI Output: "Perfect. So we have Actions (what they do), Tools (software/hardware), and Feelings (emotional state). Are these the right layers?"
// [User confirms: "Yes"]
// [AI calls set_swimlanes_bulk with complete array]
```

---

## Field Interaction Matrix

### Identity Fields Interaction (Step 1)

| Name | Role | Resulting Mode | AI Asks For |
|------|------|---------------|-------------|
| ✗ | ✗ | `[BOTH UNKNOWN]` | Name + Role |
| ✓ | ✗ | `[NAME ONLY]` | Role only |
| ✗ | ✓ | `[ROLE ONLY]` | Name only |
| ✓ | ✓ | `[BOTH KNOWN]` | Confirmation only |

### Journey Fields Interaction (Step 3)

| journeyName | journeyDescription | Resulting Mode | AI Asks For |
|-------------|-------------------|---------------|-------------|
| ✗ | ✗ | `[BOTH UNKNOWN]` | Activity description → Deduces name |
| ✓ | ✗ | `[NAME ONLY]` | Description only (name pre-filled) |
| ✓ | ✓ | `[FULL BYPASS]` | Nothing (jumps to Step 5) |
| ✗ | ✓ | *(Invalid)* | Not supported (name required if description provided) |

### Structure Fields Interaction (Steps 5-8)

| Phases | All Descriptions? | Swimlanes | All Descriptions? | Result |
|--------|------------------|-----------|-------------------|--------|
| ✗ | N/A | ✗ | N/A | Full interactive discovery (Steps 5-8) |
| ✓ | ✗ | ✗ | N/A | Partial phase bypass → Full swimlane discovery |
| ✓ | ✓ | ✗ | N/A | Full phase bypass → Full swimlane discovery |
| ✓ | ✓ | ✓ | ✗ | Full phase bypass → Partial swimlane bypass |
| ✓ | ✓ | ✓ | ✓ | **Full bypass (Steps 5-9)** → Jump to Step 10 (Cell Population) |

### Complete Template Bypass Scenario

**Maximum Bypass Configuration:**
```javascript
{
    // Identity
    name: "Alice",
    role: "Product Manager",

    // Journey
    journeyName: "Product Launch",
    journeyDescription: "Planning and executing a new product release",

    // Structure
    phases: [
        { name: "Planning", description: "Define scope and timeline" },
        { name: "Build", description: "Develop features and test" },
        { name: "Launch", description: "Release to market" }
    ],
    swimlanes: [
        { name: "Actions", description: "What the team does" },
        { name: "Tools", description: "Software used" },
        { name: "Pain Points", description: "Challenges encountered" }
    ]
}
```

**Result:** Interview starts at **Step 10 (Cell Population)** immediately after identity confirmation.

**Steps Bypassed:** Steps 3, 4, 5, 6, 7, 8, 9 (7 steps)

**Steps Remaining:**
- Steps 1-2: Identity confirmation (< 1 minute)
- Step 10: Cell population (bulk of interview - 9 cells in this case)
- Steps 11-13: Ethnographic analysis + artifact generation (3-4 questions)

---

## Context Injection Format

All pre-filled fields appear in the AI's context under two sections:

### CONTEXT FROM URL/SYSTEM
```
=== CONTEXT FROM URL/SYSTEM ===
- AGENT NAME: Max
- User Name: Alice
- User Role: Product Manager
- Journey Name: Product Launch
- Journey Description: Planning and executing a new product release
- PHASES (PRE-DEFINED) (COMPLETE): [{"name":"Planning",...}]
- SWIMLANES (PRE-DEFINED) (PARTIAL - some descriptions missing): [{"name":"Actions",...}]
- CURRENT JOURNEY ID: abc123 (Use this for all tool calls)

--- ADDITIONAL CONTEXT (Knowledge Base) ---
[RAG content here]
--- End of Additional Context ---
```

### LIVE JOURNEY STATE
```
=== LIVE JOURNEY STATE ===
CURRENT STAGE: CELL_POPULATION
STATUS: IN_PROGRESS
JOURNEY NAME: Product Launch
PHASES: Planning -> Build -> Launch
SWIMLANES: Actions, Tools, Pain Points

COMPLETION GATES:
{
  "identity": true,
  "journey": true,
  "phases": true,
  "swimlanes": true,
  "matrix": true,
  "cells": false
}

CELLS PROGRESS: 5 / 9 completed

CELL GRID STATUS (x = done, . = empty):
                |  Planning      |  Build         |  Launch        |
----------------+----------------+----------------+----------------+
Actions         |  x             |  x             |  .             |
Tools           |  x             |  .             |  .             |
Pain Points     |  x             |  .             |  .             |

NEXT EMPTY CELL: Build / Tools

⚠️  STAGE GATE REMINDER: You are currently in the "CELL_POPULATION" stage.
    Do NOT proceed to the next stage until the current completion gate is satisfied.
```

---

## Summary: Field Impact on Interview Length

| Template Complexity | Steps Bypassed | Estimated Interview Time |
|-------------------|----------------|-------------------------|
| **Blank (No pre-fills)** | 0 | 15-20 minutes |
| **Identity only** (name + role) | 0 | 14-18 minutes |
| **Journey only** (name + description) | 2 (Steps 3-4) | 13-17 minutes |
| **Structure only** (phases + swimlanes, all complete) | 4 (Steps 5-8) | 12-15 minutes |
| **Full bypass** (all fields complete) | 7 (Steps 3-9) | **8-12 minutes** |

**Note:** Cell population (Step 10) time scales with grid size:
- 3 phases × 3 swimlanes = **9 cells** (≈5-7 minutes)
- 5 phases × 4 swimlanes = **20 cells** (≈10-15 minutes)

---

## Changelog

### v3.0 (2026-02-09) - Post-Refactor
- **Added:** `journeyDescription` field support (FULL BYPASS for Step 3)
- **Added:** PARTIAL PRE-FILL mode for phases/swimlanes (missing descriptions)
- **Fixed:** Dual override system eliminated (welcome prompt unified)
- **Fixed:** Explicit data injection for bypass modes (full JSON shown)
- **Fixed:** Single source of truth for identity detection
- **Enhanced:** Gate instructions with explicit stage checks

### v2.0 (Pre-Refactor)
- Original template system with competing override mechanisms
- Ambiguous bypass logic (only names shown, not descriptions)
- Redundant identity detection across multiple layers

---

## Related Documentation

- [Journey Mapper AI Prompt System - Comprehensive Architectural Review](./TEMPLATE-FIELDS-REFERENCE.md)
- [Admin UI Guide](./front-end/admin/README.md)
- [API Documentation](./api-mcp/README.md)
