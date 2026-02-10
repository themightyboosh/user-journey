# Journey Mapper - Artifact Generation Logic (Step 13)

**Purpose:** Complete synthesis phase where the AI generates final deliverables after the interview concludes.

---

## 📍 **When It Triggers**

### Prerequisites (All Must Be True)
1. ✅ **All cells complete** - CELL GRID STATUS shows all "x" (no "." remaining)
2. ✅ **3 ethnographic questions answered** (Step 11)
   - Gap Analysis question
   - Magic Wand question
   - Synthesis question
3. ✅ **Final check completed** (Step 12)
   - User responds to "Is there anything else you'd like to add?"

### Trigger Flow
```
Step 10 → All cells complete → Step 11 → 3 ethnographic Qs → Step 12 → Final check → Step 13
                                                                           ↓
                                                                User says "No" / "Done"
                                                                           ↓
                                                          SILENTLY call generate_artifacts
```

---

## 🎯 **Step 13 Prompt Instructions**

### Base Instruction (No RAG Context)

```typescript
13. **Completion & Analysis**:
    *   **Logic**: Synthesize all gathered data. GENERATE distinct artifacts:
        1.  **Summary of Findings**: A comprehensive narrative summary of the journey.

        2.  **Mental Models**: Identify key mental models the user exhibited (as many as relevant, 0-20).
            Format each model as a distinct paragraph or bullet point, separated by double newlines.

        3.  **Quotes**: Extract 2-5 of the most interesting direct quotes from the user that
            best represent their experience.
            *   **Constraint**: These MUST be **verbatim**, word-for-word quotes from the user's
                messages in the chat history. Do not paraphrase. Do not fabricate.
            *   **Formatting**: Ensure there is greater line spacing (double newlines) after each
                paragraph in the summaries so they look like distinct blocks of text.

    *   **Action**: Call \`generate_artifacts\` with \`summaryOfFindings\`, \`mentalModels\`,
        \`quotes\` array, and optional \`anythingElse\`.

    *   **Constraint**: DO NOT OUTPUT CHAT TEXT. Call the tool immediately.
        The system will handle the closing UI.
```

### Enhanced Instruction (WITH RAG Context)

When `ragContext` is present in the template, an additional RAG constraint is injected:

```typescript
13. **Completion & Analysis**:
    *   **Logic**: Synthesize all gathered data. GENERATE distinct artifacts:

    *   **RAG Integration (Organic Expertise)**: Since ADDITIONAL CONTEXT is provided below,
        you MUST weave that knowledge into your 'Summary of Findings' and 'Mental Models'.

        *   **Style Rule**: Do NOT explicitly cite the context (e.g. "According to the context...").
            Instead, synthesize it so it feels like your own organic expertise. Use the context to
            explain *why* the user's journey matters or how it fits into the broader picture.

        1.  **Summary of Findings**: A comprehensive narrative summary...
        2.  **Mental Models**: Identify key mental models...
        3.  **Quotes**: Extract 2-5 of the most interesting direct quotes...

    *   **Action**: Call \`generate_artifacts\`...
```

**RAG Constraint Injection Logic:**
```typescript
// prompts.ts:418-424
let ragConstraint = "";
if (config.knowledgeContext) {
    ragConstraint = `*   **RAG Integration (Organic Expertise)**:
        Since ADDITIONAL CONTEXT is provided below, you MUST weave that knowledge
        into your 'Summary of Findings' and 'Mental Models'.
        *   **Style Rule**: Do NOT explicitly cite the context...`;
}
instruction = instruction.replace('{{RAG_CONSTRAINT}}', ragConstraint);
```

---

## 🛠️ **Tool Definition: `generate_artifacts`**

### Tool Schema
```typescript
{
    name: "generate_artifacts",
    description: "Finalize the journey. You MUST provide 'summaryOfFindings' and 'mentalModels' based on the conversation.",
    parameters: {
        type: "OBJECT",
        properties: {
            journeyMapId: {
                type: "STRING"
            },
            summaryOfFindings: {
                type: "STRING",
                description: "Comprehensive summary of findings"
            },
            mentalModels: {
                type: "STRING",
                description: "Identified mental models"
            },
            quotes: {
                type: "ARRAY",
                description: "2-5 most interesting verbatim direct quotes from the participant's chat messages",
                items: { type: "STRING" }
            },
            anythingElse: {
                type: "STRING",
                description: "Any final additions from the user"
            }
        },
        required: ["journeyMapId", "summaryOfFindings", "mentalModels", "quotes"]
    }
}
```

### Required Parameters
1. **`journeyMapId`** - UUID of the journey being completed
2. **`summaryOfFindings`** - Comprehensive narrative summary (string)
3. **`mentalModels`** - Identified mental models (string, can contain multiple models separated by double newlines)
4. **`quotes`** - Array of 2-5 verbatim quotes (string[])

### Optional Parameters
- **`anythingElse`** - Any additional context from Step 12 final check

---

## 📊 **What Gets Generated**

### 1. Summary of Findings
**Type:** Comprehensive narrative summary
**Format:** Multi-paragraph text
**Purpose:** Synthesize the entire journey into a coherent story

**AI Behavior:**
- Analyzes all cell data (phases × swimlanes)
- Identifies patterns and themes
- Connects user behaviors to journey structure
- If RAG context present: Weaves domain knowledge to explain *why* behaviors matter

**Example Output:**
```
The user's journey through product research reveals a pattern of systematic evaluation combined
with emotional uncertainty. During the initial discovery phase, they rely heavily on peer
recommendations and social proof, often cross-referencing multiple sources before committing to
deeper research.

A critical inflection point occurs during the comparison phase, where information overload leads
to decision paralysis. The user exhibits satisficing behavior—settling for "good enough" options
rather than exhaustively evaluating all alternatives. This suggests a need for simplified decision
frameworks and clear differentiation between options.

[Continues with synthesis of remaining phases...]
```

**With RAG Context (e.g., E-commerce domain knowledge):**
```
The user's journey through product research reveals a pattern typical of high-consideration
purchases in the electronics category. Their reliance on peer recommendations during discovery
aligns with established trust dynamics in online marketplaces, where social proof serves as a
heuristic for quality assessment.

The decision paralysis observed during comparison is a well-documented phenomenon in choice
architecture research. When presented with more than 7-10 options (as the user encountered),
cognitive load increases exponentially, leading to satisficing behavior...

[Notice: Domain knowledge woven in organically without explicit citations]
```

---

### 2. Mental Models
**Type:** Identified cognitive frameworks the user exhibited
**Format:** String with distinct models separated by double newlines
**Purpose:** Surface underlying beliefs, assumptions, and decision frameworks

**AI Behavior:**
- Identifies patterns in user responses
- Extracts implicit beliefs about how things work
- Names/labels each mental model
- Provides 0-20 models (as many as relevant)

**Example Output:**
```
**Trust Through Social Proof**: The user consistently defers to peer experiences before trusting
product claims, suggesting a mental model where "what others experience" is more reliable than
"what companies promise."

**Tiered Decision-Making**: The user employs a two-phase evaluation process—broad filtering
(price, basic features) followed by deep comparison (reviews, specs). This indicates a mental
model of "narrowing then deepening" rather than uniform evaluation.

**Visual Learning Preference**: When describing confusion, the user repeatedly mentions seeking
"diagrams" and "walkthroughs" over text documentation. This reveals a mental model where
"seeing is understanding"—visual representations are the primary path to comprehension.

**Risk Aversion Through Reversibility**: The user prioritizes products with "easy returns" and
"money-back guarantees." This suggests a mental model where "I can always undo this" is a
prerequisite for commitment, particularly in unfamiliar categories.
```

**Format:** Each model is a distinct paragraph/bullet with:
1. **Name/Label** (bold)
2. **Description** (what the model is)
3. **Evidence** (where it showed up in the journey)
4. **Implication** (what it means for design/strategy)

---

### 3. Quotes
**Type:** Array of 2-5 verbatim direct quotes
**Format:** String array (quotes extracted from chat history)
**Purpose:** Preserve the user's authentic voice

**CRITICAL CONSTRAINTS:**
- ✅ **MUST be verbatim** - Word-for-word from chat messages
- ✅ **MUST be direct quotes** - Not paraphrased or summarized
- ❌ **CANNOT be fabricated** - AI cannot make up quotes
- ✅ **2-5 quotes** - Not fewer, not more (unless conversation is very short)

**AI Selection Criteria:**
- Most revealing of user mindset
- Most quotable/memorable
- Best represents key themes
- Emotionally resonant

**Example Output:**
```typescript
quotes: [
    "I kept going back and forth between the two models because I just couldn't figure out which compromises I could actually live with.",

    "Honestly, at some point I just wanted someone to tell me, 'This is the one you should get' because I was so tired of comparing specs.",

    "The reviews were helpful, but then I'd see one negative comment and suddenly I'd question everything again.",

    "I ended up buying it mostly because the return policy was really good, so I figured worst case I can just send it back.",

    "Looking back, I probably spent 10 hours researching a $200 purchase. That's insane, but I didn't want to make a mistake."
]
```

---

### 4. Anything Else (Optional)
**Type:** Additional context from Step 12 final check
**Format:** String
**Purpose:** Capture any last-minute additions the user provided

**Trigger:** User adds information when asked "Is there anything else you'd like to add?"

**Example:**
```
"Oh, one thing I forgot to mention—I also asked my friend who works in tech,
and he gave me some insider advice about which brands to avoid."
```

---

## 💾 **What Gets Saved**

### Journey Map Object Updates

```typescript
// journey.service.ts:359-374
async generateArtifacts(id: string, params: {...}): Promise<JourneyMap | null> {
    let journey = await Store.get(id);

    // ... Generate Mermaid diagram code ...

    // Save artifacts
    if (params.summaryOfFindings) journey.summaryOfFindings = params.summaryOfFindings;
    if (params.mentalModels) journey.mentalModels = params.mentalModels;
    if (params.anythingElse) journey.anythingElse = params.anythingElse;
    if (params.quotes) journey.quotes = params.quotes;

    // Finalize stage
    journey.stage = 'COMPLETE';
    journey.status = 'READY_FOR_REVIEW';

    journey = recalculateJourney(journey);
    await Store.save(journey);

    return journey;
}
```

### Database Structure
```json
{
    "journeyMapId": "abc-123",
    "name": "Product Research Journey",
    "userName": "Sarah",
    "role": "First-time buyer",

    "stage": "COMPLETE",
    "status": "READY_FOR_REVIEW",

    "phases": [...],
    "swimlanes": [...],
    "cells": [...],

    "summaryOfFindings": "The user's journey through product research reveals...",
    "mentalModels": "**Trust Through Social Proof**: The user consistently...",
    "quotes": [
        "I kept going back and forth...",
        "Honestly, at some point..."
    ],
    "anythingElse": "Oh, one thing I forgot to mention...",

    "mermaid": { "code": "graph TD..." },
    "outputJson": { "code": "{...}" },

    "conversationHistory": [...],
    "completionStatus": {...},
    "metrics": {...}
}
```

---

## 🎨 **UI Presentation**

### Admin Journey Viewer
When viewing a completed journey in the admin panel:

1. **Journey Map Canvas** - Visual grid of phases × swimlanes
2. **Summary Tab** - Displays `summaryOfFindings`
3. **Mental Models Tab** - Displays `mentalModels` (with double newline spacing)
4. **Quotes Section** - Displays `quotes` array as formatted blockquotes
5. **Additional Context** - Displays `anythingElse` if present
6. **Chat History Button** - Allows viewing full conversation

---

## 🔍 **Artifact Quality Signals**

### High-Quality Summary Indicators
✅ **Synthesis, not summarization** - Connects themes across phases
✅ **Evidence-based** - References specific cell data
✅ **Insight-rich** - Goes beyond "what happened" to "why it matters"
✅ **Narrative flow** - Reads as coherent story, not bullet points
✅ **Domain integration** (if RAG) - Weaves knowledge organically

### High-Quality Mental Models Indicators
✅ **Named/labeled** - Each model has a clear title
✅ **Evidence-backed** - Shows where it appeared in journey
✅ **Actionable** - Implications are clear
✅ **Distinct** - Each model is different, not overlapping
✅ **Relevant count** - 3-8 models typically (not forced to 20)

### High-Quality Quotes Indicators
✅ **Verbatim** - Word-for-word from chat
✅ **Representative** - Captures key themes
✅ **Authentic voice** - Sounds like natural speech
✅ **Varied** - Different aspects of journey
✅ **Memorable** - Quotable and impactful

---

## 🚫 **Critical Constraints**

### What AI MUST NOT Do
❌ **Output chat text** - Must call tool silently, no "Here's your summary..." message
❌ **Paraphrase quotes** - Quotes must be verbatim
❌ **Fabricate quotes** - Cannot invent things user didn't say
❌ **Cite RAG context explicitly** - Must synthesize organically, not "According to..."
❌ **Skip required fields** - summaryOfFindings, mentalModels, quotes are required

### What AI MUST Do
✅ **Call tool immediately** - No preamble or chat message
✅ **Extract verbatim quotes** - From actual conversation history
✅ **Synthesize all data** - Cell data + ethnographic responses + journey structure
✅ **Format with spacing** - Double newlines between mental model paragraphs
✅ **Integrate RAG** (if present) - Weave domain knowledge into findings

---

## 🧪 **Testing Artifact Generation**

### Test Scenario 1: No RAG Context
**Input:** Standard interview (no knowledge base)
**Expected Output:**
- Summary based purely on user's cell responses + ethnographic Qs
- Mental models derived from user behavior patterns
- Quotes directly from chat history

### Test Scenario 2: With RAG Context (E-commerce)
**Input:** Interview with RAG context about e-commerce purchase behavior
**Expected Output:**
- Summary that explains user behavior in e-commerce framework (organic synthesis)
- Mental models that connect user patterns to established behavioral economics
- Same verbatim quotes (RAG doesn't change quote extraction)

### Test Scenario 3: Short Interview (Few Cells)
**Input:** 3 phases × 2 swimlanes = 6 cells only
**Expected Output:**
- Shorter summary (proportional to data)
- Fewer mental models (3-5 instead of 7-10)
- Still 2-5 quotes (minimum maintained)

---

## 📈 **Artifact Generation Flow**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ARTIFACT GENERATION FLOW                         │
└─────────────────────────────────────────────────────────────────────┘

Step 11: 3 Ethnographic Questions
   ↓
Step 12: "Anything else to add?"
   ↓
User: "No" / "Done"
   ↓
AI: [SILENT - No chat output]
   ↓
AI calls generate_artifacts(
    journeyMapId: "abc-123",
    summaryOfFindings: "The user's journey...",
    mentalModels: "**Trust Through Social Proof**: ...",
    quotes: ["Quote 1", "Quote 2", "Quote 3"],
    anythingElse: "..." (if user added context in Step 12)
)
   ↓
Server: journeyService.generateArtifacts()
   ↓
- Generates Mermaid diagram code
- Saves all artifacts to journey object
- Sets stage = 'COMPLETE'
- Sets status = 'READY_FOR_REVIEW'
- Recalculates completion metrics
   ↓
Server: Saves to database
   ↓
Server: Returns updated journey to AI
   ↓
AI: Receives tool result
   ↓
AI: Session ends (conversation complete)
   ↓
UI: Shows completion screen with journey preview
```

---

## 🎯 **Key Takeaways**

1. **Artifact generation is SILENT** - AI calls tool without chat output
2. **RAG integration is ORGANIC** - Knowledge woven in, not cited
3. **Quotes must be VERBATIM** - Word-for-word from chat history
4. **Mental models are DISTINCT** - Each is a separate framework/belief
5. **Summary is SYNTHESIS** - Not just a recap, but insight generation
6. **Spacing matters** - Double newlines between mental model paragraphs
7. **Tool call is REQUIRED** - AI cannot skip or delay artifact generation

---

## 📚 **Related Documentation**

- [TEMPLATE-FIELDS-REFERENCE.md](./TEMPLATE-FIELDS-REFERENCE.md) - See RAG Context field details
- [prompts.ts](./api-mcp/src/ai/prompts.ts) - Lines 188-197 (Step 13 instruction)
- [tools.ts](./api-mcp/src/ai/tools.ts) - Lines 102-117 (Tool definition)
- [journey.service.ts](./api-mcp/src/services/journey.service.ts) - Lines 308-375 (Implementation)
