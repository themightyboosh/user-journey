# Gate Isolation Fix: Single-Gate Confirmation Enforcement

**Date:** 2026-02-09
**Issue:** AI bundling multiple gates (Journey + Phases + Swimlanes) in single confirmation message
**Solution:** Enforce single-gate confirmation with explicit tool-call-before-next-gate sequencing

---

## ❌ **Problem: Multi-Gate Bundling**

### Observed Behavior

From actual conversation transcript:

```
[MAX] 09:20:09 PM
Perfect! So, to recap:

**Journey:** Walkies
**Goal:** To make for a happy and healthy pet
**Stages:** Prepare, Walk
**Layers:** Feel (emotions like love/hate), Do (actions taken)

Does that sound right to you?

[SCOTT] 09:20:25 PM
Sure
```

**Issues:**
1. ❌ Max bundled THREE gates in one confirmation (Journey from Step 3-4, Phases from Step 5-6, Swimlanes from Step 7-8)
2. ❌ No tool calls happened between gates (canvas never updated)
3. ❌ AI thought ahead to next gates before completing current gate
4. ❌ User couldn't see incremental progress on canvas (phases, swimlanes not saved yet)

**Root Cause:** AI was thinking across gates instead of finishing one gate completely before moving to the next.

---

## 🎯 **Expected Behavior: Gate-by-Gate Progression**

### Correct Flow

**After Step 3-4 (Journey Setup):**
```
AI: "So this is about Walkies—making for a happy and healthy pet. Got it?"
User: "Yes"
AI: [CALLS update_journey_metadata] → Canvas updates with journey name/description
AI: [ONLY THEN asks about phases]
```

**After Step 5-6 (Phases):**
```
AI: "So the stages are Prepare and Walk. Does that flow look right?"
User: "Sure"
AI: [CALLS set_phases_bulk] → Canvas updates with phase columns
AI: [ONLY THEN asks about swimlanes]
```

**After Step 7-8 (Swimlanes):**
```
AI: "So we're tracking Feel and Do. Are these the right layers?"
User: "Yes"
AI: [CALLS set_swimlanes_bulk] → Canvas updates with swimlane rows + cells
AI: [ONLY THEN moves to cell population]
```

**Key Principle:** Confirm → Call tool → Wait for success → Move to next gate

---

## 🔧 **Solution: Three-Part Fix**

### 1. Updated Step 5 (Phase Inquiry)

**Before:**
```typescript
2. **Gate**: Once user provides a list, **STOP**. Summarize back and ask "Does this flow look right?"
3. **Action**: After user confirms, probe for description of EACH phase before calling tool.
```

**After:**
```typescript
2. **Accumulate**: Once user provides a list, acknowledge it. Then probe for description of
   EACH phase (one question per phase).
3. **Confirm (SINGLE-GATE ONLY)**: After collecting ALL phase descriptions, summarize ONLY
   the phases and ask "Does this flow look right?" DO NOT recap the Journey, Goal, or any
   other gates—confirm ONLY the phases.
4. **Action**: After user confirms ("Yes"), IMMEDIATELY call `set_phases_bulk`. Wait for
   tool success. Do NOT think about or mention swimlanes until this tool succeeds.
```

**Changes:**
- ✅ Added explicit "SINGLE-GATE ONLY" label
- ✅ Prohibition against recapping Journey/Goal
- ✅ IMMEDIATELY call tool after confirmation
- ✅ Wait for success before thinking about next gate

---

### 2. Updated Step 7 (Swimlane Inquiry)

**Before:**
```typescript
*   **Mode [UNKNOWN - Step 7a (Identify Swimlanes)]**: ...
    4. **Gate**: Once user provides a list, **STOP**. Summarize and ask "Are these the right layers?"
*   **Mode [UNKNOWN - Step 7b (Probe for Descriptions)]**: After confirmation:
    1. For EACH swimlane, ask ONE probing question...
    3. **Action**: Only call `set_swimlanes_bulk` AFTER you have descriptions for ALL swimlanes.
```

**After:**
```typescript
*   **Mode [UNKNOWN]**: If no swimlanes are pre-defined:
    1. Explain that we need to define the "layers"...
    2. **Prompt**: "To understand this journey deeply, what layers should we track..."
    3. **Accumulate**: Once user provides a list, acknowledge it. Then probe for description
       of EACH swimlane (one question per swimlane).
    4. **Confirm (SINGLE-GATE ONLY)**: After collecting ALL swimlane descriptions, summarize
       ONLY the swimlanes and ask "Are these the right layers?" DO NOT recap the Journey,
       Goal, Phases, or any other gates—confirm ONLY the swimlanes.
    5. **Action**: After user confirms ("Yes"), IMMEDIATELY call `set_swimlanes_bulk`. Wait
       for tool success. Do NOT think about or mention cells until this tool succeeds.
```

**Changes:**
- ✅ Merged Step 7a and 7b into single UNKNOWN mode (clearer flow)
- ✅ Added explicit "SINGLE-GATE ONLY" label
- ✅ Prohibition against recapping Journey/Goal/Phases
- ✅ IMMEDIATELY call tool after confirmation
- ✅ Wait for success before thinking about cells

---

### 3. New CRITICAL RULE: Single-Gate Confirmation

Added to CRITICAL RULES section:

```typescript
- **SINGLE-GATE CONFIRMATION (CRITICAL)**: When confirming user data, recap ONLY the current gate.
  NEVER bundle multiple gates together in one confirmation message.
    *   ❌ **WRONG**: "So the journey is Walkies, the stages are Prepare and Walk, and the
        layers are Feel and Do. Does that sound right?"
    *   ✅ **CORRECT (Step 5)**: "So the stages are Prepare and Walk. Does that flow look
        right?" → Call `set_phases_bulk` → Wait for success
    *   ✅ **CORRECT (Step 7)**: "So we're tracking Feel and Do. Are these the right layers?"
        → Call `set_swimlanes_bulk` → Wait for success
    *   **Constraint**: Confirm ONLY what you're about to save with the tool. Do NOT recap
        previous gates (Journey, Goal, etc.).

- **GATE-TO-TOOL SEQUENCE**: After user confirms a gate (e.g., "Yes" to phases), you MUST:
    1. IMMEDIATELY call the tool (e.g., `set_phases_bulk`)
    2. Wait for tool success (canvas updates)
    3. ONLY THEN think about or mention the next gate (e.g., swimlanes)
    **Prohibition**: Do NOT ask about the next gate before the current gate's tool call completes.
```

---

## 📊 **Before vs After Examples**

### Example: Walkies Journey

#### ❌ Before (Multi-Gate Bundling)

```
[AI asks about journey] → User: "Walkies to make happy pet"
[AI asks about phases] → User: "Prepare and walk"
[AI asks about swimlanes] → User: "Feel and do"
[AI probes for Feel] → User: "Love and hate feelings"
[AI probes for Do] → User: "Actions we take"

AI: "Perfect! So, to recap:
**Journey:** Walkies
**Goal:** To make for a happy and healthy pet
**Stages:** Prepare, Walk
**Layers:** Feel (emotions like love/hate), Do (actions taken)
Does that sound right to you?"

User: "Sure"

[AI THEN calls tools... but user already said yes to everything bundled together]
```

**Problems:**
- User confirmed ALL gates at once without seeing incremental canvas updates
- No opportunity to correct one gate without affecting others
- Canvas doesn't update until ALL gates processed
- AI is thinking 2-3 steps ahead instead of focusing on current gate

---

#### ✅ After (Single-Gate Confirmation)

```
[AI asks about journey] → User: "Walkies to make happy pet"

AI: "So this is about Walkies—making for a happy and healthy pet. Got it?"
User: "Yes"
[AI calls update_journey_metadata] → ✅ Canvas updates with journey name/description

---

AI: "What are the main stages of Walkies, from start to finish?"
User: "Prepare and walk"

AI: "What does Prepare involve?"
User: "Getting ready"

AI: "What happens during Walk?"
User: "Actually doing the walk"

AI: "So the stages are Prepare and Walk. Does that flow look right?"
User: "Sure"
[AI calls set_phases_bulk] → ✅ Canvas updates with 2 phase columns

---

AI: "What layers should we track for every stage?"
User: "Feel and do"

AI: "What does Feel involve in this context?"
User: "Love and hate feelings"

AI: "What does Do encompass?"
User: "Actions we take"

AI: "So we're tracking Feel and Do. Are these the right layers?"
User: "Yes"
[AI calls set_swimlanes_bulk] → ✅ Canvas updates with 2 rows + 4 cells (2×2 grid)

---

AI: "Let's start with Prepare. For Feel during the Prepare stage..."
```

**Improvements:**
- ✅ User sees canvas update after EACH gate confirmation
- ✅ Can correct one gate without affecting others
- ✅ AI focuses on ONE gate at a time (not thinking ahead)
- ✅ Clear progression: Confirm → Save → Update canvas → Next gate

---

## 🎯 **Why This Matters**

### User Experience Impact

**Canvas Updates:**
- **Before:** Canvas updates only after ALL gates processed (Journey + Phases + Swimlanes)
- **After:** Canvas updates after EACH gate (incremental progress visible)

**Error Correction:**
- **Before:** If user wants to change phases, they must reject entire bundle (journey + phases + swimlanes)
- **After:** User can approve phases, then correct swimlanes if needed (independent gates)

**Cognitive Load:**
- **Before:** User must remember and approve 3 gates at once (Journey: "Walkies", Phases: "Prepare, Walk", Swimlanes: "Feel, Do")
- **After:** User approves one gate at a time (focus on current decision)

### AI Behavior Impact

**Gate Discipline:**
- **Before:** AI thinks ahead, planning next gate before current gate is saved
- **After:** AI completes current gate (tool call + success) before thinking about next gate

**Tool Call Sequencing:**
- **Before:** AI might call multiple tools in batch after bundled confirmation
- **After:** AI calls ONE tool per confirmation, waits for success, then proceeds

**Canvas Synchronization:**
- **Before:** Canvas and conversation can get out of sync (user approved but canvas not updated yet)
- **After:** Canvas always reflects latest confirmed gate (tight synchronization)

---

## 🔍 **Enforcement Mechanisms**

### 1. Explicit Labeling
Every confirmation gate now labeled:
```
**Confirm (SINGLE-GATE ONLY)**: Summarize ONLY the phases...
```

This signals to the AI: "You're about to confirm. Check that you're only recapping THIS gate."

### 2. Negative Examples
CRITICAL RULES section includes explicit WRONG example:
```
❌ **WRONG**: "So the journey is Walkies, the stages are Prepare and Walk,
             and the layers are Feel and Do. Does that sound right?"
```

Gemini models respond well to concrete negative examples.

### 3. Sequential Prohibition
```
Do NOT think about or mention swimlanes until this tool succeeds.
```

Prevents AI from mentally jumping to next gate before current gate is saved.

### 4. Gate Isolation Constraint
```
DO NOT recap the Journey, Goal, Phases, or any other gates—confirm ONLY the swimlanes.
```

Explicitly lists what NOT to include in confirmation.

---

## 📈 **Impact on Interview Flow**

### Typical Interview Timeline

**Before (Multi-Gate Bundling):**
```
00:00 - Welcome & Identity
01:00 - Journey question
01:30 - Phases question
02:00 - Swimlanes question
02:30 - Probing for swimlane descriptions
03:00 - BUNDLED CONFIRMATION (all 3 gates)
03:15 - [Tools called, canvas updates for all 3 gates]
03:30 - Cell population begins
```

**After (Single-Gate Confirmation):**
```
00:00 - Welcome & Identity
01:00 - Journey question
01:15 - Journey confirmation → Tool call → Canvas update
01:30 - Phases question + probing
02:00 - Phases confirmation → Tool call → Canvas update
02:15 - Swimlanes question + probing
02:45 - Swimlanes confirmation → Tool call → Canvas update
03:00 - Cell population begins
```

**Time Difference:** ~15-30 seconds longer (due to 3 confirmations vs 1)
**Quality Gain:** Incremental validation, clearer progression, better UX

---

## 🧪 **Testing the Fix**

### Test Scenario: Blank Template (No Pre-fills)

**Expected Flow:**

1. **Step 3-4 (Journey):**
   - AI asks about journey → User describes
   - AI confirms: "So this is about [Journey Name]—[Goal]. Got it?"
   - User: "Yes"
   - **CHECK:** AI calls `update_journey_metadata` immediately
   - **CHECK:** Canvas updates with journey name/description

2. **Step 5-6 (Phases):**
   - AI asks for phases → User: "Phase1, Phase2"
   - AI probes for descriptions → User provides
   - AI confirms: "So the phases are Phase1 and Phase2. Does that flow look right?"
   - User: "Yes"
   - **CHECK:** AI does NOT mention journey or swimlanes in confirmation
   - **CHECK:** AI calls `set_phases_bulk` immediately
   - **CHECK:** Canvas updates with 2 phase columns

3. **Step 7-8 (Swimlanes):**
   - AI asks for swimlanes → User: "Lane1, Lane2"
   - AI probes for descriptions → User provides
   - AI confirms: "So we're tracking Lane1 and Lane2. Are these the right layers?"
   - User: "Yes"
   - **CHECK:** AI does NOT mention journey or phases in confirmation
   - **CHECK:** AI calls `set_swimlanes_bulk` immediately
   - **CHECK:** Canvas updates with 2 rows + 4 cells (2×2 grid)

**Red Flags (Indicates Bug Not Fixed):**
- ❌ AI says "So the journey is X, the phases are Y, and the swimlanes are Z..." (bundled confirmation)
- ❌ AI asks about swimlanes before calling `set_phases_bulk`
- ❌ Canvas doesn't update after phase confirmation

---

## 🔒 **Guarantee of Isolation**

### Strong Language Added

**Step 5:**
- "DO NOT recap the Journey, Goal, or any other gates—confirm ONLY the phases"
- "IMMEDIATELY call `set_phases_bulk`. Wait for tool success."
- "Do NOT think about or mention swimlanes until this tool succeeds."

**Step 7:**
- "DO NOT recap the Journey, Goal, Phases, or any other gates—confirm ONLY the swimlanes"
- "IMMEDIATELY call `set_swimlanes_bulk`. Wait for tool success."
- "Do NOT think about or mention cells until this tool succeeds."

**CRITICAL RULES:**
- "NEVER bundle multiple gates together in one confirmation message"
- "Confirm ONLY what you're about to save with the tool"
- "Do NOT ask about the next gate before the current gate's tool call completes"

### Why This Works

**Imperative Language:** "DO NOT", "NEVER", "IMMEDIATELY" signal non-negotiable requirements

**Explicit Examples:** Showing WRONG vs CORRECT confirmations gives Gemini concrete patterns

**Sequential Enforcement:** "Wait for success, THEN proceed" prevents thinking ahead

**Negative Constraints:** Listing what NOT to include (Journey, Goal) is clearer than just saying "only phases"

---

## 📝 **Related Documentation**

- **prompts.ts:47-63** - Step 5 Phase Inquiry (updated)
- **prompts.ts:65-86** - Step 7 Swimlane Inquiry (updated)
- **prompts.ts:204-214** - CRITICAL RULES (new rules added)
- **TEMPLATE-FIELDS-REFERENCE.md** - Template bypass scenarios
- **IMPLEMENTATION-COMPLETE.md** - Journey description field implementation

---

## ✅ **Verification Checklist**

After this update, interviews should:
- ✅ Confirm ONLY phases in Step 5 (no journey/swimlane recap)
- ✅ Call `set_phases_bulk` immediately after phase confirmation
- ✅ Wait for tool success before asking about swimlanes
- ✅ Confirm ONLY swimlanes in Step 7 (no journey/phase recap)
- ✅ Call `set_swimlanes_bulk` immediately after swimlane confirmation
- ✅ Canvas updates after EACH gate (3 updates total)
- ✅ User sees incremental progress (not all-at-once)

**Before:** AI *could* bundle gates (no explicit prohibition)
**After:** AI *must* isolate gates (explicit enforcement with examples)

---

## 🎯 **Key Takeaways**

1. **Gates are independent** - Each gate (Journey, Phases, Swimlanes) has its own confirm → save → update cycle
2. **Tools update canvas** - Canvas refreshes after EACH tool call, not after all gates processed
3. **No thinking ahead** - AI must complete current gate before thinking about next gate
4. **Incremental validation** - User approves one gate at a time, can correct without affecting others
5. **Tight synchronization** - Canvas always reflects latest confirmed gate (no lag)

---

**Implementation Status:** ✅ Complete
**Ready for Testing:** Yes
**Expected Impact:** Clearer interview flow, better canvas synchronization, improved user experience
