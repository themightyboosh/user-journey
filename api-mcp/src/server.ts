import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { JourneyService } from './services/journey.service';
import { AdminService } from './services/admin.service';

const server: FastifyInstance = Fastify({ logger: true });
const journeyService = JourneyService.getInstance();
const adminService = AdminService.getInstance();

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
  },
});

server.register(swaggerUi, {
  routePrefix: '/docs',
});

// --- Endpoints ---

// Create JourneyMap
server.post('/v1/journey-maps', async (request, reply) => {
  const body = request.body as any;
  const journey = await journeyService.createJourney(body);
  return journey;
});

// List JourneyMaps
server.get('/v1/journey-maps', async (request, reply) => {
  return await journeyService.getAllJourneys();
});

// Get JourneyMap
server.get('/v1/journey-maps/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const journey = await journeyService.getJourney(id);
  if (!journey) {
      return reply.status(404).send({ message: 'Journey not found' });
  }
  return journey;
});

// Update Metadata
server.patch('/v1/journey-maps/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const journey = await journeyService.updateMetadata(id, body);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });
    return journey;
});

// Add Phase
server.post('/v1/journey-maps/:id/phases', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const journey = await journeyService.addPhase(id, body);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });
    return journey;
});

// Update Phase
server.put('/v1/journey-maps/:id/phases/:phaseId', async (request, reply) => {
    const { id, phaseId } = request.params as { id: string, phaseId: string };
    const body = request.body as any;
    const journey = await journeyService.updatePhase(id, phaseId, body);
    if (!journey) return reply.status(404).send({ message: 'Phase or Journey not found' });
    return journey;
});

// Remove Phase
server.delete('/v1/journey-maps/:id/phases/:phaseId', async (request, reply) => {
    const { id, phaseId } = request.params as { id: string, phaseId: string };
    const journey = await journeyService.removePhase(id, phaseId);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });
    return journey;
});

// Bulk Set Phases
server.put('/v1/journey-maps/:id/phases', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const journey = await journeyService.setPhasesBulk(id, body.phases);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });
    return journey;
});

// Add Swimlane
server.post('/v1/journey-maps/:id/swimlanes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const journey = await journeyService.addSwimlane(id, body);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });
    return journey;
});

// Update Swimlane
server.put('/v1/journey-maps/:id/swimlanes/:swimlaneId', async (request, reply) => {
    const { id, swimlaneId } = request.params as { id: string, swimlaneId: string };
    const body = request.body as any;
    const journey = await journeyService.updateSwimlane(id, swimlaneId, body);
    if (!journey) return reply.status(404).send({ message: 'Swimlane or Journey not found' });
    return journey;
});

// Remove Swimlane
server.delete('/v1/journey-maps/:id/swimlanes/:swimlaneId', async (request, reply) => {
    const { id, swimlaneId } = request.params as { id: string, swimlaneId: string };
    const journey = await journeyService.removeSwimlane(id, swimlaneId);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });
    return journey;
});

// Bulk Set Swimlanes
server.put('/v1/journey-maps/:id/swimlanes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const journey = await journeyService.setSwimlanesBulk(id, body.swimlanes);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });
    return journey;
});

// Generate Matrix
server.post('/v1/journey-maps/:id/generate-matrix', async (request, reply) => {
    const { id } = request.params as { id: string };
    const journey = await journeyService.generateMatrix(id);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });
    return journey;
});

// Update Cell
server.put('/v1/journey-maps/:id/cells/:cellId', async (request, reply) => {
    const { id, cellId } = request.params as { id: string, cellId: string };
    const body = request.body as any;
    const journey = await journeyService.updateCell(id, cellId, body);
    if (!journey) return reply.status(404).send({ message: 'Cell or Journey not found' });
    return journey;
});

// Generate Artifacts
server.post('/v1/journey-maps/:id/generate-artifacts', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const journey = await journeyService.generateArtifacts(id, body);
    if (!journey) return reply.status(404).send({ message: 'Journey not found' });
    return journey;
});

// --- Admin Links ---

server.get('/api/admin/links', async (request, reply) => {
    return await adminService.getLinks();
});

server.get('/api/admin/links/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const link = await adminService.getLink(id);
    if (!link) return reply.status(404).send({ message: 'Link configuration not found' });
    return link;
});

server.post('/api/admin/links', async (request, reply) => {
    const body = request.body as any;
    return await adminService.createLink(body);
});

server.put('/api/admin/links/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await adminService.updateLink(id, body);
});

server.delete('/api/admin/links/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return await adminService.deleteLink(id);
});

// --- Admin Settings ---

server.get('/api/admin/settings', async (request, reply) => {
    return await adminService.getSettings();
});

server.put('/api/admin/settings', async (request, reply) => {
    const body = request.body as any;
    return await adminService.saveSettings(body);
});

// --- Admin Knowledge ---

server.get('/api/admin/knowledge', async (request, reply) => {
    return await adminService.getKnowledge();
});

server.post('/api/admin/knowledge', async (request, reply) => {
    const body = request.body as any;
    return await adminService.createKnowledge(body);
});

server.put('/api/admin/knowledge/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    return await adminService.updateKnowledge(id, body);
});

server.delete('/api/admin/knowledge/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    return await adminService.deleteKnowledge(id);
});


// --- System ---

server.get('/', async (request, reply) => {
    return { status: 'ok', service: 'Journey Mapper API' };
});

server.get('/favicon.ico', async (request, reply) => {
    reply.header('Content-Type', 'image/x-icon');
    return reply.send(); // Return empty response or real icon if we had one
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
