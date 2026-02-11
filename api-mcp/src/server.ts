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
import { TOOLS_VERSION, TOOL_SCOPES } from './ai/tools';

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
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    logger.info('[HANDLER] /api/chat hit', { requestId });

    // --- Validate BEFORE setting SSE headers (so we can return clean 400s) ---
    const body = request.body as any;
    if (!body || !body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
        logger.warn('[HANDLER] Missing or empty message', { requestId, body: JSON.stringify(body).substring(0, 200) });
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
        requestId,
        hasWelcome: !!config.welcomePrompt,
        journeyId: config.journeyId,
        historyLength: history.length,
        messageLength: message.length,
        messagePreview: message.substring(0, 100)
    });

    // Safe SSE write helper — guards against writing to closed/destroyed streams
    const safeSend = (data: object) => {
        if (!reply.raw.destroyed && reply.raw.writable) {
            reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        } else {
            logger.warn('⚠️ Attempted SSE write to closed stream', { journeyId: config?.journeyId });
        }
    };
  
    // Declare variables outside try block for error handling access
    let journeyState: any = null;
    let currentModelName: string = 'UNKNOWN';
    let currentTurn: number = 0;

    try {
      logger.info('Chat request processing', { journeyId, messageLength: message.length });

      const contents = history.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));
      contents.push({ role: 'user', parts: [{ text: message }] });

      // Fetch Journey State for Context
      if (config.journeyId) {
          logger.info('Fetching journey state', { journeyId: config.journeyId });
          journeyState = await aiService.getJourneyState(config.journeyId);
          logger.info('Fetched journey state', { found: !!journeyState });
      }

      // PHASE 3: Auto-Execution Pattern (Bypass LLM for Admin Defaults)
      // CRITICAL: Only bypass if COMPLETE data is present (name + description)
      // Partial data (names only) goes through AI for probing
      const currentStage = journeyState?.stage || 'IDENTITY';

      // Auto-execute phases if admin provided COMPLETE data and we're AT the phases stage
      if (currentStage === 'PHASES' && config.phases && config.phases.length > 0 && journeyState) {
          // Check if ALL phases have descriptions (complete data)
          const hasCompleteData = config.phases.every((p: any) =>
              p.name && p.description && p.description.trim().length > 0
          );

          if (hasCompleteData) {
              logger.info(`🚀 [AUTO-EXEC] Admin phases with COMPLETE data detected, bypassing LLM`, {
                  phases: config.phases.map((p: any) => p.name)
              });

              await aiService.executeTool(config.journeyId!, {
                  name: 'set_phases_bulk',
                  args: { journeyMapId: config.journeyId, phases: config.phases }
              });

              // Refresh journey state after tool execution
              journeyState = await aiService.getJourneyState(config.journeyId!);

              // Stream synthetic message to user
              if (!reply.raw.destroyed && reply.raw.writable) {
                  reply.raw.write(`data: ${JSON.stringify({ text: `I've applied the ${config.phases.length} standard phases for this template.\n\n` })}\n\n`);
              }

              // IMPORTANT: Return early to skip AI processing for this turn
              // The frontend will poll and get the updated journey state
              if (!reply.raw.destroyed && reply.raw.writable) {
                  reply.raw.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                  reply.raw.end();
              }
              return;
          } else {
              logger.info(`ℹ️ Admin phases present but INCOMPLETE (missing descriptions), sending to AI for probing`);
          }
      }

      // Auto-execute swimlanes if admin provided COMPLETE data and we're AT the swimlanes stage
      if (currentStage === 'SWIMLANES' && config.swimlanes && config.swimlanes.length > 0 && journeyState) {
          // Check if ALL swimlanes have descriptions (complete data)
          const hasCompleteData = config.swimlanes.every((s: any) =>
              s.name && s.description && s.description.trim().length > 0
          );

          if (hasCompleteData) {
              logger.info(`🚀 [AUTO-EXEC] Admin swimlanes with COMPLETE data detected, bypassing LLM`, {
                  swimlanes: config.swimlanes.map((s: any) => s.name)
              });

              await aiService.executeTool(config.journeyId!, {
                  name: 'set_swimlanes_bulk',
                  args: { journeyMapId: config.journeyId, swimlanes: config.swimlanes }
              });

              // Refresh journey state after tool execution
              journeyState = await aiService.getJourneyState(config.journeyId!);

              // Stream synthetic message to user
              if (!reply.raw.destroyed && reply.raw.writable) {
                  reply.raw.write(`data: ${JSON.stringify({ text: `I've set up the ${config.swimlanes.length} standard layers. Let's get started.\n\n` })}\n\n`);
              }

              // IMPORTANT: Return early to skip AI processing
              if (!reply.raw.destroyed && reply.raw.writable) {
                  reply.raw.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                  reply.raw.end();
              }
              return;
          } else {
              logger.info(`ℹ️ Admin swimlanes present but INCOMPLETE (missing descriptions), sending to AI for probing`);
          }
      }

      // CRITICAL: Detect confirmation responses to force tool calling
      // Prevents AI from narrating "I'm adding..." without actually calling tools
      const isConfirmationResponse = /^(yes|yeah|yep|yup|correct|right|sure|ok|okay|sounds good|that's right|looks good)$/i.test(message.trim());
      const isConfirmationStage = journeyState?.stage && ['PHASES', 'SWIMLANES'].includes(journeyState.stage);
      const shouldForceTools = isConfirmationResponse && isConfirmationStage;

      if (shouldForceTools) {
          logger.warn(`🎯 CONFIRMATION DETECTED: Forcing mode=ANY to prevent hallucination (stage: ${journeyState.stage}, message: "${message.trim()}")`);
      }

      logger.info('Getting request model', {
          requestId,
          journeyId: config.journeyId,
          stage: journeyState?.stage || 'IDENTITY',
          forceTools: shouldForceTools
      });
      let modelResult = await aiService.getRequestModel(config, journeyState, undefined, shouldForceTools);
      let requestModel = modelResult.model;
      currentModelName = modelResult.modelName;
      logger.info(`Got request model: ${currentModelName}`, {
          requestId,
          modelName: currentModelName,
          stage: journeyState?.stage || 'IDENTITY',
          toolMode: shouldForceTools ? 'ANY (FORCED)' : 'AUTO'
      });

      currentTurn = 0;
      const maxTurns = 10;
      let finalDone = false;
  
      // PHASE 5: Enhanced retry with mode fallback
      const generateSafe = async (model: any, params: any, modelName: string, retryCount = 0, forcedToolMode = shouldForceTools): Promise<any> => {
          try {
              const result = await model.generateContent(params);
              const response = await result.response;
              return { response, model, modelName };
          } catch (e: any) {
              // Handle rate limiting (429)
              if (e.message?.includes('429') || e.status === 429 || e.code === 429 || e.message?.includes('RESOURCE_EXHAUSTED')) {
                   logger.warn(`⚠️ 429 RESOURCE EXHAUSTED for ${modelName} (attempt ${retryCount + 1})`, {
                       requestId,
                       journeyId: config.journeyId,
                       model: modelName,
                       retryCount,
                       errorMessage: e.message,
                       errorStatus: e.status,
                       errorCode: e.code,
                       stage: journeyState?.stage || 'UNKNOWN',
                       historyLength: params.contents?.length || 0
                   });

                   // Backoff: wait before retrying (1s first, 3s second)
                   const backoffMs = retryCount === 0 ? 1000 : 3000;
                   await sleep(backoffMs);

                   // Get the next fallback model name
                   const nextFallbackModel = aiService.getNextFallback(modelName);

                   // Re-fetch journey state so the fallback model gets fresh context
                   let freshState = journeyState;
                   if (config.journeyId) {
                       freshState = await aiService.getJourneyState(config.journeyId);
                   }

                   // Propagate forceToolCalling on fallback retry
                   const newModelResult = await aiService.getRequestModel(config, freshState, nextFallbackModel, forcedToolMode);

                   // Allow up to 2 retries total (original + 2 fallbacks)
                   if (retryCount < 2) {
                       return generateSafe(newModelResult.model, params, newModelResult.modelName, retryCount + 1, forcedToolMode);
                   }

                   // Final attempt without recursion
                   const result = await newModelResult.model.generateContent(params);
                   const response = await result.response;
                   return { response, model: newModelResult.model, modelName: newModelResult.modelName };
              }

              // Handle tool calling errors with mode fallback (400, 500)
              if ((e.status === 400 || e.status === 500) && forcedToolMode && retryCount === 0) {
                  logger.warn(`⚠️ Tool calling error with mode=ANY, falling back to mode=AUTO`, {
                      requestId,
                      journeyId: config.journeyId,
                      error: e.message,
                      errorName: e.name,
                      status: e.status,
                      model: modelName,
                      stage: journeyState?.stage || 'UNKNOWN',
                      wasForced: forcedToolMode,
                      retryCount,
                      lastUserMessage: message?.substring(0, 150) || '(no message)'
                  });

                  // Wait 500ms and retry with mode=AUTO
                  await sleep(500);

                  // Re-fetch journey state
                  let freshState = journeyState;
                  if (config.journeyId) {
                      freshState = await aiService.getJourneyState(config.journeyId);
                  }

                  // Rebuild model WITHOUT forcing tools (mode=AUTO)
                  const autoModelResult = await aiService.getRequestModel(config, freshState, modelName, false);

                  // Retry once with mode=AUTO
                  return generateSafe(autoModelResult.model, params, autoModelResult.modelName, retryCount + 1, false);
              }

              throw e;
          }
      };

      // Initial Generation
      logger.info('Starting generation', {
          requestId,
          journeyId: config.journeyId,
          model: currentModelName,
          contentsLength: contents.length,
          stage: journeyState?.stage || 'IDENTITY',
          forceToolCalling: shouldForceTools
      });
      let genResult = await generateSafe(requestModel, { contents }, currentModelName);
      let response = genResult.response;
      requestModel = genResult.model;
      currentModelName = genResult.modelName;
      logger.info('Got initial response', {
          requestId,
          journeyId: config.journeyId,
          model: currentModelName,
          hasCandidates: response.candidates && response.candidates.length > 0
      });
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

              // Capture last 3 messages from conversation for context
              const recentHistory = contents.slice(-3).map((msg: any, idx: number) => ({
                  index: contents.length - 3 + idx,
                  role: msg.role,
                  hasText: msg.parts?.some((p: any) => p.text),
                  hasFunctionCall: msg.parts?.some((p: any) => p.functionCall),
                  hasFunctionResponse: msg.parts?.some((p: any) => p.functionResponse),
                  preview: msg.parts?.[0]?.text?.substring(0, 150) || msg.parts?.[0]?.functionCall?.name || msg.parts?.[0]?.functionResponse?.name || '(no content)'
              }));

              logger.warn('⚠️ EMPTY_CANDIDATES: AI returned no usable response', {
                  requestId,
                  journeyId: config.journeyId || null,
                  finishReason,
                  blockReason,
                  safetyRatings: JSON.stringify(safetyRatings || []),
                  promptFeedback: JSON.stringify(promptFeedback || {}),
                  turn: currentTurn,
                  model: currentModelName,
                  lastUserMessage: message?.substring(0, 200) || '(no message)',
                  historyLength: contents.length,
                  recentHistory,
                  journeyStage: journeyState?.stage || 'UNKNOWN',
                  journeyMetrics: journeyState?.metrics || {},
                  promptVersion: PROMPTS_VERSION.version,
                  toolsVersion: TOOLS_VERSION.version,
                  forceToolCalling: shouldForceTools,
                  isConfirmationResponse,
                  isConfirmationStage
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

              // CRITICAL: Full diagnostic dump for user-visible errors
              const fullDiagnostic = {
                  requestId,
                  timestamp: new Date().toISOString(),
                  // Error Details
                  finishReason,
                  blockReason,
                  safetyRatings: safetyRatings || [],
                  promptFeedback: promptFeedback || {},
                  totalEmptyRetries: emptyRetries,
                  turn: currentTurn,
                  // Journey Context
                  journeyId: config.journeyId || null,
                  journeyStage: journeyState?.stage || 'UNKNOWN',
                  journeyName: journeyState?.name || null,
                  journeyDescription: journeyState?.description || null,
                  journeyMetrics: journeyState?.metrics || {},
                  completionStatus: journeyState?.completionStatus || null,
                  // Model Configuration
                  model: currentModelName,
                  forceToolCalling: shouldForceTools,
                  isConfirmationResponse,
                  isConfirmationStage,
                  // Prompt Context
                  promptVersion: PROMPTS_VERSION.version,
                  toolsVersion: TOOLS_VERSION.version,
                  // Request Context
                  lastUserMessage: message || '(no message)',
                  messageLength: message?.length || 0,
                  historyLength: contents.length,
                  recentHistory,
                  // Config Context
                  hasWelcomePrompt: !!config.welcomePrompt,
                  hasPersonaFrame: !!config.personaFrame,
                  hasRagContext: !!config.ragContext,
                  hasPhases: Array.isArray(config.phases) && config.phases.length > 0,
                  hasSwimlanes: Array.isArray(config.swimlanes) && config.swimlanes.length > 0,
                  // Journey Structure (if available)
                  phasesCount: journeyState?.phases?.length || 0,
                  swimlanesCount: journeyState?.swimlanes?.length || 0,
                  cellsCount: journeyState?.cells?.length || 0
              };

              logger.error('🚨 EMPTY_CANDIDATES_FINAL: All retries exhausted — user saw error', fullDiagnostic);
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

                  // CRITICAL: Validate tool is allowed for current stage (prevents AI from calling scoped-out tools mentioned in prompt text)
                  const currentStage = journeyState?.stage || 'IDENTITY';
                  const allowedTools = TOOL_SCOPES[currentStage] || [];

                  if (!allowedTools.includes(fn.name)) {
                      logger.warn(`🚫 BLOCKED: AI attempted to call "${fn.name}" which is not allowed in stage ${currentStage}`, {
                          requestId,
                          journeyId: config.journeyId,
                          attemptedTool: fn.name,
                          currentStage,
                          allowedTools,
                          turn: currentTurn
                      });

                      const toolResult = {
                          error: `Tool "${fn.name}" is not available in stage ${currentStage}. Allowed tools: [${allowedTools.join(', ')}]. You must complete the current stage before accessing this tool.`
                      };

                      functionResponseParts.push({
                          functionResponse: {
                              name: fn.name,
                              response: { content: toolResult }
                          }
                      });

                      safeSend({ tool: fn.name, status: 'blocked', error: toolResult.error });
                      continue; // Skip execution
                  }

                  // Send tool execution event to frontend for visibility
                  safeSend({ tool: fn.name, status: 'executing', args: fn.args });

                  logger.info(`⚙️ Executing tool: ${fn.name}`, {
                      requestId,
                      journeyId: config.journeyId,
                      toolName: fn.name,
                      args: fn.args,
                      turn: currentTurn,
                      stage: journeyState?.stage || 'UNKNOWN'
                  });

                  const toolResult: any = await aiService.executeTool(fn.name, fn.args);

                  // Log tool outcome for observability
                  if (toolResult?.error) {
                      logger.error(`❌ Tool "${fn.name}" returned error`, {
                          requestId,
                          journeyId: config.journeyId,
                          toolName: fn.name,
                          error: toolResult.error,
                          args: fn.args,
                          turn: currentTurn,
                          stage: journeyState?.stage || 'UNKNOWN',
                          model: currentModelName,
                          promptVersion: PROMPTS_VERSION.version
                      });
                      // Send error to frontend
                      safeSend({ tool: fn.name, status: 'error', error: toolResult.error });
                  } else {
                      logger.info(`✅ Tool "${fn.name}" succeeded`, {
                          requestId,
                          journeyId: config.journeyId,
                          toolName: fn.name,
                          turn: currentTurn,
                          resultPreview: JSON.stringify(toolResult).substring(0, 200)
                      });
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
          requestId,
          timestamp: new Date().toISOString(),
          error: error.message,
          errorName: error.name,
          errorCode: error.code,
          errorStatus: error.status,
          stack: error.stack,
          journeyId: config?.journeyId,
          journeyStage: journeyState?.stage || 'UNKNOWN',
          model: currentModelName || 'UNKNOWN',
          turn: currentTurn || 0,
          lastUserMessage: message?.substring(0, 200) || '(no message)',
          historyLength: history?.length || 0,
          promptVersion: PROMPTS_VERSION.version,
          toolsVersion: TOOLS_VERSION.version,
          hasConfig: !!config,
          configKeys: config ? Object.keys(config) : []
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
