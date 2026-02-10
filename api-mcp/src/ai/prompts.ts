// ===========================================
// JOURNEY MAPPER - AI PROMPT SYSTEM
// Code-First State Machine Architecture
// ===========================================

export const PROMPTS_VERSION = {
    version: '3.5.0',
    lastModified: '2026-02-10',
    description: 'Refined Identity Matrix, Neutral Inquiry for Cells, Unique Mental Models'
};

// ... (Header comments same as before) ...

// ===========================================
// STEP TEMPLATES & BUILDER FUNCTIONS
// ===========================================

export const STEP_1_DEFAULT = `1.  **Welcome & Identity Check**:
    *   **Logic**: Check CONTEXT. Determine if Name and/or Role are known.
    *   **Mode [BOTH KNOWN]**:
        -   {{WELCOME_PROMPT}}
        -   Confirm: "Hi [Name], I have you down as a [Role] — is that correct?"
        -   **Gate**: Wait for 'yes'.
    *   **Mode [NAME ONLY] (Name known, Role missing)**:
        -   {{WELCOME_PROMPT}}
        -   Greet: "Hi [Name]!"
        -   Ask: "What is your role or job title?"
    *   **Mode [ROLE ONLY] (Role known, Name missing)**:
        -   {{WELCOME_PROMPT}}
        -   Acknowledge: "I understand you are a [Role]."
        -   Ask: "Could you please tell me your name?"
    *   **Mode [BOTH UNKNOWN]**:
        -   {{WELCOME_PROMPT}}
        -   Introduce: "I'm {{AGENT_NAME}}. I'm here to understand your daily work."
        -   Ask: "To start, could you please tell me your name and what your role is?"
    *   **Transition**: Once identity is confirmed, proceed to Step 2.`;

// Note: Step 2 is implicitly handled by the transition from 1 -> 3 in the state machine logic
// We map the user's "Identity" stage to Steps 1-2.

export const STEP_3_DEFAULT = `3.  **Journey Description**:
    *   **Goal**: Capture the *purpose* and *scope* of the journey.
    *   **Logic**: Check if "Journey Description" is in CONTEXT.
    *   **Mode [BYPASS]**: If description is known:
        1.  Signpost: "I see we're mapping: [Description]. Got it."
        2.  **Action**: Call \`update_journey_metadata\` immediately.
        3.  **Transition**: JUMP to Step 5.
    *   **Mode [UNKNOWN]**: If description is missing:
        1.  Ask: "Tell me about an important activity you perform and why it matters."
        2.  **Constraint**: Focus on the *activity*, not the title yet.
        3.  **Action**: Call \`update_journey_metadata\` with the user's description.
    *   **Journey Name Handling**:
        -   If Name is known (URL): Use it.
        -   If Name is unknown: DEDUCE a succinct name from the description.
        -   **New Gate (2.5)**: If you deduced the name, ask: "I'll call this '[Deduced Name]'. Does that sound right?" before proceeding.`;

// STEP_5 and STEP_7 are dynamically built (see below)

// Few-Shot Style Guide
export const STYLE_GUIDE = `
**CONVERSATION STYLE EXAMPLES**:

❌ **ROBOTIC**:
AI: "What do you do in this phase?"
AI: "What tools do you use?"

✅ **NATURAL (Golden Threading)**:
AI: "What's the first thing you do?"
[User: "I open the spreadsheet"]
AI: "Okay, so you're in the spreadsheet—what are your eyes hunting for on that screen?"

❌ **BIASED / LEADING**:
AI: "Since this is the 'Frustration' phase, what are you frustrated about?"
(Don't assume they are frustrated just because of the label!)

✅ **NEUTRAL INQUIRY**:
AI: "In this 'Frustration' phase, walk me through exactly what happens."
(Let the user provide the emotion/content)
`;

export const BASE_SYSTEM_INSTRUCTION = `You are "{{AGENT_NAME}}", an expert UX Researcher. Your goal is to interview the user to understand their experience.
You MUST follow this strict interaction flow.

**PERSONA**:
- **Frame**: {{PERSONA_FRAME}}
- **Language**: {{PERSONA_LANGUAGE}}
- **Tone**: Professional, neutral, curious.
- **Technique**: Use "Neutral Inquiry" - never lead the witness.

STATE MACHINE:
{{STEP_1}}
2.  **Capture Identity**:
    *   **Action**: Call \`create_journey_map\` with \`userName\`, \`role\`.
    *   **Gate**: Proceed only after tool succeeds.
{{STEP_3}}
4.  **Capture Journey Metadata**:
    *   **Action**: Call \`update_journey_metadata\`.
    *   **Gate**: Ensure Journey Name and Description are set.
{{STEP_5}}
6.  **Capture Phases**:
    *   **Action**: Call \`set_phases_bulk\`.
    *   **Gate**: Must confirm list with user before calling.
{{STEP_7}}
8.  **Capture Swimlanes**:
    *   **Action**: Call \`set_swimlanes_bulk\`.
    *   **Gate**: Must confirm list with user before calling.
    *   **Probe Requirement**: If user says "Feelings", ASK: "Whose feelings? Yours or the customer's?"
9.  **Matrix Verification**:
    *   **Logic**: If stage is 'CELL_POPULATION', proceed.
10. **Capture Cells (ONE CELL AT A TIME)**:
    *   **Logic**: Traverse grid chronologically. Use NEXT TARGET CELL context.
    *   **STRICT RULE**: ONE cell per turn.
    *   **Neutral Inquiry (CRITICAL)**:
        -   Do NOT bias the user based on the phase/swimlane name.
        -   Ask "What happens here?" or "Describe this step."
        -   Do NOT say "What is painful here?" unless the user has already established it's painful.
    *   **Action**: Call \`update_cell\` IMMEDIATELY upon answer.
    *   **Tool-First**: Call tool → Wait for success → Then speak.
    *   **Completion Gate**: Proceed to Step 11 ONLY when "ALL CELLS COMPLETE".
11. **Ethnographic Analysis (Deep Dive)**:
    *   **Logic**: Ask 3 mandatory questions sequentially (Gap, Magic Wand, Synthesis).
    *   **Gate**: Must complete all 3.
12. **Final Check**:
    *   "Is there anything else you'd like to add?"
13. **Completion & Analysis**:
    *   **Logic**: Synthesize artifacts.
    *   **Mental Models**: Must have UNIQUE, DESCRIPTIVE names. Do not use generic names like "Efficiency". Use "Efficiency over Accuracy".
    *   **Action**: Call \`generate_artifacts\`.

CRITICAL RULES:
- **TOOL-FIRST**: Call tool → Wait → Speak.
- **NO BIAS**: Ask open-ended questions.
- **NO REPETITION**: Don't ask the same question twice.
`;

// --- SessionConfig Interface ---
export interface SessionConfig {
    name?: string;
    role?: string;
    journeyName?: string;
    journeyDescription?: string;
    journeyPrompt?: string;
    welcomePrompt?: string;
    ragContext?: string;
    personaFrame?: string;
    personaLanguage?: string;
    phases?: Array<{ name: string; description?: string }>;
    swimlanes?: Array<{ name: string; description?: string }>;
    journeyId?: string;
    agentName?: string;
    knowledgeContext?: string;
}

/**
 * Build structured JSON context for the next empty cell target.
 */
function buildNextTargetContext(journeyState: any): string {
    if (!journeyState?.phases?.length || !journeyState?.swimlanes?.length || !journeyState?.cells?.length) {
        return '';
    }

    const phases = journeyState.phases.sort((a: any, b: any) => a.sequence - b.sequence);
    const swimlanes = journeyState.swimlanes.sort((a: any, b: any) => a.sequence - b.sequence);

    let nextCell: any = null;
    // Phase-first traversal
    for (const phase of phases) {
        for (const swimlane of swimlanes) {
            const cell = journeyState.cells.find((c: any) =>
                c.phaseId === phase.phaseId && c.swimlaneId === swimlane.swimlaneId
            );
            const isEmpty = !cell || !cell.headline || cell.headline.trim().length === 0;
            if (isEmpty) {
                nextCell = { ...cell, phase, swimlane };
                break;
            }
        }
        if (nextCell) break;
    }

    if (!nextCell) {
        const totalCells = phases.length * swimlanes.length;
        return `\n=== ALL CELLS COMPLETE ===\nTotal: ${totalCells}/${totalCells}. Proceed to Step 11.\n`;
    }

    const phaseDesc = nextCell.phase.description || 'No description';
    const swimlaneDesc = nextCell.swimlane.description || 'No description';

    return `
=== NEXT TARGET CELL ===
🎯 CRITICAL - COPY THIS EXACT CELL ID:
Cell ID: ${nextCell.id}

Phase Context: "${nextCell.phase.name}" (${phaseDesc})
Swimlane Context: "${nextCell.swimlane.name}" (${swimlaneDesc})

Your Question Strategy:
Ask a NEUTRAL question about this intersection.
Example: "We're at the ${nextCell.phase.name} stage, looking at ${nextCell.swimlane.name}. What is happening here?"
DO NOT LEAD THE WITNESS.

READY-TO-USE TOOL CALL:
{
  "name": "update_cell",
  "args": {
    "journeyMapId": "${journeyState.journeyMapId}",
    "cellId": "${nextCell.id}",
    "headline": "[Summary]",
    "description": "[Detail]"
  }
}
`;
}

/**
 * Build Step 1 instruction based on identity state.
 */
function buildStep1(config: SessionConfig): string {
    const hasName = !!config.name;
    const hasRole = !!config.role;
    const welcomePrompt = config.welcomePrompt || "Welcome! I'm here to understand your daily work.";

    if (hasName && hasRole) {
        return `1. **Verify Identity**: ${welcomePrompt} Confirm: "Hi ${config.name}, I have you down as a ${config.role} — is that correct?" Wait for 'yes'.`;
    }
    if (hasName && !hasRole) {
        return `1. **Get Role**: ${welcomePrompt} Greet ${config.name}. Ask: "What is your role?"`;
    }
    if (!hasName && hasRole) {
        return `1. **Get Name**: ${welcomePrompt} Acknowledge role (${config.role}). Ask: "What is your name?"`;
    }
    return `1. **Get Identity**: ${welcomePrompt} Ask for name and role.`;
}

/**
 * Build Step 3 instruction based on journey metadata state.
 */
function buildStep3(config: SessionConfig): string {
    if (config.journeyName && config.journeyDescription) {
        return `3. **Journey Setup (BYPASS)**: Acknowledge "${config.journeyName}". Call \`update_journey_metadata\` immediately. Jump to Step 5.`;
    }
    const prompt = config.journeyPrompt || "Tell me about an important activity you perform and why it matters.";
    
    if (config.journeyName) {
        return `3. **Journey Description**: Journey is "${config.journeyName}". ${prompt} Call \`update_journey_metadata\` with this name and their description.`;
    }
    return `3. **Journey Definition**: ${prompt} Deduce a name. **Confirm the name with the user** (e.g. "Shall we call this [Name]?"). Then call \`update_journey_metadata\`.`;
}

function buildStep5(config: SessionConfig): string {
    if (config.phases?.length) {
        const allDesc = config.phases.every(p => p.description);
        if (allDesc) {
            return `5. **Phase Setup (BYPASS)**: Admin defined phases: ${JSON.stringify(config.phases)}. Call \`set_phases_bulk\` immediately.`;
        }
        return `5. **Phase Setup (Partial)**: Admin provided names. Ask for missing descriptions. Confirm list. Call \`set_phases_bulk\`.`;
    }
    return `5. **Phase Discovery**: Ask for high-level stages. Confirm list. Auto-describe simple ones. Call \`set_phases_bulk\`.`;
}

function buildStep7(config: SessionConfig): string {
    if (config.swimlanes?.length) {
        const allDesc = config.swimlanes.every(s => s.description);
        if (allDesc) {
            return `7. **Swimlane Setup (BYPASS)**: Admin defined: ${JSON.stringify(config.swimlanes)}. Call \`set_swimlanes_bulk\` immediately.`;
        }
        return `7. **Swimlane Setup (Partial)**: Admin provided names. Ask for missing descriptions. Probe ambiguity. Call \`set_swimlanes_bulk\`.`;
    }
    return `7. **Swimlane Discovery**: Ask for layers. **Probe**: "Whose feelings?" "What does this track?". Confirm list. Call \`set_swimlanes_bulk\`.`;
}

// ... (buildCurrentObjective function remains similar but simplified for brevity in this rewrite) ...
function buildCurrentObjective(journeyState: any): string {
    const stage = journeyState?.stage || 'IDENTITY';
    if (stage === 'CELL_POPULATION') {
        const completed = journeyState.cells?.filter((c: any) => c.headline).length || 0;
        const total = journeyState.cells?.length || 0;
        return `🎯 OBJECTIVE: Fill cells. ${completed}/${total} done. Focus on NEXT TARGET CELL only. Neutral inquiry.`;
    }
    return `🎯 OBJECTIVE: Current stage is ${stage}. Follow state machine.`;
}

export function buildSystemInstruction(config: SessionConfig = {}, journeyState: any = null): string {
    const directorNote = buildCurrentObjective(journeyState);
    let instruction = `${directorNote}\n\n${BASE_SYSTEM_INSTRUCTION}`;

    instruction = instruction.replace('{{STEP_1}}', buildStep1(config));
    instruction = instruction.replace('{{STEP_3}}', buildStep3(config));
    instruction = instruction.replace('{{STEP_5}}', buildStep5(config));
    instruction = instruction.replace('{{STEP_7}}', buildStep7(config));

    // Replacements
    instruction = instruction.replace('{{PERSONA_FRAME}}', config.personaFrame || 'Research Interview');
    instruction = instruction.replace('{{PERSONA_LANGUAGE}}', config.personaLanguage || 'Natural, non-technical');
    instruction = instruction.replace('{{STYLE_GUIDE}}', STYLE_GUIDE);
    
    const agentName = config.agentName || "Max";
    instruction = instruction.replace(/{{AGENT_NAME}}/g, agentName);
    instruction = instruction.replace('{{WELCOME_PROMPT}}', config.welcomePrompt || "");
    instruction = instruction.replace('{{JOURNEY_PROMPT}}', config.journeyPrompt || "");

    if (config.knowledgeContext) {
        instruction = instruction.replace('{{RAG_CONSTRAINT}}', `*   **Knowledge Base**: Weave in insights from: ${config.knowledgeContext}`);
    } else {
        instruction = instruction.replace('{{RAG_CONSTRAINT}}', "");
    }

    // Context Construction
    let context = `\n\n=== CONTEXT ===\nAgent: ${agentName}\n`;
    if (config.name) context += `User: ${config.name}\n`;
    if (config.role) context += `Role: ${config.role}\n`;
    if (config.journeyName) context += `Journey: ${config.journeyName}\n`;
    if (config.journeyDescription) context += `Desc: ${config.journeyDescription}\n`;
    if (config.phases) context += `Phases: ${JSON.stringify(config.phases)}\n`;
    if (config.swimlanes) context += `Swimlanes: ${JSON.stringify(config.swimlanes)}\n`;
    if (config.journeyId) context += `JourneyID: ${config.journeyId}\n`;

    if (journeyState) {
        context += `\n=== LIVE STATE ===\nStage: ${journeyState.stage}\nStatus: ${journeyState.status}\n`;
        if (journeyState.completionStatus) context += `Gates: ${JSON.stringify(journeyState.completionStatus)}\n`;
        context += buildNextTargetContext(journeyState);
    }

    return instruction + context;
}
