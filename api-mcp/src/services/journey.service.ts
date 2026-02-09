import { v4 as uuidv4 } from 'uuid';
import { Store } from '../store';
import { JourneyMap, PhaseObject, SwimlaneObject, CellObject } from '../types';
import { recalculateJourney, isCellComplete } from '../metrics';
import logger from '../logger';

export class JourneyService {
    private static instance: JourneyService;

    private constructor() {}

    public static getInstance(): JourneyService {
        if (!JourneyService.instance) {
            JourneyService.instance = new JourneyService();
        }
        return JourneyService.instance;
    }

    async createJourney(params: { name?: string; role?: string; description?: string; sessionId?: string; userName?: string }): Promise<JourneyMap> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const newJourney: JourneyMap = {
            journeyMapId: id,
            sessionId: params.sessionId || uuidv4(),
            status: 'DRAFT',
            stage: 'IDENTITY',
            userName: params.userName || '',
            name: params.name || '',
            role: params.role || '',
            description: params.description || '',
            arePhasesComplete: false,
            areSwimlanesComplete: false,
            completionStatus: {
                name: !!params.name,
                role: !!params.role,
                description: !!params.description,
                phases: false,
                swimlanes: false,
                cells: false
            },
            phases: [],
            swimlanes: [],
            cells: [],
            metrics: {
                totalPhases: 0,
                totalSwimlanes: 0,
                totalCellsExpected: 0,
                totalCellsPresent: 0,
                totalCellsCompleted: 0,
                percentCellsComplete: 0
            },
            createdAt: now,
            updatedAt: now,
            version: 1
        };

        await Store.save(newJourney);
        logger.info(`[JourneyService] Created: ${id} | Name: ${newJourney.name}`);
        return newJourney;
    }

    async getJourney(id: string): Promise<JourneyMap | null> {
        return await Store.get(id);
    }

    async getAllJourneys(): Promise<JourneyMap[]> {
        return await Store.list();
    }

    async updateMetadata(id: string, params: Partial<JourneyMap>): Promise<JourneyMap | null> {
        let journey = await Store.get(id);
        if (!journey) return null;

        const oldStage = journey.stage;

        if (params.name !== undefined) journey.name = params.name;
        if (params.userName !== undefined) journey.userName = params.userName;
        if (params.role !== undefined) journey.role = params.role;
        if (params.description !== undefined) journey.description = params.description;
        if (params.status !== undefined) journey.status = params.status;
        if (params.arePhasesComplete !== undefined) journey.arePhasesComplete = params.arePhasesComplete;
        if (params.areSwimlanesComplete !== undefined) journey.areSwimlanesComplete = params.areSwimlanesComplete;

        // Auto-advance stage if we just named it
        if (journey.stage === 'IDENTITY' && journey.name && journey.description) {
            journey.stage = 'PHASES';
        }

        journey = recalculateJourney(journey);
        await Store.save(journey);

        // Log stage transitions
        if (oldStage !== journey.stage) {
            logger.info(`🚦 [GATE TRANSITION] ${oldStage} → ${journey.stage} | Journey: ${journey.name}`);
        }

        logger.info(`[JourneyService] Updated Metadata: ${id} | Name: "${journey.name}" | Stage: ${journey.stage}`);
        return journey;
    }

    async addPhase(id: string, params: { name: string; description: string; context?: string }): Promise<JourneyMap | null> {
        let journey = await Store.get(id);
        if (!journey) return null;

        const newPhase: PhaseObject = {
            phaseId: uuidv4(),
            sequence: journey.phases.length + 1,
            name: params.name,
            description: params.description,
            context: params.context || ''
        };
        journey.phases.push(newPhase);
        journey = recalculateJourney(journey);
        await Store.save(journey);
        return journey;
    }

    async updatePhase(id: string, phaseId: string, params: { name?: string; description?: string; context?: string }): Promise<JourneyMap | null> {
        let journey = await Store.get(id);
        if (!journey) return null;

        const phase = journey.phases.find(p => p.phaseId === phaseId);
        if (!phase) return null; // Or throw error

        if (params.name) phase.name = params.name;
        if (params.description) phase.description = params.description;
        if (params.context) phase.context = params.context;

        journey = recalculateJourney(journey);
        await Store.save(journey);
        return journey;
    }

    async removePhase(id: string, phaseId: string): Promise<JourneyMap | null> {
        let journey = await Store.get(id);
        if (!journey) return null;

        journey.phases = journey.phases.filter(p => p.phaseId !== phaseId);
        // Re-sequence
        journey.phases.forEach((p, index) => p.sequence = index + 1);
        // Also remove associated cells!
        journey.cells = journey.cells.filter(c => c.phaseId !== phaseId);

        journey = recalculateJourney(journey);
        await Store.save(journey);
        return journey;
    }

    async setPhasesBulk(id: string, phases: { name: string; description: string; context?: string }[]): Promise<JourneyMap | null> {
        let journey = await Store.get(id);
        if (!journey) return null;

        const oldStage = journey.stage;

        journey.phases = phases.map((p, index) => ({
            phaseId: uuidv4(),
            sequence: index + 1,
            name: p.name,
            description: p.description,
            context: p.context || ''
        }));

        // Clear cells as structure changed significantly
        journey.cells = [];
        // Auto-advance stage
        journey.stage = 'SWIMLANES';

        journey = recalculateJourney(journey);
        await Store.save(journey);

        logger.info(`🚦 [GATE TRANSITION] ${oldStage} → ${journey.stage} | Phases set: ${journey.phases.length}`);
        logger.info(`[JourneyService] Set Phases Bulk: ${id} | Count: ${journey.phases.length}`);
        return journey;
    }

    async addSwimlane(id: string, params: { name: string; description: string; context?: string }): Promise<JourneyMap | null> {
        let journey = await Store.get(id);
        if (!journey) return null;

        const newSwimlane: SwimlaneObject = {
            swimlaneId: uuidv4(),
            sequence: journey.swimlanes.length + 1,
            name: params.name,
            description: params.description,
            context: params.context || ''
        };
        journey.swimlanes.push(newSwimlane);
        journey = recalculateJourney(journey);
        await Store.save(journey);
        return journey;
    }

    async updateSwimlane(id: string, swimlaneId: string, params: { name?: string; description?: string; context?: string }): Promise<JourneyMap | null> {
        let journey = await Store.get(id);
        if (!journey) return null;

        const swimlane = journey.swimlanes.find(s => s.swimlaneId === swimlaneId);
        if (!swimlane) return null;

        if (params.name) swimlane.name = params.name;
        if (params.description) swimlane.description = params.description;
        if (params.context) swimlane.context = params.context;

        journey = recalculateJourney(journey);
        await Store.save(journey);
        return journey;
    }

    async removeSwimlane(id: string, swimlaneId: string): Promise<JourneyMap | null> {
        let journey = await Store.get(id);
        if (!journey) return null;

        journey.swimlanes = journey.swimlanes.filter(s => s.swimlaneId !== swimlaneId);
        // Re-sequence
        journey.swimlanes.forEach((s, index) => s.sequence = index + 1);
        // Remove associated cells
        journey.cells = journey.cells.filter(c => c.swimlaneId !== swimlaneId);

        journey = recalculateJourney(journey);
        await Store.save(journey);
        return journey;
    }

    async setSwimlanesBulk(id: string, swimlanes: { name: string; description: string; context?: string }[]): Promise<JourneyMap | null> {
        let journey = await Store.get(id);
        if (!journey) return null;

        journey.swimlanes = swimlanes.map((s, index) => ({
            swimlaneId: uuidv4(),
            sequence: index + 1,
            name: s.name,
            description: s.description,
            context: s.context || ''
        }));

        // Clear cells as structure changed
        journey.cells = [];
        // Save intermediate state
        await Store.save(journey);
        
        // Immediately generate matrix to reduce AI turn count
        logger.info(`[JourneyService] Set Swimlanes Bulk: ${id} | Count: ${journey.swimlanes.length} | Auto-generating Matrix...`);
        return this.generateMatrix(id);
    }

    async generateMatrix(id: string): Promise<JourneyMap | null> {
        let journey = await Store.get(id);
        if (!journey) return null;

        const oldStage = journey.stage;

        // Ensure all phase x swimlane combos exist
        for (const phase of journey.phases) {
            for (const swimlane of journey.swimlanes) {
                const exists = journey.cells.find(c => c.phaseId === phase.phaseId && c.swimlaneId === swimlane.swimlaneId);
                if (!exists) {
                    journey.cells.push({
                        cellId: uuidv4(),
                        phaseId: phase.phaseId,
                        swimlaneId: swimlane.swimlaneId,
                        headline: '',
                        description: '',
                        context: ''
                    });
                }
            }
        }

        // Auto-advance stage
        journey.stage = 'CELL_POPULATION';

        journey = recalculateJourney(journey);
        await Store.save(journey);

        logger.info(`🚦 [GATE TRANSITION] ${oldStage} → ${journey.stage} | Matrix ready: ${journey.cells.length} cells`);
        logger.info(`[JourneyService] Matrix Generated: ${id} | Cells: ${journey.cells.length}`);
        return journey;
    }

    async updateCell(id: string, cellId: string, params: { headline?: string; description?: string; context?: string }): Promise<JourneyMap | null> {
        let journey = await Store.get(id);
        if (!journey) return null;

        const cell = journey.cells.find(c => c.cellId === cellId);
        if (!cell) return null;

        if (params.headline !== undefined) cell.headline = params.headline;
        if (params.description !== undefined) cell.description = params.description;
        if (params.context !== undefined) cell.context = params.context;

        journey = recalculateJourney(journey);
        await Store.save(journey);
        logger.info(`[JourneyService] Cell Updated: ${id} | CellId: ${cellId} | Progress: ${Math.round(journey.metrics.percentCellsComplete * 100)}%`);
        return journey;
    }

    async deleteJourney(id: string): Promise<void> {
        await Store.delete(id);
        logger.info(`[JourneyService] Deleted: ${id}`);
    }

    async clearAllJourneys(): Promise<void> {
        await Store.deleteAll();
        logger.info(`[JourneyService] Cleared All Journeys`);
    }

    async generateArtifacts(id: string, params: { summaryOfFindings?: string; mentalModels?: string; anythingElse?: string; quotes?: string[] }): Promise<JourneyMap | null> {
        logger.info(`[JourneyService] Generating Artifacts for ${id}`, { 
            hasSummary: !!params.summaryOfFindings,
            summaryLen: params.summaryOfFindings?.length,
            hasModels: !!params.mentalModels,
            modelsLen: params.mentalModels?.length
        });
        
        let journey = await Store.get(id);
        if (!journey) return null;

        // Flowchart (TD)
        // Subgraphs for Phases
        let mermaidCode = `graph TD\n    title ${journey.name}\n`;
        
        // Define Styles
        mermaidCode += `    %% Styles\n    classDef phase fill:#f9f9f9,stroke:#333,stroke-width:2px;\n    classDef swimlane fill:#e1f5fe,stroke:#0277bd,stroke-width:1px;\n`;

        // Create Subgraphs for each Phase
        for (const phase of journey.phases) {
            mermaidCode += `    subgraph ${phase.phaseId}["${phase.name}"]\n`;
            
            // Add nodes for cells within this phase
            for (const swimlane of journey.swimlanes) {
                const cell = journey.cells.find(c => c.phaseId === phase.phaseId && c.swimlaneId === swimlane.swimlaneId);
                if (cell && isCellComplete(cell)) {
                    // Node ID must be unique
                    const nodeId = `cell_${cell.cellId.replace(/-/g, '_')}`;
                    // Label includes Swimlane + Headline
                    const label = `**${swimlane.name}**<br/>${cell.headline}`;
                    mermaidCode += `        ${nodeId}["${label}"]\n`;
                }
            }
            mermaidCode += `    end\n`;
        }

        // Connect Phases sequentially?
        // Actually, in a Journey Map, items flow left-to-right through phases.
        // It's hard to auto-connect nodes without knowing the logic.
        // But we can connect the Subgraphs invisibly to force ordering?
        // Mermaid doesn't easily support connecting subgraphs directly.
        // Instead, let's just let them layout naturally or connect "dummy" nodes?
        // Alternatively, we can assume a linear flow if we want.
        // For now, let's just group them.
        
        // OPTIONAL: Connect first cell of Phase N to first cell of Phase N+1 to encourage layout?
        // Let's keep it simple first. The user asked for "ALL elements".
        
        journey.mermaid = { code: mermaidCode };
        journey.outputJson = { code: JSON.stringify(journey, null, 2) };

        if (params.summaryOfFindings) journey.summaryOfFindings = params.summaryOfFindings;
        if (params.mentalModels) journey.mentalModels = params.mentalModels;
        if (params.anythingElse) journey.anythingElse = params.anythingElse;
        if (params.quotes) journey.quotes = params.quotes;

        const oldStage = journey.stage;

        // Finalize stage
        journey.stage = 'COMPLETE';
        journey.status = 'READY_FOR_REVIEW';

        journey = recalculateJourney(journey);
        await Store.save(journey);

        logger.info(`🚦 [GATE TRANSITION] ${oldStage} → ${journey.stage} | Journey "${journey.name}" complete!`);
        return journey;
    }

    // --- Summarization Helpers ---

    async checkPhaseCompletion(id: string, phaseId: string): Promise<boolean> {
        const journey = await Store.get(id);
        if (!journey) return false;
        
        // Find all cells for this phase
        const phaseCells = journey.cells.filter(c => c.phaseId === phaseId);
        if (phaseCells.length === 0) return false;

        // Check if all are complete (non-empty headline/desc)
        return phaseCells.every(c => c.headline && c.description && c.headline.trim() !== '' && c.description.trim() !== '');
    }

    async checkSwimlaneCompletion(id: string, swimlaneId: string): Promise<boolean> {
        const journey = await Store.get(id);
        if (!journey) return false;
        
        // Find all cells for this swimlane
        const swimlaneCells = journey.cells.filter(c => c.swimlaneId === swimlaneId);
        if (swimlaneCells.length === 0) return false;

        return swimlaneCells.every(c => c.headline && c.description && c.headline.trim() !== '' && c.description.trim() !== '');
    }

    async savePhaseSummary(id: string, phaseId: string, summary: string): Promise<JourneyMap | null> {
        let journey = await Store.get(id);
        if (!journey) return null;
        
        const phase = journey.phases.find(p => p.phaseId === phaseId);
        if (phase) {
            phase.summary = summary;
            await Store.save(journey);
            logger.info(`[JourneyService] Saved Summary for Phase: ${phase.name}`);
        }
        return journey;
    }

    async saveSwimlaneSummary(id: string, swimlaneId: string, summary: string): Promise<JourneyMap | null> {
        let journey = await Store.get(id);
        if (!journey) return null;
        
        const swimlane = journey.swimlanes.find(s => s.swimlaneId === swimlaneId);
        if (swimlane) {
            swimlane.summary = summary;
            await Store.save(journey);
            logger.info(`[JourneyService] Saved Summary for Swimlane: ${swimlane.name}`);
        }
        return journey;
    }
}
