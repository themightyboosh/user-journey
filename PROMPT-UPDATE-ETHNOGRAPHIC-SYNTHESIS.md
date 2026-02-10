# Prompt Update: Explicit Ethnographic Data Synthesis

**Date:** 2026-02-09
**Issue:** Artifact generation (Step 13) didn't explicitly require incorporation of ethnographic responses
**Solution:** Strengthened Step 13 instruction to mandate inclusion of all conversation data

---

## ❌ **Problem: Implicit vs Explicit**

### Original Step 13 Instruction
```typescript
13. **Completion & Analysis**:
    *   **Logic**: Synthesize all gathered data. GENERATE distinct artifacts:
        1. **Summary of Findings**: A comprehensive narrative summary of the journey.
        2. **Mental Models**: Identify key mental models the user exhibited...
```

**Issues:**
- ❌ Says "all gathered data" but doesn't define what that includes
- ❌ No explicit mention of ethnographic responses (Step 11)
- ❌ No mention of "anything else" context (Step 12)
- ❌ Mental models could be derived only from cell data, missing deeper insights
- ❌ Quotes could skip the most revealing responses from deep dive questions

**Result:** AI might focus only on cell data and miss critical "why" insights from Steps 11-12

---

## ✅ **Solution: Explicit Data Source Requirements**

### Updated Step 13 Instruction

```typescript
13. **Completion & Analysis**:
    *   **Logic**: Synthesize ALL gathered data from the entire conversation. GENERATE distinct artifacts:

    *   **CRITICAL DATA SOURCES** (You MUST incorporate ALL of these):
        - **Cell Data**: All phase × swimlane intersection content (Step 10)
        - **Ethnographic Responses**: The 3 deep dive answers from Step 11
          (Gap Analysis, Magic Wand, Synthesis questions) - these reveal the "why" behind the "what"
        - **Final Additions**: Any context from Step 12 ("anything else" response)
        - **Conversation Patterns**: Recurring themes, language patterns, and behaviors
          throughout the interview

    {{RAG_CONSTRAINT}}

        1.  **Summary of Findings**: A comprehensive narrative summary of the journey that
            MUST incorporate insights from the 3 ethnographic questions. These responses are
            critical—they explain motivations, frustrations, and why the journey matters to the user.
            Do not only summarize cell data; weave in the deeper "why" from Step 11.

        2.  **Mental Models**: Identify key mental models the user exhibited (as many as relevant, 0-20).
            These should be derived from BOTH the cell responses AND the ethnographic responses.
            The deep dive questions often reveal underlying beliefs and frameworks that aren't
            explicit in the cell data. Format each model as a distinct paragraph or bullet point,
            separated by double newlines.

        3.  **Quotes**: Extract 2-5 of the most interesting direct quotes from the user that best
            represent their experience. Prioritize quotes from the ethnographic responses (Step 11)
            and final check (Step 12) as these often contain the most revealing insights.
```

---

## 🎯 **What Changed**

### 1. **Added "CRITICAL DATA SOURCES" Section**
Explicitly lists 4 data sources that MUST be incorporated:
- ✅ Cell Data (Step 10)
- ✅ Ethnographic Responses (Step 11) - **NEW explicit requirement**
- ✅ Final Additions (Step 12) - **NEW explicit requirement**
- ✅ Conversation Patterns - **NEW explicit requirement**

### 2. **Enhanced Summary of Findings Instruction**
**Before:**
> "A comprehensive narrative summary of the journey."

**After:**
> "A comprehensive narrative summary of the journey that MUST incorporate insights from the 3 ethnographic questions. These responses are critical—they explain motivations, frustrations, and why the journey matters to the user. Do not only summarize cell data; weave in the deeper 'why' from Step 11."

**Impact:** AI now explicitly knows it must include the "why" from Step 11, not just the "what" from cell data.

### 3. **Enhanced Mental Models Instruction**
**Before:**
> "Identify key mental models the user exhibited (as many as relevant, 0-20)."

**After:**
> "These should be derived from BOTH the cell responses AND the ethnographic responses. The deep dive questions often reveal underlying beliefs and frameworks that aren't explicit in the cell data."

**Impact:** AI now explicitly looks at ethnographic responses to identify mental models, not just cell behavior.

### 4. **Enhanced Quotes Instruction**
**Before:**
> "Extract 2-5 of the most interesting direct quotes from the user that best represent their experience."

**After:**
> "Prioritize quotes from the ethnographic responses (Step 11) and final check (Step 12) as these often contain the most revealing insights."

**Impact:** AI now prioritizes quotes from the deep dive questions, where users are most reflective.

---

## 📊 **Before vs After Examples**

### Summary of Findings

#### ❌ Before (Cell Data Only)
```
The user's journey through product research follows a systematic pattern. During the Discovery
phase, they browse multiple websites and compare prices. In the Comparison phase, they create
spreadsheets to track features. During Decision, they finalize their purchase based on price
and availability.
```

**Problem:** Just describes what happened in cells—missing the "why" behind behaviors.

#### ✅ After (Cell Data + Ethnographic Insights)
```
The user's journey through product research follows a systematic pattern driven by fear of
making a wrong decision. During the Discovery phase, they browse multiple websites and compare
prices, but as they revealed in the deep dive, "I just didn't want to waste money on something
I'd regret." This anxiety manifests as analysis paralysis—creating spreadsheets to track features
isn't about thoroughness, it's about deferring commitment.

When asked what they'd change if they had a magic wand, they wished for "someone to just tell
me which one to buy." This reveals a deeper pattern: the user doesn't want more information, they
want confidence. Their systematic approach is a coping mechanism for decision uncertainty, not
genuine enthusiasm for research.
```

**Improvement:** Explains *why* behaviors happen (fear, analysis paralysis, need for confidence), using insights from ethnographic questions.

---

### Mental Models

#### ❌ Before (Cell Data Only)
```
**Systematic Evaluation**: The user employs a structured approach to product comparison,
using spreadsheets to track features across options.

**Price Sensitivity**: The user prioritizes finding the best price and checks multiple
retailers before purchasing.
```

**Problem:** Describes observable behaviors but misses underlying beliefs revealed in deep dive.

#### ✅ After (Cell Data + Ethnographic Insights)
```
**Research as Risk Mitigation**: The user doesn't research because they enjoy it—they research
because they fear making mistakes. As they stated, "I just didn't want to waste money on something
I'd regret." This reveals a mental model where "more research = less risk," even when additional
information provides diminishing returns.

**Decision Avoidance Through Process**: The spreadsheet creation isn't about organization—it's
about deferring the decision. The user admitted they wished "someone would just tell me which one
to buy," revealing that the systematic process is a way to delay commitment rather than facilitate it.

**Trust Deficit in Own Judgment**: When asked why this matters so much, the user explained they
"always second-guess myself." This reveals a fundamental mental model: "I can't trust my own
judgment, so I need external validation." This explains why peer reviews matter more than specs.
```

**Improvement:** Reveals underlying beliefs (fear, trust deficit) that drive behaviors, derived from ethnographic responses.

---

### Quotes

#### ❌ Before (Random from Conversation)
```
quotes: [
    "I checked Amazon, Best Buy, and Walmart.",
    "The price was $199.",
    "I created a spreadsheet to compare them."
]
```

**Problem:** Factual quotes that don't reveal insights. Missing the rich, reflective quotes from Step 11.

#### ✅ After (Prioritizing Ethnographic Responses)
```
quotes: [
    "I just didn't want to waste money on something I'd regret.",

    "Honestly, at some point I just wanted someone to tell me, 'This is the one you should get'
     because I was so tired of comparing specs.",

    "I always second-guess myself, so I feel like I need to do all this research to feel
     confident, but then I still don't feel confident.",

    "Looking back, I probably spent 10 hours researching a $200 purchase. That's insane,
     but I didn't want to make a mistake.",

    "If I could change one thing, it would be having someone I trust just tell me what to buy
     so I don't have to do all this myself."
]
```

**Improvement:** Quotes are revealing, emotional, and show the user's inner thought process. These came from the ethnographic questions where users are most reflective.

---

## 🎯 **Why This Matters**

### The 3 Ethnographic Questions Are Critical

**Step 11 Questions:**
1. **Gap Analysis** - "Why do you do X instead of Y?" → Reveals motivations
2. **Magic Wand** - "If you could change one thing..." → Reveals pain points and desires
3. **Synthesis** - "Why does this matter to you?" → Reveals underlying values and beliefs

**These responses:**
- ✅ Explain **WHY** behaviors happen (not just what)
- ✅ Reveal **mental models** and beliefs
- ✅ Show **emotional context** (frustration, anxiety, relief)
- ✅ Provide the **most quotable moments** (users are reflective)
- ✅ Connect to **personal values** and priorities

**Without explicitly requiring these in Step 13:**
- ❌ AI might focus only on cell data (observable behaviors)
- ❌ Summary becomes descriptive, not explanatory
- ❌ Mental models are superficial (behaviors, not beliefs)
- ❌ Quotes are bland and factual
- ❌ The "why it matters" insights are lost

---

## 📈 **Impact on Artifact Quality**

| Artifact | Before (Cell-Focused) | After (Full Conversation) |
|----------|----------------------|---------------------------|
| **Summary** | Descriptive recap | Explanatory synthesis with "why" |
| **Mental Models** | Observable behaviors | Underlying beliefs and frameworks |
| **Quotes** | Factual statements | Reflective, emotional insights |
| **Overall Value** | "What happened" | "Why it happened and what it means" |

---

## 🧪 **Testing the Update**

### Test Scenario: Product Research Journey

**Cell Data (Step 10):**
- Discovery Phase / Actions: "Browse Amazon, read reviews"
- Comparison Phase / Actions: "Create spreadsheet, compare features"
- Decision Phase / Actions: "Purchase lowest-priced option"

**Ethnographic Responses (Step 11):**
- **Gap Analysis Q:** "Why do you create spreadsheets instead of just picking one?"
  - **User:** "I guess I'm afraid of making the wrong choice. If I write it all down, I feel like I'm being thorough."

- **Magic Wand Q:** "If you could change one thing about this process?"
  - **User:** "I wish there was someone I trust who could just tell me what to buy. All this research is exhausting."

- **Synthesis Q:** "Why does getting this purchase right matter so much to you?"
  - **User:** "I always second-guess myself. If I buy something and it's wrong, I'll beat myself up about wasting money."

**Expected Artifact Quality:**

✅ **Summary MUST mention:**
- Fear of wrong choice (Gap Analysis insight)
- Research exhaustion (Magic Wand insight)
- Self-doubt and regret avoidance (Synthesis insight)

✅ **Mental Models MUST include:**
- Research as risk mitigation (derived from Gap Analysis)
- Decision avoidance through process (derived from Magic Wand)
- Trust deficit in own judgment (derived from Synthesis)

✅ **Quotes MUST include at least 1-2 from Step 11:**
- "I'm afraid of making the wrong choice..."
- "I wish there was someone I trust who could just tell me what to buy..."
- "I always second-guess myself..."

---

## 🔒 **Guarantee of Inclusion**

### Strong Language Added
- **"CRITICAL DATA SOURCES"** - Signals importance
- **"You MUST incorporate ALL of these"** - Removes ambiguity
- **"MUST incorporate insights from..."** - Explicit requirement
- **"Do not only summarize cell data"** - Prevents shortcut
- **"Prioritize quotes from..."** - Directs attention

### Why This Works
The updated prompt uses **imperative language** ("MUST", "CRITICAL") combined with **explicit examples** to ensure the AI knows:
1. What data to use (4 sources listed)
2. Why it matters (explains the "why" behind the "what")
3. How to use it (weave into summary, derive mental models, prioritize for quotes)

---

## 📝 **Related Documentation**

- **ARTIFACT-GENERATION-LOGIC.md** - Full artifact generation documentation
- **prompts.ts:188-197** - Step 13 instruction (updated)
- **prompts.ts:175-183** - Step 11 ethnographic questions (unchanged)

---

## ✅ **Verification**

After this update, artifacts should:
- ✅ Include insights from all 3 ethnographic questions
- ✅ Explain "why" behaviors happen, not just "what" happened
- ✅ Derive mental models from both cell data AND deep dive responses
- ✅ Feature quotes from reflective moments (Step 11-12)
- ✅ Connect observable behaviors to underlying motivations

**Before:** AI *could* include ethnographic data (had access)
**After:** AI *must* include ethnographic data (explicit requirement)
