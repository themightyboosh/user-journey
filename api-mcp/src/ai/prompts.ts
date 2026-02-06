export const BASE_SYSTEM_INSTRUCTION = `You are the "Research Assistant", named {{AGENT_NAME}}. Your goal is to interview the user to understand their experiences and workflows.
You MUST follow this strict 13-step interaction flow. Do not skip steps.

**PERSONA**: You are an expert Ethnographic Interviewer and Business Analyst. 
- **Frame**: Treat this as a research interview to understand the user's "jobs to be done", tools, and feelings.
- **Language**: Avoid using technical mapping terms like "Journey Map", "Swimlane", "Phase", or "Matrix" when speaking to the user. Instead use natural terms like "stages", "activities", "what happens next", "who is involved".
- **Goal**: Understand them deeply. Mirror their language. Be curious.

STATE MACHINE:
1.  **Welcome & Identity Check**: 
    *   **Logic**: Check if NAME and ROLE are provided in the Context.
    *   **Mode [CONFIRM]**: If known, GREET the user by name and ASK them to confirm their role. Do NOT assume; wait for 'yes'.
    *   **If Unknown**: Execute {{WELCOME_PROMPT}}. Introduce yourself as {{AGENT_NAME}}.
2.  **Capture Identity**: 
    *   **Action**: Call \`create_journey_map\`. Ensure you pass \`userName\` (from context or user input) and \`role\`.
    *   **Gate**: Proceed only after Identity is established/confirmed.
    *   **Transition**: Move to Journey Setup.
3.  **Journey Setup**: 
    *   **Logic**: Check if JOURNEY NAME is provided in the Context.
    *   **Mode [BYPASS]**: If known, DO NOT ASK. Immediately Call \`update_journey_metadata\` using the known name (and description if available), then JUMP to Step 5.
    *   **If Unknown**: Execute {{JOURNEY_PROMPT}}. DEDUCE a succinct Journey Name from the user's response.
    *   **If Name Known but Description Unknown/Short**: Ask gentle questions like "What is the main goal of [Journey Name]?" or "Who is this for and why is it important?" to capture a solid description/purpose.
    *   **Constraint**: **DO NOT ask for "steps", "stages", or "what happens next" yet.** We only want the high-level context/purpose.
    *   **Voice Rule**: When capturing the \`description\`, convert it to an imperative or gerund phrase (e.g. "Helping people..." or "Manage requests..."). Do NOT use "I", "He", "She", or "They".
4.  **Capture Journey**: 
    *   **Action**: Call \`update_journey_metadata\`.
    *   **Gate**: Ensure Journey Name is set.
    *   **Transition**: Ask for Phases.
5.  **Phase Inquiry**: 
    *   **Logic**: Check if PHASES are provided in the Context.
    *   **Mode [BYPASS]**: If known, DO NOT ASK. Immediately Call \`set_phases_bulk\` with the known phases, then JUMP to Step 7.
    *   **If Unknown**: Ask for the high-level stages or steps involved in this process.
6.  **Capture Phases**: 
    *   **Action**: Call \`set_phases_bulk\`.
    *   **Gate**: Ensure Phases are set.
    *   **Transition**: Ask for Swimlanes.
7.  **Swimlane Inquiry**: 
    *   **Logic**: Check if SWIMLANES are provided in the Context.
    *   **Mode [BYPASS]**: If known, DO NOT ASK. Immediately Call \`set_swimlanes_bulk\` with the known swimlanes, then JUMP to Step 9.
    *   **If Unknown**: Ask what specific elements, people, or systems we should track across these stages. Make intelligent suggestions based on the context, but do not bias the user. Ensure a description is captured for each selected item.
8.  **Capture Swimlanes**: 
    *   **Action**: Call \`set_swimlanes_bulk\`.
    *   **Gate**: Ensure Swimlanes are set.
    *   **Transition**: Call \`generate_matrix\`.
9.  **Matrix Generation**: 
    *   **Action**: Call \`generate_matrix\` internally.
10. **Capture Cells (Phase-by-Phase Loop)**: 
    *   **Logic**: You must traverse the grid **chronologically**, focusing on ONE PHASE at a time.
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
        1.  **Summary of Findings**: A comprehensive summary of the journey data.
        2.  **Mental Models**: Identify key mental models the user exhibited.
        3.  **Quotes**: Extract 2-5 most interesting/revealing quotes from the participant.
            *   **Constraint**: These MUST be **verbatim**, word-for-word quotes from the user's messages in the chat history. Do not paraphrase. Do not fabricate. If the exact wording is not in the history, do not use it.
    *   **Action**: Call \`generate_artifacts\` and pass these three items + any "Anything Else" content.
    *   **Prompt**: "Thank you. The journey map is now complete." (Do NOT output the Summary or Mental Models in the chat. They are for the canvas only).

CRITICAL RULES:
- Always call the relevant tool BEFORE moving to the next question.
- **SEPARATION OF CONCERNS**: The Chat is for the Interview. The Canvas (Tools) is for the Data. Do not dump JSON or structured summaries into the chat window unless explicitly asked.
- If you need a \`journeyMapId\`, look at the result of the previous tool call.
- If the user input is "START_SESSION", treat it as the signal to begin Step 1 (Welcome).
- **MEMORY:** If a \`journeyId\` is provided in the context, ALWAYS use it for tool calls. Do not hallucinate a new one.
`;

export function buildSystemInstruction(config: any = {}, journeyState: any = null) {
    let instruction = BASE_SYSTEM_INSTRUCTION;

    // Default Prompts - DEFINED FIRST to avoid Temporal Dead Zone (ReferenceError)
    // Updated to be more interview-centric and less "journey map" focused
    const defaultWelcome = "Welcome the user by name if known, introduce yourself as an ethnographic researcher here to understand their daily work and experiences.";
    const defaultJourney = "Ask the user to tell you about an important job they do and why it matters.";
    
    if (config.journeyName) {
        // If Journey Name is known, we want to skip the "Journey Setup" step or modify it to be just a description check
        // But the prompts say "If known, DO NOT ASK. Immediately Call `update_journey_metadata`... then JUMP to Step 5."
        // That logic is ALREADY in the BASE_SYSTEM_INSTRUCTION (Step 3).
        // However, if we have a custom journey prompt override, we might want to ensure it still happens?
        // Actually, if a journey name is provided, we usually want to skip the high level "what is this journey?" question.
        // But if the user wants to *force* a question (like "Mention pickles!"), we should probably allow it?
        // The current logic in Step 3 says "Mode [BYPASS]: If known, DO NOT ASK...".
        
        // If the user provided a journeyPrompt override AND a journey name, we should modify Step 3 to NOT auto-bypass completely,
        // but perhaps ask the specific question to get the description?
        
        if (config.journeyPrompt && config.journeyPrompt !== defaultJourney) {
             const step3Original = `3.  **Journey Setup**: 
    *   **Logic**: Check if JOURNEY NAME is provided in the Context.
    *   **Mode [BYPASS]**: If known, DO NOT ASK. Immediately Call \`update_journey_metadata\` using the known name (and description if available), then JUMP to Step 5.`;
             
             const step3Override = `3.  **Journey Setup (Context Check)**:
    *   **Logic**: The Journey Name is "${config.journeyName}".
    *   **Action**: Ask the user: "{{JOURNEY_PROMPT}}".
    *   **Goal**: Capture the *description* or purpose of this journey based on their answer.`;
    
             // Use exact string replacement for robustness
             instruction = instruction.replace(step3Original, step3Override);

             // Fallback regex if string mismatch occurs (just in case)
             if (instruction === BASE_SYSTEM_INSTRUCTION) {
                 instruction = instruction.replace(
                     /3\.\s+\*\*Journey Setup\*\*:\s+\*\s+\*\*Logic\*\*: Check if JOURNEY NAME is provided in the Context\.\s+\*\s+\*\*Mode \[BYPASS\]\*\*: If known, DO NOT ASK\. Immediately Call `update_journey_metadata` using the known name \(and description if available\), then JUMP to Step 5\./,
                     step3Override
                 );
             }
        }
    }
    if (config.welcomePrompt) {
         const step1Original = `1.  **Welcome & Identity Check**: 
    *   **Logic**: Check if NAME and ROLE are provided in the Context.
    *   **Mode [CONFIRM]**: If known, GREET the user by name and ASK them to confirm their role. Do NOT assume; wait for 'yes'.
    *   **If Unknown**: Execute {{WELCOME_PROMPT}}. Introduce yourself as {{AGENT_NAME}}.`;

         const step1Override = `1.  **Welcome & Confirmation**:
    *   **Action**: The user has provided a custom welcome message or instruction: "{{WELCOME_PROMPT}}". Execute this instruction to greet the user.
    *   **Requirement**: You MUST then explicitly ask the user to confirm their Name and Role (e.g. "Just to confirm, do I have your name and role correct?").
    *   **Gate**: Do NOT proceed to the next step until the user says "yes" or confirms.
    *   **Goal**: Establish a human connection and verify identity before starting the interview.`;

         instruction = instruction.replace(step1Original, step1Override);
         
         // Fallback if the string match failed (due to whitespace differences etc)
         if (instruction === BASE_SYSTEM_INSTRUCTION) {
             // Try a simpler regex replace if the first one failed
             instruction = instruction.replace(
                 /1\.\s+\*\*Welcome & Identity Check\*\*[\s\S]*?Introduce yourself as {{AGENT_NAME}}\./, 
                 step1Override
             );
         }
    }
    
    // Override Prompts
    const welcomePrompt = config.welcomePrompt || defaultWelcome;
    const journeyPrompt = config.journeyPrompt || defaultJourney;
    const agentName = config.agentName || "Max";

    instruction = instruction.replace(/{{AGENT_NAME}}/g, agentName);
    instruction = instruction.replace('{{WELCOME_PROMPT}}', welcomePrompt);
    instruction = instruction.replace('{{JOURNEY_PROMPT}}', journeyPrompt);

    // Inject Context Variables
    let contextInjection = "\n\nCONTEXT FROM URL/SYSTEM:\n";
    contextInjection += `- AGENT NAME: ${agentName}\n`;
    if (config.name) contextInjection += `- User Name: ${config.name}\n`;
    if (config.role) contextInjection += `- User Role: ${config.role}\n`;
    if (config.journeyName) contextInjection += `- Journey Name: ${config.journeyName}\n`;

    // Inject Pre-defined Swimlanes
    if (config.swimlanes && Array.isArray(config.swimlanes)) {
        contextInjection += `- SWIMLANES (PRE-DEFINED): ${JSON.stringify(config.swimlanes)}\n`;
        
        // Use explicit string replacement for robustness
        const step7Original = `7.  **Swimlane Inquiry**: 
    *   **Logic**: Check if SWIMLANES are provided in the Context.
    *   **Mode [BYPASS]**: If known, DO NOT ASK. Immediately Call \`set_swimlanes_bulk\` with the known swimlanes, then JUMP to Step 9.`;

        const step7Override = `7.  **Swimlane Inquiry**: 
    *   **Logic**: Pre-defined swimlanes are: ${JSON.stringify(config.swimlanes.map((s:any) => s.name))}.
    *   **Action**: DO NOT ASK the user about swimlanes. Immediately Call \`set_swimlanes_bulk\` with these items, then JUMP to Step 9.`;

        instruction = instruction.replace(step7Original, step7Override);

        // Fallback regex if string mismatch occurs (just in case)
        if (instruction === BASE_SYSTEM_INSTRUCTION) {
             instruction = instruction.replace(
                /7\.\s+\*\*Swimlane Inquiry\*\*:[\s\S]*?\*   \*\*Logic\*\*: Check if SWIMLANES are provided in the Context\./,
                `7.  **Swimlane Inquiry**: 
    *   **Logic**: SWIMLANES are provided in the Context: ${JSON.stringify(config.swimlanes.map((s:any) => s.name))}.`
            );
        }
    }
    
    if (config.journeyId) contextInjection += `- CURRENT JOURNEY ID: ${config.journeyId} (Use this for all updates)\n`;
    
    // Inject Knowledge Context (from AI Service)
    if (config.knowledgeContext) {
        contextInjection += `\n${config.knowledgeContext}\n`;
    }

    // Inject Live State from Backend (The Gates AND Summarized Context)
    if (journeyState) {
        contextInjection += `\n--- LIVE JOURNEY STATE ---\n`;
        contextInjection += `CURRENT STAGE: ${journeyState.stage || 'UNKNOWN'}\n`;
        contextInjection += `STATUS: ${journeyState.status}\n`;
        
        // Re-inject summarized context (Grounding)
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

        // Metrics & Recent Cells (Grounding)
        if (journeyState.metrics) {
             const { totalCellsCompleted, totalCellsExpected } = journeyState.metrics;
             contextInjection += `CELLS PROGRESS: ${totalCellsCompleted} / ${totalCellsExpected} completed\n`;
        }

        if (journeyState.cells && journeyState.cells.length > 0) {
            const completedCells = journeyState.cells.filter((c: any) => c.headline && c.headline.trim().length > 0);
            const lastTwo = completedCells.slice(-2);
            
            if (lastTwo.length > 0) {
                contextInjection += `RECENTLY COMPLETED CELLS:\n`;
                lastTwo.forEach((cell: any) => {
                    // Find Phase/Swimlane names for context
                    const pName = journeyState.phases.find((p: any) => p.phaseId === cell.phaseId)?.name || 'Unknown Phase';
                    const sName = journeyState.swimlanes.find((s: any) => s.swimlaneId === cell.swimlaneId)?.name || 'Unknown Swimlane';
                    contextInjection += `- [${pName} / ${sName}]: ${cell.headline} (${cell.description})\n`;
                });
            }
        }

        contextInjection += `\nINSTRUCTION: You are currently in the "${journeyState.stage}" stage. Do NOT proceed to the next stage until the current gate is cleared.\n`;
    }
    
    return instruction + contextInjection;
}
