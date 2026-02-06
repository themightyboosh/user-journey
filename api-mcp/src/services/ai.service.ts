import { VertexAI, GenerativeModel } from '@google-cloud/vertexai';
import { buildSystemInstruction } from '../ai/prompts';
import { JOURNEY_TOOLS } from '../ai/tools';
import { JourneyService } from './journey.service';
import { AdminService } from './admin.service';
import logger from '../logger';

export class AIService {
    static instance: AIService;
    private vertexAI!: VertexAI;
    private config: any;
    private activeModelName: string = 'gemini-2.5-flash-lite'; // Default safe fallback

    // Services
    private journeyService = JourneyService.getInstance();
    private adminService = AdminService.getInstance();

    constructor() {
        if (AIService.instance) {
            return AIService.instance;
        }

        this.config = {
            projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'journey-mapper-ai-8822',
            location: process.env.VERTEX_AI_LOCATION || 'us-central1'
        };

        this.vertexAI = new VertexAI({
            project: this.config.projectId,
            location: this.config.location,
        });

        AIService.instance = this;
    }

    static getInstance() {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    async initialize(preferredModel: string | null = null) {
        // Just a health check now - stateless!
        const modelName = preferredModel || 'gemini-2.5-flash-lite';
        logger.info(`🤖 Health Check for model: ${modelName}...`);
        
        try {
            const model = this.vertexAI.getGenerativeModel({
                model: modelName
            });
            await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'ping' }] }]
            });
            logger.info(`✅ Health Check Passed: ${modelName}`);
            this.activeModelName = modelName; // Update internal default
            return model;
        } catch (e: any) {
            logger.warn(`⚠️ Health Check Failed ${modelName}: ${e.message}`);
            return null;
        }
    }

    // Pure function for fallback logic
    getNextFallback(currentModel: string): string {
        if (currentModel === 'gemini-2.5-pro') return 'gemini-2.5-flash';
        if (currentModel === 'gemini-2.5-flash') return 'gemini-2.5-flash-lite';
        if (currentModel === 'gemini-2.5-flash-lite') return 'gemini-2.5-flash';
        return 'gemini-2.5-flash';
    }

    // Deprecated stateful method - kept for now to avoid breaking existing server.ts too hard before refactor
    async switchToFallback() {
        const next = this.getNextFallback(this.activeModelName);
        this.activeModelName = next;
        return next;
    }

    async getRequestModel(config: any, journeyState: any, overrideModel?: string) {
        try {
            // AdminService is now cached, so this is fast!
            const settings = await this.adminService.getSettings();
            
            // Determine which model to use:
            let targetModel = overrideModel || settings.activeModel || 'gemini-2.5-flash-lite';
            this.activeModelName = targetModel; // Update last used for logging/state compatibility

            // Fetch Knowledge Context (Cached via AdminService)
            const knowledgeIds = config.knowledgeIds || null;
            const knowledgeBases = await this.adminService.getKnowledge();
            
            let activeKnowledge = [];
            if (knowledgeIds && Array.isArray(knowledgeIds) && knowledgeIds.length > 0) {
                activeKnowledge = knowledgeBases.filter((k: any) => knowledgeIds.includes(k.id));
            } else if (knowledgeIds && typeof knowledgeIds === 'string') {
                 const match = knowledgeBases.find((k: any) => k.id === knowledgeIds);
                 activeKnowledge = match ? [match] : [];
            } else {
                activeKnowledge = knowledgeBases.filter((k: any) => k.isActive);
            }
            
            const contextInjection = activeKnowledge.map((kb: any) => 
                `\n### KNOWLEDGE BASE: ${kb.title}\n${kb.content}\n`
            ).join("\n");

            const fullConfig = { 
                ...config, 
                agentName: settings.agentName,
                knowledgeContext: contextInjection
            };

            const model = this.vertexAI.getGenerativeModel({
                model: targetModel,
                generationConfig: {
                    maxOutputTokens: 2048,
                    temperature: 0.4,
                    topP: 0.9,
                },
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: buildSystemInstruction(fullConfig, journeyState) }]
                },
                tools: JOURNEY_TOOLS as any
            });

            // Return both model and name
            return { model, modelName: targetModel };

        } catch (error: any) {
            logger.error("Error in getRequestModel", { error: error.message, stack: error.stack });
            throw error;
        }
    }

    get ActiveModelName() {
        return this.activeModelName;
    }

    // --- Background Processing ---
    private async triggerBackgroundSummaries(journeyId: string, phaseId: string, swimlaneId: string) {
        // ... implementation
        logger.info(`[Background] Checking summaries for Journey: ${journeyId}`);

        // 1. Check Phase Completion
        const isPhaseComplete = await this.journeyService.checkPhaseCompletion(journeyId, phaseId);
        if (isPhaseComplete) {
            const journey = await this.journeyService.getJourney(journeyId);
            const phase = journey?.phases.find(p => p.phaseId === phaseId);
            
            if (journey && phase) {
                 const cells = journey.cells.filter(c => c.phaseId === phaseId);
                 const summary = await this.generateSummary(
                     `Summarize the user's experience specifically during the "${phase.name}" phase.`,
                     cells
                 );
                 if (summary) {
                     await this.journeyService.savePhaseSummary(journeyId, phaseId, summary);
                 }
            }
        }

        // 2. Check Swimlane Completion
        const isSwimlaneComplete = await this.journeyService.checkSwimlaneCompletion(journeyId, swimlaneId);
        if (isSwimlaneComplete) {
            const journey = await this.journeyService.getJourney(journeyId);
            const swimlane = journey?.swimlanes.find(s => s.swimlaneId === swimlaneId);
            
            if (journey && swimlane) {
                 const cells = journey.cells.filter(c => c.swimlaneId === swimlaneId);
                 const summary = await this.generateSummary(
                     `Summarize the user's experience related to "${swimlane.name}" across the entire journey.`,
                     cells
                 );
                 if (summary) {
                     await this.journeyService.saveSwimlaneSummary(journeyId, swimlaneId, summary);
                 }
            }
        }
    }

    private async generateSummary(instruction: string, cells: any[]): Promise<string | null> {
        try {
            // Get fresh model based on current settings
            const settings = await this.adminService.getSettings();
            const modelName = settings.activeModel || 'gemini-2.5-flash-lite';
            
            const model = this.vertexAI.getGenerativeModel({
                model: modelName
            });

            const cellContext = cells.map(c => `- ${c.headline}: ${c.description}`).join('\n');
            const prompt = `
            ${instruction}
            Keep it concise (1-2 sentences). Focus on the key insight or pain point.
            
            DATA:
            ${cellContext}
            `;

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });
            const response = await result.response;
            return response.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (e) {
            logger.error("Summary Generation Failed", e);
            return null;
        }
    }

    async getJourneyState(id: string) {
        return await this.journeyService.getJourney(id);
    }

    async executeTool(name: string, args: any) {
        logger.info(`🛠️ Executing Tool: ${name}`, args);
        
        try {
            switch (name) {
                case 'create_journey_map':
                    return await this.journeyService.createJourney(args);
                case 'update_journey_metadata':
                    return await this.journeyService.updateMetadata(args.journeyMapId, args);
                case 'set_phases_bulk':
                    return await this.journeyService.setPhasesBulk(args.journeyMapId, args.phases);
                case 'set_swimlanes_bulk':
                    return await this.journeyService.setSwimlanesBulk(args.journeyMapId, args.swimlanes);
                case 'generate_matrix':
                    return await this.journeyService.generateMatrix(args.journeyMapId);
                case 'update_cell':
                    let targetCellId = args.cellId;
                    let pId = null;
                    let sId = null;
    
                    if (!targetCellId && args.phaseName && args.swimlaneName) {
                        const journey = await this.journeyService.getJourney(args.journeyMapId);
                        if (journey) {
                            const findMatch = (list: any[], name: string) => list.find(item => item.name.toLowerCase().trim() === name.toLowerCase().trim());
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

                    // Get IDs for summarization trigger
                    if (targetCellId) {
                         const journey = await this.journeyService.getJourney(args.journeyMapId);
                         const cell = journey?.cells.find(c => c.cellId === targetCellId);
                         if (cell) {
                             pId = cell.phaseId;
                             sId = cell.swimlaneId;
                         }
                    }
    
                    const result = await this.journeyService.updateCell(args.journeyMapId, targetCellId, args);

                    // Trigger Background Summarization (Serialized to prevent race conditions)
                    if (pId && sId) {
                        try {
                            await this.triggerBackgroundSummaries(args.journeyMapId, pId, sId);
                        } catch (err) {
                            logger.error("Background Summary Error", err);
                        }
                    }

                    return result;

                case 'generate_artifacts':
                    return await this.journeyService.generateArtifacts(args.journeyMapId, args);
                    
                default:
                    return { error: `Unknown tool: ${name}` };
            }
    
        } catch (e: any) {
            logger.error("Tool execution error", e);
            return { error: e.message };
        }
    }
}
