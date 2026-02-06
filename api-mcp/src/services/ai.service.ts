import { VertexAI, GenerativeModel } from '@google-cloud/vertexai';
import { buildSystemInstruction } from '../ai/prompts';
import { JOURNEY_TOOLS } from '../ai/tools';
import { JourneyService } from './journey.service';
import { AdminService } from './admin.service';
import logger from '../logger';

export class AIService {
    static instance: AIService;
    private vertexAI: VertexAI;
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
        // Enforce Gemini 2.5 Series (Correct IDs without -001)
        const candidates = [
            preferredModel,
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
            // Fallbacks
            'gemini-2.0-flash-001',
            'gemini-1.5-pro-002',
            'gemini-1.5-flash-002'
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
        
        // Fallback to gemini-1.5-flash-002 if all else fails (safest bet)
        logger.warn("Falling back to gemini-1.5-flash-002 without ping");
        this.activeModelName = 'gemini-1.5-flash-002';
        this.activeGenerativeModel = this.vertexAI.getGenerativeModel({
             model: this.activeModelName,
             tools: JOURNEY_TOOLS as any
        });
        return this.activeGenerativeModel;
    }

    async getJourneyState(journeyId: string) {
        return await this.journeyService.getJourney(journeyId);
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
    
                    if (!targetCellId && args.phaseName && args.swimlaneName) {
                        const journey = await this.getJourneyState(args.journeyMapId);
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
    
                    return await this.journeyService.updateCell(args.journeyMapId, targetCellId, args);

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

    async getSettings() {
        return await this.adminService.getSettings();
    }

    async getKnowledge(ids: string | string[] | null) {
        const allKnowledge = await this.adminService.getKnowledge();
        
        if (ids && Array.isArray(ids) && ids.length > 0) {
            // Return specific KBs requested
            return allKnowledge.filter((k: any) => ids.includes(k.id));
        } else if (ids && typeof ids === 'string') {
             // Single ID legacy support
             const match = allKnowledge.find((k: any) => k.id === ids);
             return match ? [match] : [];
        } else {
            // Otherwise return all ACTIVE knowledge bases
            return allKnowledge.filter((k: any) => k.isActive);
        }
    }

    async getRequestModel(config: any, journeyState: any) {
        const settings = await this.getSettings();

        // Check if we need to switch models based on settings
        if (this.activeGenerativeModel && settings.activeModel && this.activeModelName !== settings.activeModel) {
            logger.info(`🔄 Switching model from ${this.activeModelName} to ${settings.activeModel}`);
            this.activeGenerativeModel = null;
        }

        if (!this.activeGenerativeModel) {
            await this.initialize(settings.activeModel);
        }

        // Fetch Knowledge Context
        const knowledgeIds = config.knowledgeIds || null;
        const knowledgeBases = await this.getKnowledge(knowledgeIds);
        
        // Concatenate content
        const contextInjection = knowledgeBases.map((kb: any) => 
            `\n### KNOWLEDGE BASE: ${kb.title}\n${kb.content}\n`
        ).join("\n");

        const fullConfig = { 
            ...config, 
            agentName: settings.agentName,
            knowledgeContext: contextInjection
        };

        if (!this.activeGenerativeModel) throw new Error("Model failed to initialize");

        return this.vertexAI.getGenerativeModel({
            model: this.activeModelName!,
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
    }

    get ActiveModelName() {
        return this.activeModelName;
    }
}
