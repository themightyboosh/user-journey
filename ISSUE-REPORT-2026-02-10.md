# CRITICAL BUG REPORT
**Date:** 2026-02-10
**Reporter:** Claude Sonnet 4.5
**Severity:** P0 - Blocks core functionality

## Issue Summary
After user confirms phases/swimlanes with "Yes", AI responds with "I had a brief hiccup processing that" and fails to create the journey structure. Canvas remains empty.

## Reproduction Steps
1. Start new journey at https://journey-mapper-ai-8822.web.app
2. Progress through identity questions (name, role, activity, why it matters)
3. AI asks: "List the high-level steps" → User: "Clean and Sharpen"
4. AI asks: "Does that timeline look right?" → User: "Yes"
5. **BUG**: AI says "brief hiccup" instead of calling `set_phases_bulk`
6. Canvas shows "New Journey" but no grid

## Expected Behavior
```
User: "Yes"
→ AI calls set_phases_bulk(['Clean', 'Sharpen'])
→ Grid appears with 2 columns
→ AI narrates: "Great, I've added those 2 phases to the grid"
→ AI asks about swimlanes
```

## Actual Behavior
```
User: "Yes"
→ No tool call
→ Canvas stays empty
→ AI says: "I had a brief hiccup processing that. Could you try sending your message again?"
→ No journey ID in console
```

## Technical Evidence

### Console Logs
```
[POLL] Skipped: No current journey ID
[REND] Using default target: journeyViewerRoot_cv
[REND] Container found, starting render
[REND] renderMap complete
[POLL] Skipped: No current journey ID
```

**Analysis:** Journey was never created or ID was lost.

### Transcript Analysis
```
Stage: PHASES (expected)
User Input: "Yes" (confirmation)
AI Response: Error recovery message
Tool Execution: NONE
Database State: Empty (0 phases, 0 swimlanes, 0 cells)
```

## Root Cause Theories

### Theory 1: Tool Execution Failure (Most Likely)
**Hypothesis:** AI attempted to call `set_phases_bulk` but the call failed due to:
- API error (500/502/504)
- Rate limit (429)
- Timeout
- Safety filter blocking
- Empty candidates

**Evidence:**
- "Brief hiccup" is error recovery language
- No journey ID suggests tool never completed
- This is different from hallucination (AI saying "I've added..." without calling tool)

**Verification Needed:**
- Check backend logs for failed tool calls around 1:32 PM
- Look for exceptions in `aiService.executeTool()`
- Check Vertex AI logs for blocked responses

### Theory 2: Journey Creation Failed at Identity Stage
**Hypothesis:** The initial `create_journey_map` tool never executed, so there's no journey to attach phases to.

**Evidence:**
- Console shows "No current journey ID"
- Frontend polling for journey but none exists

**Verification Needed:**
- Check if `create_journey_map` was called during identity collection
- Verify journey exists in journey-maps.json

### Theory 3: FunctionCallingMode.AUTO Not Strong Enough
**Hypothesis:** With mode='AUTO', Gemini chose not to call tools despite Tool-First Protocol prompts.

**Evidence:**
- This matches the original hallucination pattern
- v3.1.0 uses AUTO mode (we reverted from ANY due to "mute" risk)

**Verification Needed:**
- Check if tool was attempted at all
- Review Gemini response to see if it tried to call tools

## Code References

### Backend Tool Execution (server.ts)
**Lines 330-370:** Tool execution loop
```typescript
for (const call of functionCalls) {
    const fn = call.functionCall;
    safeSend({ tool: fn.name, status: 'executing', args: fn.args });
    const toolResult = await aiService.executeTool(fn.name, fn.args);
    if (toolResult?.error) {
        safeSend({ tool: fn.name, status: 'error', error: toolResult.error });
    } else {
        safeSend({ tool: fn.name, status: 'success' });
    }
}
```

**Issue:** If tool execution throws unhandled exception, the loop may break and AI never gets tool result.

### AI Service Tool Config (ai.service.ts)
**Lines 128-160:** FunctionCallingMode.AUTO configuration
```typescript
toolConfig: {
    functionCallingConfig: {
        mode: FunctionCallingMode.AUTO // AI chooses when to call tools
    }
}
```

**Issue:** AUTO mode allows AI to choose not to call tools.

### Tool-First Protocol (prompts.ts)
**Lines 416-464:** Instructions for tool calling
```
STEP 1: STOP. DO NOT SPEAK.
STEP 2: CALL set_phases_bulk IMMEDIATELY.
STEP 3: WAIT for functionResponse.
STEP 4: ONLY THEN speak to the user.
```

**Issue:** Strong language but mode='AUTO' may override.

## Impact
- 🔴 **User Experience:** Journey creation completely fails
- 🔴 **Core Feature:** Cannot create journey maps at all
- 🔴 **Reliability:** Users lose confidence in the tool
- 🟡 **Workaround:** None - must restart and hope it works

## Proposed Fixes (Priority Order)

### Fix 1: Add Error Handling & Retry Logic (Quick Win)
**What:** Catch tool execution errors and retry
**Where:** `server.ts` lines 330-370
**Code:**
```typescript
try {
    const toolResult = await aiService.executeTool(fn.name, fn.args);
    if (toolResult?.error) {
        logger.error('Tool execution error', { tool: fn.name, error: toolResult.error });
        safeSend({ tool: fn.name, status: 'error', error: toolResult.error });

        // Retry once
        await sleep(1000);
        const retryResult = await aiService.executeTool(fn.name, fn.args);
        if (!retryResult?.error) {
            safeSend({ tool: fn.name, status: 'success' });
        }
    }
} catch (e) {
    logger.error('Tool execution exception', { tool: fn.name, error: e.message });
    safeSend({ error: 'Tool execution failed. Please try again.' });
}
```

### Fix 2: Conditional mode='ANY' for Confirmation Turns (Recommended)
**What:** Detect "Yes" responses and switch to mode='ANY' for that turn only
**Where:** `ai.service.ts` `getRequestModel()`
**Logic:**
```typescript
// Check if user's last message is a confirmation
const isConfirmation = /^(yes|yeah|yep|correct|right|yup)$/i.test(lastUserMessage);
const isConfirmationStage = ['PHASES', 'SWIMLANES'].includes(journeyState?.stage);

if (isConfirmation && isConfirmationStage) {
    modelConfig.toolConfig.functionCallingConfig.mode = FunctionCallingMode.ANY;
    logger.info('🔧 Forcing mode=ANY for confirmation response');
}
```

### Fix 3: Add Tool Execution Visibility (Debug)
**What:** Show tool execution status to user
**Where:** Frontend toast indicators (already implemented but may not be firing)
**Verify:** Check if SSE events are reaching frontend

### Fix 4: Add Journey Creation Verification
**What:** After identity stage, verify journey was created before proceeding
**Where:** `server.ts` after conversation turn
**Code:**
```typescript
if (journeyState?.stage === 'PHASES' && !journeyState?.journeyMapId) {
    logger.error('Journey not created but moved to PHASES stage');
    safeSend({ error: 'Journey creation failed. Starting over...' });
    // Force journey creation
}
```

## Testing Plan

1. **Reproduce the bug:**
   - Start fresh journey
   - Confirm phases with "Yes"
   - Capture backend logs, Vertex AI response, tool execution

2. **Test Fix 1 (Error Handling):**
   - Inject tool execution error
   - Verify retry logic works
   - Check user sees helpful error

3. **Test Fix 2 (Conditional ANY):**
   - Confirm "Yes" response triggers mode='ANY'
   - Verify tool is called
   - Verify grid appears
   - Test edge case: "Yes please" vs "Yes" vs "Yeah"

4. **Test Fix 3 (Visibility):**
   - Verify toast shows: ⚙️ Calling set_phases_bulk
   - Verify console shows: [TOOL] set_phases_bulk - executing
   - If not firing, debug SSE event flow

## Related Issues
- Original hallucination bug (AI saying "I've added" without calling tool)
- Mode='ANY' "mute" risk (AI can't speak after tool execution)
- Firebase Functions caching (old code running)

## Version Info
- Prompts: v3.1.0 (Tool-First Protocol + AUTO mode)
- Tools: v3.1.0 (Schema flexibility + AUTO mode)
- Build: 2026-02-10T17:48:17.435Z
- Commit: 4f326bc

## Next Steps
1. Check backend logs for this specific session (1:31-1:32 PM)
2. Implement Fix 1 (error handling) immediately
3. Test Fix 2 (conditional ANY mode) as permanent solution
4. Add comprehensive logging for tool execution flow
