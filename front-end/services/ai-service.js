import { VertexAI } from '@google-cloud/vertexai';
import { buildSystemInstruction } from '../config/prompts.js';
import { JOURNEY_TOOLS } from '../config/tools.js';

export class AIService {
    static instance;
    
    constructor() {
        if (AIService.instance) {
            return AIService.instance;
        }

        this.config = {
            projectId: process.env.GOOGLE_CLOUD_PROJECT,
            location: process.env.VERTEX_AI_LOCATION || 'us-central1',
            mcpApiUrl: process.env.MCP_API_URL || 'http://localhost:3001'
        };

        this.vertexAI = new VertexAI({
            project: this.config.projectId,
            location: this.config.location,
        });

        this.activeGenerativeModel = null;
        this.activeModelName = null;

        AIService.instance = this;
    }

    static getInstance() {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    async initialize(preferredModel = null) {
        const candidates = [
            preferredModel,
            process.env.VERTEX_AI_MODEL,
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-2.5-flash-lite',
            'gemini-2.0-flash-001',
            'gemini-2.0-flash-lite-preview-02-05',
            'gemini-1.5-flash-002'
        ].filter((v, i, a) => v && a.indexOf(v) === i);

        // Minimal system instruction for ping check
        const systemInstruction = {
            parts: [{ text: "ping" }]
        };

        for (const modelName of candidates) {
            console.log(`🤖 Attempting to initialize model: ${modelName}...`);
            try {
                const model = this.vertexAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        maxOutputTokens: 2048,
                        temperature: 0.4,
                        topP: 0.9,
                    },
                    systemInstruction,
                    tools: JOURNEY_TOOLS
                });
                
                // Ping
                const dummyResult = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: 'ping' }] }]
                });
                await dummyResult.response; 
                
                console.log(`✅ Successfully initialized model: ${modelName}`);
                this.activeGenerativeModel = model;
                this.activeModelName = modelName;
                return model;
            } catch (e) {
                console.warn(`⚠️ Failed to initialize ${modelName}: ${e.message}`);
            }
        }
        
        throw new Error("CRITICAL: No working Vertex AI model found in candidates list.");
    }

    async getJourneyState(journeyId) {
        try {
            const response = await fetch(`${this.config.mcpApiUrl}/v1/journey-maps/${journeyId}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            console.error("Failed to fetch journey state:", e);
            return null;
        }
    }

    async executeTool(name, args) {
        console.log(`🛠️ Executing Tool: ${name}`, args);
        const headers = { 'Content-Type': 'application/json' };
        
        try {
            let response;
            const api = this.config.mcpApiUrl;
    
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
                    let targetCellId = args.cellId;
    
                    if (!targetCellId && args.phaseName && args.swimlaneName) {
                        const journey = await this.getJourneyState(args.journeyMapId);
                        if (journey) {
                            const findMatch = (list, name) => list.find(item => item.name.toLowerCase().trim() === name.toLowerCase().trim());
                            const phase = findMatch(journey.phases, args.phaseName);
                            const swimlane = findMatch(journey.swimlanes, args.swimlaneName);
                            
                            if (phase && swimlane) {
                                const cell = journey.cells.find(c => c.phaseId === phase.phaseId && c.swimlaneId === swimlane.swimlaneId);
                                if (cell) targetCellId = cell.cellId;
                            }
                        }
                    }
    
                    if (!targetCellId) {
                        return { error: "Missing cellId and could not resolve phaseName/swimlaneName to a valid cell." };
                    }
    
                    response = await fetch(`${api}/v1/journey-maps/${args.journeyMapId}/cells/${targetCellId}`, { method: 'PUT', headers, body: JSON.stringify(args) });
                    break;
                case 'generate_artifacts':
                    response = await fetch(`${api}/v1/journey-maps/${args.journeyMapId}/generate-artifacts`, { 
                        method: 'POST', 
                        headers, 
                        body: JSON.stringify(args)
                    });
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

    async getSettings() {
        try {
            const response = await fetch(`${this.config.mcpApiUrl}/api/admin/settings`);
            if (!response.ok) return { agentName: "Max" };
            return await response.json();
        } catch (e) {
            console.error("Failed to fetch settings:", e);
            return { agentName: "Max" };
        }
    }

    async getKnowledge(ids = null) {
        try {
            const response = await fetch(`${this.config.mcpApiUrl}/api/admin/knowledge`);
            if (!response.ok) return [];
            const allKnowledge = await response.json();
            
            if (ids && Array.isArray(ids) && ids.length > 0) {
                // Return specific KBs requested
                return allKnowledge.filter(k => ids.includes(k.id));
            } else if (ids && !Array.isArray(ids)) {
                 // Single ID legacy support
                 const match = allKnowledge.find(k => k.id === ids);
                 return match ? [match] : [];
            } else {
                // Otherwise return all ACTIVE knowledge bases
                return allKnowledge.filter(k => k.isActive);
            }
        } catch (e) {
            console.error("Failed to fetch knowledge:", e);
            return [];
        }
    }

    async getRequestModel(config, journeyState) {
        const settings = await this.getSettings();

        // Check if we need to switch models based on settings
        if (this.activeGenerativeModel && settings.activeModel && this.activeModelName !== settings.activeModel) {
            console.log(`🔄 Switching model from ${this.activeModelName} to ${settings.activeModel}`);
            this.activeGenerativeModel = null;
        }

        if (!this.activeGenerativeModel) {
            await this.initialize(settings.activeModel);
        }

        // Fetch Knowledge Context
        // Priority: 1. Config IDs (URL), 2. Default Active
        const knowledgeIds = config.knowledgeIds || null;
        const knowledgeBases = await this.getKnowledge(knowledgeIds);
        
        // Concatenate content
        const contextInjection = knowledgeBases.map(kb => 
            `\n### KNOWLEDGE BASE: ${kb.title}\n${kb.content}\n`
        ).join("\n");

        const fullConfig = { 
            ...config, 
            agentName: settings.agentName,
            knowledgeContext: contextInjection
        };

        return this.vertexAI.getGenerativeModel({
            model: this.activeModelName,
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: 0.4,
                topP: 0.9,
            },
            systemInstruction: {
                parts: [{ text: buildSystemInstruction(fullConfig, journeyState) }]
            },
            tools: JOURNEY_TOOLS
        });
    }
}
