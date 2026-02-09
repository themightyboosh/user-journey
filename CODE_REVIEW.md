# Code Review: Journey Mapper
**Date:** February 9, 2026
**Reviewer:** Claude Code (Transitioning from Cursor)
**Codebase:** 3,732 lines of TypeScript + Vanilla JS Frontend

---

## Executive Summary

**Journey Mapper** is an AI-powered UX research tool that conducts structured interviews to create detailed user journey maps. It uses a sophisticated 13-step state machine implemented via Gemini prompt engineering to guide users through a conversational journey mapping process.

**Architecture:**
- Backend: TypeScript + Fastify + Firebase Functions
- Frontend: Vanilla JS/HTML/CSS (M.AX Design System)
- AI: Google Vertex AI (Gemini 2.5 Pro/Flash)
- Database: Firebase Firestore
- Deployment: Firebase Hosting + Cloud Functions

---

## Core Architecture

### 1. The Heart: `prompts.ts` (355 lines) ⭐

**This is THE critical file.** It defines the entire AI interviewer persona and behavior.

**Key Concepts:**
- **13-Step State Machine:** Identity → Journey Definition → Phases → Swimlanes → Matrix → Cell Population → Deep Dive → Artifacts
- **Dynamic System Instruction Builder:** `buildSystemInstruction()` constructs prompts based on:
  - Session config (pre-filled data from URL params)
  - Current journey state (pulled from Firestore)
  - Completion gates (ensures sequential progress)
  - Cell grid status (ASCII grid showing which cells are filled)

**Gemini Prompt Engineering Patterns Used:**

1. **Persona Definition:**
   ```typescript
   You are "{{AGENT_NAME}}", an expert UX Researcher and Business Analyst.
   Frame: {{PERSONA_FRAME}}
   Language: {{PERSONA_LANGUAGE}}
   Tone: Professional yet deeply curious.
   ```

2. **Golden Threading:**
   - AI must connect each question to something the user just said
   - Prevents robotic, checklist-style interviews

3. **Sensory Anchoring:**
   - Prompts like "When you're staring at that dashboard, what specifically are your eyes hunting for?"
   - Grounds abstract descriptions in physical reality

4. **Tool-Before-Talk Protocol:**
   - CRITICAL RULE: AI must call `update_cell` BEFORE saying "Got it"
   - Prevents dropped data from race conditions

5. **Bypass Logic for Pre-filled Data:**
   - If phases/swimlanes come from URL, AI skips asking and confirms instead
   - Reduces friction for templated journeys

6. **Completion Gates:**
   - `buildCellGridStatus()` creates ASCII grid: `x` = done, `.` = empty
   - AI CANNOT proceed to Deep Dive while any cell is empty
   - Prevents premature advancement

**🚨 CRITICAL PROMPT ENGINEERING PRINCIPLE:**

> **When modifying `prompts.ts`, you MUST think as a Gemini Prompt Engineer.**
> This isn't just TypeScript — it's behavioral programming for an LLM.
> Every word matters. Ambiguity = unpredictable behavior.
> Test changes against the 13-step state machine logic.

---

### 2. Server Architecture: `server.ts` (842 lines)

**Strengths:**
- ✅ Clean Fastify setup with proper error handling
- ✅ SSE (Server-Sent Events) for streaming AI responses
- ✅ Robust 429 handling with exponential backoff
- ✅ Tool execution loop with fresh state fetching after each tool call
- ✅ Winston logger integration
- ✅ Firebase Auth integration for admin features

**Key Flow: `/api/chat` Endpoint**

```
1. Validate request BEFORE setting SSE headers (prevents 500s)
2. Fetch journey state from Firestore
3. Build Gemini model with dynamic system instruction
4. Enter turn-based loop (max 10 turns):
   a. Generate AI response
   b. If function calls → Execute tools → Refresh state → Regenerate
   c. If text only → Stream to client → Done
5. Handle 429 errors with fallback models
6. Handle empty candidates (safety filters) with retry logic
```

**Notable Fixes (from recent commits):**
- Validation before SSE headers (prevents 500s)
- Exact cell ID lookup enforcement
- Tool-before-talk flow enforcement
- Empty candidate retry logic

---

### 3. Journey Service: `journey.service.ts` (407 lines)

**Clean CRUD operations with business logic:**

- `createJourney()` - Initialize journey with identity
- `setPhasesBulk()` - Replace all phases, clear cells
- `setSwimlanesBulk()` - Replace all swimlanes, auto-generate matrix
- `generateMatrix()` - Create empty cells for all phase x swimlane combos
- `updateCell()` - Save cell content, recalculate metrics
- `generateArtifacts()` - Finalize journey with Mermaid diagram

**Auto-advancement Logic:**
- After `updateMetadata()` with name → Stage = PHASES
- After `setPhasesBulk()` → Stage = SWIMLANES
- After `setSwimlanesBulk()` → Auto-call `generateMatrix()` → Stage = CELL_POPULATION
- After `generateArtifacts()` → Stage = COMPLETE

**Metrics Calculation:**
- `recalculateJourney()` called after every mutation
- Tracks: `totalCellsCompleted`, `percentCellsComplete`
- Used by AI to determine if all cells are filled

---

### 4. AI Service: `ai.service.ts` (358 lines)

**Model Selection & Fallback:**
```typescript
Primary: gemini-2.5-pro
Fallback 1: gemini-2.5-flash
Fallback 2: gemini-2.5-flash-lite
```

**Dynamic Token Allocation:**
- Early stages: 2048 tokens
- Cell population (80%+ done): 3072 tokens
- Artifact generation: 4096 tokens
- Rationale: Summaries/mental models need more space

**Tool Execution:**
- `executeTool()` maps function names to service methods
- Handles cell lookup by ID OR by phase/swimlane name
- Returns structured results to AI

---

### 5. Frontend: Vanilla JS + M.AX Design System

**Files:**
- `index.html` (120KB) - Full SPA
- `renderer.js` (35KB) - Journey map visualization
- `journey-viewer.js` - Interactive canvas renderer
- `max-design-tokens.css` - Design system

**Architecture:**
- No framework — pure DOM manipulation
- SSE client for streaming AI responses
- Canvas-based journey map renderer with pan/zoom
- Template picker (loads configs from admin panel)

**Notable Features:**
- Dark-first design optimized for extended use
- Mobile-responsive
- Real-time journey map updates during conversation
- Feedback collection system

---

## Code Quality Assessment

### ✅ Strengths

1. **Clean Service Layer:** Proper separation of concerns
2. **Comprehensive Logging:** Winston integration throughout
3. **Type Safety:** TypeScript strict mode enabled
4. **Error Handling:** Global error handlers, process-level uncaught handlers
5. **Robust AI Flow:** Handles 429s, empty candidates, tool execution loops
6. **State Management:** Firestore as source of truth, recalculation on mutations
7. **Prompt Engineering:** Sophisticated state machine with completion gates

### ⚠️ Issues & Technical Debt

#### 1. **Console.log Usage (69 instances)**
Found across 11 files. Should use Winston logger instead.

**Files:**
- `api-mcp/src/store.ts` (1)
- `api-mcp/src/mcp-server.ts` (1)
- `front-end/scripts/max-interactions.js` (2)
- `front-end/js/journey-viewer.js` (2)
- `front-end/admin/script.js` (12)
- `api-mcp/src/tests/journey_probing.test.ts` (7)
- `api-mcp/src/scripts/*.ts` (37 total)
- `front-end/js/renderer.js` (7)

**Recommendation:** Replace production code console.logs with logger. Keep in scripts.

#### 2. **Hardcoded Values**
- Project ID: `'journey-mapper-ai-8822'` in `ai.service.ts:31`
- Super admin email: `'daniel@monumental-i.com'` in `types.ts:131`
- API URL hardcoded in frontend

**Recommendation:** Move to environment variables.

#### 3. **Tool Call Validation**
- Cell ID lookup relies on exact phase/swimlane name matching
- Fragile if names have typos or Unicode issues
- Recent fix enforces exact ID lookup, but prompt still allows name-based lookup

**Recommendation:** Deprecate name-based lookup in `update_cell` tool schema.

#### 4. **No Unit Tests for Critical Paths**
- Only 1 test file: `journey_probing.test.ts` (129 lines)
- No tests for:
  - `buildSystemInstruction()` (prompt generation logic)
  - Cell grid status generation
  - Metric calculation
  - Tool execution

**Recommendation:** Add tests for prompt logic and metric calculation.

#### 5. **Frontend Has No Build Step**
- 120KB HTML file
- Inline styles and scripts
- No minification
- No tree-shaking

**Recommendation:** Consider Vite for build optimization (but keep simplicity).

---

## Prompt Engineering Deep Dive

### The State Machine (13 Steps)

**Step 1-2: Identity Capture**
- Check if name/role provided via URL params
- Mode [CONFIRM]: Greet by name, ask to confirm
- Mode [UNKNOWN]: Ask for name and role
- Call `create_journey_map`

**Step 3-4: Journey Definition**
- Check if journey name provided
- Mode [BYPASS]: Use known name, ask for description only
- Mode [UNKNOWN]: Ask user to describe the journey
- Call `update_journey_metadata`

**Step 5-6: Phases (Horizontal Axis)**
- Check if phases pre-defined
- Mode [BYPASS]: Confirm phases, call `set_phases_bulk`, jump to Step 7
- Mode [UNKNOWN]: Ask for high-level stages
- **Gate:** Must confirm list with user before calling tool

**Step 7-8: Swimlanes (Vertical Axis)**
- Check if swimlanes pre-defined
- Mode [BYPASS]: Confirm swimlanes, call `set_swimlanes_bulk`, auto-generate matrix
- Mode [UNKNOWN]: Ask for data layers to track
- **Gate:** Must confirm list with user before calling tool

**Step 9: Matrix Generation**
- Check if cells already exist
- If not: Call `generate_matrix`

**Step 10: Cell Population (THE MEAT)**
- **ONE CELL AT A TIME** — Never batch
- Traverse grid chronologically (Phase 1 Swimlane 1 → Phase 1 Swimlane 2 → ...)
- Use "Golden Threading" to connect questions
- **Flow:** User Answer → Call `update_cell` → Wait for confirmation → Ask next question
- **Probing Rule:** If answer is brief, ask ONE follow-up
- **Completion Gate:** Cannot proceed until ALL cells are `x` (done) in grid

**Step 11: Deep Dive (Ethnographic Analysis)**
- Ask 3 questions ONE AT A TIME:
  1. Gap Analysis: "Most people do X, but you do Y. Why?"
  2. Magic Wand: "If you could change one thing..."
  3. Synthesis: "Why does [theme] matter so much to you?"
- **Gate:** All cells MUST be complete before entering this step

**Step 12: Final Check**
- "Is there anything else you'd like to add?"
- If yes: Call `update_journey_metadata` to append
- If no: SILENTLY transition to Step 13

**Step 13: Artifact Generation**
- Call `generate_artifacts` with:
  - Summary of Findings
  - Mental Models (0-20 distinct models)
  - Quotes (2-5 verbatim quotes from user)
  - Anything Else
- System handles UI closing

### Critical Prompt Rules

1. **Tool-Before-Talk:** Always call tool BEFORE acknowledging to user
2. **Structural Gates:** Confirm phases/swimlanes before calling set_ tools
3. **One Cell Per Turn:** NEVER batch `update_cell` calls
4. **All Cells Before Deep Dive:** Check CELL GRID STATUS — if `.` exists, keep asking
5. **Separation of Concerns:** Chat for interview, Canvas for data
6. **No Hallucination:** ONLY record what user explicitly said

### Context Injection Strategy

The system instruction is built dynamically with:

```typescript
BASE_SYSTEM_INSTRUCTION
+ STEP_1 (with welcome logic)
+ STEP_3 (with journey logic)
+ STEP_5 (with phase logic)
+ STEP_7 (with swimlane logic)
+ PERSONA_FRAME
+ PERSONA_LANGUAGE
+ CONTEXT FROM URL/SYSTEM:
  - Agent Name
  - User Name (if known)
  - User Role (if known)
  - Journey Name (if known)
  - Phases (if pre-defined)
  - Swimlanes (if pre-defined)
  - Current Journey ID
  - Knowledge Context (RAG if provided)
+ LIVE JOURNEY STATE:
  - Current Stage
  - Status
  - Completion Gates
  - Cells Progress
  - CELL GRID STATUS (ASCII grid)
```

**Why This Works:**
- AI sees exactly where it is in the flow
- Bypass logic prevents redundant questions
- Completion gates enforce sequential progression
- Cell grid provides unambiguous "next cell" pointer

---

## Security Review

### ✅ Good Practices
- Firebase Auth for admin endpoints
- Input validation before processing
- SQL injection not applicable (Firestore NoSQL)
- CORS configured (currently `*` — should be restricted in production)

### ⚠️ Concerns
1. **CORS:** `origin: '*'` allows any domain (server.ts:30)
2. **Rate Limiting:** No rate limiting on `/api/chat` (could be abused)
3. **Super Admin Email Hardcoded:** Should use Firebase custom claims instead
4. **Public Template Endpoint:** `/api/templates` is fully public (acceptable?)

---

## Performance Considerations

### Backend
- ✅ Singleton services prevent re-initialization
- ✅ Firestore indexes likely needed for large datasets
- ⚠️ No caching layer (every request hits Firestore)
- ⚠️ No request coalescing for concurrent requests to same journey

### Frontend
- ✅ SSE streaming provides perceived performance
- ⚠️ 120KB HTML (could be split into chunks)
- ⚠️ Large lucide-icons.js (383KB) — should tree-shake
- ⚠️ No service worker for offline capability

### AI
- ✅ Dynamic token allocation based on stage
- ✅ Fallback model strategy for 429 errors
- ⚠️ Max 10 turns could be insufficient for complex journeys
- ⚠️ No conversation caching (Gemini 2.5 supports this now)

---

## Recommendations

### High Priority (P0)

1. **Add Comprehensive Tests for Prompts**
   - Test `buildSystemInstruction()` output
   - Test cell grid generation
   - Test bypass logic for pre-filled data
   - Prevent regression in prompt behavior

2. **Replace Console.log with Logger in Production**
   - Keep in scripts, remove from services
   - Improves production debugging

3. **Add CORS Whitelist**
   - Replace `origin: '*'` with domain list
   - Prevent unauthorized API access

### Medium Priority (P1)

4. **Extract Hardcoded Values to Environment**
   - Project ID
   - Super admin email
   - API endpoints

5. **Add Rate Limiting**
   - Prevent abuse of `/api/chat`
   - Use Firebase App Check or custom middleware

6. **Optimize Frontend Bundle**
   - Split large JS files
   - Tree-shake icon library
   - Consider Vite build

### Low Priority (P2)

7. **Add Conversation Caching**
   - Gemini 2.5 supports caching system instructions
   - Could reduce costs significantly

8. **Add Analytics**
   - Track completion rates
   - Identify where users drop off
   - Measure average session duration

9. **Add E2E Tests**
   - Playwright tests for full journey flow
   - Currently only has stale test results

---

## Deployment Architecture

```
Firebase Hosting (front-end/)
    ↓
Firebase Functions (api-mcp/)
    ↓
Vertex AI (Gemini 2.5 Pro/Flash)
    ↓
Firestore (journey-maps, admin-links, settings, users, feedback)
```

**Deployment Command:**
```bash
pnpm --filter api-mcp build && firebase deploy
```

---

## Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `ai/prompts.ts` | 355 | ⭐ AI interviewer state machine |
| `server.ts` | 842 | Main API server + chat endpoint |
| `services/journey.service.ts` | 407 | Journey CRUD operations |
| `services/ai.service.ts` | 358 | Gemini integration |
| `ai/tools.ts` | 124 | Function calling schemas |
| `store.ts` | 336 | Firestore abstraction layer |
| `types.ts` | 131 | Zod schemas + TypeScript types |
| `renderer.js` | 35KB | Frontend journey visualization |
| `index.html` | 120KB | Main SPA |

---

## Summary

**Overall Code Quality:** ⭐⭐⭐⭐ (4/5)

**Strengths:**
- Sophisticated AI interviewer with robust state management
- Clean service architecture
- Comprehensive error handling
- Production-ready prompt engineering

**Areas for Improvement:**
- Test coverage (especially prompts)
- Console.log → Logger migration
- Security hardening (CORS, rate limiting)
- Frontend optimization

**Unique Achievement:**
The 13-step state machine in `prompts.ts` is exceptional. It demonstrates deep understanding of LLM behavioral programming and implements complex interview logic that would be difficult with traditional rule-based systems.

**Risk:** The entire product relies on prompt engineering. ANY change to `prompts.ts` must be tested exhaustively. This is not regular code — it's behavioral programming for an AI agent.

---

**Status:** ✅ Production-ready with recommended improvements
**Next:** Product Manager Interview to establish context and prevent drift
