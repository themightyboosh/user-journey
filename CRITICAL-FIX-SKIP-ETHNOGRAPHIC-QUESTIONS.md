# CRITICAL FIX: AI Skipping Ethnographic Questions (Steps 11-12)

**Date:** 2026-02-10
**Issue:** After completing cells, AI jumped directly to artifact generation, skipping the 3 mandatory ethnographic questions
**Impact:** Low-quality artifacts (missing "why" insights), journey disappearance

---

## ❌ **Problem: Premature Artifact Generation**

### Observed Behavior (Walkies Journey - 2026-02-10)

**Expected Flow:**
```
Step 10: Complete all cells →
Step 11: Ask 3 ethnographic questions (Gap Analysis, Magic Wand, Synthesis) →
Step 12: "Is there anything else you'd like to add?" →
Step 13: Generate artifacts
```

**Actual Flow:**
```
Step 10: Complete all cells →
AI: "Is there anything else you'd like to add or refine about this 'Walkies'
     journey before we finalize?" (WRONG - this skips Step 11!) →
User: "No" →
Step 13: Generate artifacts (missing ethnographic data)
```

### Evidence from Conversation Transcript

**10:12 PM - After completing 4th cell (Walk / Feelings):**
```
MAX: "We've now mapped out the 'Open Door' and 'Walk' stages, capturing
      the Pains and Feelings for each.

      Is there anything else you'd like to add or refine about this 'Walkies'
      journey before we finalize?"

SCOTT: "No"

MAX: "Thank you, Scott! This has been incredibly insightful. I'm going to
      put together a summary of your 'Walkies' journey, including the insights
      from our chat and the deeper motivations you shared."
```

**Issues:**
1. ❌ Never asked Gap Analysis question
2. ❌ Never asked Magic Wand question
3. ❌ Never asked Synthesis question
4. ❌ Asked premature finalization question ("before we finalize?")
5. ❌ Generated artifacts without ethnographic insights

### Result:

**Artifacts Generated (from PDF page 1):**
- Summary: Generic, surface-level (only uses cell data)
- Mental Models: Only 3 models (should be richer with ethnographic data)
- Quote: "Absolute frustration" (from cell, not from deep dive)
- **Journey Map:** MISSING (page 6 blank - likely tool call failure)

**Without Ethnographic Questions:**
- Summary explains WHAT happened, not WHY
- Mental models are behavioral, not belief-based
- Quotes are factual statements, not revealing insights

---

## 🔍 **Root Cause Analysis**

### Issue 1: Weak Step 11 Language

**Before (Lines 191-199):**
```typescript
11. **Ethnographic Analysis (Deep Dive)**:
    *   **Logic**: You are now entering the "Deep Dive" phase. You must ask
        3 distinct ethnographic questions...
```

**Problem:**
- "You are now entering" sounds INFORMATIONAL, not MANDATORY
- "You must ask" is weak - Gemini can interpret this as optional
- No explicit gate preventing skip to Step 12

### Issue 2: Missing Transition Enforcement

**Before (Lines 187-190):**
```typescript
*   **COMPLETION GATE (CRITICAL)**: Before moving to Step 11, you MUST check
    the CELL GRID STATUS... You may ONLY proceed to Step 11 when:
    - The grid shows ALL cells as "x" (done)...
```

**Problem:**
- Says "proceed to Step 11" but doesn't enforce it
- AI can interpret "cells done" as "interview done"
- No blocking instruction preventing jump to finalization

### Issue 3: No Tracking Mechanism

**Before:**
- No mental checklist for ethnographic questions
- No way to verify all 3 questions have been asked
- AI can't self-check before moving to Step 12

---

## ✅ **Solution: Make Steps 11-12 Unavoidable**

### Fix 1: Add Forced Transition from Step 10 to Step 11

**Added to Step 10 COMPLETION GATE (Line 190+):**
```typescript
*   **TRANSITION TO STEP 11**: Once all cells are complete, you MUST
    immediately proceed to Step 11 (Ethnographic Analysis). Do NOT ask
    about finalization yet. Do NOT skip ahead to Step 12 or 13.
```

**Impact:** Explicit directive to go to Step 11 after cells complete

---

### Fix 2: Enhanced Step 11 with Mandatory Language

**Before:**
```typescript
11. **Ethnographic Analysis (Deep Dive)**:
    *   **Logic**: You are now entering the "Deep Dive" phase...
```

**After:**
```typescript
11. **Ethnographic Analysis (Deep Dive) — MANDATORY**:
    *   **CRITICAL**: This step is REQUIRED. You CANNOT skip to Step 12
        or 13 without completing all 3 questions below.
    *   **Logic**: You must now ask 3 distinct ethnographic questions to
        uncover hidden motivations. These questions are ESSENTIAL for
        quality artifact generation in Step 13.
```

**Changes:**
- ✅ Added "MANDATORY" to title
- ✅ Added "CRITICAL" and "REQUIRED" at start
- ✅ Explicit prohibition: "You CANNOT skip"
- ✅ Tied to artifact quality: "ESSENTIAL for quality"

---

### Fix 3: Added Mental Checklist (Blocking Gate)

**Added to Step 11:**
```typescript
*   **BLOCKING GATE**: You MUST ask ALL 3 questions before proceeding
    to Step 12. Track mentally:
    - [ ] Gap Analysis question asked and answered
    - [ ] Magic Wand question asked and answered
    - [ ] Synthesis question asked and answered
```

**Impact:**
- AI has explicit checklist to track progress
- Cannot proceed to Step 12 until all checkboxes mentally checked

---

### Fix 4: Strengthened Protocol Language

**Before:**
```typescript
**Protocol**:
1. **Turn 1**: Formulate a **Gap Analysis** question... Ask it. STOP.
2. **Turn 2**: (After user replies) Save answer mentally. Then ask...
```

**After:**
```typescript
**Protocol**:
1. **Turn 1 (REQUIRED)**: Formulate a **Gap Analysis** question... Ask it.
   STOP. Wait for user input. Do NOT proceed until you get an answer.
2. **Turn 2 (REQUIRED)**: (After user replies) Save answer mentally. Then
   ask... STOP. Wait for user input. Do NOT proceed until you get an answer.
```

**Changes:**
- ✅ Added "(REQUIRED)" label to each turn
- ✅ Added blocking instruction: "Do NOT proceed until you get an answer"

---

### Fix 5: Added Transition Gate to Step 11

**Added at end of Step 11:**
```typescript
*   **Transition Gate**: ONLY after all 3 questions have been asked and
    answered may you proceed to Step 12.
```

**Impact:** Explicit gate preventing premature transition

---

### Fix 6: Enhanced Step 12 with Gate Check

**Before:**
```typescript
12. **Final Check**:
    *   **Prompt**: "Is there anything else you'd like to add?"
```

**After:**
```typescript
12. **Final Check**:
    *   **Gate**: You may ONLY reach this step after completing ALL 3
        ethnographic questions in Step 11. If you haven't asked all 3
        questions yet, GO BACK to Step 11.
    *   **Prompt**: "Is there anything else you'd like to add?" (Do NOT
        suggest skipping). Keep this question simple and distinct from
        the ethnographic questions.
    *   **Important**: This is NOT "Is there anything else you'd like to
        add or refine before we finalize?" - that sounds premature. Use
        the exact wording: "Is there anything else you'd like to add?"
```

**Changes:**
- ✅ Added entry gate: "ONLY reach after completing ALL 3 questions"
- ✅ Added GO BACK instruction if questions not asked
- ✅ Clarified exact wording to prevent premature finalization language

---

### Fix 7: New CRITICAL RULE

**Added to CRITICAL RULES section:**
```typescript
- **STEPS 11-12 ARE MANDATORY (CRITICAL)**: After completing all cells
  (Step 10), you MUST complete Steps 11 and 12 before generating artifacts
  (Step 13). The workflow is FIXED:
    1. Step 10: Complete all cells
    2. Step 11: Ask ALL 3 ethnographic questions (Gap Analysis, Magic Wand,
       Synthesis) - one per turn
    3. Step 12: Ask "Is there anything else you'd like to add?"
    4. Step 13: ONLY THEN call `generate_artifacts`

    **Prohibition**: Do NOT skip from Step 10 directly to artifact generation.
    Do NOT ask "Is there anything else before we finalize?" prematurely - that
    bypasses the critical ethnographic questions.
```

**Impact:**
- Global rule reinforcing step sequence
- Explicit workflow diagram
- Prohibition against common error pattern

---

## 📊 **Before vs After Comparison**

### Before (Weak Enforcement):

**Step 10 Completion:**
```
✅ All cells complete
→ AI thinks: "Cells done, I can finalize now"
→ AI asks: "Anything else before we finalize?" (premature)
→ User: "No"
→ Jumps to Step 13 (artifacts)
```

**Missing:**
- Gap Analysis insights
- Magic Wand pain points
- Synthesis motivations

**Result:**
- Generic summary (only cell data)
- Shallow mental models
- Factual quotes (no revealing insights)

---

### After (Strong Enforcement):

**Step 10 Completion:**
```
✅ All cells complete
→ TRANSITION TO STEP 11 directive triggers
→ AI: "Now to understand the deeper 'why' behind these experiences..."
→ AI asks Gap Analysis question
→ User answers
→ AI asks Magic Wand question
→ User answers
→ AI asks Synthesis question
→ User answers
→ ALL 3 QUESTIONS CHECKED OFF
→ AI proceeds to Step 12: "Is there anything else you'd like to add?"
→ User: "No"
→ Step 13: Generate artifacts WITH ethnographic data
```

**Included:**
- ✅ Gap Analysis insights (why X instead of Y)
- ✅ Magic Wand pain points (what would change)
- ✅ Synthesis motivations (why it matters)

**Result:**
- Rich summary (explains WHY, not just WHAT)
- Deep mental models (beliefs, not just behaviors)
- Revealing quotes (from reflective moments)

---

## 🧪 **Testing the Fix**

### Test Scenario: Walkies Journey (Re-run)

**Setup:**
- 2 phases (Open Door, Walk)
- 2 swimlanes (Pains, Feelings)
- 4 cells total

**Expected Flow After Fix:**

1. **Step 10: Complete all 4 cells** ✓
2. **Step 11 Trigger:**
   ```
   AI: "Now to understand the deeper 'why' behind these experiences, I have
        a few questions about what makes 'Walkies' so impactful for you."
   ```
3. **Gap Analysis Question:**
   ```
   AI: "You mentioned feeling absolute frustration when the door is broken.
        Many pet parents might just... [continue with contrast]. Why do you
        think this specific issue bothers you so much?"

   User: [Answer]
   ```
4. **Magic Wand Question:**
   ```
   AI: "If you could change one thing about the 'Walkies' experience to make
        it less frustrating, what would it be?"

   User: [Answer]
   ```
5. **Synthesis Question:**
   ```
   AI: "Thinking about everything we've discussed - from the broken door to
        feeling unkindly toward your dog when they pull - why does getting
        this walk right matter so much to you?"

   User: [Answer]
   ```
6. **Step 12: Final Check:**
   ```
   AI: "Is there anything else you'd like to add?"

   User: "No"
   ```
7. **Step 13: Generate Artifacts** (now with rich ethnographic data)

**Red Flags (Indicates Fix Failed):**
- ❌ AI asks "Anything else before we finalize?" right after cells complete
- ❌ AI skips straight to "I'm going to put together a summary..."
- ❌ No Gap Analysis, Magic Wand, or Synthesis questions asked

---

## 🎯 **Why This Fix Works**

### 1. Multiple Layers of Enforcement

**Layer 1:** Explicit transition directive (Step 10 → Step 11)
**Layer 2:** Mandatory language in Step 11 title and opening
**Layer 3:** Mental checklist with blocking gate
**Layer 4:** Transition gate at end of Step 11
**Layer 5:** Entry gate at start of Step 12
**Layer 6:** Global CRITICAL RULE
**Layer 7:** Prohibition examples (what NOT to do)

**Result:** 7 overlapping safeguards prevent skip

### 2. Imperative Language

**Weak (Before):**
- "You are now entering..."
- "You must ask..."

**Strong (After):**
- "This step is REQUIRED"
- "You CANNOT skip"
- "Do NOT proceed until"
- "ONLY after... may you proceed"

**Gemini Response:** Imperative language triggers stricter compliance

### 3. Explicit Workflow Diagram

**Before:** Steps described in isolation

**After:** Explicit sequence in CRITICAL RULES:
```
1. Step 10 → 2. Step 11 → 3. Step 12 → 4. Step 13
```

**Gemini Response:** Visual workflow prevents mental shortcuts

### 4. Error Pattern Prevention

**Common Error Identified:**
> "Is there anything else you'd like to add or refine before we finalize?"

**Explicit Prohibition Added:**
> Do NOT ask "Is there anything else before we finalize?" prematurely

**Gemini Response:** Concrete negative examples prevent exact mistake

---

## 📈 **Expected Impact**

### Artifact Quality Improvement

| Metric | Before (No Ethnographic) | After (With Ethnographic) |
|--------|-------------------------|--------------------------|
| **Summary Depth** | Descriptive (what happened) | Explanatory (why it happened) |
| **Mental Models** | 2-3 behavioral patterns | 5-8 belief frameworks |
| **Quote Quality** | Factual statements | Reflective insights |
| **"Why" Insights** | Missing | Present in all artifacts |

### Interview Completion Rate

**Before:**
- Risk of premature finalization (as seen in Walkies journey)
- Missing critical data sources

**After:**
- Guaranteed completion of all 13 steps
- All data sources captured

---

## 📝 **Related Documentation**

- **PROMPT-UPDATE-ETHNOGRAPHIC-SYNTHESIS.md** - Why ethnographic data is critical
- **ARTIFACT-GENERATION-LOGIC.md** - How Step 13 uses ethnographic responses
- **prompts.ts:187-210** - Updated Steps 10-12 with blocking gates

---

## ✅ **Verification Checklist**

After deployment, test with a simple 2×2 journey:

- [ ] AI completes all cells (Step 10)
- [ ] AI immediately transitions to Step 11 (doesn't ask about finalization)
- [ ] AI asks Gap Analysis question
- [ ] AI waits for answer before proceeding
- [ ] AI asks Magic Wand question
- [ ] AI waits for answer before proceeding
- [ ] AI asks Synthesis question
- [ ] AI waits for answer before proceeding
- [ ] ONLY THEN does AI ask "Is there anything else you'd like to add?"
- [ ] After Step 12, AI silently calls generate_artifacts
- [ ] Artifacts include ethnographic insights

**Red Flag:** If AI says "before we finalize?" or skips any of the 3 questions, the fix failed.

---

**Implementation Status:** ✅ Complete
**Ready for Testing:** Yes
**Expected Impact:** Prevents premature artifact generation, ensures high-quality insights
