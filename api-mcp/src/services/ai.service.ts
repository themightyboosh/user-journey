import { VertexAI, GenerativeModel, HarmCategory, HarmBlockThreshold, FunctionCallingMode } from '@google-cloud/vertexai';
import { buildSystemInstruction, SessionConfig } from '../ai/prompts';
import { JOURNEY_TOOLS, TOOL_SCOPES } from '../ai/tools';
import { JourneyService } from './journey.service';
import { AdminService } from './admin.service';
import logger from '../logger';

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

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
            projectId: 'journey-mapper-ai-8822', // Hardcoded to match deployed project
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
                model: modelName,
                safetySettings: SAFETY_SETTINGS
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

    /**
     * Determine appropriate maxOutputTokens based on current journey stage.
     * Artifact generation (CELL_POPULATION late / COMPLETE) needs more tokens
     * for the full summary, mental models, and quotes.
     */
    private getMaxOutputTokens(journeyState: any): number {
        if (!journeyState) return 2048;
        const stage = journeyState.stage;
        // Artifact generation and completion need significantly more room
        if (stage === 'COMPLETE') return 4096;
        // Late cell population where ethnographic questions + final check happen
        if (stage === 'CELL_POPULATION' && journeyState.metrics) {
            const pct = journeyState.metrics.percentCellsComplete;
            if (pct >= 80) return 3072; // Near completion, model will produce longer synthesis
        }
        return 2048;
    }

    async getRequestModel(config: SessionConfig, journeyState: any, overrideModel?: string, forceToolCalling: boolean = false) {
        try {
            // AdminService is now cached, so this is fast!
            const settings = await this.adminService.getSettings();

            // Determine which model to use:
            let targetModel = overrideModel || settings.activeModel || 'gemini-2.5-flash-lite';
            this.activeModelName = targetModel; // Update last used for logging/state compatibility

            // Build knowledge context from ragContext (inline text from link config)
            let contextInjection = '';
            if (config.ragContext && typeof config.ragContext === 'string' && config.ragContext.trim().length > 0) {
                contextInjection = `\n### ADDITIONAL CONTEXT\n${config.ragContext.trim()}\n`;
            }

            const fullConfig: SessionConfig = {
                ...config,
                agentName: settings.agentName,
                knowledgeContext: contextInjection
            };

            const maxOutputTokens = this.getMaxOutputTokens(journeyState);

            // PHASE 4: Tool Scoping ("Blinders Strategy")
            // Filter available tools based on current stage to prevent impossible operations
            const currentStage = journeyState?.stage || 'IDENTITY';
            const allowedToolNames = TOOL_SCOPES[currentStage] || Object.keys(TOOL_SCOPES).flatMap(k => TOOL_SCOPES[k]);

            const scopedTools = JOURNEY_TOOLS.map(toolGroup => ({
                functionDeclarations: toolGroup.functionDeclarations.filter(
                    (tool: any) => allowedToolNames.includes(tool.name)
                )
            })).filter(toolGroup => toolGroup.functionDeclarations.length > 0);

            logger.info(`🔍 Tool Scoping: Stage=${currentStage}, Allowed=[${allowedToolNames.join(', ')}]`);

            // Determine function calling mode based on context
            // CRITICAL: Force tool calling ONLY when confirmation response detected
            // This prevents hallucination during structure definition (PHASES/SWIMLANES gates)
            //
            // IMPORTANT: Do NOT force mode=ANY during CELL_POPULATION
            // - CELL_POPULATION requires alternating pattern: Question → User Response → Tool Call → Repeat
            // - mode=ANY forces tool calls on EVERY turn, causing AI to guess/hallucinate cell content
            // - Instead, rely on strong prompt instructions ("ONE CELL PER TURN", "NEXT TARGET CELL")
            // - mode=AUTO allows AI to call tools after user responses, but also acknowledge with text
            const shouldForceTools = forceToolCalling;  // Only force on confirmation responses (PHASES/SWIMLANES)

            const toolMode = shouldForceTools ? FunctionCallingMode.ANY : FunctionCallingMode.AUTO;

            const model = this.vertexAI.getGenerativeModel({
                model: targetModel,
                safetySettings: SAFETY_SETTINGS,
                generationConfig: {
                    maxOutputTokens,
                    temperature: 0.4,
                    topP: 0.9,
                },
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: buildSystemInstruction(fullConfig, journeyState) }]
                },
                tools: scopedTools as any,
                toolConfig: {
                    functionCallingConfig: {
                        mode: toolMode
                    }
                }
            });

            const modeLabel = toolMode === FunctionCallingMode.ANY ? 'ANY (FORCED)' : 'AUTO';
            logger.info(`🔧 Tool Calling Mode: ${modeLabel} (stage: ${journeyState?.stage || 'N/A'})${forceToolCalling ? ' - Confirmation detected' : ''}`, {
                model: targetModel,
                toolMode: modeLabel,
                maxOutputTokens,
                stage: journeyState?.stage || 'N/A',
                forceToolCalling,
                allowedTools: allowedToolNames,
                scopedToolsCount: scopedTools.reduce((acc: number, tg: any) => acc + tg.functionDeclarations.length, 0),
                journeyId: fullConfig.journeyId || null,
                promptVersion: buildSystemInstruction.length // Approximate prompt size
            });

            // Return both model and name
            return { model, modelName: targetModel };

        } catch (error: any) {
            logger.error("Error in getRequestModel", { error: error.message, stack: error.stack });
            throw error;
        }
    }

    /**
     * STABILITY FIX: Generate with exponential backoff retry
     * Handles 429 (Rate Limit), 500 (Model Overloaded), and network flakes
     * Prevents "Brief Hiccup" errors from reaching the user
     */
    async generateWithRetry(model: any, request: any, retries = 3, context?: any): Promise<any> {
        try {
            const result = await model.generateContent(request);
            return result;
        } catch (error: any) {
            const isRetryable =
                error.status === 429 ||
                error.status === 500 ||
                error.message?.includes('429') ||
                error.message?.includes('RESOURCE_EXHAUSTED') ||
                error.message?.includes('503') ||
                error.message?.includes('timeout');

            if (isRetryable && retries > 0) {
                const delay = 1000 * (4 - retries); // 1s, 2s, 3s exponential backoff
                logger.warn(`⚠️ Generation failed, retrying in ${delay}ms... (${retries} attempts left)`, {
                    error: error.message,
                    errorName: error.name,
                    errorCode: error.code,
                    status: error.status,
                    retriesLeft: retries,
                    delay,
                    model: this.activeModelName,
                    requestContext: context || {}
                });

                await new Promise(resolve => setTimeout(resolve, delay));
                return this.generateWithRetry(model, request, retries - 1, context);
            }

            // Final failure bubbles up
            logger.error('❌ Generation failed after all retries', {
                timestamp: new Date().toISOString(),
                error: error.message,
                errorName: error.name,
                errorCode: error.code,
                status: error.status,
                stack: error.stack,
                retriesExhausted: retries === 0,
                model: this.activeModelName,
                requestContext: context || {},
                isRetryable
            });
            throw error;
        }
    }

    get ActiveModelName() {
        return this.activeModelName;
    }

    // --- Background Processing ---
    private async triggerBackgroundSummaries(journeyId: string, phaseId: string, swimlaneId: string) {
        logger.info(`[Background] Checking summaries for Journey: ${journeyId}`);

        // Fetch journey ONCE for both checks (reduces Firestore reads)
        const journey = await this.journeyService.getJourney(journeyId);
        if (!journey) return;

        // 1. Check Phase Completion
        const phaseCells = journey.cells.filter(c => c.phaseId === phaseId);
        const isPhaseComplete = phaseCells.length > 0 && 
            phaseCells.every(c => c.headline && c.description && c.headline.trim() !== '' && c.description.trim() !== '');

        if (isPhaseComplete) {
            const phase = journey.phases.find(p => p.phaseId === phaseId);
            if (phase) {
                const summary = await this.generateSummary(
                    `Summarize the user's experience specifically during the "${phase.name}" phase.`,
                    phaseCells
                );
                if (summary) {
                    await this.journeyService.savePhaseSummary(journeyId, phaseId, summary);
                }
            }
        }

        // 2. Check Swimlane Completion
        const swimlaneCells = journey.cells.filter(c => c.swimlaneId === swimlaneId);
        const isSwimlaneComplete = swimlaneCells.length > 0 &&
            swimlaneCells.every(c => c.headline && c.description && c.headline.trim() !== '' && c.description.trim() !== '');

        if (isSwimlaneComplete) {
            const swimlane = journey.swimlanes.find(s => s.swimlaneId === swimlaneId);
            if (swimlane) {
                const summary = await this.generateSummary(
                    `Summarize the user's experience related to "${swimlane.name}" across the entire journey.`,
                    swimlaneCells
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
                model: modelName,
                safetySettings: SAFETY_SETTINGS
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

    /**
     * Get remaining cells info for a journey.
     * Returns a structured breakdown of completed vs. remaining cells.
     */
    async getCellsRemaining(journeyId: string) {
        const journey = await this.journeyService.getJourney(journeyId);
        if (!journey) return null;

        const remaining: Array<{ phase: string; swimlane: string; phaseId: string; swimlaneId: string; cellId: string }> = [];
        const completed: Array<{ phase: string; swimlane: string; headline: string }> = [];

        for (const cell of journey.cells) {
            const phase = journey.phases.find(p => p.phaseId === cell.phaseId);
            const swimlane = journey.swimlanes.find(s => s.swimlaneId === cell.swimlaneId);
            const phaseName = phase?.name || 'Unknown';
            const swimlaneName = swimlane?.name || 'Unknown';

            const isDone = cell.headline && cell.headline.trim().length > 0 
                        && cell.description && cell.description.trim().length > 0;

            if (isDone) {
                completed.push({ phase: phaseName, swimlane: swimlaneName, headline: cell.headline });
            } else {
                remaining.push({ 
                    phase: phaseName, 
                    swimlane: swimlaneName,
                    phaseId: cell.phaseId,
                    swimlaneId: cell.swimlaneId,
                    cellId: cell.cellId
                });
            }
        }

        return {
            journeyId,
            stage: journey.stage,
            totalCells: journey.cells.length,
            completedCount: completed.length,
            remainingCount: remaining.length,
            percentComplete: journey.cells.length > 0 
                ? Math.round((completed.length / journey.cells.length) * 100) 
                : 0,
            remaining,
            completed
        };
    }

    async executeTool(name: string, args: any) {
        logger.info(`🛠️ Executing Tool: ${name}`, {
            toolName: name,
            args,
            timestamp: new Date().toISOString()
        });

        try {
            switch (name) {
                case 'create_journey_map': {
                    logger.info('Creating journey map', { args });
                    return await this.journeyService.createJourney(args);
                }
                case 'update_journey_metadata': {
                    logger.info('Updating journey metadata', { journeyId: args.journeyMapId, fields: Object.keys(args) });
                    return await this.journeyService.updateMetadata(args.journeyMapId, args);
                }
                case 'set_phases_bulk': {
                    logger.info('Setting phases bulk', {
                        journeyId: args.journeyMapId,
                        phasesCount: args.phases?.length || 0,
                        phases: args.phases?.map((p: any) => ({ name: p.name, hasDescription: !!p.description }))
                    });
                    return await this.journeyService.setPhasesBulk(args.journeyMapId, args.phases);
                }
                case 'set_swimlanes_bulk': {
                    logger.info('Setting swimlanes bulk', {
                        journeyId: args.journeyMapId,
                        swimlanesCount: args.swimlanes?.length || 0,
                        swimlanes: args.swimlanes?.map((s: any) => ({ name: s.name, hasDescription: !!s.description }))
                    });
                    return await this.journeyService.setSwimlanesBulk(args.journeyMapId, args.swimlanes);
                }
                case 'generate_matrix': {
                    logger.info('Generating matrix', { journeyId: args.journeyMapId });
                    return await this.journeyService.generateMatrix(args.journeyMapId);
                }
                case 'update_cell': {
                    logger.info('Tool: update_cell START', { 
                        journeyId: args.journeyMapId, 
                        cellId: args.cellId,
                        headline: args.headline?.substring(0, 50)
                    });

                    // Fetch journey ONCE for all resolution needs (was 3 reads, now 1)
                    const journey = await this.journeyService.getJourney(args.journeyMapId);
                    if (!journey) return { error: "Journey not found" };

                    let targetCellId = args.cellId;
                    let pId: string | null = null;
                    let sId: string | null = null;
    
                    if (!targetCellId && args.phaseName && args.swimlaneName) {
                        const findMatch = (list: any[], name: string) => list.find(item => item.name.toLowerCase().trim() === name.toLowerCase().trim());
                        const phase = findMatch(journey.phases, args.phaseName);
                        const swimlane = findMatch(journey.swimlanes, args.swimlaneName);
                        
                        if (phase && swimlane) {
                            const cell = journey.cells.find(c => c.phaseId === phase.phaseId && c.swimlaneId === swimlane.swimlaneId);
                            if (cell) {
                                targetCellId = cell.cellId;
                                pId = phase.phaseId;
                                sId = swimlane.swimlaneId;
                            }
                        }
                    }
    
                    if (!targetCellId) {
                        logger.error('Tool: update_cell FAILED - Target not resolved', { args });
                        return { error: "Missing cellId and could not resolve phaseName/swimlaneName to a valid cell." };
                    }

                    // Get IDs for summarization trigger (using already-fetched journey)
                    if (!pId || !sId) {
                        const cell = journey.cells.find(c => c.cellId === targetCellId);
                        if (cell) {
                            pId = cell.phaseId;
                            sId = cell.swimlaneId;
                        }
                    }
    
                    const result = await this.journeyService.updateCell(args.journeyMapId, targetCellId, args);

                    if (!result) {
                        logger.error('Tool: update_cell FAILED - Service returned null', { journeyId: args.journeyMapId, targetCellId });
                    } else {
                        logger.info('Tool: update_cell SUCCESS', { journeyId: args.journeyMapId, targetCellId });
                    }

                    // Fire-and-forget background summarization (don't block the response)
                    if (pId && sId) {
                        this.triggerBackgroundSummaries(args.journeyMapId, pId, sId)
                            .catch(err => logger.error("Background Summary Error", err));
                    }

                    return result;
                }

                case 'update_ethnographic_progress': {
                    logger.info('Updating ethnographic progress', {
                        journeyId: args.journeyMapId,
                        questionType: args.questionType
                    });
                    return await this.journeyService.updateEthnographicProgress(args.journeyMapId, args.questionType);
                }

                case 'generate_artifacts': {
                    logger.info('Generating artifacts', {
                        journeyId: args.journeyMapId,
                        hasSummary: !!args.summaryOfFindings,
                        hasModels: !!args.mentalModels,
                        quotesCount: args.quotes?.length || 0
                    });
                    return await this.journeyService.generateArtifacts(args.journeyMapId, args);
                }

                default: {
                    logger.error('Unknown tool called', { toolName: name, args });
                    return { error: `Unknown tool: ${name}` };
                }
            }

        } catch (e: any) {
            logger.error("🚨 Tool execution error", {
                timestamp: new Date().toISOString(),
                toolName: name,
                error: e.message,
                errorName: e.name,
                stack: e.stack,
                args,
                journeyId: args?.journeyMapId || args?.journeyId || null
            });
            return { error: e.message };
        }
    }
}
