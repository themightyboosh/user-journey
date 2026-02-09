# Canvas Rendering Issue - Debugging Guide
**Issue:** Title doesn't generate as expected in journey canvas. After prompting for description, canvas stops working.

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Chat Conversation (SSE Stream)                          │
│    /api/chat → AI generates responses → Calls tools        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓ Tools called
┌────────────────────────────────────────────────────────────┐
│ 2. Tool Execution (server.ts:336)                          │
│    - create_journey_map                                     │
│    - update_journey_metadata  ← Should set title/desc      │
│    - set_phases_bulk                                        │
│    - set_swimlanes_bulk                                     │
│    - update_cell                                            │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ↓ Saves to Firestore
┌────────────────────────────────────────────────────────────┐
│ 3. Firestore Storage (via journey.service.ts)              │
│    JourneyService.updateMetadata() saves:                   │
│    - journey.name (the title)                               │
│    - journey.description                                    │
│    - journey.role                                           │
│    - journey.userName                                       │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ↓ Polled every 2 seconds
┌────────────────────────────────────────────────────────────┐
│ 4. Frontend Polling (index.html:1955)                      │
│    pollJourneyState()                                       │
│    → GET /api/journey-state/${journeyId}                   │
│    → Updates currentJourney                                 │
│    → Calls renderCurrentView()                              │
└────────────────┬───────────────────────────────────────────┘
                 │
                 ↓ Renders to canvas
┌────────────────────────────────────────────────────────────┐
│ 5. Canvas Rendering (renderer.js:125)                      │
│    renderMap(journey)                                       │
│    → Reads journey.name (title)                             │
│    → Reads journey.description                              │
│    → Builds HTML and injects into canvas                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Debugging Checklist

### Step 1: Check if Journey is Created
**Location:** Browser DevTools Console

When AI says "Hi [Name]!", check:
```javascript
// In browser console:
console.log('Journey ID:', currentJourneyId);
```

**Expected:** Should see a UUID like `"a1b2c3d4-..."`
**If null/undefined:** Journey creation failed (AI didn't call `create_journey_map` tool)

---

### Step 2: Check if Title is Saved in Firestore
**Location:** Browser DevTools Console

After AI asks for description and you respond:
```javascript
// In browser console:
console.log('Current Journey:', currentJourney);
// Check:
// - currentJourney.name (should be journey title)
// - currentJourney.description (should be your description)
```

**Expected:**
```javascript
{
  name: "Onboarding New Customers",  // ✅ Should exist
  description: "Helping new users...", // ✅ Should exist
  role: "Product Manager",
  userName: "Daniel",
  ...
}
```

**If name is empty:** AI didn't call `update_journey_metadata` correctly

---

### Step 3: Check if Polling is Working
**Location:** Browser DevTools Network Tab

1. Open DevTools → Network tab
2. Filter for "journey-state"
3. Watch for requests every 2 seconds

**Expected:**
- Request: `GET /api/journey-state/{journeyId}`
- Status: 200 OK
- Response should contain journey with `name` and `description`

**If no requests:** `currentJourneyId` is not set (Step 1 failed)
**If 404:** Journey not found in Firestore
**If 200 but name is empty:** Data not saved properly

---

### Step 4: Check Canvas Rendering
**Location:** Browser DevTools Console

Add this temporary debug code to index.html around line 1773:
```javascript
function renderCurrentView() {
    if (!currentJourney) {
        console.warn('❌ No currentJourney to render');
        return;
    }

    console.log('✅ Rendering journey:', {
        name: currentJourney.name,
        description: currentJourney.description,
        hasPhases: currentJourney.phases?.length > 0,
        hasCells: currentJourney.cells?.length > 0
    });

    if (state.currentView === 'map') {
        renderMap(currentJourney);
    } else {
        renderJson(currentJourney);
    }
}
```

**Expected:** Should log journey details every time canvas updates

---

## Common Failure Modes & Fixes

### 🐛 Failure Mode 1: "AI asks for description but journeyId is null"

**Symptom:**
- AI conversation proceeds normally
- `console.log(currentJourneyId)` shows `null`
- No polling requests in Network tab

**Root Cause:** AI didn't call `create_journey_map` tool in Step 2 (Identity Capture)

**Check Prompt:**
- File: `api-mcp/src/ai/prompts.ts`
- Lines: 47-51 (Step 2: Capture Identity)
- Ensure AI is instructed to call `create_journey_map` after identity confirmation

**Check Server Logs:**
```bash
# Look for:
[JourneyService] Created: {id}
```

**If missing:** AI skipped Step 2 or tool call failed

**Fix:**
1. Check if `create_journey_map` is in JOURNEY_TOOLS (`ai/tools.ts`)
2. Check if AI system instruction includes Step 2
3. Add logging in `server.ts:336` to see which tools are being called

---

### 🐛 Failure Mode 2: "Journey created but name is empty"

**Symptom:**
- `currentJourneyId` exists
- `currentJourney.name` is empty string or "Untitled Journey"
- Canvas shows "Untitled Journey" header

**Root Cause:** AI didn't call `update_journey_metadata` after asking for description

**Check Prompt:**
- File: `api-mcp/src/ai/prompts.ts`
- Lines: 53-56 (Step 4: Capture Journey)
- Ensure AI calls `update_journey_metadata` with name + description

**Check Server Logs:**
```bash
# Look for:
[JourneyService] Updated Metadata: {id} | Stage: PHASES
```

**If missing:** AI proceeded without calling the tool

**Debug in Chat:**
After AI asks "Tell me about the journey" and you respond, manually check:
```javascript
// Wait 3 seconds for polling, then:
console.log('Name:', currentJourney.name);
console.log('Description:', currentJourney.description);
```

**Fix:**
- Ensure Step 3-4 in prompts.ts enforces tool call
- Check if `update_journey_metadata` tool parameters are correct
- Verify journey.name is being set in `journey.service.ts:75`

---

### 🐛 Failure Mode 3: "Data saves but canvas doesn't update"

**Symptom:**
- Network tab shows journey-state with correct data
- `console.log(currentJourney)` shows correct name/description
- Canvas still shows old data or "Untitled Journey"

**Root Cause:** `renderMap()` not being called or rendering logic broken

**Check:**
1. **Is renderCurrentView being called?**
   ```javascript
   // Add to pollJourneyState (line 1980):
   console.log('📊 Rendering after poll');
   renderCurrentView();
   ```

2. **Is renderMap executing?**
   Add to renderer.js line 126:
   ```javascript
   function renderMap(journey, targetElementId) {
       console.log('🎨 renderMap called with:', journey.name);
       // ... rest of function
   ```

3. **Is canvas element found?**
   Check renderer.js line 130:
   ```javascript
   const container = document.getElementById(targetElementId);
   if (!container) {
       console.error('❌ Canvas container not found:', targetElementId);
       return;
   }
   console.log('✅ Canvas container found');
   ```

**Fix:**
- If renderMap not called: Check `state.currentView` is 'map' (not 'json')
- If container not found: Check `window.journeyViewer` is initialized
- If rendering but not visible: Check CSS (canvas might be hidden)

---

### 🐛 Failure Mode 4: "Canvas shows title but stops after that"

**Symptom:**
- Title appears on canvas
- Description doesn't appear
- No phases/swimlanes render
- AI conversation might continue normally

**Root Cause:**
- Canvas rendering only header section
- Grid not rendering (phases/swimlanes empty)
- Or render crashes partway through

**Check:**
1. **Does journey have phases yet?**
   ```javascript
   console.log('Phases:', currentJourney.phases);
   // Should be [] at this stage (description prompt is Step 3-4)
   ```
   This is **expected** — phases come later (Step 5-6)

2. **Is render completing?**
   Add to renderer.js line 510 (after html += `</div>`):
   ```javascript
   console.log('✅ Render HTML complete, length:', html.length);
   container.innerHTML = html;
   console.log('✅ Canvas updated');
   ```

3. **Any JavaScript errors?**
   Check DevTools Console for red errors

**Expected Behavior at Step 3-4:**
```
Canvas should show:
- M.AX Logo ✅
- Title: "[Journey Name]" ✅
- Role: "[Name], [Role]" ✅
- Description: "[Description]" ✅
- Empty grid (no phases/swimlanes yet) ✅
```

**If description missing:**
- Check `journey.description` in currentJourney
- Check renderer.js line 253 (description rendering logic)

---

## Testing Procedure

### Manual Test: Full Flow

1. **Reset state:**
   ```javascript
   localStorage.clear();
   location.reload();
   ```

2. **Start conversation:**
   - AI should greet and ask for name/role
   - Provide: "Daniel, Product Manager"

3. **Check Step 2 (Identity):**
   ```javascript
   console.log('After identity - Journey ID:', currentJourneyId);
   // Expected: UUID
   ```

4. **Continue to Step 3 (Journey Name):**
   - AI should ask about journey
   - Provide: "Onboarding new customers to our SaaS platform"

5. **Check Step 4 (Metadata saved):**
   ```javascript
   // Wait 3 seconds
   console.log('After description:', currentJourney);
   // Expected: { name: "Onboarding new customers...", description: "...", ...}
   ```

6. **Check Canvas:**
   - Should show journey title in large text
   - Should show description below
   - Grid will be empty (phases come next)

---

## Quick Diagnostic Script

**Add this to browser console for instant diagnosis:**

```javascript
function diagnoseCanvas() {
    console.log('=== CANVAS DIAGNOSTIC ===');
    console.log('1. Journey ID:', currentJourneyId || '❌ NOT SET');
    console.log('2. Current Journey:', currentJourney || '❌ NOT SET');

    if (currentJourney) {
        console.log('   - Name:', currentJourney.name || '❌ EMPTY');
        console.log('   - Description:', currentJourney.description || '❌ EMPTY');
        console.log('   - Stage:', currentJourney.stage);
        console.log('   - Phases:', currentJourney.phases?.length || 0);
        console.log('   - Swimlanes:', currentJourney.swimlanes?.length || 0);
        console.log('   - Cells:', currentJourney.cells?.length || 0);
    }

    console.log('3. Viewer initialized:', !!window.journeyViewer);
    console.log('4. Current view:', state?.currentView || 'unknown');
    console.log('5. Canvas element:', document.getElementById(window.journeyViewer?.canvasId || 'journeyDashboard') ? '✅' : '❌');

    // Try to force a render
    if (currentJourney) {
        console.log('6. Forcing render...');
        renderCurrentView();
        console.log('   Render complete');
    }
}

// Run it
diagnoseCanvas();
```

---

## Next Steps

1. **Run diagnostic script** in browser console during a session
2. **Identify which step fails** using the checklist above
3. **Check corresponding code location** from the data flow diagram
4. **Add targeted logging** to isolate the issue
5. **Report findings** with console output + network requests

---

## Files to Check

| Issue | File | Line | Function |
|-------|------|------|----------|
| Journey not created | `ai/prompts.ts` | 47-51 | Step 2: Capture Identity |
| Title not saved | `ai/prompts.ts` | 53-56 | Step 4: Capture Journey |
| Tool not called | `server.ts` | 314-356 | Function call execution |
| Data not saved | `journey.service.ts` | 71-92 | updateMetadata() |
| Polling not working | `index.html` | 1955-1985 | pollJourneyState() |
| Canvas not rendering | `renderer.js` | 125-510 | renderMap() |
| No canvas element | `index.html` | 1789-1817 | JourneyViewer init |

---

**Status:** Ready for debugging session
**Next:** Run diagnostic script and report findings
