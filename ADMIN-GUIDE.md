# Journey Mapper Admin Guide

**Version:** 3.2.0
**Last Updated:** 2026-02-10

---

## Table of Contents

1. [Admin Panel Fields](#admin-panel-fields)
2. [Interview Gates & Data Collection](#interview-gates--data-collection)
3. [Data Flow Architecture](#data-flow-architecture)

---

## Admin Panel Fields

### Template Configuration

#### **Template Name** (Required)
- **Purpose:** Identifies the template in the template picker
- **Example:** "Employee Onboarding", "Customer Support Journey"
- **Where it goes:** Displayed as the template title in the chooser UI
- **Usage:** Users see this when selecting a journey template

#### **Description** (Required)
- **Purpose:** Brief explanation shown to users when selecting the template
- **Example:** "Map the experience of new employees joining your organization"
- **Where it goes:** Template picker card subtitle
- **Character Limit:** ~150 characters recommended
- **Usage:** Helps users understand what journey type this template is for

#### **Template Icon**
- **Purpose:** Visual identifier for the template
- **Options:** 20+ icons (activity, briefcase, calendar, chart, clock, code, coffee, compass, database, file, flag, globe, heart, home, key, layers, map, package, rocket, shield, star, target, tool, truck, user, users, zap)
- **Where it goes:** Template picker card icon
- **Default:** "activity" if not specified
- **Usage:** Quick visual recognition in template gallery

#### **Visible Globally**
- **Purpose:** Controls whether template appears in the public template picker
- **Values:**
  - ON: Template visible to all users
  - OFF: Template only accessible via direct URL
- **Where it goes:** Template picker UI (if enabled)
- **Usage:** Allows private templates for specific use cases

#### **Require Authentication**
- **Purpose:** Controls access restrictions for this journey template
- **Values:**
  - ON: Users must sign in before starting journey
  - OFF: Anyone with the link can start (anonymous access)
- **Where it goes:** Triggers Firebase Auth gate on journey start
- **Usage:** Protect sensitive research sessions or limit access

---

### Pre-fill Parameters

These fields allow you to bypass interview gates by pre-defining journey context. They work hierarchically - each pre-fill can skip or pre-populate specific gates.

#### **Name**
- **Field ID:** `name`
- **Purpose:** Pre-fills the user's first name
- **Gates Bypassed:** Step 1 (partial) - skips name question
- **What it does:** AI uses this name in conversation without asking "What's your name?"
- **Example:** "Alice" → AI says "Welcome, Alice!"
- **URL Parameter:** `?name=Alice`
- **Data Structure:** String, stored in `journey.userName`

#### **Role**
- **Field ID:** `role`
- **Purpose:** Pre-fills the user's job title or role
- **Gates Bypassed:** Step 1 (partial) - skips role question
- **What it does:** AI uses this role in context without asking "What do you do?"
- **Example:** "Product Manager" → AI understands user context
- **URL Parameter:** `?role=Product%20Manager`
- **Data Structure:** String, stored in `journey.role`
- **Combined with Name:** Fully bypasses Step 1 (Identity Gate)

#### **Journey Name**
- **Field ID:** `journey`
- **Purpose:** Pre-defines the journey title
- **Gates Bypassed:** Step 3 (partial) - skips journey name question
- **What it does:** AI uses this as the journey title without asking
- **Example:** "Employee Onboarding" → Journey titled "Employee Onboarding"
- **URL Parameter:** `?journey=Employee%20Onboarding`
- **Data Structure:** String, stored in `journey.name`

#### **Journey Description**
- **Field ID:** `journey-description`
- **Purpose:** Pre-fills detailed journey context
- **Gates Bypassed:** Step 3 (full) - completely skips journey inquiry gate
- **What it does:** AI uses this as journey description, moves straight to Step 5 (Phases)
- **Example:** "The process of bringing a new employee into the organization, from offer letter to first 90 days"
- **URL Parameter:** `?journey-description=...` (encoded)
- **Data Structure:** String, stored in `journey.description`
- **IMPORTANT:** Only bypasses Step 3 if BOTH Journey Name AND Description are provided

#### **Phases** (JSON Array)
- **Field ID:** `phases` (not visible in UI - URL only)
- **Purpose:** Pre-defines the journey phases (horizontal axis)
- **Gates Bypassed:** Step 5 - skips phase collection
- **What it does:** AI uses these phases without asking user to define them
- **Example:** `?phases=[{"name":"Pre-Arrival"},{"name":"Day 1"},{"name":"First Week"}]`
- **Data Structure:** Array of objects with `name` and optional `description`
- **URL Parameter:** JSON array, URL-encoded
- **Combined Effects:** With Name, Role, Journey, Description → Jumps to Step 7 (Swimlanes)

#### **Swimlanes** (JSON Array)
- **Field ID:** `swimlanes` (not visible in UI - URL only)
- **Purpose:** Pre-defines the swimlanes (vertical axis/experience layers)
- **Gates Bypassed:** Step 7 - skips swimlane collection
- **What it does:** AI uses these swimlanes without asking user to define them
- **Example:** `?swimlanes=[{"name":"Actions"},{"name":"Feelings"},{"name":"Pain Points"}]`
- **Data Structure:** Array of objects with `name` and optional `description`
- **URL Parameter:** JSON array, URL-encoded
- **Combined Effects:** With all previous pre-fills → Jumps directly to Step 10 (Cell Population)

---

### AI Customization

#### **Welcome Prompt**
- **Field ID:** `welcome-prompt`
- **Purpose:** Custom instruction for the initial greeting (Step 1)
- **Where it goes:** Injected into Step 1 system instruction
- **What it does:** Overrides default greeting behavior
- **Example:** "Greet the user like a friendly pirate who is excited to learn about their adventure"
- **Default:** Standard UX researcher greeting
- **Character Limit:** ~500 characters recommended
- **Data Structure:** String, passed to `buildStep1()`

#### **Journey Prompt**
- **Field ID:** `journey-prompt`
- **Purpose:** Custom instruction for journey inquiry (Step 3)
- **Where it goes:** Injected into Step 3 system instruction
- **What it does:** Guides how AI asks about the journey
- **Example:** "Ask specifically about risk factors and compliance checkpoints in their workflow"
- **Default:** Standard "tell me about an important activity" approach
- **Character Limit:** ~500 characters recommended
- **Data Structure:** String, passed to `buildStep3()`

#### **RAG Context**
- **Field ID:** `ragContext`
- **Purpose:** Additional background knowledge for the AI to reference
- **Where it goes:** Injected into ALL system instructions (every step)
- **What it does:** Provides domain-specific context, terminology, product docs
- **Example:** "Product Name: Acme CRM. Key Features: Lead Scoring (scores 0-100), Email Sequences (automated drip campaigns), Dashboard (real-time analytics)"
- **Use Cases:**
  - Product documentation snippets
  - Industry terminology definitions
  - Research brief context
  - Compliance requirements
- **Character Limit:** 4,000 characters (hard limit)
- **Data Structure:** String, stored in `sessionConfig.ragContext`

#### **Persona Frame**
- **Field ID:** `personaFrame`
- **Purpose:** Defines the AI's research framing and approach
- **Where it goes:** System instruction persona section
- **What it does:** Sets the AI's mental model for conducting the interview
- **Example:** "Treat this as a research interview to understand the user's 'jobs to be done', tools, and feelings"
- **Default:** "You are conducting ethnographic research using journey mapping methodology"
- **Character Limit:** ~300 characters recommended
- **Data Structure:** String, stored in `sessionConfig.personaFrame`

#### **Persona Language**
- **Field ID:** `personaLanguage`
- **Purpose:** Controls vocabulary the AI uses with the user
- **Where it goes:** System instruction language section
- **What it does:** Defines which terms to use/avoid
- **Example:** "Avoid technical mapping terms like 'Journey Map', 'Swimlane', 'Phase'. Use natural terms like 'stages', 'activities', 'what happens next'"
- **Default:** Avoids technical jargon, uses conversational language
- **Character Limit:** ~300 characters recommended
- **Data Structure:** String, stored in `sessionConfig.personaLanguage`

---

### Global Settings

#### **Agent Name**
- **Field ID:** `agentName`
- **Purpose:** Name of the AI assistant displayed in chat
- **Where it goes:**
  - Chat UI (agent message labels)
  - System prompts (AI refers to itself by this name)
  - Transcript exports
- **Default:** "MAX"
- **Example:** "Max", "Journey Guide", "Research Assistant"
- **Data Structure:** String, stored in `settings.agentName`

#### **AI Model**
- **Field ID:** `activeModel`
- **Purpose:** Selects which Gemini model to use
- **Options:**
  - **gemini-2.5-flash-lite** (Fastest, Cheapest) - Default
  - **gemini-2.5-flash** (Balanced)
  - **gemini-2.5-pro** (Most Capable, Expensive)
- **Where it goes:** Vertex AI model selection
- **What it does:** Controls AI capability vs. cost tradeoff
- **Cost Impact:**
  - Lite: ~$0.01 per journey
  - Flash: ~$0.05 per journey
  - Pro: ~$0.25 per journey
- **Fallback Logic:** If rate-limited, automatically falls back to next tier
- **Data Structure:** String, stored in `settings.activeModel`

#### **Auto-Activate New Templates**
- **Field ID:** `autoActivateToggle`
- **Purpose:** Automatically show new templates when created
- **Values:**
  - ON: New templates visible immediately
  - OFF: Templates start hidden (must manually enable "Visible Globally")
- **Where it goes:** Template creation logic
- **Default:** OFF
- **Data Structure:** Boolean

---

## Interview Gates & Data Collection

The AI conducts a 13-step structured interview, organized into 5 gates (stages). Each gate collects specific data and transitions the journey state.

---

### Gate 1: IDENTITY STAGE (Steps 1-2)

**Purpose:** Establish who the user is and their role context

#### Step 1: Name Collection
**Question:** "What is your name?"
**Data Collected:**
- `journey.userName` (String) - User's first name
- Example: "Alice", "Bob", "Sarah Chen"

**Can Be Bypassed By:**
- Admin Pre-fill: `name` parameter
- Skips to: Role question (Step 2)

#### Step 2: Role Collection
**Question:** "What do you do?" or "What is your role?"
**Data Collected:**
- `journey.role` (String) - Job title or role description
- Example: "Product Manager", "Software Engineer", "Restaurant Manager"

**Can Be Bypassed By:**
- Admin Pre-fill: `role` parameter
- Combined Bypass: Both `name` AND `role` → Skips entire Identity Gate

**Tool Called:** `create_journey_map(name, userName, role)`

**State Transition:** `IDENTITY` → `PHASES`

**Canvas Update:** Journey header displays user identity

---

### Gate 2: JOURNEY DEFINITION (Steps 3-4)

**Purpose:** Define what journey/activity we're mapping and why it matters

#### Step 3: Journey Name & Context
**Questions:**
1. "Tell me about an important activity you perform as a [role], and why it matters"
2. (Follow-up if needed) "What would you call this activity/journey?"

**Data Collected:**
- `journey.name` (String) - Journey title
  - Example: "Employee Onboarding", "Deploying a Production Hotfix", "Planning a Science Unit"
- `journey.description` (String) - What the journey is about and why it matters
  - Example: "Bringing new employees into the organization from offer acceptance through their first 90 days. Matters because it sets the foundation for employee success and retention."

**Can Be Bypassed By:**
- Partial Bypass: `journey` parameter (pre-fills name, still asks for description)
- Full Bypass: Both `journey` AND `journey-description` → Skips to Step 5 (Phases)

**Tool Called:** `update_journey_metadata(journeyMapId, name, description)`

**State Transition:** Stays in `PHASES` stage (Journey Definition phase)

**Canvas Update:** Journey header displays journey name and description

---

### Gate 3: PHASES STRUCTURE (Steps 5-6)

**Purpose:** Define the horizontal axis - time-based stages of the journey

#### Step 5: Phase Collection
**Questions:**
1. "What are the high-level steps you go through? List them out for me"
2. (If needed) "For example: 'Prepare, Execute, Review'"

**Data Collected:**
- `journey.phases[]` (Array of Objects)
- Each phase object contains:
  - `phaseId` (UUID) - Unique identifier
  - `sequence` (Integer) - Order number (1, 2, 3...)
  - `name` (String) - Phase title
    - Example: "Discovery", "Implementation", "Review"
  - `description` (String) - What this phase represents
    - Example: "Researching and understanding requirements"
  - `context` (String) - Optional additional context
  - `summary` (String) - Generated after cell completion

**Collection Pattern:**
1. AI asks for phase names as a list
2. User provides: "Phase A, Phase B, Phase C"
3. AI confirms: "So the phases are [A], [B], [C]. Does that sound right?"
4. User confirms: "Yes"
5. AI calls tool to save phases

**Minimum:** 2 phases
**Maximum:** 12 phases (recommended)
**Typical:** 4-8 phases

**Can Be Bypassed By:**
- Admin Pre-fill: `phases` JSON array parameter
- Combined with previous bypasses → Skips to Step 7 (Swimlanes)

**Tool Called:** `set_phases_bulk(journeyMapId, phases[])`

**State Transition:** `PHASES` → `SWIMLANES`

**Canvas Update:** Column headers appear with phase names

---

### Gate 4: SWIMLANES STRUCTURE (Steps 7-8)

**Purpose:** Define the vertical axis - experience layers to track across phases

#### Step 7: Swimlane Collection
**Questions:**
1. "Now let's think about the layers we should track across each stage. What layers are important for understanding this experience?"
2. (If needed) "Common examples are Actions, Feelings, Pain Points, and Tools"

**Data Collected:**
- `journey.swimlanes[]` (Array of Objects)
- Each swimlane object contains:
  - `swimlaneId` (UUID) - Unique identifier
  - `sequence` (Integer) - Order number (1, 2, 3...)
  - `name` (String) - Swimlane title
    - Example: "Actions", "Feelings", "Pain Points", "Tools"
  - `description` (String) - What this layer captures
    - Example: "What the user physically does at each stage"
  - `context` (String) - Optional additional context
  - `summary` (String) - Generated after cell completion

**Collection Pattern:**
1. AI asks for swimlane names
2. User provides: "Actions and Feelings"
3. (Optional) AI may probe for description: "What should we capture in 'Actions'?"
4. AI confirms: "So we'll track [Actions] and [Feelings]. Does that sound right?"
5. User confirms: "Yes"
6. AI calls tool to save swimlanes

**Minimum:** 2 swimlanes
**Maximum:** 6 swimlanes (recommended)
**Typical:** 3-4 swimlanes

**Common Swimlane Types:**
- **Actions** - What they do
- **Thinking** - What they're considering
- **Feeling** - Emotional state
- **Pain Points** - Frustrations/difficulties
- **Tools** - Systems/tools used
- **Touchpoints** - Interfaces/interactions
- **Opportunities** - Improvement areas
- **Metrics** - Measurable outcomes

**Can Be Bypassed By:**
- Admin Pre-fill: `swimlanes` JSON array parameter
- Combined with all previous bypasses → Skips directly to Step 10 (Cell Population)

**Tool Called:** `set_swimlanes_bulk(journeyMapId, swimlanes[])`

**Automatic Side Effect:** This tool INTERNALLY calls `generate_matrix()` to create the cell grid

**State Transition:** `SWIMLANES` → `CELL_POPULATION`

**Canvas Update:**
- Row headers appear with swimlane names
- Empty cell grid generated (Phases × Swimlanes)

---

### Gate 5: CELL POPULATION (Step 10)

**Purpose:** Fill each cell with user experience data, working chronologically through the grid

#### Step 10: Cell-by-Cell Interview Loop
**Pattern:** AI asks about ONE cell at a time, moving left-to-right, top-to-bottom

**Question Format:**
"In the [PHASE NAME] stage, under [SWIMLANE NAME], [specific question about that intersection]"

**Examples:**
- "In the Discovery phase, what Actions do you take?"
- "During Implementation, what are your Feelings?"
- "In the Review stage, what Pain Points do you encounter?"

**Data Collected:**
- `journey.cells[]` (Array of Objects)
- Each cell object contains:
  - `cellId` (UUID) - Unique identifier
  - `phaseId` (UUID) - Links to phase
  - `swimlaneId` (UUID) - Links to swimlane
  - `headline` (String) - 5-10 word summary
    - Example: "Reviewing documentation and asking questions"
  - `description` (String) - 2-3 sentence detailed description
    - Example: "Reading through onboarding docs, watching training videos, and reaching out to team members with clarifying questions about tools and processes"
  - `context` (String) - Optional additional context
  - `action` (String) - Deprecated field

**Cell Population Logic:**
1. AI checks `NEXT TARGET CELL` in journey state
2. Asks question specific to that Phase × Swimlane intersection
3. User responds with experience details
4. AI synthesizes response into headline + description
5. AI calls `update_cell()` tool immediately
6. AI confirms save: "Got it, saved"
7. AI moves to next cell, repeats

**Expected Cell Count:** Phases × Swimlanes
- Example: 5 phases × 3 swimlanes = 15 cells to populate

**Completion Criteria:**
- `completionStatus.cells: true` in journey state
- All cells have non-empty headlines
- `percentCellsComplete: 100`

**Cannot Be Bypassed** - This is the core interview data

**Tool Called:** `update_cell(journeyMapId, cellId, headline, description)` - Called once per cell

**State Transition:** Stays in `CELL_POPULATION` until all cells complete

**Canvas Update:** Each cell fills with headline + description as interview progresses

**Progression Tracking:**
- Journey state includes `metrics.percentCellsComplete`
- AI can see which cells remain empty
- Frontend shows real-time grid population

---

### Gate 6: ETHNOGRAPHIC ANALYSIS (Steps 11-12)

**Purpose:** Gather deeper insights through reflective questions

#### Step 11: The 3 Deep-Dive Questions

**These questions MUST be asked one at a time, one per conversation turn**

##### Question 1: Gap Analysis
**Question:** "Looking across everything we've mapped, where do you see the biggest gaps or disconnects?"

**Purpose:** Identify systemic issues, process breakdowns, unmet needs

**Data Collected:**
- Stored in conversation history
- Used to generate `summaryOfFindings` in Step 13
- May prompt `update_journey_metadata()` if user adds context

**Example Answers:**
- "The handoff between teams is where things fall apart"
- "We lack visibility into what's happening in the Implementation phase"
- "There's no feedback loop from Review back to Discovery"

##### Question 2: Magic Wand
**Question:** "If you had a magic wand and could change one thing about this experience, what would it be?"

**Purpose:** Surface ideal state, innovation opportunities, user aspirations

**Data Collected:**
- Stored in conversation history
- Used to generate `mentalModels` and `summaryOfFindings`
- Reveals user priorities and pain severity

**Example Answers:**
- "Automate the entire approval process"
- "Have a dedicated mentor assigned from day one"
- "Real-time visibility into deployment status"

##### Question 3: Synthesis
**Question:** "Stepping back and looking at the whole journey, what stands out to you the most?"

**Purpose:** User's own synthesis, unexpected insights, emotional highlights

**Data Collected:**
- Stored in conversation history
- Used to generate `mentalModels` and `quotes[]`
- Often yields verbatim quotes for final report

**Example Answers:**
- "It's surprising how much time is wasted waiting for approvals"
- "The emotional rollercoaster is exhausting - excited, then anxious, then relieved"
- "Everything depends on that one person knowing the tribal knowledge"

**BLOCKING REQUIREMENT:** AI cannot proceed to Step 12 until ALL 3 questions are asked

#### Step 12: Final Check
**Question:** "Is there anything else you'd like to add or any part of the journey we should revisit?"

**Purpose:** Catch missed details, allow user to add final context

**Data Collected:**
- Optional updates to journey metadata
- May trigger `update_journey_metadata()` if user adds info
- Ensures user feels heard and complete

**Typical Responses:**
- "No, I think we covered everything"
- "Actually, I forgot to mention..." (AI captures and updates)
- "Can we add more detail to [specific cell]?" (AI updates cell)

**State Transition:** Stays in `COMPLETE` stage

**Tool Called (Optional):** `update_journey_metadata()` if user adds context

---

### Gate 7: ARTIFACT GENERATION (Step 13)

**Purpose:** Synthesize all collected data into final deliverables

#### Step 13: Final Synthesis & Export

**What Happens:**
AI analyzes the ENTIRE conversation history and generates:

1. **Summary of Findings**
   - Comprehensive overview of the journey
   - Key pain points and friction areas
   - Critical insights and patterns
   - Recommendations based on gaps identified
   - Format: 2-4 paragraph narrative

2. **Mental Models**
   - Belief frameworks revealed in conversation
   - Underlying assumptions driving user behavior
   - Decision-making patterns
   - Format: Numbered list with explanations
   - Example: "1. Time is Money: User explicitly equates delays with financial loss"

3. **Quotes**
   - 2-5 verbatim user quotes (exact words from transcript)
   - Selected for insight value and authenticity
   - Captures voice and emotion
   - Format: Array of quoted strings
   - Example: ["This is the absolute worst part of my day", "When it works, it's magic"]

**Data Structure Generated:**
```json
{
  "summaryOfFindings": "Comprehensive narrative summary...",
  "mentalModels": "1. Model A: Description\n2. Model B: Description...",
  "quotes": [
    "Direct quote from user",
    "Another insightful quote",
    "Emotionally revealing statement"
  ],
  "status": "READY_FOR_REVIEW",
  "stage": "COMPLETE"
}
```

**Tool Called:** `generate_artifacts(journeyMapId, summaryOfFindings, mentalModels, quotes[])`

**State Transition:** `COMPLETE` (stage remains, status changes to `READY_FOR_REVIEW`)

**Canvas Update:**
- Artifact panel displays final synthesis
- Journey marked as complete
- Export buttons become available (PDF, Transcript, Copy Chat)

**Cannot Be Bypassed** - This is the final deliverable generation

---

## Data Flow Architecture

### Session Configuration Flow
```
Admin Panel → URL Generation → Frontend State → API Request → AI System Instruction
```

1. Admin fills form fields
2. "Generate URL" creates shareable link with encoded parameters
3. User visits URL → Frontend parses parameters into `sessionConfig`
4. User sends message → `sessionConfig` sent to `/api/chat`
5. Backend calls `buildSystemInstruction(sessionConfig, journeyState)`
6. AI receives customized prompt based on config

### Tool Execution Flow
```
AI Decision → Function Call → Backend Validation → Store Method → Database Write → State Refresh → Canvas Update
```

1. AI decides to call tool (based on conversation + system instruction)
2. Gemini returns `functionCall` in response
3. Server.ts receives function call, validates parameters
4. Server.ts calls `aiService.executeTool(toolName, args)`
5. AIService routes to appropriate JourneyService method
6. JourneyService updates journey in Store (Firestore or JSON)
7. Store saves data, triggers stage transition if needed
8. Journey state refreshed with new data
9. Server rebuilds AI model with updated system instruction
10. SSE event sent to frontend: `{tool: 'tool_name', status: 'success'}`
11. Frontend polls `/api/journey-state/{id}` (every 2 seconds)
12. Renderer.js receives updated journey, re-renders canvas

### Stage Transition Logic

**Automatic Transitions (Tool-Triggered):**
- `create_journey_map()` → `IDENTITY` to `PHASES`
- `set_phases_bulk()` → `PHASES` to `SWIMLANES`
- `set_swimlanes_bulk()` → `SWIMLANES` to `CELL_POPULATION`
- Last `update_cell()` completing grid → `CELL_POPULATION` to `COMPLETE`

**Manual Transitions:**
- None - all transitions are tool-triggered and automatic

### Completion Status Tracking

The journey state includes a `completionStatus` object:
```json
{
  "completionStatus": {
    "name": true,      // Has journey name
    "role": true,      // Has user role
    "description": true, // Has journey description
    "phases": false,   // Has phases defined
    "swimlanes": false, // Has swimlanes defined
    "cells": false     // All cells populated
  }
}
```

AI uses this to determine:
- Which gate it's currently in
- What data is still needed
- When to proceed to next step

### Metrics Tracking

Real-time metrics calculated on every state refresh:
```json
{
  "metrics": {
    "totalPhases": 5,
    "totalSwimlanes": 3,
    "totalCellsExpected": 15,
    "totalCellsPresent": 15,
    "totalCellsCompleted": 12,
    "percentCellsComplete": 80.0
  }
}
```

Frontend uses `percentCellsComplete` to show progress indicators.

---

## Key Behavioral Rules

### Single-Gate Confirmation
**Rule:** AI must confirm ONLY the current gate's data, not recap previous gates

**Wrong:** "So the journey is [name], the stages are [phases], and layers are [swimlanes]. Does that sound right?"

**Correct (Step 5):** "So the stages are [phases]. Does that flow look right?"

**Why:** Reduces cognitive load, focuses user on current decision

### Tool-First Protocol
**Rule:** AI must call tool IMMEDIATELY after confirmation, BEFORE narrating

**Wrong:** "Great! I'm adding those stages..." (narrates without calling tool)

**Correct:**
1. User: "Yes"
2. [Tool call: `set_phases_bulk`]
3. [Wait for tool success]
4. AI: "I've added those 2 stages to the grid" (past tense)

**Why:** Prevents hallucination where AI narrates actions without executing them

### Conditional Tool Forcing
**Implementation:** When user confirms with "yes/yeah/yep/correct", backend detects confirmation and forces `FunctionCallingMode.ANY` for that turn only

**Log Output:** `🎯 CONFIRMATION DETECTED: Forcing mode=ANY`

**Why:** Ensures AI cannot skip tool execution on confirmation responses

---

## Troubleshooting

### Issue: Phases/Swimlanes Not Appearing
**Symptom:** User confirms but grid stays empty
**Cause:** AI hallucinated tool call without executing
**Check:** Console logs for `🎯 CONFIRMATION DETECTED` and `[TOOL] set_phases_bulk - executing`
**Fix:** v3.2.0 implements conditional mode=ANY to force tool execution

### Issue: Journey Starts at Wrong Step
**Symptom:** AI asks for phases when they should be pre-filled
**Cause:** Pre-fill parameters not properly encoded in URL
**Check:** URL contains `?phases=[...]` with properly JSON-encoded array
**Fix:** Use admin panel "Generated URL" output, don't manually construct URLs

### Issue: RAG Context Not Being Used
**Symptom:** AI doesn't reference provided context
**Cause:** Context too long (>4000 chars) or not relevant to current question
**Check:** Character count in RAG Context field
**Fix:** Reduce to most essential info, use bullet points, prioritize terminology

### Issue: Canvas Shows Old Data
**Symptom:** Grid doesn't update after tool execution
**Cause:** Frontend polling not running or journey ID mismatch
**Check:** Browser console for `[POLL]` logs, verify journey ID matches
**Fix:** Hard refresh (Cmd+Shift+R), clear localStorage, restart journey

---

## Version History

- **v3.2.0** (2026-02-10): Conditional mode=ANY prevents hallucination on confirmations
- **v3.1.0** (2026-02-10): Auto mode + debug diagnostics in COPY CHAT
- **v3.0.0** (2026-02-10): Tool-First Protocol + enforced tool calling
- **v2.0.0** (2026-02-09): Schema flexibility (optional descriptions)
- **v1.0.0** (Initial): Core 13-step interview implementation
