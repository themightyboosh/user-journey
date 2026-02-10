# Swimlane & Journey Description Fixes

## Issues Fixed

### Issue 1: Journey Description Hallucination ❌ → ✅
**Problem:** MAX was inferring/fabricating journey details instead of asking the user.

**Example from transcript:**
- User: "I woke him outside"
- MAX: "So, the journey is 'Waking Him Outside,' and it's all about taking your Bernedoodle out shortly after waking up for their morning routine and well-being."
  - ❌ Hallucinated: "morning routine and well-being"
  - ✅ User actually meant: "nighttime activity"

**Root Cause:** Step 3 (Journey Setup) in `prompts.ts` line 307 said:
> "DEDUCE a succinct Journey Name from their response"

This caused MAX to infer BOTH the name AND description without explicitly asking.

**Fix Applied:**
Added explicit instruction in Step 3 (BOTH UNKNOWN mode):
```
3. **CRITICAL - NO HALLUCINATION**: Do NOT infer or make up details about the journey. After getting the activity name, EXPLICITLY ASK:
   - "Can you give me a brief description of what [Journey Name] entails?"
   - OR "Tell me a bit more about what [Journey Name] involves."
4. Wait for user's actual description. Do NOT fabricate details like timing, purpose, or steps.
5. Call `update_journey_metadata` with deduced name + user's ACTUAL description (not inferred).
```

**Expected Behavior Now:**
1. User: "I woke him outside"
2. MAX: "So the journey is 'Waking Him Outside'. Can you give me a brief description of what that entails?"
3. User: "It's a nighttime activity where I open the door then bring him back in"
4. MAX: "Got it!" → Saves with user's ACTUAL description

---

### Issue 2: Swimlanes Not Rendering (Missing Descriptions) ❌ → ✅
**Problem:** Phases drew on canvas but swimlanes didn't appear even after user confirmed them.

**Example from transcript:**
- User: "Positive Feelings, Negative Feelings"
- MAX: "So the rows are: Positive Feelings and Negative Feelings. Are these the right layers?"
- User: "yes"
- MAX: "I'm adding those rows to the grid now..."
- **Result:** ❌ Grid didn't render (swimlanes missing descriptions)

**Root Cause:** Step 7 (Swimlane Discovery) said:
> "Auto-describe if standard terms: If user says 'Feelings', auto-describe as 'Emotional state experienced during each stage' - no need to probe."

But the AI wasn't actually generating descriptions - it was calling `set_swimlanes_bulk` with empty description fields, which caused either:
1. Tool call to fail silently
2. Swimlanes saved without descriptions → rendering failed
3. Matrix generation failed due to missing metadata

**Fixes Applied:**

#### 1. Updated Prompts (`prompts.ts` - buildStep7 function)

**USER MODE (Line 836-857):**
- ❌ Old: "Auto-describe if standard terms" (vague, optional)
- ✅ New: "Probing for Descriptions (MANDATORY)"

Changed from:
```
3. **Auto-describe if standard terms**: If user says "Feelings", auto-describe as "Emotional state experienced during each stage" - no need to probe.
4. **Confirm**: "So the rows are: [Swimlane 1], [Swimlane 2]. Are these the right layers?"
```

To:
```
**Probing for Descriptions (MANDATORY)**:
- After getting the swimlane NAMES, you MUST ask clarifying questions to understand what each layer represents.
- **ONE question per swimlane MAX** to get a brief description:
    - ✅ CORRECT: "What kind of things go in the [Swimlane] layer?"
    - ✅ CORRECT: "So [Swimlane] tracks what exactly?"
- **Goal**: Get 1-2 sentence definition of what this LAYER represents across ALL stages.

**Action - Description Collection**:
3. **Probe for descriptions**: For EACH swimlane, ask ONE brief question to get a description.
4. **Confirm**: After collecting ALL descriptions, summarize: "So the rows are: [Swimlane 1]: [description], [Swimlane 2]: [description]. Are these the right layers?"
```

**PARTIAL PRE-FILL MODE (Line 813-832):**
Enhanced probing requirements:
```
**Probe (MANDATORY - ONE QUESTION PER MISSING DESCRIPTION)**: For EACH swimlane in missing list, ask ONE brief question:
- **Examples**:
    - "Feelings" → "Your emotional state throughout the process"
    - "Actions" → "What you physically do at each stage"

**Gate (CRITICAL)**:
- Do NOT call set_swimlanes_bulk until ALL swimlanes have descriptions (no empty strings allowed).
```

#### 2. Added Backend Validation (`journey.service.ts` - setSwimlanesBulk method)

Added strict validation BEFORE saving:
```typescript
// Validate that ALL swimlanes have descriptions
const missingDescriptions = swimlanes.filter(s => !s.description || s.description.trim().length === 0);
if (missingDescriptions.length > 0) {
    logger.error(`[JourneyService] setSwimlanesBulk FAILED: Swimlanes missing descriptions`, {
        missingNames: missingDescriptions.map(s => s.name)
    });
    throw new Error(`Swimlanes missing descriptions: ${missingDescriptions.map(s => s.name).join(', ')}. All swimlanes must have descriptions before saving.`);
}
```

**Result:** Tool call will **FAIL** if ANY swimlane is missing a description, forcing the AI to collect them first.

#### 3. Added Enhanced Logging

**Backend logs now show:**
```
[JourneyService] setSwimlanesBulk START: <id> | Swimlanes to set: 2
  swimlaneNames: ["Positive Feelings", "Negative Feelings"]
  hasDescriptions: [
    { name: "Positive Feelings", hasDesc: true },
    { name: "Negative Feelings", hasDesc: true }
  ]
[JourneyService] Swimlanes mapped successfully
[JourneyService] Intermediate state saved, generating matrix...
```

If validation fails:
```
[JourneyService] setSwimlanesBulk FAILED: Swimlanes missing descriptions
  missingNames: ["Positive Feelings", "Negative Feelings"]
ERROR: Swimlanes missing descriptions: Positive Feelings, Negative Feelings. All swimlanes must have descriptions before saving.
```

---

## Expected Flow Now

### Journey Description (Step 3)
1. **User provides activity name**
   - User: "I woke him outside"
2. **MAX deduces short name**
   - MAX: "So the journey is 'Waking Him Outside'."
3. **MAX explicitly asks for description**
   - MAX: "Can you give me a brief description of what that entails?"
4. **User provides REAL description**
   - User: "It's a nighttime activity where I open the door then bring him back in"
5. **MAX saves with actual user words**
   - Tool call: `update_journey_metadata(name: "Waking Him Outside", description: "nighttime activity where I open the door then bring him back in")`

### Swimlane Collection (Step 7)
1. **User lists swimlane names**
   - User: "Positive Feelings, Negative Feelings"
2. **MAX acknowledges names**
   - MAX: "Got it. Let me understand what each of these tracks."
3. **MAX probes for EACH swimlane description (NEW)**
   - MAX: "What kind of things go in the Positive Feelings layer?"
   - User: "Things that make me happy during the process"
   - MAX: "And what about Negative Feelings?"
   - User: "Frustrations or sadness I feel"
4. **MAX confirms with descriptions**
   - MAX: "So the rows are:
     - Positive Feelings: Things that make you happy during the process
     - Negative Feelings: Frustrations or sadness you feel

     Are these the right layers?"
5. **User confirms**
   - User: "yes"
6. **MAX saves with complete data**
   - Tool call: `set_swimlanes_bulk([
       { name: "Positive Feelings", description: "Things that make you happy during the process" },
       { name: "Negative Feelings", description: "Frustrations or sadness you feel" }
     ])`
7. **Backend validates → Matrix generates → Grid renders** ✅

---

## Testing Instructions

### Test 1: Journey Description (No Hallucination)
1. Start new chat
2. Provide name/role
3. Say something brief like "I make coffee"
4. **Expected:**
   - MAX: "So the journey is 'Making Coffee'. Can you give me a brief description of what that entails?"
   - **DO NOT expect:** MAX fabricating details like "morning routine to brew..."

### Test 2: Swimlane Descriptions (Probing Required)
1. Continue from Test 1
2. Provide phases (e.g., "Prepare, Brew, Serve")
3. Provide swimlane names (e.g., "My Actions, My Feelings")
4. **Expected:**
   - MAX: "What kind of things go in the My Actions layer?"
   - You answer: "What I physically do"
   - MAX: "And what about My Feelings?"
   - You answer: "How I feel emotionally"
   - MAX: "So the rows are:
     - My Actions: What you physically do
     - My Feelings: How you feel emotionally

     Are these the right layers?"
   - You: "yes"
   - MAX: "I'm adding those rows to the grid now..."
   - **Check canvas:** Grid should render with phase columns AND swimlane rows visible

### Test 3: Backend Validation (Safety Net)
If AI somehow skips descriptions, backend should catch it:

**Backend Terminal:**
```
[JourneyService] setSwimlanesBulk FAILED: Swimlanes missing descriptions
  missingNames: ["Actions", "Feelings"]
ERROR: Swimlanes missing descriptions: Actions, Feelings. All swimlanes must have descriptions before saving.
```

**Frontend (AI should recover):**
- AI receives error → re-prompts user for descriptions → retries tool call

---

## Files Modified

1. **`api-mcp/src/ai/prompts.ts`**
   - Line 295-312: Updated `STEP_3_DEFAULT` to prevent journey description hallucination
   - Line 836-857: Updated buildStep7() USER MODE to make swimlane description probing mandatory
   - Line 813-832: Enhanced buildStep7() PARTIAL PRE-FILL mode with stricter gates

2. **`api-mcp/src/services/journey.service.ts`**
   - Line 225-260: Added validation and logging to `setSwimlanesBulk()` method

---

## Success Criteria

✅ Journey descriptions are NEVER fabricated - always explicitly asked for
✅ Swimlane descriptions are ALWAYS collected via probing (one question per swimlane)
✅ Backend rejects swimlane saves with empty descriptions
✅ Grid renders properly with phase columns AND swimlane rows
✅ Matrix generation succeeds after swimlanes are saved
✅ Winston logs show description validation details

---

**Last Updated:** 2026-02-10
**Author:** Claude Code Assistant
