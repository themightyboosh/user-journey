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
    private activeGenerativeModel: GenerativeModel | null = null;
    private activeModelName: string | null = null;
    
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
        // Enforce Gemini 2.5 Series Only (User Request: No Deprecated Models)
        const candidates = [
            preferredModel,
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite'
        ].filter((v, i, a) => v && a.indexOf(v) === i);

        // Minimal system instruction for ping check
        const systemInstruction = {
            role: 'system',
            parts: [{ text: "ping" }]
        };

        for (const modelName of candidates) {
            if (!modelName) continue;
            logger.info(`🤖 Attempting to initialize model: ${modelName}...`);
            try {
                const model = this.vertexAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        maxOutputTokens: 2048,
                        temperature: 0.4,
                        topP: 0.9,
                    },
                    systemInstruction,
                    tools: JOURNEY_TOOLS as any
                });
                
                // Ping
                const dummyResult = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: 'ping' }] }]
                });
                await dummyResult.response; 
                
                logger.info(`✅ Successfully initialized model: ${modelName}`);
                this.activeGenerativeModel = model;
                this.activeModelName = modelName;
                return model;
            } catch (e: any) {
                logger.warn(`⚠️ Failed to initialize ${modelName}: ${e.message}`);
            }
        }
        
        // Fallback to gemini-2.5-flash-lite if all else fails (safest bet in 2.5 series)
        logger.warn("Falling back to gemini-2.5-flash-lite without ping");
        this.activeModelName = 'gemini-2.5-flash-lite';
        this.activeGenerativeModel = this.vertexAI.getGenerativeModel({
             model: this.activeModelName,
             tools: JOURNEY_TOOLS as any
        });
        return this.activeGenerativeModel;
    }

    async switchToFallback() {
        const current = this.activeModelName;
        let next = 'gemini-2.5-flash'; // Default safe fallback
        
        if (current === 'gemini-2.5-pro') {
            next = 'gemini-2.5-flash';
        } else if (current === 'gemini-2.5-flash') {
            next = 'gemini-2.5-flash-lite';
        } else if (current === 'gemini-2.5-flash-lite') {
            // If lite fails, loop back to flash (transient check) or stick with lite
            next = 'gemini-2.5-flash'; 
        }
        
        logger.warn(`⚠️ Resource Exhausted (429) for ${current}. Switching to fallback: ${next}`);
        // Do NOT re-initialize activeGenerativeModel here, just return the name
        // We want the caller (server.ts) to handle the specific retry with this model name
        return next;
    }

    async getRequestModel(config: any, journeyState: any, overrideModel?: string) {
        try {
            const settings = await this.adminService.getSettings();
            
            // Determine which model to use:
            // 1. Explicit override (from fallback retry loop)
            // 2. Settings from Admin Panel
            // 3. Currently active model
            let targetModel = overrideModel || settings.activeModel || this.activeModelName;

            // If we need to switch the "Active" model (and it's not just a temporary override)
            // OR if the model isn't initialized yet
            if (!this.activeGenerativeModel || (!overrideModel && this.activeModelName !== targetModel)) {
                 logger.info(`🔄 Switching active model to ${targetModel}`);
                 await this.initialize(targetModel);
            }

            // Fetch Knowledge Context
            const knowledgeIds = config.knowledgeIds || null;
            
            // Use AdminService directly to avoid 'this' context issues with local helper methods
            const knowledgeBases = await this.adminService.getKnowledge();
            
            // Filter manually since we are bypassing the wrapper
            let activeKnowledge = [];
            if (knowledgeIds && Array.isArray(knowledgeIds) && knowledgeIds.length > 0) {
                activeKnowledge = knowledgeBases.filter((k: any) => knowledgeIds.includes(k.id));
            } else if (knowledgeIds && typeof knowledgeIds === 'string') {
                 const match = knowledgeBases.find((k: any) => k.id === knowledgeIds);
                 activeKnowledge = match ? [match] : [];
            } else {
                activeKnowledge = knowledgeBases.filter((k: any) => k.isActive);
            }
            
            // Concatenate content
            const contextInjection = activeKnowledge.map((kb: any) => 
                `\n### KNOWLEDGE BASE: ${kb.title}\n${kb.content}\n`
            ).join("\n");

            const fullConfig = { 
                ...config, 
                agentName: settings.agentName,
                knowledgeContext: contextInjection
            };

            // Return a fresh GenerativeModel instance with the specific system instructions for this chat turn
            // This does NOT affect the global tool-enabled model unless we re-initialized above
            return this.vertexAI.getGenerativeModel({
                model: targetModel!,
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
        } catch (error: any) {
            logger.error("Error in getRequestModel", { error: error.message, stack: error.stack });
            throw error;
        }
    }

    get ActiveModelName() {
        return this.activeModelName;
    }

    // --- Background Processing (Simulating BullMQ Worker) ---
    // NOTE: In a full scale implementation, this would be offloaded to a Redis queue via BullMQ.
    private async triggerBackgroundSummaries(journeyId: string, phaseId: string, swimlaneId: string) {
        logger.info(`[Background] Checking summaries for Journey: ${journeyId}`);

        // 1. Check Phase Completion
        const isPhaseComplete = await this.journeyService.checkPhaseCompletion(journeyId, phaseId);
        if (isPhaseComplete) {
            const journey = await this.journeyService.getJourney(journeyId);
            const phase = journey?.phases.find(p => p.phaseId === phaseId);
            
            // Check if summary already exists to avoid re-gen (unless we want to update it?)
            // For now, only generate if empty or simple update. 
            // Actually, prompts say "When cells... are complete". We should generate it.
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
            if (!this.activeGenerativeModel) return null;

            const cellContext = cells.map(c => `- ${c.headline}: ${c.description}`).join('\n');
            const prompt = `
            ${instruction}
            Keep it concise (1-2 sentences). Focus on the key insight or pain point.
            
            DATA:
            ${cellContext}
            `;

            const result = await this.activeGenerativeModel.generateContent({
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

                    // Trigger Background Summarization (Fire and Forget)
                    if (pId && sId) {
                        this.triggerBackgroundSummaries(args.journeyMapId, pId, sId).catch(err => logger.error("Background Summary Error", err));
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
