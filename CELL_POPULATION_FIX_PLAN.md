# Cell Population Fix Plan (Revised)

**Date**: 2026-02-11
**Branch**: staging
**Goal**: Robust, enforcement-based cell population with minimal context load.

---

## The Core Problem

The AI is suffering from **Context Overload** and **Lack of Enforcement**.
- **Overload**: We currently feed the entire `journeyState` JSON (including all empty cells) to the AI on every turn. As the grid grows (e.g., 5 phases × 4 swimlanes = 20 cells), the token count explodes, causing "hiccups" (empty responses) and hallucinations.
- **Enforcement**: The AI "sees" the whole grid and tries to "manage" it. We need to put "blinders" on it so it can only see and act on **ONE CELL** at a time.

## The Strategy: "The Blinders Protocol"

We will shift the burden of tracking the grid from the **AI's context window** to the **Backend Logic**.
1.  **Backend** determines the Next Target Cell.
2.  **Prompt** receives ONLY that cell's context (plus necessary high-level phase/swimlane info).
3.  **AI** is forced to act on that single cell.
4.  **Tool** (`update_cell`) saves it.
5.  **Cycle** repeats.

---

## Detailed Fixes

### 1. Context Load Reduction (CRITICAL)
**File**: `api-mcp/src/ai/prompts.ts`
**Action**:
- In `buildSystemInstruction`, when stage is `CELL_POPULATION`:
  - **Sanitize `journeyState`**: Create a lightweight version that **EXCLUDES** the `cells` array.
  - **Inject ONLY**: `phases`, `swimlanes`, and `metrics`.
  - **Reasoning**: The AI does not need to see 20+ cell objects. It only needs the *current* one (provided by `buildNextTargetContext`). This reduces token load by ~60%.

### 2. Prompt Instruction Trimming (Focus)
**File**: `api-mcp/src/ai/prompts.ts`
**Action**:
- When stage is `CELL_POPULATION`, **REMOVE** instructions for Steps 1-8 (Identity, Journey, Phases, Swimlanes).
- **Reasoning**: These steps are done. Including them confuses the model and wastes tokens. The prompt should focus 100% on "Ask Question → Get Answer → Update Cell".

### 3. Backend Enforcement of Completion Flags
**File**: `api-mcp/src/services/journey.service.ts`
**Action**:
- Automatically set `arePhasesComplete = true` after `set_phases_bulk` succeeds.
- Automatically set `areSwimlanesComplete = true` after `set_swimlanes_bulk` succeeds.
- **Reasoning**: Removes dependency on AI remembering to call `update_journey_metadata`. Ensures state is valid for `CELL_POPULATION` entry.

### 4. Tool Scoping & Safety
**File**: `api-mcp/src/ai/tools.ts`
**Action**:
- Add `generate_matrix` to `CELL_POPULATION` scope.
- **Reasoning**: Safety net. If matrix is missing, AI can regenerate it instead of crashing.

### 5. Smarter Retry Logic
**File**: `api-mcp/src/server.ts`
**Action**:
- In the "Empty Candidates" retry loop, if stage is `CELL_POPULATION`, force a **Fresh Model** + **Fresh Journey State**.
- **Reasoning**: The "brief hiccup" is often due to a stale model state or safety filter on the exact prompt context. Refreshing context clears the blockage.

### 6. Robust Logging
**File**: `api-mcp/src/services/ai.service.ts`
**Action**:
- Log every `update_cell` attempt, inputs, and resolution method.
- **Reasoning**: Currently we fly blind if a cell update fails silently.

---

## Implementation Plan

| Step | Task | Target File | Impact |
|------|------|-------------|--------|
| **1** | **Optimize Context (Blinders)** | `prompts.ts` | **High** (Solves "Hiccup") |
| **2** | **Trim Instructions** | `prompts.ts` | **High** (Solves Hallucination) |
| **3** | **Auto-Complete Flags** | `journey.service.ts` | **Medium** (Fixes State) |
| **4** | **Smart Retry** | `server.ts` | **Medium** (Reliability) |
| **5** | **Tool Scope & Logging** | `tools.ts`, `ai.service.ts` | **Low** (Safety/Debug) |

---

## Verification Plan

1. **Deploy** changes.
2. **Start Journey**: "Bury Bodies" (2 phases, 2 swimlanes).
3. **Reach Step 10**: Verify "NEXT TARGET CELL" is the *only* cell context visible (in logs/debug).
4. **Answer**: "It is hard work."
5. **Observe**:
   - AI calls `update_cell`.
   - AI immediately asks about the *next* cell (e.g., "Clean / Feeling").
   - No "brief hiccup".
   - `arePhasesComplete` is true.

This plan directly addresses "Context Load" and "Enforcement".
