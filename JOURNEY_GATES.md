# Journey Mapper: Gates & State Machine

This document outlines the strict **12-Step Interaction Flow** and the backend **State Machine** that governs the Journey Mapping process.

The AI Agent acts as a "Rigid Interviewer" and is **gated** by the backend state. It cannot proceed to the next stage of the interview until the specific data requirements (Gates) for the current stage are met and persisted in the database.

## 1. State Machine Overview

| Step | UI State / Gate | Backend Stage (`stage`) | Goal | Gatekeeper Tool (Trigger) |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Welcome** | `IDENTITY` | Greet user (or skip if context known). | *N/A (Context Check)* |
| **2** | **Capture Identity** | `IDENTITY` | Get Name & Role. | `create_journey_map` |
| **3** | **Journey Setup** | `JOURNEY_DEFINITION` | Ask about the process. | *N/A (Conversation)* |
| **4** | **Capture Journey** | `JOURNEY_DEFINITION` | Get Journey Name & Context. | `update_journey_metadata` |
| **5** | **Phase Inquiry** | `PHASES` | Ask for high-level steps. | *N/A (Conversation)* |
| **6** | **Capture Phases** | `PHASES` | Lock in the sequence of phases. | `set_phases_bulk` |
| **7** | **Swimlane Inquiry** | `SWIMLANES` | Ask for actors/systems. | *N/A (Conversation)* |
| **8** | **Capture Swimlanes** | `SWIMLANES` | Lock in the list of actors. | `set_swimlanes_bulk` |
| **9** | **Matrix Generation** | `MATRIX_GENERATION` | Create grid (Phases x Swimlanes). | `generate_matrix` |
| **10** | **Capture Cells** | `CELL_POPULATION` | Fill in specific actions/pain-points. | `update_cell` (Loop) |
| **11** | **Completion** | `COMPLETE` | Finalize and thank user. | `generate_artifacts` |

---

## 2. Detailed Gate Definitions

### 🚪 Gate 1: Identity
*   **Current Stage:** `IDENTITY`
*   **Prompt Logic:** "Welcome. Please state your name and role." (Or custom `welcome-prompt`).
*   **Success Criteria:** The system must have a valid `name` and `role` for the user.
*   **Auto-Advance Trigger:** Calling `create_journey_map` successfully creates the journey record.
    *   *Note:* If Name/Role are passed via URL, this step may happen automatically in the background.

### 🚪 Gate 2: Journey Definition
*   **Current Stage:** `JOURNEY_DEFINITION`
*   **Prompt Logic:** "Describe an important end-to-end job you perform." (Or custom `journey-prompt`).
*   **Success Criteria:** The journey must have a `name` (succinct title) and `context` (description).
*   **Auto-Advance Trigger:** Calling `update_journey_metadata`.
    *   *Logic:* The backend checks `if (journey.name && journey.context) journey.stage = 'PHASES'`.

### 🚪 Gate 3: Phases
*   **Current Stage:** `PHASES`
*   **Prompt Logic:** "What are the high-level phases or steps? Please list them in order."
*   **Verification:** The AI must read back the sequence (A -> B -> C) and confirm with the user *before* saving.
*   **Success Criteria:** A non-empty list of `phases` objects.
*   **Auto-Advance Trigger:** Calling `set_phases_bulk`.
    *   *Logic:* The backend automatically advances `journey.stage = 'SWIMLANES'`.

### 🚪 Gate 4: Swimlanes
*   **Current Stage:** `SWIMLANES`
*   **Prompt Logic:** "Who are the actors, systems, or departments involved in these phases?"
*   **Verification:** The AI must confirm the list of actors with the user *before* saving.
*   **Success Criteria:** A non-empty list of `swimlanes` objects.
*   **Auto-Advance Trigger:** Calling `set_swimlanes_bulk`.
    *   *Logic:* The backend automatically advances `journey.stage = 'MATRIX_GENERATION'`.

### 🚪 Gate 5: Matrix Generation
*   **Current Stage:** `MATRIX_GENERATION`
*   **Prompt Logic:** (Internal Step) The AI should immediately trigger the matrix generation tool.
*   **Success Criteria:** The `cells` array in the database is populated with empty placeholder objects for every (Phase x Swimlane) combination.
*   **Auto-Advance Trigger:** Calling `generate_matrix`.
    *   *Logic:* The backend automatically advances `journey.stage = 'CELL_POPULATION'`.

### 🚪 Gate 6: Cell Population (The Loop)
*   **Current Stage:** `CELL_POPULATION`
*   **Prompt Logic:** The AI iterates through the grid.
    *   *Template:* "Moving on to the **[Phase Name]**. What specific tasks does the **[Swimlane Name]** handle here?"
*   **Success Criteria:** All cells must have `action` (content) and `context`.
*   **Exit Condition:** The backend calculates `percentCellsComplete`. When 100%, the AI is allowed to proceed to Completion.
    *   *Note:* The AI stays in this stage until *all* cells are addressed (or explicitly marked as N/A).

### 🚪 Gate 7: Completion
*   **Current Stage:** `COMPLETE`
*   **Action:** The AI calls `generate_artifacts` to create the final JSON/Mermaid summaries.
*   **Prompt Logic:** "Thank you, [Name]! Your journey map is complete."
*   **Final State:** Journey status updates to `READY_FOR_REVIEW`.

---

## 3. System Instruction & Enforcement

The Frontend Server (`server.js`) enforces these gates by injecting the **Live Journey State** directly into the AI's system prompt before every turn:

```text
--- LIVE JOURNEY STATE ---
CURRENT STAGE: PHASES
STATUS: DRAFT
COMPLETION GATES:
{
  "name": true,
  "role": true,
  "phases": false,
  "swimlanes": false,
  ...
}

INSTRUCTION: You are currently in the "PHASES" stage. 
Do NOT proceed to the next stage until the current gate is cleared.
```

This prevents the AI from "hallucinating" progress (e.g., claiming it has saved the swimlanes when it hasn't) because the backend serves as the single source of truth.
