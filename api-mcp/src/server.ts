import Fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import * as admin from 'firebase-admin';
import { JourneyService } from './services/journey.service';
import { AdminService } from './services/admin.service';
import { AIService } from './services/ai.service';
import { UserService } from './services/user.service';
import { Store } from './store';
import { SessionConfig } from './ai/prompts';
import { SUPER_ADMIN_EMAIL, AppUser } from './types';
import logger from './logger';
import { VERSION } from './version';
import { PROMPTS_VERSION } from './ai/prompts';
import { TOOLS_VERSION } from './ai/tools';

// Log version on server start (forces redeploy on every build)
logger.info('🚀 Journey Mapper API Starting', { version: VERSION });

export const server: FastifyInstance = Fastify({ 
    logger: false, // Use our own logger
    ignoreTrailingSlash: true
});

// Services
const journeyService = JourneyService.getInstance();
const adminService = AdminService.getInstance();
const aiService = AIService.getInstance();
const userService = UserService.getInstance();

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

// --- Utility: sleep for backoff ---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Chat & AI Endpoints ---

server.get('/api/health', async (request, reply) => {
    const settings = await adminService.getSettings();
    return {
        status: 'ok',
        model: aiService.ActiveModelName || 'Initializing...',
        location: process.env.VERTEX_AI_LOCATION || 'us-central1'
    };
});

// Version endpoint - check deployed version
server.get('/api/version', async (request, reply) => {
    return {
        ...VERSION,
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        serverTime: new Date().toISOString(),
        prompts: PROMPTS_VERSION,
        tools: TOOLS_VERSION
    };
});

server.get('/api/journey-state/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await aiService.getJourneyState(id);
    if (!data) return reply.status(404).send({error: "Not found"});
    return data;
});

// --- Cells Remaining Endpoint ---
server.get('/api/cells-remaining/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await aiService.getCellsRemaining(id);
    if (!data) return reply.status(404).send({ error: "Journey not found" });
    return data;
});

server.post('/api/chat', async (request, reply) => {
    logger.info('[HANDLER] /api/chat hit');

    // --- Validate BEFORE setting SSE headers (so we can return clean 400s) ---
    const body = request.body as any;
    if (!body || !body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
        logger.warn('[HANDLER] Missing or empty message', { body: JSON.stringify(body).substring(0, 200) });
        return reply.status(400).send({ error: 'Message is required' });
    }

    const message: string = body.message;
    const history: Array<{ role: string; content: string }> = Array.isArray(body.history) ? body.history : [];
    const config: any = body.config || {};
    const journeyId: string | undefined = body.journeyId;

    // Set Headers for SSE after validation passes
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    if (journeyId) config.journeyId = journeyId;
    
    logger.info('[API] Chat request validated', { 
        hasWelcome: !!config.welcomePrompt, 
        journeyId: config.journeyId,
        historyLength: history.length
    });

    // Safe SSE write helper — guards against writing to closed/destroyed streams
    const safeSend = (data: object) => {
        if (!reply.raw.destroyed && reply.raw.writable) {
            reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        } else {
            logger.warn('⚠️ Attempted SSE write to closed stream', { journeyId: config?.journeyId });
        }
    };
  
    try {
      logger.info('Chat request processing', { journeyId, messageLength: message.length });

      const contents = history.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
      contents.push({ role: 'user', parts: [{ text: message }] });
  
      // Fetch Journey State for Context
      let journeyState: any = null;
      if (config.journeyId) {
          logger.info('Fetching journey state', { journeyId: config.journeyId });
          journeyState = await aiService.getJourneyState(config.journeyId);
          logger.info('Fetched journey state', { found: !!journeyState });
      }

      // CRITICAL: Detect confirmation responses to force tool calling
      // Prevents AI from narrating "I'm adding..." without actually calling tools
      const isConfirmationResponse = /^(yes|yeah|yep|yup|correct|right|sure|ok|okay|sounds good|that's right|looks good)$/i.test(message.trim());
      const isConfirmationStage = journeyState?.stage && ['PHASES', 'SWIMLANES'].includes(journeyState.stage);
      const shouldForceTools = isConfirmationResponse && isConfirmationStage;

      if (shouldForceTools) {
          logger.warn(`🎯 CONFIRMATION DETECTED: Forcing mode=ANY to prevent hallucination (stage: ${journeyState.stage}, message: "${message.trim()}")`);
      }

      logger.info('Getting request model');
      let modelResult = await aiService.getRequestModel(config, journeyState, undefined, shouldForceTools);
      let requestModel = modelResult.model;
      let currentModelName = modelResult.modelName;
      logger.info(`Got request model: ${currentModelName}`);
  
      let currentTurn = 0;
      const maxTurns = 10;
      let finalDone = false;
  
      // Helper for generation with 429 handling + backoff retry
      const generateSafe = async (model: any, params: any, modelName: string, retryCount = 0): Promise<any> => {
          try {
              const result = await model.generateContent(params);
              const response = await result.response;
              return { response, model, modelName }; 
          } catch (e: any) {
              if (e.message?.includes('429') || e.status === 429 || e.code === 429 || e.message?.includes('RESOURCE_EXHAUSTED')) {
                   logger.warn(`⚠️ 429 RESOURCE EXHAUSTED for ${modelName} (attempt ${retryCount + 1})`);
                   
                   // Backoff: wait before retrying (1s first, 3s second)
                   const backoffMs = retryCount === 0 ? 1000 : 3000;
                   await sleep(backoffMs);

                   // Get the next fallback model name
                   const nextFallbackModel = aiService.getNextFallback(modelName);
                   
                   // Re-create the request model using the FALLBACK name
                   // Re-fetch journey state so the fallback model gets fresh context
                   let freshState = journeyState;
                   if (config.journeyId) {
                       freshState = await aiService.getJourneyState(config.journeyId);
                   }
                   // Propagate forceToolCalling on fallback retry
                   const newModelResult = await aiService.getRequestModel(config, freshState, nextFallbackModel, shouldForceTools);
                   
                   // Allow up to 2 retries total (original + 2 fallbacks)
                   if (retryCount < 2) {
                       return generateSafe(newModelResult.model, params, newModelResult.modelName, retryCount + 1);
                   }
                   
                   // Final attempt without recursion
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
      requestModel = genResult.model;
      currentModelName = genResult.modelName;
      logger.info('Got initial response');
      let emptyRetries = 0;
      
      while (currentTurn < maxTurns && !finalDone) {
          currentTurn++;
          
          // Guard against empty candidates (safety filters, recitation, or model hiccups)
          const candidates = response.candidates;
          if (!candidates || candidates.length === 0 || !candidates[0]?.content?.parts) {
              const finishReason = candidates?.[0]?.finishReason || 'NO_CANDIDATES';
              const safetyRatings = candidates?.[0]?.safetyRatings;
              const promptFeedback = response.promptFeedback;
              const blockReason = promptFeedback?.blockReason || null;
              logger.warn('⚠️ EMPTY_CANDIDATES: AI returned no usable response', {
                  journeyId: config.journeyId || null,
                  finishReason,
                  blockReason,
                  safetyRatings: JSON.stringify(safetyRatings || []),
                  promptFeedback: JSON.stringify(promptFeedback || {}),
                  turn: currentTurn,
                  model: currentModelName,
                  lastUserMessage: message?.substring(0, 200) || '(no message)',
                  historyLength: contents.length
              });

              // Retry up to 2 times on empty candidates before giving up
              if (!emptyRetries) emptyRetries = 0;
              emptyRetries++;
              if (emptyRetries <= 2) {
                  logger.info(`Retrying after empty candidates (attempt ${emptyRetries}/2)`, {
                      journeyId: config.journeyId,
                      model: currentModelName
                  });
                  await sleep(1000);
                  genResult = await generateSafe(requestModel, { contents }, currentModelName);
                  response = genResult.response;
                  requestModel = genResult.model;
                  currentModelName = genResult.modelName;
                  continue;
              }

              logger.error('🚨 EMPTY_CANDIDATES_FINAL: All retries exhausted — user saw error', {
                  journeyId: config.journeyId || null,
                  finishReason,
                  blockReason,
                  safetyRatings: JSON.stringify(safetyRatings || []),
                  turn: currentTurn,
                  model: currentModelName,
                  lastUserMessage: message?.substring(0, 200) || '(no message)',
                  totalEmptyRetries: emptyRetries
              });
              safeSend({ text: "I had a brief hiccup processing that. Could you try sending your message again?" });
              safeSend({ done: true, journeyId: config.journeyId });
              finalDone = true;
              break;
          }
          // Reset empty retry counter on successful response
          emptyRetries = 0;

          const allParts = candidates[0].content.parts;
          const functionCalls = allParts.filter((p: any) => p.functionCall);
          const textParts = allParts.filter((p: any) => p.text);
          
          if (functionCalls && functionCalls.length > 0) {
              // P0 FIX: If model generated BOTH text and tool calls in the same turn,
              // log the discarded text. The tool calls take priority — we'll get proper
              // follow-up text from the next generation with fresh post-tool context.
              if (textParts.length > 0) {
                  const discardedText = textParts.map((p: any) => p.text).join('');
                  if (discardedText.trim().length > 0) {
                      logger.info('🔇 Discarding co-generated text in favor of tool execution', {
                          discardedLength: discardedText.length,
                          discardedPreview: discardedText.substring(0, 150),
                          tools: functionCalls.map((c: any) => c.functionCall?.name)
                      });
                  }
              }

              // Execute all function calls and collect responses
              const functionResponseParts: any[] = [];
              for (const call of functionCalls) {
                  const fn = call.functionCall;
                  if (!fn) continue;

                  // Send tool execution event to frontend for visibility
                  safeSend({ tool: fn.name, status: 'executing', args: fn.args });

                  logger.info(`⚙️ Executing tool: ${fn.name}`, { journeyId: config.journeyId });
                  const toolResult: any = await aiService.executeTool(fn.name, fn.args);

                  // Log tool outcome for observability
                  if (toolResult?.error) {
                      logger.error(`❌ Tool "${fn.name}" returned error`, { error: toolResult.error, args: JSON.stringify(fn.args).substring(0, 500) });
                      // Send error to frontend
                      safeSend({ tool: fn.name, status: 'error', error: toolResult.error });
                  } else {
                      logger.info(`✅ Tool "${fn.name}" succeeded`, { journeyId: config.journeyId });
                      // Send success to frontend
                      safeSend({ tool: fn.name, status: 'success' });
                  }
                  
                  functionResponseParts.push({
                      functionResponse: {
                          name: fn.name,
                          response: { content: toolResult }
                      }
                  });
  
                  if (fn.name === 'create_journey_map' && toolResult && toolResult.journeyMapId) {
                       config.journeyId = toolResult.journeyMapId;
                       safeSend({ journeyId: toolResult.journeyMapId });
                  }
              }

              // Push model response (with function call parts ONLY — strip co-generated text
              // to keep conversation history clean and avoid confusing the model)
              const cleanModelParts = allParts.filter((p: any) => p.functionCall);
              contents.push({ role: 'model', parts: cleanModelParts });
              contents.push({ role: 'function', parts: functionResponseParts });
              
              // Re-fetch journey state after tool calls so the model
              // gets a fresh system instruction reflecting the mutations just made.
              if (config.journeyId) {
                  journeyState = await aiService.getJourneyState(config.journeyId);
                  logger.info('Refreshed journey state after tool calls', { 
                      stage: journeyState?.stage,
                      cellsCompleted: journeyState?.metrics?.totalCellsCompleted 
                  });
              }

              // Rebuild model with fresh state so system instruction is current
              // NOTE: After tool execution, reset to AUTO mode (don't force tools)
              // This prevents the "mute" problem where AI can't narrate results
              const freshModelResult = await aiService.getRequestModel(config, journeyState, currentModelName, false);
              requestModel = freshModelResult.model;
              currentModelName = freshModelResult.modelName;

              genResult = await generateSafe(requestModel, { contents }, currentModelName);
              response = genResult.response;
              requestModel = genResult.model;
              currentModelName = genResult.modelName;
          } else {
              // Pure text response — no tool calls. Send to client.
              const finalText = textParts.map((p: any) => p.text).join('') || "Processing...";
              safeSend({ text: finalText });
              safeSend({ done: true, journeyId: config.journeyId });
              finalDone = true;
          }
      }
  
      if (!finalDone) {
           safeSend({ text: "I'm still thinking, but I hit a limit. Please continue." });
           safeSend({ done: true });
      }
  
      reply.raw.end();
  
    } catch (error: any) {
      logger.error('🚨 CHAT_ERROR: Unhandled exception in /api/chat', { 
          error: error.message, 
          stack: error.stack,
          journeyId: config?.journeyId
      });
      safeSend({ error: error.message });
      if (!reply.raw.destroyed) reply.raw.end();
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
    const user = await authenticateRequest(request);
    if (!user) return requireAuth(reply);
    if (!user.active) return reply.status(403).send({ error: 'Account is inactive' });
    return await adminService.getLinks();
});

// Public endpoint: global templates (for frontend template picker)
server.get('/api/templates', async (request, reply) => {
    const allLinks = await adminService.getLinks();
    const links = Array.isArray(allLinks) ? allLinks : Object.values(allLinks);
    // Return only global templates with public-safe fields
    const globalTemplates = links
        .filter((l: any) => l.global)
        .map((l: any) => ({
            id: l.id,
            configName: l.configName,
            description: l.description || '',
            icon: l.icon || 'file-text',
            requireAuth: !!l.requireAuth,
            createdBy: l.createdBy || null,
        }));
    return globalTemplates;
});

// Public endpoint: get a single link config (used by frontend to load template params)
server.get('/api/links/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const link = await adminService.getLink(id);
    if (!link) return reply.status(404).send({ message: 'Link configuration not found' });
    return link;
});

server.get('/api/admin/links/:id', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return requireAuth(reply);
    const { id } = request.params as { id: string };
    const link = await adminService.getLink(id);
    if (!link) return reply.status(404).send({ message: 'Link configuration not found' });
    return link;
});

server.post('/api/admin/links', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return requireAuth(reply);
    if (!user.active) return reply.status(403).send({ error: 'Account is inactive' });
    const body = request.body as any;
    // Add creator attribution
    body.createdBy = user.email;
    body.createdByName = user.displayName;
    return await adminService.createLink(body);
});

server.put('/api/admin/links/:id', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return requireAuth(reply);
    if (!user.active) return reply.status(403).send({ error: 'Account is inactive' });
    const { id } = request.params as { id: string };
    
    // Check permissions: creator or super_admin
    const existing = await adminService.getLink(id);
    if (existing && existing.createdBy && existing.createdBy !== user.email && user.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Only the template creator or super admin can edit this template' });
    }
    
    const body = request.body as any;
    return await adminService.updateLink(id, body);
});

server.delete('/api/admin/links/:id', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return requireAuth(reply);
    const { id } = request.params as { id: string };
    
    // Check permissions: creator or super_admin
    const existing = await adminService.getLink(id);
    if (existing && existing.createdBy && existing.createdBy !== user.email && user.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Only the template creator or super admin can delete this template' });
    }
    
    return await adminService.deleteLink(id);
});

// Public settings (for frontend)
server.get('/api/settings', async (request, reply) => {
    const settings = await adminService.getSettings();
    // Return only public-safe fields
    return { agentName: settings.agentName || 'Max' };
});

// --- Admin Settings (Super Admin Only) ---

server.get('/api/admin/settings', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return requireAuth(reply);
    if (!requireSuperAdmin(user, reply)) return;
    return await adminService.getSettings();
});

server.put('/api/admin/settings', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return requireAuth(reply);
    if (!requireSuperAdmin(user, reply)) return;
    const body = request.body as any;
    return await adminService.saveSettings(body);
});

// --- Admin Journeys ---

server.get('/api/admin/journeys', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return requireAuth(reply);
    if (!user.active) return reply.status(403).send({ error: 'Account is inactive' });
    return await journeyService.getAllJourneys();
});

server.delete('/api/admin/journeys/:id', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return requireAuth(reply);
    if (!user.active) return reply.status(403).send({ error: 'Account is inactive' });
    const { id } = request.params as { id: string };
    await journeyService.deleteJourney(id);
    return { success: true };
});

server.delete('/api/admin/journeys', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return requireAuth(reply);
    if (!requireSuperAdmin(user, reply)) return;
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

// --- Auth Middleware Helper ---
async function authenticateRequest(request: FastifyRequest): Promise<AppUser | null> {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

    const token = authHeader.split('Bearer ')[1];
    if (!token) return null;

    try {
        // Verify Firebase ID token
        const decoded = await admin.auth().verifyIdToken(token);
        const user = await userService.getOrCreateUser({
            uid: decoded.uid,
            email: decoded.email,
            name: decoded.name || decoded.email
        });
        return user;
    } catch (err: any) {
        logger.warn('Auth token verification failed', { error: err.message });
        return null;
    }
}

function requireAuth(reply: any): null {
    reply.status(401).send({ error: 'Authentication required' });
    return null;
}

function requireSuperAdmin(user: AppUser, reply: any): boolean {
    if (user.role !== 'super_admin') {
        reply.status(403).send({ error: 'Super admin access required' });
        return false;
    }
    return true;
}

// --- Auth Endpoints ---

server.get('/api/admin/me', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return requireAuth(reply);
    if (!user.active) return reply.status(403).send({ error: 'Account is inactive. Contact administrator.' });
    return user;
});

// --- User Management (Super Admin Only) ---

server.get('/api/admin/users', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return requireAuth(reply);
    if (!requireSuperAdmin(user, reply)) return;
    return await userService.listUsers();
});

server.put('/api/admin/users/:uid/active', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return requireAuth(reply);
    if (!requireSuperAdmin(user, reply)) return;
    
    const { uid } = request.params as { uid: string };
    const updated = await userService.toggleUserActive(uid);
    if (!updated) return reply.status(404).send({ error: 'User not found' });
    return updated;
});

// --- Feedback Endpoint (Public) ---

server.post('/api/feedback', async (request, reply) => {
    const body = request.body as any;
    const { text, messages, journeyId, email, templateId } = body || {};
    
    if (!text || !text.trim()) {
        return reply.status(400).send({ error: 'Feedback text is required' });
    }

    const feedback = {
        id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        text: text.trim(),
        messages: messages || [],
        journeyId: journeyId || null,
        templateId: templateId || null,
        email: email || null,
        userAgent: request.headers['user-agent'] || null,
        createdAt: new Date().toISOString()
    };

    await Store.saveFeedback(feedback);
    logger.info('Feedback received', { id: feedback.id, hasMessages: (messages || []).length > 0 });
    return { success: true, id: feedback.id };
});

// --- Admin Feedback (Super Admin) ---

server.get('/api/admin/feedback', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return requireAuth(reply);
    if (!requireSuperAdmin(user, reply)) return;
    return await Store.getFeedback();
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
// Force redeploy 1770738219
