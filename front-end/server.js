/**
 * M.AX Chat Server
 * Vertex AI Gemini Streaming Backend
 */

import express from 'express';
import cors from 'cors';
import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  port: process.env.PORT || 3000,
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.VERTEX_AI_LOCATION || 'us-central1',
  mcpApiUrl: process.env.MCP_API_URL || 'http://localhost:3001'
};

// ...

// Initialize Vertex AI
const vertexAI = new VertexAI({
  project: CONFIG.projectId,
  location: CONFIG.location,
});

// System Instruction (The Rigid Interviewer)
const BASE_SYSTEM_INSTRUCTION = `You are the "Journey Mapper Assistant". Your goal is to interview the user to build a structured Journey Map.
You MUST follow this strict 12-step interaction flow. Do not skip steps.
However, you must act like a friendly, curious UX Researcher. Use mirroring and open-ended probing.

STATE MACHINE:
1.  **Welcome**: 
    *   **Logic**: If NAME and ROLE are known from context, skip to Step 2 immediately.
    *   **Prompt**: {{WELCOME_PROMPT}}
2.  **Capture Identity**: 
    *   **Action**: Call \`create_journey_map\`. 
    *   **Logic**: The AI does not let the conversation proceed until NAME and ROLE are known.
    *   **Transition**: Ask about the Journey process.
3.  **Journey Setup**: 
    *   **Prompt**: {{JOURNEY_PROMPT}}
4.  **Capture Journey**: 
    *   **Action**: Call \`update_journey_metadata\`.
    *   **Logic**: The AI does not let the conversation proceed until the JOURNEY is named and described succinctly.
    *   **Transition**: Ask for the Phases (Steps).
5.  **Phase Inquiry**: 
    *   **Prompt**: Ask for the high-level phases (steps).
    *   **Logic**: Understand each phase, probe for context. Verify the sequence is correct based on name alone.
    *   **Gate**: Must confirm sequence with user before proceeding.
6.  **Capture Phases**: 
    *   **Action**: Call \`set_phases_bulk\`.
    *   **Logic**: Summarize anything else as CONTEXT. The AI does not let the conversation proceed until PHASES are known.
    *   **Transition**: Ask for Swimlanes (Actors/Systems).
7.  **Swimlane Inquiry**: 
    *   **Prompt**: Ask for the actors/swimlanes.
    *   **Logic**: Understand each swimlane, probe for context. Verify sequence. OK to reference PHASE to guide questions.
    *   **Gate**: Must confirm sequence with user before proceeding.
8.  **Capture Swimlanes**: 
    *   **Action**: Call \`set_swimlanes_bulk\`.
    *   **Logic**: Summarize anything else as CONTEXT. The AI does not let the conversation proceed until SWIMLANES are known.
    *   **Transition**: Call \`generate_matrix\`.
9.  **Matrix Generation**: 
    *   **Action**: Call \`generate_matrix\` internally.
10. **Capture Cells (Loop)**: 
    *   **Logic**: Iterate through every Phase x Swimlane intersection.
    *   **Prompt**: Construct a natural language prompt using the SWIMLANE and PHASE name/description. Ask "what happens here" and probe once for context.
    *   **Action**: Call \`update_cell\` to save.
    *   **Gate**: The AI does not let the conversation proceed until CELLS are known.
11. **Completion**: 
    *   **Action**: Call \`generate_artifacts\` when done.
    *   **Prompt**: Thank the user for their time and by NAME.

CRITICAL RULES:
- Always call the relevant tool BEFORE moving to the next question.
- If you need a \`journeyMapId\`, look at the result of the previous tool call.
- If the user input is "START_SESSION", treat it as the signal to begin Step 1 (Welcome).
- **MEMORY:** If a \`journeyId\` is provided in the context, ALWAYS use it for tool calls. Do not hallucinate a new one.
`;

// Helper to get journey state from API
async function getJourneyState(journeyId) {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/v1/journey-maps/${journeyId}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error("Failed to fetch journey state:", e);
        return null;
    }
}

function buildSystemInstruction(config = {}, journeyState = null) {
    let instruction = BASE_SYSTEM_INSTRUCTION;
    
    // Default Prompts
    const defaultWelcome = "Greet the user ask for their name and role.";
    const defaultJourney = "Ask the user for an important end-to-end job they perform.";

    // Override Prompts
    const welcomePrompt = config.welcomePrompt || defaultWelcome;
    const journeyPrompt = config.journeyPrompt || defaultJourney;

    instruction = instruction.replace('{{WELCOME_PROMPT}}', welcomePrompt);
    instruction = instruction.replace('{{JOURNEY_PROMPT}}', journeyPrompt);

    // Inject Context Variables
    let contextInjection = "\n\nCONTEXT FROM URL/SYSTEM:\n";
    if (config.name) contextInjection += `- User Name: ${config.name}\n`;
    if (config.role) contextInjection += `- User Role: ${config.role}\n`;
    if (config.journeyName) contextInjection += `- Journey Name: ${config.journeyName}\n`;
    if (config.journeyId) contextInjection += `- CURRENT JOURNEY ID: ${config.journeyId} (Use this for all updates)\n`;
    
    // Inject Live State from Backend (The Gates AND Summarized Context)
    if (journeyState) {
        contextInjection += `\n--- LIVE JOURNEY STATE ---\n`;
        contextInjection += `CURRENT STAGE: ${journeyState.stage || 'UNKNOWN'}\n`;
        contextInjection += `STATUS: ${journeyState.status}\n`;
        
        // Re-inject summarized context (Grounding)
        if (journeyState.name) contextInjection += `JOURNEY NAME: ${journeyState.name}\n`;
        if (journeyState.context) contextInjection += `JOURNEY CONTEXT: ${journeyState.context}\n`;
        
        if (journeyState.phases && journeyState.phases.length > 0) {
            const phaseNames = journeyState.phases.map(p => p.name).join(' -> ');
            contextInjection += `PHASES: ${phaseNames}\n`;
        }

        if (journeyState.swimlanes && journeyState.swimlanes.length > 0) {
            const swimlaneNames = journeyState.swimlanes.map(s => s.name).join(', ');
            contextInjection += `SWIMLANES: ${swimlaneNames}\n`;
        }

        contextInjection += `COMPLETION GATES:\n${JSON.stringify(journeyState.completionStatus, null, 2)}\n`;

        // Metrics & Recent Cells (Grounding)
        if (journeyState.metrics) {
             const { totalCellsCompleted, totalCellsExpected } = journeyState.metrics;
             contextInjection += `CELLS PROGRESS: ${totalCellsCompleted} / ${totalCellsExpected} completed\n`;
        }

        if (journeyState.cells && journeyState.cells.length > 0) {
            const completedCells = journeyState.cells.filter(c => c.action && c.action.trim().length > 0);
            const lastTwo = completedCells.slice(-2);
            
            if (lastTwo.length > 0) {
                contextInjection += `RECENTLY COMPLETED CELLS:\n`;
                lastTwo.forEach(cell => {
                    // Find Phase/Swimlane names for context
                    const pName = journeyState.phases.find(p => p.phaseId === cell.phaseId)?.name || 'Unknown Phase';
                    const sName = journeyState.swimlanes.find(s => s.swimlaneId === cell.swimlaneId)?.name || 'Unknown Swimlane';
                    contextInjection += `- [${pName} / ${sName}]: ${cell.action} (${cell.context})\n`;
                });
            }
        }

        contextInjection += `\nINSTRUCTION: You are currently in the "${journeyState.stage}" stage. Do NOT proceed to the next stage until the current gate is cleared.\n`;
    }

    // Logic Injection for Welcome
    if (config.welcomePrompt) {
         // If a custom welcome prompt exists, force the AI to use it regardless of whether name/role are known
         instruction = instruction.replace('If NAME and ROLE are known from context, skip to Step 2 immediately.', 'Execute the Welcome Prompt below.');
    }
    
    return instruction + contextInjection;
}


const JOURNEY_TOOLS = [
    {
        functionDeclarations: [
            {
                name: "create_journey_map",
                description: "Initialize a new journey map when the user provides their name and role.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: { type: "STRING", description: "Name of the journey/project (e.g. 'Draft')" },
                        role: { type: "STRING", description: "User's role" },
                        context: { type: "STRING", description: "Any extra context provided" }
                    },
                    required: ["name", "role"]
                }
            },
            {
                name: "update_journey_metadata",
                description: "Update the journey name and description after the user explains the process.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        journeyMapId: { type: "STRING" },
                        name: { type: "STRING", description: "Succinct journey name" },
                        context: { type: "STRING", description: "Detailed description/context" }
                    },
                    required: ["journeyMapId", "name"]
                }
            },
            {
                name: "set_phases_bulk",
                description: "Set the list of high-level phases (steps) for the journey.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        journeyMapId: { type: "STRING" },
                        phases: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    name: { type: "STRING" },
                                    description: { type: "STRING" }
                                },
                                required: ["name", "description"]
                            }
                        }
                    },
                    required: ["journeyMapId", "phases"]
                }
            },
            {
                name: "set_swimlanes_bulk",
                description: "Set the list of actors/swimlanes.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        journeyMapId: { type: "STRING" },
                        swimlanes: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    name: { type: "STRING" },
                                    description: { type: "STRING" }
                                },
                                required: ["name", "description"]
                            }
                        }
                    },
                    required: ["journeyMapId", "swimlanes"]
                }
            },
            {
                name: "generate_matrix",
                description: "Generate the empty cell grid. Call this immediately after setting phases and swimlanes.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        journeyMapId: { type: "STRING" }
                    },
                    required: ["journeyMapId"]
                }
            },
            {
                name: "update_cell",
                description: "Save a specific action/pain-point for a specific cell intersection.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        journeyMapId: { type: "STRING" },
                        cellId: { type: "STRING", description: "The UUID of the cell being updated" },
                        action: { type: "STRING", description: "Succinct action title" },
                        context: { type: "STRING", description: "Detailed context" }
                    },
                    required: ["journeyMapId", "cellId", "action"]
                }
            },
            {
                name: "generate_artifacts",
                description: "Finalize the journey and generate summaries.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        journeyMapId: { type: "STRING" }
                    },
                    required: ["journeyMapId"]
                }
            }
        ]
    }
];

// Helper to get a working generative model with fallback strategy
async function getWorkingGenerativeModel() {
    const candidates = [
        process.env.VERTEX_AI_MODEL, // Primary choice (env var)
        'gemini-2.5-flash',       // New Primary: High speed & performance
        'gemini-2.5-pro',         // New Secondary: High reasoning
        'gemini-2.5-flash-lite',  // Cost optimized
        'gemini-2.0-flash-001',   // Previous Gen (Backup)
        'gemini-1.5-flash-002'    // Legacy Backup
    ].filter((v, i, a) => v && a.indexOf(v) === i); // Unique non-null

    const systemInstruction = {
        parts: [{ text: buildSystemInstruction() }] // Use default for initial ping
    };

    const tools = JOURNEY_TOOLS;

    for (const modelName of candidates) {
        console.log(`🤖 Attempting to initialize model: ${modelName}...`);
        try {
            const model = vertexAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    maxOutputTokens: 2048,
                    temperature: 0.4,
                    topP: 0.9,
                },
                systemInstruction,
                tools
            });
            
            // Validate model by generating a tiny dummy response
            // This 'ping' ensures we fail fast if the model ID is invalid in this region
            const dummyResult = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'ping' }] }]
            });
            await dummyResult.response; 
            
            console.log(`✅ Successfully initialized model: ${modelName}`);
            return { model, modelName };
        } catch (e) {
            console.warn(`⚠️ Failed to initialize ${modelName}: ${e.message}`);
            // Continue to next candidate
        }
    }
    
    throw new Error("CRITICAL: No working Vertex AI model found in candidates list.");
}

// Global model instance holder
let activeGenerativeModel = null;
let activeModelName = "Initializing...";

// Initialize immediately on start
getWorkingGenerativeModel().then(({ model, modelName }) => {
    activeGenerativeModel = model;
    activeModelName = modelName;
}).catch(err => {
    console.error(err);
    process.exit(1);
});


// Helper to call MCP tools
async function callMcpTool(name, args) {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/mcp/tools/${name}`, { // This endpoint doesn't exist on API-MCP, we need to map tools to API calls manually or use a client.
            // Actually, we built `api-mcp` as a REST API. The MCP server wraps it.
            // For this 'Driver' (Node.js), we should call the REST API directly to avoid overhead, 
            // OR use the MCP SDK client. 
            // Let's call REST API directly for simplicity as per Integration Guide.
        });
        // REVISION: The Vertex AI needs to call "Tools". 
        // We need to define the tool definitions for Vertex AI.
    } catch (e) { console.error(e); }
}



// Get the generative model
// REMOVED: Static initialization replaced by dynamic fallback logic above
// const generativeModel = vertexAI.getGenerativeModel({ ... });


// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(__dirname));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    model: CONFIG.model,
    location: CONFIG.location 
  });
});

// Helper to execute tools against API
async function executeTool(name, args) {
    console.log(`🛠️ Executing Tool: ${name}`, args);
    const headers = { 'Content-Type': 'application/json' };
    
    try {
        let response;
        const api = CONFIG.mcpApiUrl;

        switch (name) {
            case 'create_journey_map':
                response = await fetch(`${api}/v1/journey-maps`, { method: 'POST', headers, body: JSON.stringify(args) });
                break;
            case 'update_journey_metadata':
                response = await fetch(`${api}/v1/journey-maps/${args.journeyMapId}`, { method: 'PATCH', headers, body: JSON.stringify(args) });
                break;
            case 'set_phases_bulk':
                response = await fetch(`${api}/v1/journey-maps/${args.journeyMapId}/phases`, { method: 'PUT', headers, body: JSON.stringify(args) });
                break;
            case 'set_swimlanes_bulk':
                response = await fetch(`${api}/v1/journey-maps/${args.journeyMapId}/swimlanes`, { method: 'PUT', headers, body: JSON.stringify(args) });
                break;
            case 'generate_matrix':
                response = await fetch(`${api}/v1/journey-maps/${args.journeyMapId}/generate-matrix`, { method: 'POST', headers, body: '{}' });
                break;
            case 'update_cell':
                response = await fetch(`${api}/v1/journey-maps/${args.journeyMapId}/cells/${args.cellId}`, { method: 'PUT', headers, body: JSON.stringify(args) });
                break;
            case 'generate_artifacts':
                response = await fetch(`${api}/v1/journey-maps/${args.journeyMapId}/generate-artifacts`, { method: 'POST', headers, body: '{}' });
                break;
            default:
                return { error: `Unknown tool: ${name}` };
        }

        if (!response.ok) {
            const txt = await response.text();
            console.error(`API Error: ${txt}`);
            return { error: txt };
        }
        return await response.json();

    } catch (e) {
        console.error("Tool execution error", e);
        return { error: e.message };
    }
}

// Chat endpoint with streaming and tools
app.post('/api/chat', async (req, res) => {
  const { message, history = [], config = {}, journeyId } = req.body;

  // Inject journeyId into config if present (from client state)
  if (journeyId) {
      config.journeyId = journeyId;
  }

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    contents.push({ role: 'user', parts: [{ text: message }] });

    // Send chat message to Vertex AI
    if (!activeGenerativeModel) {
        throw new Error("Generative model not yet initialized. Please wait.");
    }

    // Instantiate a request-specific model to inject dynamic system instructions
    let journeyState = null;
    if (config.journeyId) {
        journeyState = await getJourneyState(config.journeyId);
        if (journeyState) {
            console.log(`[JourneyDebug] ID: ${config.journeyId}`);
            console.log(`[JourneyDebug] Stage: ${journeyState.stage}`);
            console.log(`[JourneyDebug] Name: ${journeyState.name}`);
        } else {
            console.warn(`[JourneyDebug] Journey ID provided but state not found: ${config.journeyId}`);
        }
    } else {
        console.log(`[JourneyDebug] No Journey ID in request context.`);
    }

    const requestModel = vertexAI.getGenerativeModel({
        model: activeModelName,
        generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.4,
            topP: 0.9,
        },
        systemInstruction: {
            parts: [{ text: buildSystemInstruction(config, journeyState) }]
        },
        tools: JOURNEY_TOOLS
    });

    let currentTurn = 0;
    const maxTurns = 5;
    let finalDone = false;

    // Initial Generation
    let result = await requestModel.generateContent({ contents });
    let response = await result.response;
    
    while (currentTurn < maxTurns && !finalDone) {
        currentTurn++;
        
        // Check for Function Calls
        const functionCalls = response.candidates?.[0]?.content?.parts?.filter(p => p.functionCall);
        
        if (functionCalls && functionCalls.length > 0) {
            // Handle Tool Calls
            for (const call of functionCalls) {
                const fn = call.functionCall;
                const toolResult = await executeTool(fn.name, fn.args);
                
                // Send tool result back to model (multi-turn)
                const toolResponsePart = {
                    functionResponse: {
                        name: fn.name,
                        response: { content: toolResult }
                    }
                };
                
                // Add intermediate steps to history for the model
                contents.push(response.candidates[0].content); // Model's request
                contents.push({ role: 'function', parts: [toolResponsePart] }); // Tool result

                // If we created a journey, tell the frontend
                if (fn.name === 'create_journey_map' && toolResult.journeyMapId) {
                     config.journeyId = toolResult.journeyMapId; // Update local tracking
                     res.write(`data: ${JSON.stringify({ journeyId: toolResult.journeyMapId })}\n\n`);
                }
            }
            
            // Get next response after tools
            result = await requestModel.generateContent({ contents });
            response = await result.response;
        } else {
            // No function calls, this is the text response
            const finalText = response.candidates?.[0]?.content?.parts?.[0]?.text || "Processing...";
            res.write(`data: ${JSON.stringify({ text: finalText })}\n\n`);
            // Always echo back the journeyId to keep client in sync
            res.write(`data: ${JSON.stringify({ done: true, journeyId: config.journeyId })}\n\n`);
            finalDone = true;
        }
    }

    if (!finalDone) {
         // Fallback if loop hit maxTurns
         res.write(`data: ${JSON.stringify({ text: "I'm still thinking, but I hit a limit. Please continue." })}\n\n`);
         res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    }

    res.end();

  } catch (error) {
    console.error('Chat error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});


// Non-streaming chat endpoint (fallback)
app.post('/api/chat/sync', async (req, res) => {
  const { message, history = [], config = {} } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    contents.push({ role: 'user', parts: [{ text: message }] });

    let finalResponseText = "Thinking...";
    let maxTurns = 5;
    let currentTurn = 0;

    // Instantiate a request-specific model to inject dynamic system instructions
    let journeyState = null;
    if (config.journeyId) {
        journeyState = await getJourneyState(config.journeyId);
        if (journeyState) {
            console.log(`[JourneyDebug] ID: ${config.journeyId}`);
            console.log(`[JourneyDebug] Stage: ${journeyState.stage}`);
            console.log(`[JourneyDebug] Name: ${journeyState.name}`);
        } else {
            console.warn(`[JourneyDebug] Journey ID provided but state not found: ${config.journeyId}`);
        }
    } else {
        console.log(`[JourneyDebug] No Journey ID in request context.`);
    }

    const requestModel = vertexAI.getGenerativeModel({
        model: activeModelName,
        generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.4,
            topP: 0.9,
        },
        systemInstruction: {
            parts: [{ text: buildSystemInstruction(config, journeyState) }]
        },
        tools: JOURNEY_TOOLS
    });

    // Initial Generation
    let result = await requestModel.generateContent({ contents });
    let response = await result.response;
    
    let createdJourneyId = null;

    while (currentTurn < maxTurns) {
        currentTurn++;

        // Check for Function Calls
        const functionCalls = response.candidates?.[0]?.content?.parts?.filter(p => p.functionCall);

        if (functionCalls && functionCalls.length > 0) {
            // Handle Tool Calls (Multi-turn for Sync)
            for (const call of functionCalls) {
                const fn = call.functionCall;
                const toolResult = await executeTool(fn.name, fn.args);
                
                // Capture Journey ID if created
                if (fn.name === 'create_journey_map' && toolResult.journeyMapId) {
                    createdJourneyId = toolResult.journeyMapId;
                    config.journeyId = createdJourneyId; // Update local config
                }

                // Send tool result back to model (multi-turn)
                const toolResponsePart = {
                    functionResponse: {
                        name: fn.name,
                        response: { content: toolResult }
                    }
                };
                
                // Add intermediate steps to history for the model
                contents.push(response.candidates[0].content); // Model's request
                contents.push({ role: 'function', parts: [toolResponsePart] }); // Tool result
            }
            
            // Get next response after tools
            result = await requestModel.generateContent({ contents });
            response = await result.response;
        } else {
            // No more function calls, we have the text
            finalResponseText = response.candidates?.[0]?.content?.parts?.[0]?.text;
            break; 
        }
    }

    if (!finalResponseText) {
         // Fallback
         finalResponseText = response.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || "Processing...";
    }

    res.json({ response: finalResponseText, journeyId: createdJourneyId || config.journeyId });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate response' });
  }
});

// Proxy for Journey State
app.get('/api/journey-state/:id', async (req, res) => {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/v1/journey-maps/${req.params.id}`);
        if (!response.ok) return res.status(404).json({error: "Not found"});
        const data = await response.json();
        res.json(data);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

// Start server
app.listen(CONFIG.port, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   ███╗   ███╗    █████╗ ██╗  ██╗                          ║');
  console.log('║   ████╗ ████║   ██╔══██╗╚██╗██╔╝                          ║');
  console.log('║   ██╔████╔██║   ███████║ ╚███╔╝                           ║');
  console.log('║   ██║╚██╔╝██║   ██╔══██║ ██╔██╗                           ║');
  console.log('║   ██║ ╚═╝ ██║██╗██║  ██║██╔╝ ██╗                          ║');
  console.log('║   ╚═╝     ╚═╝╚═╝╚═╝  ╚═╝╚═╝  ╚═╝                          ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  🚀 Server running at http://localhost:${CONFIG.port}`);
  console.log(`  🤖 Model: Auto-detecting (Target: ${CONFIG.model || 'gemini-2.5-flash'})`);
  console.log(`  ☁️  Project: ${CONFIG.projectId}`);
  console.log(`  📍 Location: ${CONFIG.location}`);
  console.log('');
});
