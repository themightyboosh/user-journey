import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { JourneyService } from './services/journey.service';
import { AdminService } from './services/admin.service';
import { AIService } from './services/ai.service';
import logger from './logger';

export const server: FastifyInstance = Fastify({ 
    logger: false, // Use our own logger
    ignoreTrailingSlash: true
});

// Services
const journeyService = JourneyService.getInstance();
const adminService = AdminService.getInstance();
const aiService = AIService.getInstance();

// Initialize AI
aiService.initialize().catch(err => logger.error("AI Init Failed", { error: err }));

// Register plugins
server.register(cors, { origin: '*' });

// Fix for Firebase Functions Gen 2 (Cloud Run) Double Body Parsing
// Firebase parses the body before it reaches Fastify, causing Fastify to hang waiting for a consumed stream.
const contentTypeParser = (req: any, payload: any, done: any) => {
    if (req.raw.body) {
        done(null, req.raw.body);
    } else {
        let data = '';
        payload.on('data', (chunk: any) => { data += chunk; });
        payload.on('end', () => {
            try {
                done(null, data ? JSON.parse(data) : {});
            } catch (err: any) {
                done(err, undefined);
            }
        });
    }
};

server.removeContentTypeParser('application/json');
server.addContentTypeParser('application/json', contentTypeParser);
server.addContentTypeParser('application/x-www-form-urlencoded', contentTypeParser);

// Debug logging
server.addHook('onRequest', async (request, reply) => {
    logger.info(`[REQUEST] ${request.method} ${request.url}`, {
        method: request.method,
        url: request.url,
        ip: request.ip
    });
});

server.addHook('onReady', async () => {
    logger.info('Server routes initialized');
});

// Global Error Handler
server.setErrorHandler((error: any, request, reply) => {
    logger.error('Global Error Handler', { 
        error: error.message, 
        stack: error.stack,
        url: request.url 
    });
    reply.status(error.statusCode || 500).send({ 
        error: error.name, 
        message: error.message,
        statusCode: error.statusCode || 500
    });
});

// Process-level Error Handling (Winston Opportunities)
process.on('unhandledRejection', (reason: any, promise) => {
    logger.error('Unhandled Rejection at:', { 
        promise, 
        reason: reason?.message || reason,
        stack: reason?.stack 
    });
});

process.on('uncaughtException', (error: any) => {
    logger.error('Uncaught Exception:', { 
        error: error.message, 
        stack: error.stack 
    });
    // Optional: process.exit(1) if critical
});

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

// --- Chat & AI Endpoints ---

server.get('/api/health', async (request, reply) => {
    const settings = await adminService.getSettings();
    return { 
        status: 'ok', 
        model: aiService.ActiveModelName || 'Initializing...',
        location: process.env.VERTEX_AI_LOCATION || 'us-central1'
    };
});

server.get('/api/journey-state/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await aiService.getJourneyState(id);
    if (!data) return reply.status(404).send({error: "Not found"});
    return data;
});

server.post('/api/chat', async (request, reply) => {
    logger.info('[HANDLER] /api/chat hit'); // <--- Very first log

    // Set Headers for SSE immediately but don't flush yet
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    let body: any;
    try {
        body = request.body;
        logger.info('[HANDLER] Body parsed', { 
            hasMessage: !!body?.message, 
            journeyId: body?.journeyId 
        });
    } catch (e) {
        logger.error('[HANDLER] Body parse error', e);
        return reply.status(400).send({ error: 'Invalid JSON body' });
    }

    const { message, history = [], config = {}, journeyId } = body || {};
  
    if (journeyId) config.journeyId = journeyId;
    
    logger.info('[API] Received Chat Config:', { 
        hasWelcome: !!config.welcomePrompt, 
        welcomeLen: config.welcomePrompt?.length,
        journeyName: config.journeyName
    });

    if (!message) return reply.status(400).send({ error: 'Message is required' });
  
    try {
      logger.info('Chat request processing', { journeyId, messageLength: message.length });

      const contents = history.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
      contents.push({ role: 'user', parts: [{ text: message }] });
  
      // Fetch Journey State for Context
      let journeyState = null;
      if (config.journeyId) {
          logger.info('Fetching journey state', { journeyId: config.journeyId });
          journeyState = await aiService.getJourneyState(config.journeyId);
          logger.info('Fetched journey state', { found: !!journeyState });
      }
  
      logger.info('Getting request model');
      let modelResult = await aiService.getRequestModel(config, journeyState);
      let requestModel = modelResult.model;
      let currentModelName = modelResult.modelName;
      logger.info(`Got request model: ${currentModelName}`);
  
      let currentTurn = 0;
      const maxTurns = 5;
      let finalDone = false;
  
      // Helper for generation with 429 handling
      const generateSafe = async (model: any, params: any, modelName: string) => {
          try {
              const result = await model.generateContent(params);
              const response = await result.response;
              return { response, model, modelName }; 
          } catch (e: any) {
              if (e.message?.includes('429') || e.status === 429 || e.code === 429 || e.message?.includes('RESOURCE_EXHAUSTED')) {
                   logger.warn(`⚠️ 429 RESOURCE EXHAUSTED for ${modelName} - Triggering Fallback Model`);
                   
                   // 1. Get the next fallback model name
                   const nextFallbackModel = aiService.getNextFallback(modelName);
                   
                   // 2. Re-create the request model using the FALLBACK name specifically
                   const newModelResult = await aiService.getRequestModel(config, journeyState, nextFallbackModel);
                   
                   // 3. Retry once with new model
                   const result = await newModelResult.model.generateContent(params);
                   const response = await result.response;
                   return { response, model: newModelResult.model, modelName: newModelResult.modelName }; 
              }
              throw e;
          }
      };

      // Initial Generation
      logger.info('Starting generation');
      let genResult = await generateSafe(requestModel, { contents }, currentModelName);
      let response = genResult.response;
      requestModel = genResult.model; // Update model reference
      currentModelName = genResult.modelName; // Update name reference
      logger.info('Got initial response');
      
      while (currentTurn < maxTurns && !finalDone) {
          currentTurn++;
          
          const functionCalls = response.candidates?.[0]?.content?.parts?.filter((p: any) => p.functionCall);
          
          if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                  const fn = call.functionCall;
                  if (!fn) continue;

                  const toolResult: any = await aiService.executeTool(fn.name, fn.args);
                  
                  const toolResponsePart = {
                      functionResponse: {
                          name: fn.name,
                          response: { content: toolResult }
                      }
                  };
                  
                  // Add model response and tool result to history
                  contents.push(response.candidates![0].content);
                  contents.push({ role: 'function', parts: [toolResponsePart] });
  
                  if (fn.name === 'create_journey_map' && toolResult && toolResult.journeyMapId) {
                       config.journeyId = toolResult.journeyMapId;
                       reply.raw.write(`data: ${JSON.stringify({ journeyId: toolResult.journeyMapId })}\n\n`);
                  }
              }
              
              genResult = await generateSafe(requestModel, { contents }, currentModelName);
              response = genResult.response;
              requestModel = genResult.model;
              currentModelName = genResult.modelName;
          } else {
              const finalText = response.candidates?.[0]?.content?.parts?.[0]?.text || "Processing...";
              reply.raw.write(`data: ${JSON.stringify({ text: finalText })}\n\n`);
              reply.raw.write(`data: ${JSON.stringify({ done: true, journeyId: config.journeyId })}\n\n`);
              finalDone = true;
          }
      }
  
      if (!finalDone) {
           reply.raw.write(`data: ${JSON.stringify({ text: "I'm still thinking, but I hit a limit. Please continue." })}\n\n`);
           reply.raw.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
  
      reply.raw.end();
  
    } catch (error: any) {
      console.error('Chat error:', error);
      reply.raw.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      reply.raw.end();
    }
});

// --- Journey Endpoints ---

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

// Delete JourneyMap
server.delete('/v1/journey-maps/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await journeyService.deleteJourney(id);
    return { success: true };
});

// Clear All JourneyMaps (Admin Only ideally, but open for now)
server.delete('/v1/journey-maps', async (request, reply) => {
    await journeyService.clearAllJourneys();
    return { success: true };
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

// --- Admin Journeys ---

server.get('/api/admin/journeys', async (request, reply) => {
    return await journeyService.getAllJourneys();
});

server.delete('/api/admin/journeys/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await journeyService.deleteJourney(id);
    return { success: true };
});

server.delete('/api/admin/journeys', async (request, reply) => {
    await journeyService.clearAllJourneys();
    return { success: true };
});

server.get('/admin/journeys', async (request, reply) => {
    return await journeyService.getAllJourneys();
});


// --- System ---

// Client-side Log Ingestion
server.post('/api/logs', async (request, reply) => {
    const { level, message, context, userAgent, timestamp } = request.body as any;
    
    // Sanitize
    const safeContext = context ? JSON.parse(JSON.stringify(context)) : {};
    
    const logData = {
        source: 'client-browser',
        userAgent,
        clientTimestamp: timestamp,
        ...safeContext
    };

    if (level === 'error') {
        logger.error(`[CLIENT] ${message}`, logData);
    } else if (level === 'warn') {
        logger.warn(`[CLIENT] ${message}`, logData);
    } else {
        logger.info(`[CLIENT] ${message}`, logData);
    }

    return { status: 'logged' };
});

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
    logger.info('Server listening on http://localhost:3001');
    logger.info('Swagger docs at http://localhost:3001/docs');
  } catch (err) {
    logger.error('Startup Error', { error: err });
    process.exit(1);
  }
};

// Only start if this file is the main module
if (require.main === module) {
    start();
}
