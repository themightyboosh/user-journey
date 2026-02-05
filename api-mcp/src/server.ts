import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { v4 as uuidv4 } from 'uuid';
import { Store } from './store';
import { JourneyMap, JourneyMapSchema, PhaseObjectSchema, SwimlaneObjectSchema, CellObjectSchema } from './types';
import { recalculateJourney, isCellComplete } from './metrics';
import { z } from 'zod';
// import { zodToJsonSchema } from 'zod-to-json-schema';


const server: FastifyInstance = Fastify({ logger: true });

// Register plugins
server.register(cors, { origin: '*' });

server.register(swagger, {
  openapi: {
    openapi: '3.1.0',
    info: {
      title: 'Journey Map Capture API',
      description: 'API for creating and progressively completing Journey Maps',
      version: '1.0.0',
    },
    servers: [{ url: 'http://localhost:3001' }],
    components: {
        schemas: {
           // JourneyMap: zodToJsonSchema(JourneyMapSchema, { target: 'openApi3' }),
           // Phase: zodToJsonSchema(PhaseObjectSchema, { target: 'openApi3' }),
           // Swimlane: zodToJsonSchema(SwimlaneObjectSchema, { target: 'openApi3' }),
           // Cell: zodToJsonSchema(CellObjectSchema, { target: 'openApi3' })
        }
    }
  },
});

server.register(swaggerUi, {
  routePrefix: '/docs',
});

// --- Endpoints ---

// Create JourneyMap
server.post('/v1/journey-maps', async (request, reply) => {
  const body = request.body as any;
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const newJourney: JourneyMap = {
    journeyMapId: id,
    sessionId: body.sessionId || uuidv4(),
    status: 'DRAFT',
    stage: 'IDENTITY',
    name: body.name || '',
    role: body.role || '',
    context: body.context || '',
    arePhasesComplete: false,
    areSwimlanesComplete: false,
    completionStatus: {
        name: !!body.name,
        role: !!body.role,
        context: !!body.context,
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
    console.log(`[DB] Created Journey: ${id} | Name: ${newJourney.name}`);
    return newJourney;
});

// Get JourneyMap
server.get('/v1/journey-maps/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const journey = await Store.get(id);
  if (!journey) {
      console.warn(`[DB] Journey Not Found: ${id}`);
      return reply.status(404).send({ message: 'Journey not found' });
  }
  return journey;
});

// Update Metadata
server.patch('/v1/journey-maps/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    let journey = await Store.get(id);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });

    if (body.name !== undefined) journey.name = body.name;
    if (body.role !== undefined) journey.role = body.role;
    if (body.context !== undefined) journey.context = body.context;
    if (body.status !== undefined) journey.status = body.status;
    if (body.arePhasesComplete !== undefined) journey.arePhasesComplete = body.arePhasesComplete;
    if (body.areSwimlanesComplete !== undefined) journey.areSwimlanesComplete = body.areSwimlanesComplete;
    
    // Auto-advance stage if we just named it
    if (journey.stage === 'IDENTITY' && journey.name && journey.context) {
        journey.stage = 'PHASES';
    }

    journey = recalculateJourney(journey);
    await Store.save(journey);
    console.log(`[DB] Updated Metadata: ${id} | Stage: ${journey.stage}`);
    return journey;
});

// Add Phase
server.post('/v1/journey-maps/:id/phases', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    let journey = await Store.get(id);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });

    const newPhase = {
        phaseId: uuidv4(),
        sequence: journey.phases.length + 1,
        name: body.name,
        description: body.description,
        context: body.context || ''
    };
    journey.phases.push(newPhase);
    journey = recalculateJourney(journey);
    await Store.save(journey);
    return journey;
});

// Update Phase
server.put('/v1/journey-maps/:id/phases/:phaseId', async (request, reply) => {
    const { id, phaseId } = request.params as { id: string, phaseId: string };
    const body = request.body as any;
    let journey = await Store.get(id);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });

    const phase = journey.phases.find(p => p.phaseId === phaseId);
    if (!phase) return reply.status(404).send({ message: 'Phase not found' });

    if (body.name) phase.name = body.name;
    if (body.description) phase.description = body.description;
    if (body.context) phase.context = body.context;

    journey = recalculateJourney(journey);
    await Store.save(journey);
    return journey;
});

// Remove Phase
server.delete('/v1/journey-maps/:id/phases/:phaseId', async (request, reply) => {
    const { id, phaseId } = request.params as { id: string, phaseId: string };
    let journey = await Store.get(id);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });

    journey.phases = journey.phases.filter(p => p.phaseId !== phaseId);
    // Re-sequence
    journey.phases.forEach((p, index) => p.sequence = index + 1);
    
    // Also remove associated cells!
    journey.cells = journey.cells.filter(c => c.phaseId !== phaseId);

    journey = recalculateJourney(journey);
    await Store.save(journey);
    return journey;
});

// Bulk Set Phases
server.put('/v1/journey-maps/:id/phases', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    let journey = await Store.get(id);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });

    journey.phases = body.phases.map((p: any, index: number) => ({
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
    console.log(`[DB] Set Phases Bulk: ${id} | Count: ${journey.phases.length} | New Stage: ${journey.stage}`);
    return journey;
});

// Add Swimlane
server.post('/v1/journey-maps/:id/swimlanes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    let journey = await Store.get(id);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });

    const newSwimlane = {
        swimlaneId: uuidv4(),
        sequence: journey.swimlanes.length + 1,
        name: body.name,
        description: body.description,
        context: body.context || ''
    };
    journey.swimlanes.push(newSwimlane);
    journey = recalculateJourney(journey);
    await Store.save(journey);
    return journey;
});

// Update Swimlane
server.put('/v1/journey-maps/:id/swimlanes/:swimlaneId', async (request, reply) => {
    const { id, swimlaneId } = request.params as { id: string, swimlaneId: string };
    const body = request.body as any;
    let journey = await Store.get(id);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });

    const swimlane = journey.swimlanes.find(s => s.swimlaneId === swimlaneId);
    if (!swimlane) return reply.status(404).send({ message: 'Swimlane not found' });

    if (body.name) swimlane.name = body.name;
    if (body.description) swimlane.description = body.description;
    if (body.context) swimlane.context = body.context;

    journey = recalculateJourney(journey);
    await Store.save(journey);
    return journey;
});

// Remove Swimlane
server.delete('/v1/journey-maps/:id/swimlanes/:swimlaneId', async (request, reply) => {
    const { id, swimlaneId } = request.params as { id: string, swimlaneId: string };
    let journey = await Store.get(id);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });

    journey.swimlanes = journey.swimlanes.filter(s => s.swimlaneId !== swimlaneId);
    // Re-sequence
    journey.swimlanes.forEach((s, index) => s.sequence = index + 1);

    // Remove associated cells
    journey.cells = journey.cells.filter(c => c.swimlaneId !== swimlaneId);

    journey = recalculateJourney(journey);
    await Store.save(journey);
    return journey;
});

// Bulk Set Swimlanes
server.put('/v1/journey-maps/:id/swimlanes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    let journey = await Store.get(id);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });

    journey.swimlanes = body.swimlanes.map((s: any, index: number) => ({
        swimlaneId: uuidv4(),
        sequence: index + 1,
        name: s.name,
        description: s.description,
        context: s.context || ''
    }));

     // Clear cells as structure changed
     journey.cells = [];
     
     // Auto-advance stage
     journey.stage = 'MATRIX_GENERATION';

    journey = recalculateJourney(journey);
    await Store.save(journey);
    console.log(`[DB] Set Swimlanes Bulk: ${id} | Count: ${journey.swimlanes.length} | New Stage: ${journey.stage}`);
    return journey;
});

// Generate Matrix
server.post('/v1/journey-maps/:id/generate-matrix', async (request, reply) => {
    const { id } = request.params as { id: string };
    let journey = await Store.get(id);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });

    // Ensure all phase x swimlane combos exist
    for (const phase of journey.phases) {
        for (const swimlane of journey.swimlanes) {
            const exists = journey.cells.find(c => c.phaseId === phase.phaseId && c.swimlaneId === swimlane.swimlaneId);
            if (!exists) {
                journey.cells.push({
                    cellId: uuidv4(),
                    phaseId: phase.phaseId,
                    swimlaneId: swimlane.swimlaneId,
                    action: '',
                    context: ''
                });
            }
        }
    }
    
    // Auto-advance stage
    journey.stage = 'CELL_POPULATION';

    journey = recalculateJourney(journey);
    await Store.save(journey);
    console.log(`[DB] Matrix Generated: ${id} | Cells: ${journey.cells.length} | New Stage: ${journey.stage}`);
    return journey;
});

// Update Cell
server.put('/v1/journey-maps/:id/cells/:cellId', async (request, reply) => {
    const { id, cellId } = request.params as { id: string, cellId: string };
    const body = request.body as any;
    let journey = await Store.get(id);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });

    const cell = journey.cells.find(c => c.cellId === cellId);
    if (!cell) return reply.status(404).send({ message: 'Cell not found' });

    if (body.action !== undefined) cell.action = body.action;
    if (body.context !== undefined) cell.context = body.context;

    journey = recalculateJourney(journey);
    await Store.save(journey);
    console.log(`[DB] Cell Updated: ${id} | CellId: ${cellId} | Progress: ${Math.round(journey.metrics.percentCellsComplete * 100)}%`);
    return journey;
});

// Generate Artifacts
server.post('/v1/journey-maps/:id/generate-artifacts', async (request, reply) => {
    const { id } = request.params as { id: string };
    let journey = await Store.get(id);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });

    // Logic to generate summaries would go here (or be delegated to an AI service)
    // For now we just stub it or generate the Mermaid code
    
    let mermaidCode = `journey\n    title ${journey.name}\n`;
    for(const phase of journey.phases) {
        mermaidCode += `    section ${phase.name}\n`;
        for(const swimlane of journey.swimlanes) {
             const cell = journey.cells.find(c => c.phaseId === phase.phaseId && c.swimlaneId === swimlane.swimlaneId);
             if (cell && isCellComplete(cell)) {
                 // Simple representation: Actor: Score: Task
                 // We don't have scores yet, default to 3
                 mermaidCode += `      ${swimlane.name}: 3: ${cell.action}\n`;
             }
        }
    }

    journey.mermaid = { code: mermaidCode };
    journey.outputJson = { code: JSON.stringify(journey, null, 2) }; // Self-reference for now
    
    // Finalize stage
    journey.stage = 'COMPLETE';
    journey.status = 'READY_FOR_REVIEW';

    journey = recalculateJourney(journey);
    await Store.save(journey);
    return journey;
});


const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Server listening on http://localhost:3001');
    console.log('Swagger docs at http://localhost:3001/docs');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
