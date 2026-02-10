# CRITICAL FIX: AI Repeating Exact Same Question

**Date:** 2026-02-10
**Issue:** AI asking the exact same question twice in a row
**Root Cause:** No explicit prohibition against question repetition in prompts
**Solution:** Added conversation history check with rephrase protocol

---

## ❌ **Problem: Duplicate Question Loop**

### Observed Behavior (Fred Transcript - 2026-02-10)

**10:40:39 PM:**
```
MAX: "Hi! I'm Max, a UX researcher. I'm here to understand your work as an onion farmer and what matters to you in that. Could you tell me about an important activity you perform as an onion farmer, and why it matters to you?"
```

**10:40:55 PM (16 seconds later):**
```
MAX: "Hi Fred! Could you tell me about an important activity you perform as an onion farmer, and why it matters to you?"
```

**Issues:**
1. ❌ AI asked THE EXACT SAME QUESTION twice
2. ❌ Only 16 seconds elapsed between the two questions
3. ❌ User likely didn't respond to first question, so AI repeated it verbatim
4. ❌ Creates poor UX - feels like a bug or broken conversation loop

---

## 🔍 **Root Cause Analysis**

### Issue: No Repetition Prevention Rule

**Current Prompt State:**
- Prompts have strong rules for:
  - ONE CELL PER TURN (don't ask about multiple cells)
  - Tool-first flow (call tools before moving on)
  - Gate enforcement (don't skip steps)
  - Question repetition prevention: **MISSING**

**What Likely Happened:**
1. AI asked question at 10:40:39 PM
2. User didn't respond (or response was delayed)
3. AI received no input after timeout or user sent empty message
4. AI didn't know what to do, so it repeated the EXACT same question

**Gemini Behavior Pattern:**
- When uncertain or stuck, Gemini may repeat its last action
- Without explicit "Do NOT repeat the same question" rule, the model falls back to literal repetition
- This is especially common in streaming scenarios where the AI might not detect that it already asked

---

## ✅ **Solution: Question Repetition Prevention Protocol**

### Fix 1: Added to Step 10 (Cell Questioning)

**Added after "The Golden Thread" style guidance (Lines 162-172):**

```typescript
*   **Prompt Style — "The Golden Thread"**: Do NOT simply ask "What about [Swimlane]?". You must **bridge** from their previous answer. Use a detail they just gave you to frame the next question.
    *   ❌ **AVOID (Mechanical/Template)**: "Got it. Now what are the Pain Points in this phase?" or "For [Swimlane] during [Phase], what happens?"
    *   ✅ **PREFER (Natural/Threaded)**: "You mentioned using Excel is tedious there. Does that frustration lead to any other specific pain points or bottlenecks in this moment?"

*   **QUESTION REPETITION PREVENTION (CRITICAL)**: Before asking ANY question, check your recent conversation history (last 3-5 turns):
    *   **Rule**: NEVER ask the exact same question twice in a row. If the user didn't answer adequately, either:
        1.  Rephrase the question with different wording, OR
        2.  Provide an example to help them understand, OR
        3.  Accept their brief answer and move on (don't get stuck)
    *   ❌ **WRONG**: Asking "Could you tell me about an important activity..." at 10:40:39 PM, then asking the EXACT SAME QUESTION again at 10:40:55 PM
    *   ✅ **CORRECT**: If first attempt gets no response, rephrase: "What's something you do regularly as an onion farmer that matters to you?"
    *   **Prohibition**: Do NOT loop. Do NOT repeat. Each question must be unique or a meaningful rephrasing.
```

**Gemini Prompt Engineering Principles Applied:**
1. **Explicit History Check**: "check your recent conversation history (last 3-5 turns)"
2. **Three-Option Protocol**: Gives AI 3 alternative actions if user doesn't answer
3. **Concrete Example**: Shows exact Fred transcript pattern with timestamps
4. **Imperative Language**: "NEVER ask the exact same question twice"
5. **Visual Annotation**: ❌ WRONG vs ✅ CORRECT with exact examples

---

### Fix 2: Added to CRITICAL RULES

**Added after Swimlane Ambiguity rule (Lines 259-265):**

```typescript
- **NO QUESTION REPETITION (CRITICAL)**: NEVER ask the exact same question twice in a row. If you just asked a question and the user didn't respond or gave an unclear answer:
    1.  Rephrase with different wording, OR
    2.  Provide an example to clarify, OR
    3.  Accept the brief answer and move forward
    *   **Prohibition**: Do NOT loop. Do NOT get stuck repeating the same question verbatim.
```

**Gemini Prompt Engineering Principles Applied:**
1. **Redundant Enforcement**: Critical rules appear in TWO places (Step 10 + CRITICAL RULES)
2. **Numbered Protocol**: Clear 3-option decision tree
3. **Strong Prohibition**: "Do NOT loop. Do NOT get stuck" - imperative language
4. **Global Scope**: Rule applies to ALL steps, not just cell questioning

---

## 🎯 **Why This Fix Works**

### 1. Explicit History Check Requirement

**Before:** No instruction to check conversation history before asking questions.

**After:** "Before asking ANY question, check your recent conversation history (last 3-5 turns)"

**Gemini Pattern:** Explicit procedural steps increase compliance. Telling the model to CHECK before ACTING creates a mental gate.

---

### 2. Multiple Escape Routes

**Before:** If user doesn't respond, AI has no guidance on what to do → repeats question.

**After:** Three options provided:
1. Rephrase (change wording)
2. Provide example (add clarity)
3. Move on (don't get stuck)

**Gemini Pattern:** Providing multiple valid actions prevents the AI from falling into a default loop behavior.

---

### 3. Concrete Negative Example

**Fred Pattern Captured:**
```
❌ **WRONG**: Asking "Could you tell me about an important activity..." at 10:40:39 PM,
              then asking the EXACT SAME QUESTION again at 10:40:55 PM
```

**Gemini Pattern:** Showing the EXACT transcript pattern with timestamps makes the prohibition concrete. The model can pattern-match against this example.

---

### 4. Rephrase Example Provided

**Before:** AI doesn't know HOW to rephrase if user doesn't respond.

**After:** Explicit rephrase example:
```
✅ **CORRECT**: If first attempt gets no response, rephrase:
                "What's something you do regularly as an onion farmer that matters to you?"
```

**Gemini Pattern:** Don't just say "rephrase" - SHOW a rephrase. This gives the AI a template to follow.

---

## 📊 **Before vs After Comparison**

### Before (Question Loop)

```
[10:40:39 PM]
AI: "Could you tell me about an important activity you perform as an onion farmer,
     and why it matters to you?"

[User doesn't respond or response is delayed]

[10:40:55 PM]
AI: "Could you tell me about an important activity you perform as an onion farmer,
     and why it matters to you?" ← EXACT SAME QUESTION
```

**User Experience:**
- Feels like a bug
- Frustrating (already heard this)
- Unclear if AI is stuck

---

### After (Rephrasing Protocol)

```
[10:40:39 PM]
AI: "Could you tell me about an important activity you perform as an onion farmer,
     and why it matters to you?"

[User doesn't respond or response is delayed]

[AI checks conversation history → Detects no response → Applies protocol]

[10:40:55 PM - Option 1: Rephrase]
AI: "What's something you do regularly as an onion farmer that's important to you?"

[OR Option 2: Provide Example]
AI: "For example, do you focus on planting, harvesting, pest management, or
     something else that's central to your work?"

[OR Option 3: Move On]
AI: "Let me know whenever you're ready to share, or we can move to the next step."
```

**User Experience:**
- Feels natural (AI is trying different approaches)
- Shows intelligence (not stuck in loop)
- Gives user options (example helps clarify)

---

## 🧪 **Testing the Fix**

### Test Scenario: Delayed User Response

**Setup:**
- Start a blank journey
- AI asks for important activity (Step 3)
- Delay response by 30+ seconds

**Expected Behavior:**

1. **First Question (10:00:00):**
   ```
   AI: "Could you tell me about an important activity you perform, and why it matters?"
   ```

2. **User doesn't respond for 30 seconds**

3. **Second Attempt (10:00:30) - Should be DIFFERENT:**
   ```
   ✅ CORRECT (Rephrase):
   AI: "What's something important you do regularly in your role?"

   ✅ CORRECT (Example):
   AI: "For example, is there a specific task or responsibility that's central to your work?"

   ✅ CORRECT (Move On):
   AI: "Take your time - let me know when you're ready to share."
   ```

4. **Red Flags (Fix Failed):**
   ```
   ❌ WRONG:
   AI: "Could you tell me about an important activity you perform, and why it matters?"
   [Exact same wording as first attempt]
   ```

---

## 📈 **Expected Impact**

### Conversation Quality

| Metric | Before (Repetition) | After (Rephrasing) |
|--------|--------------------|--------------------|
| **Duplicate Questions** | Frequent (when user delays) | Never (rephrases instead) |
| **User Frustration** | High ("Is the AI stuck?") | Low (feels conversational) |
| **Loop Detection** | None | Explicit history check |
| **Recovery Options** | 0 (just repeats) | 3 (rephrase, example, move on) |

### Edge Case Handling

**Before:**
- User doesn't respond → AI repeats → User still doesn't respond → AI repeats again → LOOP

**After:**
- User doesn't respond → AI rephrases → User still doesn't respond → AI provides example → User still doesn't respond → AI moves on (no loop)

---

## 🔧 **Technical Implementation Notes**

### Why This Happens in Streaming Scenarios

**Gemini Streaming Behavior:**
- In SSE (Server-Sent Events) streaming, the AI generates responses in chunks
- If the user's message doesn't arrive or is empty, the AI might:
  1. Not detect that it already asked the question (conversation history not refreshed)
  2. Fall back to repeating the last generated output

**Our Fix:**
- Explicit instruction to "check your recent conversation history (last 3-5 turns)"
- This forces the AI to review what it ALREADY said before generating new output
- The prohibition "NEVER ask the exact same question twice in a row" prevents verbatim repetition

---

## 📝 **Related Documentation**

- **CRITICAL-FIX-CELL-QUESTION-SPLITTING.md** - ONE CELL PER TURN enforcement
- **CRITICAL-FIX-SKIP-ETHNOGRAPHIC-QUESTIONS.md** - 7-layer enforcement for mandatory steps
- **prompts.ts:173-182** - Step 10 question repetition prevention (updated)
- **prompts.ts:259-265** - CRITICAL RULES (updated)

---

## ✅ **Verification Checklist**

After deployment:

- [ ] Start a new journey
- [ ] AI asks first question
- [ ] Wait 30+ seconds without responding
- [ ] AI sends second message
- [ ] Verify second message is DIFFERENT from first (rephrased or example provided)
- [ ] Verify AI does NOT ask the EXACT same question verbatim

**Red Flag:** If AI repeats the exact same question word-for-word, the fix failed.

---

**Implementation Status:** ✅ Complete
**Ready for Testing:** Yes
**Expected Impact:** Prevents question repetition loops, improves conversation flow, better UX during delays
