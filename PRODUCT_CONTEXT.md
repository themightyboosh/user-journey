# Product Context Document
**Last Updated:** February 9, 2026
**Stage:** MVP (20 initial users)
**Lead Dev:** Transitioning from Cursor → Claude Code

---

## 🎯 Product Vision

### One-Sentence Summary
**Journey Mapper** is the best way to create fully AI-driven journey maps through human-like qualitative interviews.

### Value Proposition
- **For:** UX Researchers
- **Who:** Need to create user journey maps
- **Pain:** Human-to-human interviews are time-consuming and exhausting
- **Solution:** AI-powered qualitative interviews that feel natural and capture depth
- **Unlike:** Form-based tools (which can't capture qualitative nuance) or manual human interviews (which are slow)
- **Benefit:** Fast, deep, qualitative journey maps with insights

---

## ✨ Magic Moment

**When a UX researcher (and the target user) sees a completed journey on the canvas that captures their process and reveals amazing insights.**

This is the "wow" moment — seeing their messy, complex workflow transformed into a clear, insightful journey map through a conversational process.

---

## 👥 Users & Use Cases

### Primary User: UX Researcher

**Current Workflow (Without Journey Mapper):**
1. Schedule 1-hour interview with subject
2. Conduct interview manually
3. Transcribe notes
4. Analyze and synthesize findings
5. Create journey map in tool (Miro, FigJam, etc.)
6. **Total Time:** 4-6 hours per journey

**Workflow With Journey Mapper:**
1. Send user link with template
2. AI conducts 15-20 minute conversational interview
3. Journey map auto-generates on canvas
4. Review and refine
5. **Total Time:** 30 minutes - 1 hour

### Target User (Being Interviewed)

**Experience Goals:**
- Feels like talking to a curious researcher, not filling out a form
- Natural conversation flow with follow-up questions
- Sees their journey visualized in real-time
- Feels heard and understood

---

## 🏗️ Product Architecture

### Technology Stack

**Backend:**
- TypeScript + Fastify (API server)
- Firebase Functions (deployment)
- Firebase Firestore (data storage)
- Google Vertex AI (Gemini 2.5 Pro/Flash/Lite)
- Winston (logging)

**Frontend:**
- Vanilla JS/HTML/CSS (no framework)
- M.AX Design System (custom dark-first design)
- Canvas-based journey map renderer
- SSE (Server-Sent Events) for streaming AI responses

**Why Gemini?**
- Works better than GPT-4/Claude so far
- Centralizes billing with Google Cloud
- Good context window + function calling

### Deployment
- Firebase Hosting (frontend)
- Firebase Functions Gen 2 / Cloud Run (backend)
- Project ID: `journey-mapper-ai-8822`

---

## 🧠 Core Innovation: The 13-Step State Machine

The heart of Journey Mapper is `prompts.ts` — a 355-line Gemini prompt that implements a sophisticated state machine.

### The 13 Steps

```
1-2.  Identity Capture → Establish who they are
3-4.  Journey Definition → What process are we mapping?
5-6.  Phases (Horizontal Axis) → High-level stages
7-8.  Swimlanes (Vertical Axis) → Data layers (feelings, actions, tools, etc.)
9.    Matrix Generation → Create empty grid
10.   Cell Population → Fill each cell ONE AT A TIME
11.   Deep Dive (Ethnographic) → Ask "why" questions
12.   Final Check → Anything else to add?
13.   Artifact Generation → Summary, mental models, quotes
```

### Prompt Engineering Techniques

**1. Golden Threading**
- AI must connect each question to something the user just said
- Prevents robotic checklist interviewing
- Example: "You mentioned Excel is tedious — does that lead to other pain points?"

**2. Sensory Anchoring**
- Ground abstract concepts in physical reality
- Example: "When you're staring at that dashboard, what are your eyes hunting for?"

**3. Tool-Before-Talk Protocol** ⚠️ **CRITICAL**
- AI MUST call `update_cell` BEFORE saying "Got it" or acknowledging
- Prevents data loss from race conditions
- We had issues before — this is non-negotiable

**4. Completion Gates**
- AI CANNOT proceed to Deep Dive if any cells are empty
- System provides ASCII grid showing which cells are done (x) vs empty (.)
- Enforces sequential, complete data capture

**5. Bypass Logic**
- If phases/swimlanes/name come from URL params, AI doesn't ask for them
- Instead, AI confirms and moves forward
- Reduces friction for templated journeys

---

## 🚨 Current State & Issues

### What's Working Well ✅
- Admin panel and UI are solid
- Golden Threading & Sensory Anchoring produce natural interviews
- Prompt engineering philosophy is strong
- Gemini model performance is good

### Primary Issue (BLOCKER) 🔴
**Journey elements not rendering on canvas**

**Symptoms:**
- Title doesn't generate as expected
- After prompting for description, canvas stops working
- Most common failure: Canvas not drawing journey elements

**Suspected Causes:**
1. AI skipping steps (not following state machine)
2. AI not saving data properly (tool calls failing)
3. Canvas not rendering saved data (data pipeline broken)
4. Could be a combination

**Status:** Currently debugging the title/description flow (Steps 3-4)

### Testing Philosophy
- **Validation:** Manual testing only (MVP stage)
- **Priority:** Working flow of existing functionality
- **Approach:** Don't break things, make it work first
- **Prompt Changes:** Made based on project requirements, tested manually

---

## 🎨 Design System: M.AX

### Aesthetic
- Dark-first professional design
- Optimized for extended use
- Inspired by Palantir's enterprise-grade design language
- Typography: Messina Sans + Sorts Mill Goudy (quotes)

### Key Design Principles
- **Semantically clear naming:** `max-[component]-[element]-[variant]-[state]`
- **Accessibility-compliant:** WCAG 2.1 AA standards
- **Professional tone:** For serious research work

### Canvas Rendering
- Real-time journey map updates during conversation
- Pan/zoom functionality (Panzoom.js)
- Journey map structure:
  - Header: Logo + Title + Role + Description
  - Grid: Phases (columns) × Swimlanes (rows)
  - Cells: Content at each intersection
  - Footer: User quote (large, serif font)

---

## 📊 Business Model

**Type:** SaaS module

**Initial Users:** 20 users to start

**Revenue Model:** (Not specified in interview — likely subscription-based)

---

## 🔧 Technical Decisions & Constraints

### Why No Framework?
- MVP speed
- Simplicity
- No build complexity
- Direct DOM manipulation is fast enough

### Why Firebase?
- Quick deployment
- Managed infrastructure
- Good integration with Vertex AI
- Pay-as-you-go pricing

### Why Strict Mode TypeScript?
- Type safety critical for LLM tool schemas
- Prevents runtime errors in production
- Makes refactoring safer

### Key Architectural Decisions

1. **Singleton Services**
   - Prevents re-initialization
   - Maintains consistent state
   - Used for: JourneyService, AIService, AdminService, UserService

2. **SSE Streaming**
   - Better UX than long polling
   - Real-time AI responses
   - Handles multi-turn tool execution loops

3. **Firestore as Source of Truth**
   - Frontend polls every 2 seconds
   - Backend writes immediately after tool calls
   - Journey state refreshed after each mutation

4. **Dynamic Prompt Generation**
   - System instruction built at runtime
   - Includes current journey state (stage, completion gates, cell grid)
   - Adapts to URL params (pre-filled data)

---

## 🧪 Prompt Engineering Philosophy (CRITICAL)

### When to Modify Prompts

**Triggers:**
- Project requirements change
- Gates not enforcing properly
- AI skipping steps
- Data not being saved
- Need better context/progress feedback

**NOT Triggers:**
- User complaints about tone (Golden Threading works well)
- Requests for "faster" (speed comes from model, not prompts)

### Testing Prompt Changes

**Current Process:**
1. Modify `api-mcp/src/ai/prompts.ts`
2. Build: `cd api-mcp && pnpm build`
3. Manual test: Walk through full 13-step flow
4. Check:
   - Does AI call tools at each gate?
   - Is data saved to Firestore?
   - Does canvas render correctly?
   - Does conversation feel natural?

**Validation Criteria:**
- ✅ All gates enforced
- ✅ All cells filled before Deep Dive
- ✅ Data saves after each tool call
- ✅ Canvas updates in real-time
- ✅ Conversation flows naturally

### Stability vs. Improvement

**Current Philosophy (MVP Stage):**
- **Priority:** Make existing functionality work reliably
- **Approach:** Fix bugs, don't add features
- **Testing:** Manual only, no automated tests yet
- **Risk Tolerance:** Low — avoid breaking what works

**Future Philosophy (Post-MVP):**
- Add automated prompt testing
- A/B test prompt variations
- Measure: completion rate, average cells filled, user satisfaction

### Critical Prompt Rules (NEVER VIOLATE)

1. **Tool-Before-Talk:** AI calls tool BEFORE acknowledging user
2. **One Cell Per Turn:** NEVER batch multiple `update_cell` calls
3. **Structural Gates:** Confirm phases/swimlanes before calling set_ tools
4. **All Cells Complete:** Check CELL GRID STATUS before Deep Dive
5. **No Hallucination:** Only record what user explicitly said

**Why These Matter:**
- We had data loss issues before
- Race conditions caused dropped cells
- AI proceeding with incomplete data led to bad journey maps

---

## 📁 Key Files & Locations

### Backend (api-mcp/)

| File | Lines | Purpose | Change Frequency |
|------|-------|---------|------------------|
| `ai/prompts.ts` | 355 | ⭐ AI state machine | High (debugging gates) |
| `server.ts` | 842 | Main API + chat endpoint | Medium (bug fixes) |
| `services/journey.service.ts` | 407 | Journey CRUD | Low (stable) |
| `services/ai.service.ts` | 358 | Gemini integration | Low (stable) |
| `ai/tools.ts` | 124 | Function schemas | Low (stable) |
| `store.ts` | 336 | Firestore wrapper | Low (stable) |
| `types.ts` | 131 | Zod schemas | Low (stable) |

### Frontend (front-end/)

| File | Size | Purpose | Change Frequency |
|------|------|---------|------------------|
| `index.html` | 120KB | Main SPA | Medium (UI tweaks) |
| `js/renderer.js` | 35KB | Journey visualization | High (canvas bugs) |
| `js/journey-viewer.js` | 9KB | Pan/zoom controls | Low (stable) |
| `styles/*.css` | Various | M.AX design system | Low (stable) |

---

## 🐛 Known Issues & Workarounds

### 1. Console.log Usage (69 instances)
**Status:** Known technical debt
**Priority:** Low (works fine, just not ideal)
**Fix:** Replace with Winston logger in production code
**Timeline:** Post-MVP

### 2. Hardcoded Values
**Issues:**
- Project ID in `ai.service.ts`
- Super admin email in `types.ts`
- API URLs in frontend

**Status:** Acceptable for MVP
**Fix:** Move to environment variables
**Timeline:** Before production launch

### 3. Canvas Rendering (CURRENT BLOCKER)
**Status:** Actively debugging
**Priority:** P0 — Blocks user value
**Approach:** Data flow investigation (see CANVAS_DEBUGGING_GUIDE.md)

---

## 🚀 Immediate Next Steps

### 1. Debug Canvas Rendering (P0)
- Use diagnostic script in `CANVAS_DEBUGGING_GUIDE.md`
- Identify where data pipeline breaks
- Fix data flow: AI → Tool → Firestore → Poll → Canvas

### 2. Verify Completion Gates (P0)
- Test if AI respects "All Cells Complete" gate before Deep Dive
- Add logging to see when Deep Dive is triggered
- Check CELL GRID STATUS generation

### 3. Test Full Flow (P1)
- Manual walkthrough: Identity → Journey → Phases → Swimlanes → Cells → Deep Dive → Artifacts
- Verify data saves at each step
- Verify canvas updates at each step

---

## 📝 Development Guidelines

### Before Making Changes

1. **Read CODE_REVIEW.md** — Understand architecture
2. **Read this document** — Understand product context
3. **Read CANVAS_DEBUGGING_GUIDE.md** — If touching rendering

### When Modifying Prompts

1. **Think as a Gemini Prompt Engineer**
   - This is not TypeScript — it's behavioral programming
   - Every word affects AI behavior
   - Ambiguity = unpredictable outcomes

2. **Test the full 13-step flow**
   - Don't just test the step you changed
   - State machine steps depend on each other

3. **Check completion gates**
   - Verify AI doesn't skip steps
   - Verify data saves before proceeding
   - Verify canvas updates

### When Touching Canvas Rendering

1. **Understand data flow** (see CANVAS_DEBUGGING_GUIDE.md)
2. **Add diagnostic logging** before making changes
3. **Test with real journey data**, not mocks
4. **Check both Map and JSON views**

### Code Quality Standards

**MVP Standards:**
- ✅ TypeScript strict mode
- ✅ No runtime errors
- ✅ Winston logging for errors
- ⚠️ Console.log acceptable for now
- ⚠️ No unit tests yet (manual testing only)

**Post-MVP Standards:**
- Add Jest tests for prompt generation logic
- Add E2E tests with Playwright
- Replace console.log with Winston
- Add ESLint + Prettier

---

## 🎯 Success Metrics (Future)

**Primary:**
- Completion rate (% of sessions that reach Step 13)
- Average cells filled (out of total expected)
- Time to completion

**Secondary:**
- User satisfaction (post-interview survey)
- Canvas interaction rate (pan/zoom usage)
- Template usage rate

**Technical:**
- Tool call success rate
- 429 error rate (rate limiting)
- Average turns per session

---

## 🤝 Collaboration Notes

### Working with Claude Code

**Preferred Style:**
- Be direct and technical
- Reference specific files and line numbers
- Provide debugging steps, not just explanations
- Ask for clarification when requirements are ambiguous

**Communication Protocol:**
- Use diagnostic scripts to gather data before asking for help
- Provide console logs, network traces, and Firestore snapshots
- Specify which step in the 13-step flow is failing

### Avoiding Drift

**This document serves as the source of truth for:**
- Product vision and goals
- User needs and pain points
- Technical decisions and rationale
- Prompt engineering philosophy
- Current issues and priorities

**Update this document when:**
- Product vision changes
- New features are added
- Technical decisions are made
- Testing philosophy evolves

---

## 📚 Additional Resources

- `CODE_REVIEW.md` — Comprehensive code analysis
- `CANVAS_DEBUGGING_GUIDE.md` — Data flow debugging
- `CLEANUP_SUMMARY.md` — Recent cleanup actions
- `front-end/README.md` — M.AX Design System overview

---

**Status:** Context complete and documented
**Next:** Debug canvas rendering issue using diagnostic guide
**Contact:** daniel@monumental-i.com
