# Canvas Redrawing Issue - Debugging & Fix

## Problem
When phases are saved during the interview, the canvas stops redrawing/updating even though the data is being saved to the database correctly.

## Root Cause Analysis

The issue involves the entire data pipeline from backend to frontend:

1. **Backend Chain** (API → Service → Store → Database)
   - `set_phases_bulk` tool call → `JourneyService.setPhasesBulk()` → `Store.save()` → Database
   - Phases ARE being saved correctly
   - Journey stage transitions from `IDENTITY` → `PHASES` → `SWIMLANES`

2. **Frontend Polling** (Database → API → Frontend → Renderer)
   - Frontend polls `/api/journey-state/:id` every 2 seconds
   - Journey state is fetched and updated in `currentJourney` global variable
   - `renderCurrentView()` is called to update the canvas

3. **Canvas Rendering** (Renderer → DOM)
   - `renderMap()` function in `renderer.js` generates HTML
   - Phases should appear in the table header
   - Grid should update as phases/swimlanes/cells are added

## Changes Made

### 1. Enhanced Backend Logging (`journey.service.ts`)
Added comprehensive logging to `setPhasesBulk()` method:
- Log when method starts with phase names
- Log journey retrieval success/failure
- Log current stage before transition
- Log phases mapping with IDs
- Log journey state after update
- Log metrics after recalculation
- Log successful save to store
- Log gate transition

### 2. Enhanced Store Logging (`store.ts`)
Added logging to both FileStorageAdapter and FirestoreAdapter:
- **getJourney**: Log journey details (name, stage, version, counts)
- **saveJourney**: Log before and after save with full context

### 3. Enhanced Frontend Polling (`index.html`)
Added detailed logging to `pollJourneyState()`:
- Log when polling is skipped (no ID, debug journey)
- Log fetch request with journey ID
- Log HTTP response status
- Log received journey data with counts
- Log version comparison (previous vs current)
- Log when renderCurrentView() is called
- Log completion of renderCurrentView()

### 4. Enhanced Render Logging (`index.html` & `renderer.js`)
**renderCurrentView():**
- Log function call with journey state
- Log current view mode (map/JSON)
- Log when rendering starts/completes
- Warn if no journey data

**renderMap():**
- Log function call with journey details
- Log target element resolution
- Log container found/not found
- Log innerHTML size before setting
- Log journeyRendered event dispatch
- Log completion

### 5. Fixed Version Increment (`metrics.ts`)
Changed `version: journey.version + 1` to `version: (journey.version || 0) + 1` to handle undefined initial versions.

## Testing Instructions

### 1. Start the Development Server
```bash
cd api-mcp
pnpm dev
```

### 2. Open Browser DevTools
- Open Chrome/Firefox DevTools (F12)
- Go to Console tab
- Clear console

### 3. Start a New Journey Interview
- Go to http://localhost:5173 (or your frontend URL)
- Start chatting with MAX
- Provide identity (name, role)
- Provide journey name and description
- **Provide phases** (e.g., "Open Door, Walk, Return")

### 4. Monitor Console Output
Watch for these log patterns:

#### Backend Logs (Terminal)
```
[JourneyService] setPhasesBulk START: <id> | Phases to set: 3
[JourneyService] Current stage: PHASES
[JourneyService] Phases mapped successfully
[JourneyService] Journey state updated
[JourneyService] Journey recalculated
[FileStore/Firestore] Saving journey: <id>
[FileStore/Firestore] Journey saved successfully: <id>
🚦 [GATE TRANSITION] PHASES → SWIMLANES | Phases set: 3
```

#### Frontend Logs (Browser Console)
```
[POLL] Fetching journey state: <id>
[POLL] Journey received: {id, name, stage, version, phasesCount: 3, ...}
[POLL] Version check: {previous: 1, current: 2, changed: true}
[POLL] Calling renderCurrentView()
[RENDER] renderCurrentView called
[RENDER] Rendering map view
[RENDERER] renderMap called
[RENDERER] Container found, starting render
[RENDERER] Setting container innerHTML, size: <number>
[RENDERER] innerHTML set successfully
[RENDERER] Dispatching journeyRendered event
[RENDERER] renderMap complete
[POLL] renderCurrentView() complete
```

### 5. Identify Issues

#### Issue: No backend logs
**Problem:** Tool call not being executed
**Check:**
- Is the AI model calling `set_phases_bulk`?
- Check `/api/chat` SSE stream for tool call events
- Check AI service logs

#### Issue: Backend logs but no save
**Problem:** Store.save() failing
**Check:**
- Are there database write errors?
- Check Firestore/file write permissions
- Check if journey ID exists

#### Issue: Save succeeds but polling doesn't fetch updates
**Problem:** Frontend not polling or fetch failing
**Check:**
- Is `currentJourneyId` set correctly?
- Is the journey ID matching?
- Check `/api/journey-state/:id` endpoint response
- Check browser network tab

#### Issue: Fetch succeeds but renderCurrentView not called
**Problem:** Polling logic error
**Check:**
- Is version comparison working?
- Is `currentJourney` being updated?
- Is there a JavaScript error breaking execution?

#### Issue: renderCurrentView called but canvas doesn't update
**Problem:** Renderer error or DOM issue
**Check:**
- Does renderMap() complete?
- Is the target container element present?
- Are there any renderer.js errors?
- Check if innerHTML is actually being set
- Check if JourneyViewer is initialized

## Expected Behavior

### After Phases Are Saved:
1. Backend logs show phases saved successfully
2. Version increments (e.g., v1 → v2)
3. Journey stage changes to `SWIMLANES`
4. Frontend polling detects version change
5. `renderCurrentView()` is called
6. Canvas updates to show:
   - Journey name and description in header
   - Phase column headers (Open Door, Walk, Return)
   - Empty grid (no swimlanes yet)
   - Stage indicator shows `SWIMLANES`

### During Swimlane Collection:
- AI asks for swimlane names (e.g., "Pains", "Pleasures")
- Canvas continues to poll and update
- Chat messages appear in chat view
- Canvas should still be responsive

### After Swimlanes Are Saved:
1. Matrix generation happens automatically
2. Grid cells appear (Phase × Swimlane intersections)
3. Stage changes to `CELL_POPULATION`
4. Canvas shows full grid structure

## Common Issues

### 1. Version Not Incrementing
**Symptom:** Polling logs show `version: undefined` or same version repeatedly
**Fix:** Check that `journey.version` is initialized to 1 in `createJourney()`

### 2. Canvas Shows "New Journey" Placeholder
**Symptom:** Canvas never updates from initial empty state
**Fix:**
- Verify `currentJourneyId` is set after journey creation
- Check that journeyId is returned in SSE stream from `/api/chat`
- Check localStorage for 'max_journey_id'

### 3. Polling Stops After First Update
**Symptom:** One update works, then polling stops
**Fix:**
- Check for JavaScript errors in console
- Verify setInterval is not being cleared
- Check if journey ID changes unexpectedly

### 4. Canvas Updates Only When Switching Views
**Symptom:** Canvas only updates when clicking Map/Chat toggle
**Fix:**
- Verify polling is running (check console for [POLL] logs every 2 seconds)
- Check if `renderCurrentView()` is being called
- Verify `state.currentView` is set correctly

### 5. Phases Saved But Grid Doesn't Appear
**Expected:** Grid header with phase columns should appear even without swimlanes
**Check:**
- Does renderer.js handle the case where `phases.length > 0` but `swimlanes.length === 0`?
- Look at line 258-276 in renderer.js - condition should render if phases exist

## Winston Logging

All backend logs use the Winston logger. To see them:

```bash
# In terminal running pnpm dev
# Logs appear with timestamps and JSON context
```

Example log output:
```json
{
  "level": "info",
  "message": "[JourneyService] Set Phases Bulk: <id> | Count: 3",
  "timestamp": "2026-02-10T05:30:00.000Z"
}
```

## Next Steps

1. **Test the changes:** Run a complete interview flow and monitor all logs
2. **Verify phases are displayed:** After setting phases, canvas should show phase headers
3. **Verify polling continues:** Console should show [POLL] logs every 2 seconds
4. **Verify version increments:** Each update should increment journey.version
5. **Document any remaining issues:** If canvas still doesn't update, check logs for specific failure point

## Additional Debugging

### Check Journey State Directly
```bash
# Via API
curl http://localhost:3001/api/journey-state/<journeyId>

# Via Firebase (if using Firestore)
# Open Firebase Console → Firestore → journey_maps → <journeyId>
```

### Check Browser State
```javascript
// In browser console
console.log('Current Journey ID:', currentJourneyId);
console.log('Current Journey:', currentJourney);
console.log('Last Version:', lastJourneyVersion);
console.log('Current View:', state.currentView);
console.log('Journey Viewer:', window.journeyViewer);
```

### Force Manual Update
```javascript
// In browser console
pollJourneyState();
```

## Success Criteria

✅ Backend logs show phases saved with IDs
✅ Version increments after each update
✅ Frontend polling fetches updated journey every 2 seconds
✅ Canvas renders phases in header
✅ Grid structure appears when swimlanes are added
✅ Cells populate as interview progresses
✅ No JavaScript errors in console
✅ No backend errors in terminal

---

**Last Updated:** 2026-02-10
**Author:** Claude Code Assistant
