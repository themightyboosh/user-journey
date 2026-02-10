# CRITICAL FIX: AI Splitting Single Cell into Multiple Sub-Questions

**Date:** 2026-02-10
**Issue:** AI violating ONE CELL PER TURN rule by asking multiple sub-questions for a single cell
**Root Cause:** Ambiguous swimlane definitions + multi-entity response handling gap
**Solution:** 3-layer Gemini-engineered enforcement with explicit examples and prohibitions

---

## ❌ **Problem: Cell Question Splitting**

### Observed Behavior (Walkies Transcript - 2026-02-10)

**Swimlane Definition Phase:**
```
AI: "What layers should we track for every stage?"
SCOTT: "Just feelings"
AI: [Accepts "Feelings" without clarification of whose feelings]
→ Calls set_swimlanes_bulk with swimlane: { name: "Feelings", description: "Just feelings" }
```

**Cell Population Phase (WRONG):**
```
[Cell: Open Door / Feelings]
AI: "What emotions come up for you or Banner?"
MIKE: "Frustration"

AI: "And what about Banner's feelings?" ← WRONG! This is the SAME cell!
MIKE: "He's thrilled"
```

**Issues:**
1. ❌ AI asked TWO questions for ONE cell (Mike's feelings, then Banner's feelings)
2. ❌ Violated ONE CELL PER TURN rule
3. ❌ User mentioned Mike AND Banner in context, so swimlane should track both - but AI didn't clarify this during Step 7
4. ❌ When user gave answer mentioning one entity ("Frustration"), AI asked follow-up for the other entity

---

## 🔍 **Root Cause Analysis**

### Issue 1: Ambiguous Swimlane Definition

**Walkies Journey Context:**
- Journey involves TWO actors: Mike (user) and Banner (dog)
- User said swimlane is "Just feelings" without specifying whose feelings

**Problem with Current Step 7 Probing:**
```typescript
// Current (Line 94)
✅ **CORRECT**: "When you say [Swimlane], what does that track for you?"
```

**Gap:** When user says "Feelings", the probe asks "what does that track for you?" but doesn't detect that:
1. The journey involves multiple entities (Mike + Banner)
2. "Feelings" could mean Mike's feelings, Banner's feelings, or both
3. Without clarification, AI won't know how to ask about this cell later

**Result:** AI accepted vague swimlane description "Just feelings" without asking:
> "When you say 'Feelings', whose feelings are we tracking - yours, Banner's, or both?"

---

### Issue 2: Multi-Entity Response Handling Gap

**Current ONE CELL PER TURN Rule (Line 143):**
```typescript
*   **STRICT RULE — ONE CELL PER TURN**: Each question you ask must target exactly ONE specific cell (one Phase + one Swimlane intersection). NEVER ask about multiple cells in one message.
```

**Gap:** This rule prevents asking about multiple CELLS, but doesn't handle the case where:
1. User mentions multiple ENTITIES in a single response (e.g., "I'm frustrated, Banner's thrilled")
2. AI should accept ALL information and save to ONE cell
3. AI should NOT ask follow-up questions to separate each entity

**Walkies Example:**
- AI asked: "What emotions come up for you or Banner?" (good - ONE question)
- Mike answered: "Frustration" (mentions only HIS feeling, not Banner's)
- AI then asked: "And what about Banner's feelings?" (WRONG - this is a second question for the same cell)

**Why This Happened:**
- AI interpreted Mike's partial answer as "incomplete" because the swimlane is "Feelings" (ambiguous whether it's Mike's or both)
- AI tried to "complete" the cell by asking about Banner separately
- This violated ONE CELL PER TURN

**What SHOULD Have Happened:**
- If swimlane description clarified "Mike's feelings only", AI would only ask about Mike
- If swimlane description said "Both Mike's and Banner's feelings", AI should ask ONE question like "What emotions come up for you and Banner?" and accept whatever user provides (even if partial)

---

## ✅ **Solution: Three-Layer Gemini-Engineered Fix**

### Fix 1: Mandatory Ambiguity Clarification (Step 7)

**Added to STEP_7_DEFAULT (Lines 89-102):**

```typescript
*   **Mode [UNKNOWN]**: If no swimlanes are pre-defined:
    ...
    3.  **Accumulate**: Once user provides a list, acknowledge it. Then probe for description of EACH swimlane (one brief question per swimlane).
        *   **Probe Style (META-LEVEL ONLY)**: Ask what this LAYER represents across the journey, not specific instances.
        *   ✅ **CORRECT**: "When you say [Swimlane], what does that track for you?" or "What goes in the [Swimlane] layer?"
        *   ❌ **WRONG**: "What do you feel during the first stage?" (too specific, that's cell-level)

        *   **CRITICAL — Ambiguity Detection**: If the swimlane name is GENERIC (like "Feelings", "Actions", "Thoughts") and the user's answer suggests multiple entities/actors are involved (e.g., user + dog, user + customer, manager + employee), you MUST ask a CLARIFYING question:
            - ✅ **CORRECT**: "When you say 'Feelings', whose feelings are we tracking - yours, Banner's, or both?"
            - ✅ **CORRECT**: "For 'Actions', are we tracking what you do, what the customer does, or both?"
            - **Rule**: Swimlane descriptions MUST specify whose perspective/entity is being tracked if multiple actors exist in the journey. Do NOT proceed without this clarity.

        *   **Goal**: Get a 1-sentence definition that clarifies BOTH the concept AND whose perspective (e.g., "My emotional state during each stage" or "What I'm physically doing, not Banner's actions"), not specific feelings or actions.
```

**Gemini Prompt Engineering Principles Applied:**
1. **Explicit Condition Detection**: "If the swimlane name is GENERIC..."
2. **Concrete Examples**: Shows CORRECT clarifying questions for "Feelings" and "Actions"
3. **Imperative Language**: "you MUST ask a CLARIFYING question", "Do NOT proceed without this clarity"
4. **Scope Clarification**: "BOTH the concept AND whose perspective"

**Impact:** AI now detects ambiguous swimlane names and forces clarification before accepting them.

---

### Fix 2: Multi-Entity Response Handling (Step 10)

**Added to Step 10 Cell Population (Lines 143-160):**

```typescript
*   **STRICT RULE — ONE CELL PER TURN**: Each question you ask must target exactly ONE specific cell (one Phase + one Swimlane intersection). NEVER ask about multiple cells in one message.

*   **MULTI-ENTITY RESPONSE HANDLING (CRITICAL)**: If a user mentions multiple entities/actors in a SINGLE response (e.g., "I feel frustrated, and Banner is thrilled"), you MUST:
    1.  **Accept ALL information** from their response
    2.  **Incorporate ALL entities** into the SINGLE cell's description
    3.  **Do NOT ask follow-up questions** to separate each entity (e.g., "And what about Banner's feelings?")
    4.  **Call `update_cell` ONCE** with a description that includes all mentioned entities

    *   ❌ **WRONG (violates ONE CELL PER TURN)**:
        - User: "I feel frustrated, Banner's thrilled"
        - AI: "Got it. And what about Banner's feelings?" ← NO! This splits one cell into two questions

    *   ✅ **CORRECT (ONE CELL PER TURN)**:
        - User: "I feel frustrated, Banner's thrilled"
        - AI: [Calls `update_cell` with description: "Mike feels frustrated while Banner is thrilled"] → "Got it, moving on..."

    *   **Rule**: ONE user response = ONE cell save, regardless of how many entities they mention.
```

**Gemini Prompt Engineering Principles Applied:**
1. **Explicit Protocol**: 4-step procedure with numbered actions
2. **Negative Example**: Shows WRONG behavior with exact transcript pattern from Walkies
3. **Positive Example**: Shows CORRECT behavior with what AI should have done
4. **Imperative Prohibition**: "Do NOT ask follow-up questions"
5. **Clear Rule**: "ONE user response = ONE cell save"

**Impact:** AI now accepts multi-entity responses and saves them to ONE cell without splitting.

---

### Fix 3: Global Critical Rule Enhancement

**Added to CRITICAL RULES Section (Lines 242-253):**

```typescript
- **ONE CELL PER TURN (Step 10 - CRITICAL)**: During cell capture, ask about ONE cell, wait for answer, save ONE cell, then move to next. NEVER batch multiple \`update_cell\` calls in a single turn. NEVER fill cells the user hasn't directly addressed yet.

    *   **PROHIBITION**: Do NOT ask multiple sub-questions for a single cell. If the user mentions multiple entities (e.g., "I'm frustrated, my dog is happy"), accept ALL information and save it to ONE cell. Do NOT ask "And what about [entity]'s [aspect]?" as a follow-up - that violates ONE CELL PER TURN.

    *   **Example of WRONG behavior**:
        - User: "I feel frustrated, Banner's thrilled"
        - AI: "Got it. And what about Banner's feelings?" ← WRONG! This is asking about the same cell twice

    *   **Example of CORRECT behavior**:
        - User: "I feel frustrated, Banner's thrilled"
        - AI: [Calls `update_cell` with both pieces of info] → Moves to next cell
```

**Gemini Prompt Engineering Principles Applied:**
1. **Reinforcement**: Repeats prohibition in global rules (not just Step 10)
2. **Concrete Error Pattern**: Shows exact transcript pattern that triggered the bug
3. **Visual Annotation**: Uses "← WRONG!" to mark bad behavior
4. **Comparative Examples**: WRONG vs CORRECT side-by-side

**Impact:** AI sees the prohibition in TWO places (Step 10 + CRITICAL RULES) for redundant enforcement.

---

### Fix 4: New Global Rule - Swimlane Ambiguity Clarification

**Added to CRITICAL RULES Section (Lines 254-258):**

```typescript
- **SWIMLANE AMBIGUITY CLARIFICATION (Step 7 - CRITICAL)**: When user provides generic swimlane names (Feelings, Actions, Thoughts, Pain Points) that could refer to multiple entities/actors in the journey, you MUST clarify whose perspective is being tracked:
    *   ❌ **WRONG**: User says "Just feelings" → AI accepts it without asking whose feelings
    *   ✅ **CORRECT**: User says "Just feelings" → AI asks "When you say 'Feelings', whose feelings are we tracking - yours, Banner's, or both?"
    *   **Rule**: Swimlane descriptions MUST specify the entity/perspective if the journey involves multiple actors. This prevents confusion during cell population (Step 10).
```

**Gemini Prompt Engineering Principles Applied:**
1. **Specific Condition**: "generic swimlane names... that could refer to multiple entities"
2. **Examples List**: "Feelings, Actions, Thoughts, Pain Points"
3. **Wrong/Correct Comparison**: Shows exact Walkies pattern
4. **Forward Linkage**: "This prevents confusion during cell population (Step 10)" - explains WHY this rule matters

**Impact:** AI understands the downstream consequence of accepting ambiguous swimlanes.

---

## 📊 **Before vs After Comparison**

### Before (Ambiguous Swimlane → Cell Splitting)

**Step 7 - Swimlane Definition:**
```
AI: "What layers should we track?"
User: "Just feelings"
AI: "What does Feelings track for you?"
User: "Emotions"
AI: [Calls set_swimlanes_bulk with { name: "Feelings", description: "Emotions" }]
→ Ambiguous: Whose emotions? Mike's? Banner's? Both?
```

**Step 10 - Cell Population (WRONG):**
```
[Cell: Open Door / Feelings]
AI: "What emotions come up for you or Banner?"
User: "Frustration"
AI: "And what about Banner's feelings?" ← WRONG! Second question for same cell
User: "He's thrilled"
AI: [Calls update_cell with "Frustration for Mike, thrilled for Banner"]
```

**Issues:**
- TWO questions asked for ONE cell
- User had to answer twice for same cell intersection
- Violates ONE CELL PER TURN

---

### After (Clarified Swimlane → Single Question)

**Step 7 - Swimlane Definition (FIXED):**
```
AI: "What layers should we track?"
User: "Just feelings"
AI: "When you say 'Feelings', whose feelings are we tracking - yours, Banner's, or both?"
User: "Both - mine and Banner's"
AI: [Calls set_swimlanes_bulk with { name: "Feelings", description: "Mike's and Banner's emotional states during each stage" }]
→ Clear: Track BOTH entities' feelings in each cell
```

**Step 10 - Cell Population (CORRECT):**
```
[Cell: Open Door / Feelings]
AI: "When the door's open, what emotions come up for you and Banner?"
User: "I feel frustrated, Banner's thrilled"
AI: [Calls update_cell with "Mike feels frustrated while Banner is thrilled"] → "Got it, moving on..."
```

**Improvements:**
- ONE question asked for ONE cell
- User answered once with both entities' info
- AI accepted ALL information and saved to ONE cell
- Respects ONE CELL PER TURN

---

## 🎯 **Why This Fix Works (Gemini Prompt Engineering Lens)**

### 1. Upstream Prevention (Step 7)

**Principle:** Fix ambiguity at the SOURCE (swimlane definition), not at the symptom (cell questioning).

**Before:** AI accepted vague swimlane descriptions, causing confusion later in Step 10.

**After:** AI detects generic names + multi-entity context → Forces clarification BEFORE proceeding.

**Gemini Pattern:** Use CONDITIONAL LOGIC with explicit detection rules:
```
IF (swimlane name is generic) AND (journey has multiple actors)
THEN (ask clarifying question)
ELSE (proceed normally)
```

---

### 2. Explicit Prohibition with Examples (Step 10)

**Principle:** Show Gemini EXACTLY what NOT to do, using concrete examples from real transcripts.

**Before:** Rule said "ONE CELL PER TURN" but didn't define what counts as splitting a cell.

**After:** Added explicit PROHIBITION with WRONG example showing the exact bug:
```
❌ **WRONG**: User: "I feel frustrated, Banner's thrilled"
             AI: "Got it. And what about Banner's feelings?"
```

**Gemini Pattern:** Negative examples with visual annotations (← WRONG!) are highly effective.

---

### 3. Redundant Enforcement Layers

**Principle:** Critical rules should appear in MULTIPLE places for redundancy.

**Fix Applied:**
- **Layer 1 (Step 7):** Ambiguity detection rule
- **Layer 2 (Step 10):** Multi-entity response handling protocol
- **Layer 3 (CRITICAL RULES - Swimlane):** Global ambiguity clarification rule
- **Layer 4 (CRITICAL RULES - One Cell Per Turn):** Global prohibition with examples

**Gemini Pattern:** If a rule is CRITICAL, state it at both the specific step AND in the global rules section.

---

### 4. Imperative Language

**Before:** "You should ask..." or "It's important to..."

**After:** "You MUST ask...", "Do NOT proceed...", "NEVER ask..."

**Gemini Pattern:** Imperative commands trigger stricter compliance than suggestions.

Examples from fix:
- "you MUST ask a CLARIFYING question"
- "Do NOT ask follow-up questions to separate each entity"
- "NEVER ask about multiple cells"
- "Do NOT proceed without this clarity"

---

### 5. Forward Linkage (Explaining WHY)

**Principle:** Help Gemini understand the CONSEQUENCE of violating a rule.

**Example from Fix:**
```typescript
**Rule**: Swimlane descriptions MUST specify the entity/perspective if the journey involves multiple actors.
This prevents confusion during cell population (Step 10). ← WHY this matters
```

**Gemini Pattern:** When enforcing a rule, explain the downstream impact to increase compliance.

---

## 🧪 **Testing the Fix**

### Test Scenario: Walkies Journey (Re-run)

**Setup:**
- 2 entities: Mike (user) + Banner (dog)
- User provides generic swimlane name: "Feelings"

**Expected Step 7 Flow:**

1. **AI asks for swimlanes:**
   ```
   AI: "What layers should we track for every stage?"
   User: "Just feelings"
   ```

2. **AI detects ambiguity and clarifies:**
   ```
   AI: "When you say 'Feelings', whose feelings are we tracking - yours, Banner's, or both?"
   User: "Both"
   ```

3. **AI confirms with clarified description:**
   ```
   AI: "So we're tracking Feelings (both yours and Banner's). Are these the right layers?"
   User: "Yes"
   ```

4. **AI calls set_swimlanes_bulk:**
   ```json
   [{
     "name": "Feelings",
     "description": "Mike's and Banner's emotional states during each stage"
   }]
   ```

**Expected Step 10 Flow:**

1. **AI asks about cell (ONE question):**
   ```
   [Cell: Open Door / Feelings]
   AI: "When the door opens, what emotions come up for you and Banner?"
   ```

2. **User provides multi-entity response:**
   ```
   User: "I feel frustrated, he's thrilled"
   ```

3. **AI accepts ALL info and saves to ONE cell:**
   ```
   AI: [Calls update_cell with:
     headline: "Frustration and excitement",
     description: "Mike feels frustrated while Banner is thrilled"
   ]
   → "Got it. Now for the Walk stage..."
   ```

**Red Flags (Indicates Fix Failed):**
- ❌ AI accepts "Feelings" without asking whose feelings (Step 7 failed)
- ❌ AI asks "And what about Banner's feelings?" after user mentions only Mike (Step 10 failed)
- ❌ AI calls `update_cell` twice for same cell intersection

---

## 📈 **Expected Impact**

### Interview Quality

| Metric | Before (Cell Splitting) | After (Single Question) |
|--------|------------------------|-------------------------|
| **Questions per Cell** | 1-2 (if multi-entity) | 1 (always) |
| **User Friction** | High ("Why are they asking again?") | Low (one answer per cell) |
| **ONE CELL PER TURN Compliance** | Violated when entities mentioned separately | Enforced |
| **Swimlane Clarity** | Ambiguous (whose perspective?) | Explicit (clarified in Step 7) |

### Conversation Flow

**Before:**
```
[Cell: Phase X / Feelings]
AI: "What do you feel?"
User: "Frustrated"
AI: "And what about your dog?" ← Feels redundant
User: "He's happy"
```

**After:**
```
[Cell: Phase X / Feelings]
AI: "What do you and your dog feel?"
User: "I'm frustrated, he's happy"
AI: [Saves both] → Next cell
```

**Improvement:** 50% fewer questions for multi-entity cells.

---

## 📝 **Related Documentation**

- **CRITICAL-FIX-SKIP-ETHNOGRAPHIC-QUESTIONS.md** - 7-layer enforcement system for mandatory steps
- **GATE-ISOLATION-FIX.md** - Single-gate confirmation enforcement
- **prompts.ts:89-102** - Step 7 ambiguity detection (updated)
- **prompts.ts:143-160** - Step 10 multi-entity response handling (updated)
- **prompts.ts:242-258** - CRITICAL RULES (updated)

---

## ✅ **Verification Checklist**

After deployment, test with Walkies-style journey (multi-entity scenario):

**Step 7:**
- [ ] AI asks for swimlanes
- [ ] User provides generic name (e.g., "Feelings", "Actions")
- [ ] AI detects ambiguity and asks clarifying question: "Whose X are we tracking - yours, [entity]'s, or both?"
- [ ] User clarifies
- [ ] AI confirms with FULL description (including whose perspective)
- [ ] AI calls set_swimlanes_bulk with clarified description

**Step 10:**
- [ ] AI asks about cell with ONE question referencing all entities
- [ ] User mentions multiple entities in response (e.g., "I'm X, dog is Y")
- [ ] AI does NOT ask follow-up question like "And what about [entity]'s [aspect]?"
- [ ] AI calls update_cell ONCE with ALL information
- [ ] AI moves to next cell

**Red Flag:** If AI asks "And what about [entity]'s [aspect]?" after user mentions only one entity, the fix failed.

---

**Implementation Status:** ✅ Complete
**Ready for Testing:** Yes
**Expected Impact:** Prevents cell question splitting, enforces ONE CELL PER TURN, improves multi-entity journey handling
