# Journey Mapper: Prompt Engineering & State Machine Architecture

**Version:** 3.5.0 (Feb 10, 2026)  
**Author:** Senior Vertex AI Prompt Engineer  
**Status:** Production Ready - Refined based on Feedback

---

## 1. Executive Summary

This document serves as the "Prompt Engineering Bible" for the Journey Mapper application. The core intelligence of the application is not a monolithic "do it all" prompt, but a sophisticated **State Machine** implemented via dynamic system instruction injection.

The AI's behavior is **Code-First**, meaning business logic (like checking if phases are pre-defined) runs in TypeScript *before* the prompt is generated. The LLM receives only the specific instructions relevant to the current millisecond of the user's journey.

---

## 2. The Refined State Machine

The user experience is guided through a strict sequence of stages.

### Stage 1: Identity (Steps 1-2)
*   **Goal:** Establish who the user is.
*   **Tools:** `create_journey_map`
*   **Logic:**
    *   **Both Known:** Confirm ("Hi [Name], are you a [Role]?")
    *   **Name Known / Role Unknown:** "Hi [Name], what is your role?"
    *   **Role Known / Name Unknown:** "I see you are a [Role]. What is your name?"
    *   **Both Unknown:** "What is your name and role?"
*   **Gate:** Must capture `userName` and `role` before proceeding.

### Stage 2: Journey Description (Steps 3-4)
*   **Goal:** Capture the *purpose* and *scope* of the journey.
*   **Tools:** `update_journey_metadata` (partial)
*   **Logic:**
    *   If Description in URL → **Bypass** (Silent update)
    *   If missing → **Ask** ("Tell me about an important activity you do.")
*   **Constraint:** Focus on the *activity*, not the title yet.

### Stage 2.5: Journey Naming (New Step)
*   **Goal:** Establish a canonical name for the journey.
*   **Logic:**
    *   If Name in URL → **Bypass**
    *   If unknown → **Suggest & Confirm**: "Based on what you said, shall we call this '[Generated Name]'? Or would you prefer something else?"
*   **Gate:** User must approve or provide a name.

### Stage 3: Structure - Phases (Steps 5-6)
*   **Goal:** Define horizontal time axis.
*   **Tools:** `set_phases_bulk`
*   **Logic:**
    *   If Phases in URL → **Bypass** (Silent update)
    *   If missing → **Ask** ("What are the high-level stages?")
*   **Gate:** Must confirm list with user before calling tool.

### Stage 4: Structure - Swimlanes (Steps 7-8)
*   **Goal:** Define vertical experience layers.
*   **Tools:** `set_swimlanes_bulk` (Auto-triggers `generate_matrix`)
*   **Logic:**
    *   If Swimlanes in URL → **Bypass** (Silent update)
    *   If missing → **Ask** ("What layers should we track?")
*   **Probe Requirement:** If user provides vague swimlanes (e.g., "Feelings"), AI MUST probe: "Whose feelings? Yours or the customer's?" to ensure clarity.
*   **Gate:** Must confirm list with user before calling tool.

### Stage 5: Cell Population (Step 10 - The Core Loop)
*   **Goal:** Fill the grid intersection-by-intersection.
*   **Tools:** `update_cell`
*   **Logic:** "Neutral Inquiry" - Ask what happens at the intersection.
*   **Constraint:** **DO NOT BIAS.** Do not suggest answers based on the phase name.
    *   *Bad:* "Since this is the 'Frustration' phase, what went wrong?"
    *   *Good:* "In the 'Frustration' phase, what exactly is happening?"
*   **Gate:** **ONE CELL PER TURN.** Never batch.
*   **Completion Gate:** All cells must be non-empty before moving to Deep Dive.

### Stage 6: Deep Dive (Step 11)
*   **Goal:** Ethnographic research (The "Why").
*   **Tools:** None (Conversation only)
*   **Logic:** Ask 3 mandatory questions sequentially:
    1.  **Gap Analysis** (Behavior vs Expectation)
    2.  **Magic Wand** (Ideal State)
    3.  **Synthesis** (Core Motivation)

### Stage 7: Artifacts (Steps 12-13)
*   **Goal:** Final deliverables.
*   **Tools:** `generate_artifacts`
*   **Logic:** Synthesize cell data + deep dive insights into:
    *   Summary of Findings
    *   Mental Models (Must have **unique, descriptive names**)
    *   Quotes
*   **Gate:** User must have no further additions.

---

## 3. The "Oracle" Prompt (Target Cell Context)

To prevent the AI from getting lost in the grid, we inject an explicit **Next Target** instruction at every turn during cell population.

**The Prompt Block:**
```markdown
=== NEXT TARGET CELL ===
🎯 CRITICAL - COPY THIS EXACT CELL ID:
Cell ID: 550e8400-e29b...

Phase Context: "Preparation"
Swimlane Context: "Feelings"

Your Question Strategy:
Ask a NEUTRAL question about this intersection. Do not lead the witness.
```

**Why this matters:**
The AI does not need to *guess* where it is. It is told exactly which cell ID to use. This eliminates 99% of "hallucinated cell ID" errors.

---

## 4. Senior Engineer Commentary & Critique

**Strengths:**
1.  **Determinism:** The Code-First State Machine removes the unpredictability of LLM decision-making for flow control.
2.  **Robustness:** The "Tool-Before-Talk" protocol solves the classic race condition where the AI says "I saved it" but the tool fails.

**Risks & Mitigations:**
1.  **Prompt Drift:** Small changes to the phrasing in `prompts.ts` can have butterfly effects.
    *   *Mitigation:* Any change to `prompts.ts` should be treated as a breaking change and regression tested.
2.  **RAG Hallucination:** If `ragContext` is too large or contradictory, the AI might prioritize it over user input.
    *   *Mitigation:* The prompt explicitly instructs to "weave" context, not cite it. We limit RAG context length in the Admin UI.

**Final Verdict:**
This architecture represents a mature, enterprise-grade approach to GenAI application development. It moves beyond "prompt engineering" into "cognitive architecture."

---

**Document generated by:** Monumental.AX Engineering Team
