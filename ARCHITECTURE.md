# Journey Mapper: System Architecture & Interaction Protocol

> **System Identity**: You are "Max", an expert UX Researcher and Journey Mapping facilitator. Your goal is to guide users through a structured 13-step interview process to generate high-fidelity user journey maps.

## 1. Core System Philosophy

### 1.1 The "Code-First" Directive
The system operates on a **Code-First, AI-Second** architecture. Critical logic (state transitions, data validation, gate enforcement) is handled by deterministic TypeScript code, NOT by the AI model. The AI is a conversational interface layer that executes instructions provided by the backend.

### 1.2 Separation of Concerns
- **The Brain (AI/Backend)**: Handles the interview, synthesizes user input, manages state, and executes tool calls.
- **The Face (Canvas)**: A passive rendering layer (`renderer.js`) that purely visualizes the current state. It does not contain business logic. It draws what the data says.

### 1.3 User Experience Principles
- **"No Blank Page"**: We pre-fill as much context as possible via Journey Templates.
- **"Trust but Verify"**: Pre-filled data can be confirmed or bypassed based on confidence.
- **"Conversational Flow"**: The interview should feel like a natural conversation, not a form filling exercise.
- **"Imperative Output"**: Cell content is written in an imperative, active voice (e.g., "Feeling frustrated," not "I feel frustrated").

---

## 2. Journey Template Schema (The "Source of Truth")

Templates drive the experience. They are stored in the `admin_links` collection and scoped to specific Journey types.

### 2.1 Identity & Metadata (with Confirmation Strategy)
Every variable collected supports a `confirmationMode`:
- `CONFIRM`: "I see your name is Scott. Is that correct?" (Verification)
- `BYPASS`: (Silently accepts "Scott" and moves to next step)

```typescript
interface TemplateIdentity {
  name: { value: string, confirmationMode: 'CONFIRM' | 'BYPASS' };
  role: { value: string, confirmationMode: 'CONFIRM' | 'BYPASS' };
}

interface TemplateMetadata {
  journeyName: { value: string, confirmationMode: 'CONFIRM' | 'BYPASS' };
  journeyDescription: { value: string, confirmationMode: 'CONFIRM' | 'BYPASS' };
}
```

### 2.2 Structural Configuration (Gates & Probes)
Gates enforce the structural integrity of the journey (Phases, Swimlanes). Each gate has specific probing logic.

- `probeMode`:
  - `ALWAYS_PROBE`: Ask for details even if pre-filled.
  - `NEVER_PROBE`: Accept pre-filled data as absolute truth.
  - `AUTO_PROBE`: Ask only if data quality/confidence is low.
- `probeThreshold`: (0.0 - 1.0) Confidence score required to skip probing in AUTO mode.

```typescript
interface TemplateStructure {
  phases: {
    data: Array<{ name: string, description?: string }>;
    gate: { probeMode: 'ALWAYS_PROBE' | 'NEVER_PROBE' | 'AUTO_PROBE', probeThreshold: number };
  };
  swimlanes: {
    data: Array<{ name: string, description?: string }>;
    gate: { probeMode: 'ALWAYS_PROBE' | 'NEVER_PROBE' | 'AUTO_PROBE', probeThreshold: number };
  };
}
```

### 2.3 Persona & Knowledge Base
- `agentName`: "Max" (default)
- `personaFrame`: "You are a sympathetic researcher..."
- `personaLanguage`: "Avoid jargon, use simple terms..."
- `ragContext`: Domain-specific knowledge base for final artifact synthesis.

---

## 3. The 13-Step Interaction Protocol

The interaction is a linear state machine. The AI **CANNOT** skip steps.

| Step | Stage | Gate | Action |
|---|---|---|---|
| **1-2** | `IDENTITY` | **Identity Gate** | Confirm User Name & Role. Call `create_journey_map`. |
| **3-4** | `JOURNEY_DEFINITION` | **Definition Gate** | Define Journey Name & Goal. Call `update_journey_metadata`. |
| **5-6** | `PHASES` | **Structure Gate (X-Axis)** | Define time-based steps. Call `set_phases_bulk`. |
| **7-8** | `SWIMLANES` | **Structure Gate (Y-Axis)** | Define experience layers. Call `set_swimlanes_bulk`. |
| **9** | `MATRIX_GENERATION` | **System Gate** | (Internal) Backend generates grid cells. |
| **10** | `CELL_POPULATION` | **Content Gate** | Iteratively fill every Phase/Swimlane intersection. |
| **11-12** | `COMPLETE` | **Analysis Gate** | 3 deep-dive ethnographic questions. |
| **13** | `COMPLETE` | **Artifact Gate** | Generate Summary, Mental Models, Quotes. Call `generate_artifacts`. |

---

## 4. Gatekeeper Architecture & Tooling

Tools are strictly scoped to the current stage. The backend REJECTS tool calls that are out of scope.

### 4.1 Tool Scoping Table
```typescript
const TOOL_SCOPES = {
  'IDENTITY': ['create_journey_map', 'update_journey_metadata'],
  'JOURNEY_DEFINITION': ['update_journey_metadata'],
  'PHASES': ['update_journey_metadata', 'set_phases_bulk'],
  'SWIMLANES': ['update_journey_metadata', 'set_swimlanes_bulk', 'generate_matrix'],
  'CELL_POPULATION': ['update_cell', 'update_journey_metadata'],
  'COMPLETE': ['update_ethnographic_progress', 'generate_artifacts', 'update_journey_metadata']
};
```

### 4.2 Core Tools (Function Declarations)

#### `create_journey_map` / `update_journey_metadata`
- **Purpose**: Initialize or update high-level journey data.
- **Trigger**: Steps 1-4.

#### `set_phases_bulk` / `set_swimlanes_bulk`
- **Purpose**: Define the grid structure.
- **Trigger**: Steps 5-8.
- **Note**: `set_swimlanes_bulk` automatically triggers matrix generation.

#### `update_cell`
- **Purpose**: Fill a specific grid cell.
- **Trigger**: Step 10 (Loop).
- **Targeting**: The system explicitly tells the AI which cell to focus on (e.g., "Target Phase 1, Swimlane 2").
- **Constraint**: Focus on ONE cell at a time. Do not hallucinate data.

#### `generate_artifacts`
- **Purpose**: Final synthesis.
- **Trigger**: Step 13.
- **Inputs**: Summary, Mental Models, Quotes.
- **RAG Integration**: Must synthesize `ragContext` if present.

---

## 5. Canvas Rendering Interface

The Canvas is a "dumb" terminal. It polls `/api/journey-state/:journeyId` and renders the JSON it receives.

- **Endpoint**: `GET /api/journey-state/:journeyId`
- **Frequency**: Polling (e.g., 2s).
- **Logic**:
  - `phases` -> Render Columns.
  - `swimlanes` -> Render Rows.
  - `cells` -> Render Cards at intersections.
  - `status` -> Show/Hide completion modal.

**Zero Logic Rule**: The Canvas never calculates completion or decides what to show. It only reflects the backend state.

---

## 6. Admin Configuration & Prompt Injection

The system constructs the "System Instruction" (Prompt) dynamically for every request.

### 6.1 Dynamic Prompt Assembly
1. **Load Base Template**: The core personality and rules.
2. **Inject Template Config**: Override standard variables (`{{AGENT_NAME}}`, etc.).
3. **Inject Gate Logic**:
   - If `confirmationMode === 'BYPASS'`, inject instruction: "Do not ask. Call tool X with value Y immediately."
   - If `probeMode === 'ALWAYS_PROBE'`, inject instruction: "Ask follow-up questions to deepen this data."
4. **Inject Current Context**: Add the current Journey State (JSON) to the prompt context window.

### 6.2 The "Silent Configuration" Pattern
The AI prompt is manipulated so the AI *thinks* it is following its natural flow, but the Admin has pre-decided the outcome.
- **User View**: "Wow, it already knows my name!"
- **AI View**: "My instructions say the name is 'Scott' and I must call `create_journey_map` immediately."

---

## 7. Future Roadmap: Kruft Removal & Optimization

### 7.1 Drift Analysis
- **Issue**: Prompt logic has become fragmented across `server.ts` and `prompts.ts`.
- **Plan**: Centralize prompt assembly into a `PromptBuilder` service.
- **Issue**: Gate logic is hardcoded.
- **Plan**: Refactor Gates into a configuration-driven engine handled by the `TemplateService`.

### 7.2 Implementation Plan
1. **Refactor Data Model**: Update Firestore schemas to support `confirmationMode` and `probeMode`.
2. **Update Admin UI**: Add controls for these new settings.
3. **Rewrite Prompt Engine**: Implement the `PromptBuilder` to handle the conditional injection logic cleanly.
4. **Verify Tool Scopes**: Ensure strict enforcement of tool scopes in `server.ts`.
