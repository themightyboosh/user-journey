# 🔍 Tool Execution Debugging Guide

## The Problem You Experienced

In your screenshot, MAX said:
> "I'm adding those rows to the grid now..."

But the canvas showed **NO grid** - just the journey header.

**Root Cause**: The AI was **hallucinating completion** - saying it was calling the tool without actually calling it.

---

## What We Fixed

### ✅ Fix 1: Schema Mismatch (Critical)

**Problem**:
- `tools.ts` required `description` field for phases/swimlanes
- `prompts.ts` "Speed Mode" allowed AI to skip descriptions
- Tool calls **failed silently** when descriptions missing
- Canvas stayed empty, AI thought it succeeded

**Solution**:
```typescript
// tools.ts - Made description optional
required: ["name"]  // Was: ["name", "description"]

// journey.service.ts - Added fallbacks
description: p.description || ''  // Was: p.description
description: s.description || ''

// journey.service.ts - Removed blocking validation
// REMOVED: throw new Error("Swimlanes missing descriptions...")
```

### ✅ Fix 2: Tool Execution Visibility

**Problem**: No way to tell if tools were actually executing vs AI hallucinating

**Solution**: Added 3 levels of visibility:

#### **Level 1: Visual Indicator (Bottom-Right Toast)**
When ANY tool executes, you'll see:
```
⚙️ Calling set_swimlanes_bulk...  (orange, executing)
✅ set_swimlanes_bulk succeeded    (green, 1 second)
❌ update_cell failed: Missing ID  (red, 3 seconds)
```

#### **Level 2: Browser Console Logs**
```javascript
[TOOL] set_swimlanes_bulk - executing {...args}
[TOOL] set_swimlanes_bulk - success
```

#### **Level 3: Backend Logs**
```
⚙️  Executing tool: set_swimlanes_bulk
✅ Tool "set_swimlanes_bulk" succeeded | journeyId: abc-123
```

### ✅ Fix 3: Prompt Enforcement

**Problem**: Prompt said "narrate BEFORE tool call" which encouraged hallucination

**Solution**:
```
OLD (Broken):
"I'm adding rows..." → [Call tool]

NEW (Fixed):
[Call tool] → [Wait for success] → "I've added those rows"
                                    ↑ Past tense, AFTER tool succeeds
```

---

## How to Diagnose Issues Now

### 🔍 Quick Test: Is the Tool Actually Running?

1. **Open browser console** (F12 → Console tab)
2. **Start a journey** and progress through the interview
3. **Watch for tool indicators**:

**✅ If you see this:**
```
[TOOL] set_swimlanes_bulk - executing
[TOOL] set_swimlanes_bulk - success
⚙️ (Visual toast appears bottom-right)
```
→ Tool is running! If canvas still doesn't update, it's a **render issue**.

**❌ If you DON'T see this:**
```
(No [TOOL] logs)
(No visual indicator)
MAX says: "I'm adding rows..." but nothing happens
```
→ **Prompt hallucination** - AI didn't actually call the tool.

---

## Three Types of Issues (Now Easy to Diagnose)

### 🎭 Type 1: Prompt Hallucination
**Symptoms**: AI says "saved" but no tool indicator appears

**Evidence**:
- ❌ No `[TOOL]` logs in console
- ❌ No visual toast indicator
- ❌ No backend logs

**Fix**: Strengthen prompt enforcement (already done)

---

### ⚠️ Type 2: Tool Execution Error
**Symptoms**: Tool indicator appears but shows error

**Evidence**:
- ✅ `[TOOL] tool_name - executing` appears
- ❌ `[TOOL] tool_name - error: Missing cellId` appears
- 🔴 Red toast: "update_cell failed: Missing cellId"

**Fix**: Check tool arguments - AI is calling tool but with wrong parameters

---

### 🖼️ Type 3: Render Issue
**Symptoms**: Tool succeeds but canvas doesn't update

**Evidence**:
- ✅ `[TOOL] tool_name - success` appears
- ✅ Green toast: "set_swimlanes_bulk succeeded"
- ✅ Backend logs show success
- ❌ Canvas still shows no grid

**Fix**: Check frontend polling/rendering (rare, but check `renderMap` logs)

---

## Testing the Fixes

### Test Case: "Finding a Chair" Journey

1. **Start journey** at https://journey-mapper-ai-8822.web.app
2. **Complete identity**: "Fred the Stoic"
3. **Define journey**: "Finding a Chair"
4. **Define phases**: "Look Around", "Sit" (notice descriptions are now optional!)
5. **Define swimlanes**: "Distance to chair", "Emotional states"

**Expected Behavior (NEW)**:
```
[User] Yes (confirms swimlanes)
⚙️ [TOOL] set_swimlanes_bulk - executing  ← IMMEDIATELY appears
✅ [TOOL] set_swimlanes_bulk - success    ← 1 second later
[MAX] I've added those rows to the grid. ← Only says this AFTER tool succeeds
[CANVAS] Grid appears with 2 columns × 2 rows
```

**Old Buggy Behavior**:
```
[User] Yes
[MAX] I'm adding those rows to the grid now...  ← Says this WITHOUT calling tool
(No tool indicator)
(No console logs)
[CANVAS] Nothing happens - still just header
```

---

## How to Use Tool Indicators in Real-Time

### During Interview:
1. Keep browser console open (F12)
2. Filter console by typing `[TOOL]` in the filter box
3. As you answer questions, watch for:
   - `[TOOL]` logs confirming each tool call
   - Visual indicators bottom-right

### If Something Goes Wrong:
1. **Check console** - Is `[TOOL]` appearing?
   - YES → Tool is running (check for `error` status)
   - NO → Prompt hallucination (AI didn't call tool)

2. **Check backend logs** (if you have access):
   ```bash
   firebase functions:log --only api
   ```
   Look for `⚙️ Executing tool:` and `✅ Tool succeeded`

3. **Check journey state API**:
   ```bash
   curl https://journey-mapper-ai-8822.web.app/api/journey-state/{journeyId} | jq
   ```
   Verify data exists in `phases`, `swimlanes`, `cells` arrays

---

## Pro Tips

### Tip 1: Console Filtering
Filter console by `[TOOL]` to see ONLY tool execution events:
```
[TOOL] create_journey_map - executing
[TOOL] create_journey_map - success
[TOOL] set_phases_bulk - executing
[TOOL] set_phases_bulk - success
[TOOL] set_swimlanes_bulk - executing
[TOOL] set_swimlanes_bulk - success
[TOOL] update_cell - executing
[TOOL] update_cell - success  (x8 if 2 phases × 4 swimlanes)
```

### Tip 2: Backend Log Monitoring
Open a second terminal and tail function logs:
```bash
firebase functions:log --only api --lines 50
```

### Tip 3: Journey State Inspection
Bookmark this in your browser:
```
https://journey-mapper-ai-8822.web.app/api/journey-state/{journeyId}
```
Replace `{journeyId}` with your journey's ID (from localStorage: `max_journey_id`)

---

## Summary

**Before These Fixes**:
- ❌ Tool calls failed silently (schema mismatch)
- ❌ No way to tell if tools were running
- ❌ AI could hallucinate "saved" without calling tools

**After These Fixes**:
- ✅ Tools succeed even without descriptions
- ✅ Visual + console + backend logs show every tool call
- ✅ AI MUST call tool before narrating (past tense only after success)
- ✅ You can instantly diagnose: hallucination vs error vs render issue

---

**Ready to deploy?** Just run:
```bash
cd /Users/danielcrowder/Desktop/Projects/journey-mapper
firebase deploy --only functions,hosting
```

The fixes are pushed to GitHub (commit `bb92c5f`) and ready to go live! 🚀
