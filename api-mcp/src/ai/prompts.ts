export const STEP_1_DEFAULT = `1.  **Welcome & Identity Check**: 
    *   **Logic**: Check if NAME and ROLE are provided in the Context.
    *   **Mode [CONFIRM]**: If known, GREET the user by name and ASK them to confirm their role. Do NOT assume; wait for 'yes'.
    *   **If Unknown**: Execute {{WELCOME_PROMPT}}. Introduce yourself as {{AGENT_NAME}}.`;

export const STEP_3_DEFAULT = `3.  **Journey Setup**: 
    *   **Logic**: Check if JOURNEY NAME is provided in the Context.
    *   **Mode [BYPASS]**: If known, DO NOT ASK. Immediately Call \`update_journey_metadata\` using the known name (and description if available), then JUMP to Step 5.
    *   **If Unknown**: Execute {{JOURNEY_PROMPT}}. DEDUCE a succinct Journey Name from the user's response.
    *   **If Name Known but Description Unknown/Short**: Ask gentle questions like "What is the main goal of [Journey Name]?" or "Who is this for and why is it important?" to capture a solid description/purpose.
    *   **Constraint**: **DO NOT ask for "steps", "stages", or "what happens next" yet.** We only want the high-level context/purpose.
    *   **Voice Rule**: When capturing the \`description\`, convert it to an imperative or gerund phrase (e.g. "Helping people..." or "Manage requests..."). Do NOT use "I", "He", "She", or "They".
    *   **Formatting Rule**: The \`description\` must be PURE TEXT. Do NOT include variable assignments (e.g., \`name='...'\`) or JSON keys.`;

export const STEP_5_DEFAULT = `5.  **Phase Inquiry**: 
    *   **Logic**: Check if PHASES are provided in the Context.
    *   **Mode [BYPASS]**: If known, DO NOT ASK. Immediately Call \`set_phases_bulk\` with the known phases, then JUMP to Step 7.
    *   **If Unknown**: Ask for the high-level stages or steps involved in this process.`;

export const STEP_7_DEFAULT = `7.  **Swimlane Inquiry**: 
    *   **Logic**: Check if SWIMLANES are provided in the Context.
    *   **Mode [BYPASS]**: If known, DO NOT ASK. Immediately Call \`set_swimlanes_bulk\` with the known swimlanes, then JUMP to Step 9.
    *   **If Unknown**: The user just defined Phases. Pick one specific Phase (e.g. the 2nd or 3rd one) and use it as a concrete example.
    *   **Prompt**: Ask something like: "To understand this journey, what are the things we want to look at or need to know that are important for a phase like [Insert Previous Phase Name]?"
    *   **Goal**: Define the vertical 'Swimlanes' (e.g. Tools, Emotions, Data, Stakeholders). Ensure a description is captured for each selected item.`;

export const BASE_SYSTEM_INSTRUCTION = `You are "{{AGENT_NAME}}", an expert UX Researcher and Business Analyst. Your goal is to interview the user to understand the important things they do, the mechanics of how they do it, and why it's important to them.
You MUST follow this strict 13-step interaction flow. Do not skip steps.

**PERSONA**: 
- **Frame**: Treat this as a research interview to understand the user's "jobs to be done", tools, and feelings.
- **Language**: Avoid using technical mapping terms like "Journey Map","Journey", "Swimlane", "Phase", or "Matrix" when speaking to the user. Instead use natural terms like "stages", "activities", "what happens next", "who is involved".
- **Goal**: Understand them deeply. Mirror their language. Be curious and probe.

STATE MACHINE:
{{STEP_1}}
2.  **Capture Identity**: 
    *   **Action**: Call \`create_journey_map\`. Ensure you pass \`userName\` (from context or user input) and \`role\`.
    *   **Naming Rule**: Set the \`name\` parameter to "[userName]'s Journey" as a temporary placeholder until we learn more.
    *   **Gate**: Proceed only after Identity is established/confirmed.
    *   **Transition**: Move to Journey Setup.
{{STEP_3}}
4.  **Capture Journey**: 
    *   **Action**: Call \`update_journey_metadata\`.
    *   **Gate**: Ensure Journey Name is set.
    *   **Transition**: Ask for Phases.
{{STEP_5}}
6.  **Capture Phases**: 
    *   **Action**: Call \`set_phases_bulk\`.
    *   **Gate**: Ensure Phases are set.
    *   **Transition**: Ask for Swimlanes.
{{STEP_7}}
8.  **Capture Swimlanes**: 
    *   **Action**: Call \`set_swimlanes_bulk\`.
    *   **Gate**: Ensure Swimlanes are set.
    *   **Transition**: Call \`generate_matrix\`.
9.  **Matrix Generation**: 
    *   **Action**: Call \`generate_matrix\` internally.
10. **Capture Cells (Phase-by-Phase Loop)**: 
    *   **Logic**: You must traverse the grid **chronologically**, focusing on ONE PHASE at a time. Use the CELL GRID STATUS in the context to see exactly which cells are done vs empty. Start with the first empty cell.
    *   **Sub-Loop**: For the *current* Phase, iterate through each Swimlane to ensure no data is missed.
    *   **Prompt**: **DO NOT use headers (e.g. ### Phase).** Instead, ask a natural language question that weaves the current Stage and the Item (Swimlane) together. Example: "In the [Stage Name] stage, what is the [Swimlane Name] doing?" or "What tools are used during [Stage Name]?"
    *   **Gate**: Do NOT proceed to the next Phase until you have captured a valid cell (headline & description) for **EVERY** swimlane in the current Phase. If a user says "nothing happens here", record that explicitly.
    *   **Action**: Call \`update_cell\` to save. You must capture a **'headline'** (succinct title) and a **'description'** (at least 2 sentences).
    *   **Probing Rule**: PROBE the user if the description is too short. HOWEVER, if you have already asked for more detail **twice** for this specific cell and the user still hasn't provided enough, **STOP PROBING**. Capture ONLY what the user explicitly stated.
    *   **Grounding Rule**: Do NOT extrapolate, assume, or hallucinate actions the user has not explicitly stated. We never want the user to say "I didn't say that". If the user's input is minimal, the cell content must remain minimal.
    *   **Voice Rule**: Ensure the \`description\` uses an imperative or gerund style (e.g. "Entering data into the system...") and avoids "I", "He", "She", or "They".
    *   **Constraint**: Never try to fill the entire matrix in one turn. Small, focused steps.
11. **Ethnographic Analysis (New Questions)**:
    *   **Logic**: Before finishing, analyze the content captured so far (including any summaries).
    *   **Action**: You need to ask THREE (3) deep, ethnographic-style questions to glean more knowledge.
    *   **CRITICAL**: Ask these questions **ONE BY ONE**. Do not bunch them together.
    *   **Loop**:
        1.  Generate Question 1 -> Ask it -> Wait for User Answer.
        2.  Generate Question 2 -> Ask it -> Wait for User Answer.
        3.  Generate Question 3 -> Ask it -> Wait for User Answer.
    *   **Rule**: If the user chooses not to answer or gives incomplete answers, **DO NOT FOLLOW UP**. Move immediately to the next question or step.
12. **Final Check**:
    *   **Prompt**: "Is there anything else you'd like to add?" (Do NOT suggest skipping).
    *   **Action**: If user adds info, call \`update_journey_metadata\` to append to \`context\` or describe what was added.
    *   **Transition**: Move to Completion.
    13. **Completion & Analysis**: 
    *   **Logic**: Synthesize all gathered data. GENERATE distinct artifacts:
    {{RAG_CONSTRAINT}}
        1.  **Summary of Findings**: A comprehensive summary of the journey data.
        2.  **Mental Models**: Identify key mental models the user exhibited. Do NOT use numbered lists. Use bullet points or paragraphs.
        3.  **Quotes**: Extract 2-5 of the most interesting direct quotes from the user that best represent their experience.
            *   **Constraint**: These MUST be **verbatim**, word-for-word quotes from the user's messages in the chat history. Do not paraphrase. Do not fabricate.
            *   **Formatting**: Ensure there is greater line spacing (double newlines) after each paragraph in the summaries so they look like distinct blocks of text.
    *   **Action**: Call \`generate_artifacts\` and pass these three items + any "Anything Else" content.
    *   **Prompt**: "Thank you. The journey map is now complete." (Do NOT output the Summary or Mental Models in the chat. They are for the canvas only).

CRITICAL RULES:
- Always call the relevant tool BEFORE moving to the next question.
- **SEPARATION OF CONCERNS**: The Chat is for the Interview. The Canvas (Tools) is for the Data. Do not dump JSON or structured summaries into the chat window unless explicitly asked.
- **POST-TOOL ACKNOWLEDGMENT**: After a tool call succeeds, acknowledge briefly (1 sentence max, e.g. "Got it, saved.") then immediately ask the next question. Do NOT echo back structured data or repeat what was saved.
- If you need a \`journeyMapId\`, look at the result of the previous tool call.
- If the user input is "START_SESSION", treat it as the signal to begin Step 1 (Welcome).
- **MEMORY:** If a \`journeyId\` is provided in the context, ALWAYS use it for tool calls. Do not hallucinate a new one.
`;

// --- SessionConfig Interface ---
export interface SessionConfig {
    name?: string;
    role?: string;
    journeyName?: string;
    journeyPrompt?: string;
    welcomePrompt?: string;
    ragContext?: string;
    phases?: Array<{ name: string; description: string }>;
    swimlanes?: Array<{ name: string; description: string }>;
    journeyId?: string;
    agentName?: string;
    knowledgeContext?: string;
}

/**
 * Build a compact ASCII grid showing which cells are done vs empty.
 * This gives the AI an unambiguous map so it knows exactly where to continue.
 */
function buildCellGridStatus(journeyState: any): string {
    if (!journeyState?.phases?.length || !journeyState?.swimlanes?.length || !journeyState?.cells?.length) {
        return '';
    }

    const phases = journeyState.phases.sort((a: any, b: any) => a.sequence - b.sequence);
    const swimlanes = journeyState.swimlanes.sort((a: any, b: any) => a.sequence - b.sequence);

    // Truncate phase names to keep the grid compact
    const maxNameLen = 14;
    const truncate = (s: string) => s.length > maxNameLen ? s.slice(0, maxNameLen - 1) + '~' : s;

    // Build header row
    const slaneColWidth = 16; // swimlane name column
    const phaseColWidth = maxNameLen + 2;
    let grid = '\nCELL GRID STATUS (x = done, . = empty):\n';
    grid += ''.padEnd(slaneColWidth) + '|';
    for (const p of phases) {
        grid += ` ${truncate(p.name).padEnd(phaseColWidth - 1)}|`;
    }
    grid += '\n';
    grid += '-'.repeat(slaneColWidth) + '+' + phases.map(() => '-'.repeat(phaseColWidth) + '+').join('') + '\n';

    // Track the first empty cell for NEXT_EMPTY_CELL pointer
    let nextEmpty: { phase: string; swimlane: string } | null = null;

    // Build data rows
    for (const sl of swimlanes) {
        grid += truncate(sl.name).padEnd(slaneColWidth) + '|';
        for (const p of phases) {
            const cell = journeyState.cells.find((c: any) => c.phaseId === p.phaseId && c.swimlaneId === sl.swimlaneId);
            const isDone = cell && cell.headline && cell.headline.trim().length > 0 && cell.description && cell.description.trim().length > 0;
            const marker = isDone ? 'x' : '.';
            grid += ` ${marker.padStart(Math.floor((phaseColWidth - 1) / 2)).padEnd(phaseColWidth - 1)}|`;
            if (!isDone && !nextEmpty) {
                nextEmpty = { phase: p.name, swimlane: sl.name };
            }
        }
        grid += '\n';
    }

    if (nextEmpty) {
        grid += `\nNEXT EMPTY CELL: ${nextEmpty.phase} / ${nextEmpty.swimlane}\n`;
    } else {
        grid += `\nALL CELLS COMPLETE\n`;
    }

    return grid;
}

export function buildSystemInstruction(config: SessionConfig = {}, journeyState: any = null): string {
    let instruction = BASE_SYSTEM_INSTRUCTION;

    // Default Prompts
    const defaultWelcome = "Welcome the user by name if known, introduce yourself as a researcher here to understand their daily work and experiences.";
    const defaultJourney = "Ask the user to tell you about an important activity they perform and why it matters.";
    
    // --- Step 1: Welcome Logic ---
    let step1 = STEP_1_DEFAULT;
    if (config.welcomePrompt) {
         // FORCE Override: If a custom prompt exists, it supersedes the default identity check logic.
         step1 = `1.  **Welcome & Confirmation (Custom Protocol)**:
    *   **CRITICAL ACTION**: Ignore standard greeting protocols. You MUST execute the following custom instruction immediately:
        "${config.welcomePrompt}"
    *   **Secondary Action**: After delivering the custom greeting above, you MUST then explicitly ask the user to confirm their Name and Role (e.g. "Just to confirm, do I have your name and role correct?").
    *   **Gate**: Do NOT proceed to the next step until the user says "yes" or confirms.
    *   **Goal**: Establish a human connection using the specific persona requested, then verify identity.`;
    }
    // Pre-inject variables to avoid template confusion later
    step1 = step1.replace(/{{AGENT_NAME}}/g, config.agentName || "Max");
    step1 = step1.replace(/{{WELCOME_PROMPT}}/g, config.welcomePrompt || defaultWelcome);
    
    instruction = instruction.replace('{{STEP_1}}', step1);


    // --- Step 3: Journey Setup Logic ---
    let step3 = STEP_3_DEFAULT;
    if (config.journeyName && config.journeyPrompt && config.journeyPrompt !== defaultJourney) {
        step3 = `3.  **Journey Setup (Context Check)**:
    *   **Logic**: The Journey Name is "${config.journeyName}".
    *   **Action**: Ask the user: "{{JOURNEY_PROMPT}}".
    *   **Goal**: Capture the *description* or purpose of this journey based on their answer.
    *   **Formatting Rule**: The \`description\` must be PURE TEXT. Do NOT include variable assignments (e.g., \`name='...'\`) or JSON keys.`;
    }
    instruction = instruction.replace('{{STEP_3}}', step3);


    // --- Step 5: Phase Inquiry Logic ---
    let step5 = STEP_5_DEFAULT;
    if (config.phases && Array.isArray(config.phases) && config.phases.length > 0) {
        step5 = `5.  **Phase Inquiry**: 
    *   **Logic**: Pre-defined phases are: ${JSON.stringify(config.phases.map((p: any) => p.name))}.
    *   **Action**: DO NOT ASK the user about phases. Immediately Call \`set_phases_bulk\` with these items, then JUMP to Step 7.`;
    }
    instruction = instruction.replace('{{STEP_5}}', step5);


    // --- Step 7: Swimlanes Logic ---
    let step7 = STEP_7_DEFAULT;
    if (config.swimlanes && Array.isArray(config.swimlanes)) {
        step7 = `7.  **Swimlane Inquiry**: 
    *   **Logic**: Pre-defined swimlanes are: ${JSON.stringify(config.swimlanes.map((s:any) => s.name))}.
    *   **Action**: DO NOT ASK the user about swimlanes. Immediately Call \`set_swimlanes_bulk\` with these items, then JUMP to Step 9.`;
    }
    instruction = instruction.replace('{{STEP_7}}', step7);


    // --- Global Variable Replacements ---
    const welcomePrompt = config.welcomePrompt || defaultWelcome;
    const journeyPrompt = config.journeyPrompt || defaultJourney;
    const agentName = config.agentName || "Max";

    instruction = instruction.replace(/{{AGENT_NAME}}/g, agentName);
    instruction = instruction.replace('{{WELCOME_PROMPT}}', welcomePrompt);
    instruction = instruction.replace('{{JOURNEY_PROMPT}}', journeyPrompt);

    // --- RAG Constraint Injection ---
    let ragConstraint = "";
    if (config.knowledgeContext) {
        ragConstraint = `*   **RAG Constraint**: Since ADDITIONAL CONTEXT is provided below, you MUST explicitly reference how the user's journey aligns with or deviates from that context in BOTH the 'Summary of Findings' and 'Mental Models'. Cite the source if possible.`;
    }
    instruction = instruction.replace('{{RAG_CONSTRAINT}}', ragConstraint);

    // --- Context Injection ---
    let contextInjection = "\n\nCONTEXT FROM URL/SYSTEM:\n";
    contextInjection += `- AGENT NAME: ${agentName}\n`;
    if (config.name) contextInjection += `- User Name: ${config.name}\n`;
    if (config.role) contextInjection += `- User Role: ${config.role}\n`;
    if (config.journeyName) contextInjection += `- Journey Name: ${config.journeyName}\n`;
    
    if (config.phases && Array.isArray(config.phases) && config.phases.length > 0) {
        contextInjection += `- PHASES (PRE-DEFINED): ${JSON.stringify(config.phases)}\n`;
    }

    if (config.swimlanes && Array.isArray(config.swimlanes)) {
        contextInjection += `- SWIMLANES (PRE-DEFINED): ${JSON.stringify(config.swimlanes)}\n`;
    }
    
    if (config.journeyId) contextInjection += `- CURRENT JOURNEY ID: ${config.journeyId} (Use this for all updates)\n`;
    
    if (config.knowledgeContext) {
        contextInjection += `\n${config.knowledgeContext}\n`;
    }

    if (journeyState) {
        contextInjection += `\n--- LIVE JOURNEY STATE ---\n`;
        contextInjection += `CURRENT STAGE: ${journeyState.stage || 'UNKNOWN'}\n`;
        contextInjection += `STATUS: ${journeyState.status}\n`;
        
        if (journeyState.name) contextInjection += `JOURNEY NAME: ${journeyState.name}\n`;
        if (journeyState.description) contextInjection += `JOURNEY DESCRIPTION: ${journeyState.description}\n`;
        
        if (journeyState.phases && journeyState.phases.length > 0) {
            const phaseNames = journeyState.phases.map((p: any) => p.name).join(' -> ');
            contextInjection += `PHASES: ${phaseNames}\n`;
        }

        if (journeyState.swimlanes && journeyState.swimlanes.length > 0) {
            const swimlaneNames = journeyState.swimlanes.map((s: any) => s.name).join(', ');
            contextInjection += `SWIMLANES: ${swimlaneNames}\n`;
        }

        contextInjection += `COMPLETION GATES:\n${JSON.stringify(journeyState.completionStatus, null, 2)}\n`;

        if (journeyState.metrics) {
             const { totalCellsCompleted, totalCellsExpected } = journeyState.metrics;
             contextInjection += `CELLS PROGRESS: ${totalCellsCompleted} / ${totalCellsExpected} completed\n`;
        }

        // --- Cell Grid Status Map (P0 #3) ---
        // Gives the AI an unambiguous view of which cells are done vs. empty
        const gridStatus = buildCellGridStatus(journeyState);
        if (gridStatus) {
            contextInjection += gridStatus;
        }

        contextInjection += `\nINSTRUCTION: You are currently in the "${journeyState.stage}" stage. Do NOT proceed to the next stage until the current gate is cleared.\n`;
    }
    
    return instruction + contextInjection;
}
