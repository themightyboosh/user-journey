import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { AIService } from './services/ai-service.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  port: process.env.PORT || 3000,
  mcpApiUrl: process.env.MCP_API_URL || 'http://localhost:3001'
};

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use('/admin', express.static(fileURLToPath(new URL('../admin', import.meta.url))));

// Initialize AI Service
const aiService = AIService.getInstance();
aiService.initialize().catch(err => {
    console.error("Failed to initialize AI Service:", err);
    process.exit(1);
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    model: aiService.activeModelName || 'Initializing...',
    location: aiService.config.location 
  });
});

app.post('/api/chat', async (req, res) => {
  const { message, history = [], config = {}, journeyId } = req.body;

  if (journeyId) config.journeyId = journeyId;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    // Fetch Journey State for Context
    let journeyState = null;
    if (config.journeyId) {
        journeyState = await aiService.getJourneyState(config.journeyId);
    }

    const requestModel = await aiService.getRequestModel(config, journeyState);

    let currentTurn = 0;
    const maxTurns = 5;
    let finalDone = false;

    // Initial Generation
    let result = await requestModel.generateContent({ contents });
    let response = await result.response;
    
    while (currentTurn < maxTurns && !finalDone) {
        currentTurn++;
        
        const functionCalls = response.candidates?.[0]?.content?.parts?.filter(p => p.functionCall);
        
        if (functionCalls && functionCalls.length > 0) {
            for (const call of functionCalls) {
                const fn = call.functionCall;
                const toolResult = await aiService.executeTool(fn.name, fn.args);
                
                const toolResponsePart = {
                    functionResponse: {
                        name: fn.name,
                        response: { content: toolResult }
                    }
                };
                
                contents.push(response.candidates[0].content);
                contents.push({ role: 'function', parts: [toolResponsePart] });

                if (fn.name === 'create_journey_map' && toolResult.journeyMapId) {
                     config.journeyId = toolResult.journeyMapId;
                     res.write(`data: ${JSON.stringify({ journeyId: toolResult.journeyMapId })}\n\n`);
                }
            }
            
            result = await requestModel.generateContent({ contents });
            response = await result.response;
        } else {
            const finalText = response.candidates?.[0]?.content?.parts?.[0]?.text || "Processing...";
            res.write(`data: ${JSON.stringify({ text: finalText })}\n\n`);
            res.write(`data: ${JSON.stringify({ done: true, journeyId: config.journeyId })}\n\n`);
            finalDone = true;
        }
    }

    if (!finalDone) {
         res.write(`data: ${JSON.stringify({ text: "I'm still thinking, but I hit a limit. Please continue." })}\n\n`);
         res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    }

    res.end();

  } catch (error) {
    console.error('Chat error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.get('/api/journey-state/:id', async (req, res) => {
    try {
        const data = await aiService.getJourneyState(req.params.id);
        if (!data) return res.status(404).json({error: "Not found"});
        res.json(data);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.get('/api/admin/links', async (req, res) => {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/api/admin/links`);
        const data = await response.json();
        res.json(data);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.get('/api/admin/links/:id', async (req, res) => {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/api/admin/links/${req.params.id}`);
        if (response.status === 404) return res.status(404).json({ error: "Link config not found" });
        const data = await response.json();
        res.json(data);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.post('/api/admin/links', async (req, res) => {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/api/admin/links`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.put('/api/admin/links/:id', async (req, res) => {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/api/admin/links/${req.params.id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.delete('/api/admin/links/:id', async (req, res) => {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/api/admin/links/${req.params.id}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        res.json(data);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.get('/api/admin/settings', async (req, res) => {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/api/admin/settings`);
        const data = await response.json();
        res.json(data);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.put('/api/admin/settings', async (req, res) => {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/api/admin/settings`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.get('/api/admin/knowledge', async (req, res) => {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/api/admin/knowledge`);
        const data = await response.json();
        res.json(data);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.get('/api/admin/journeys', async (req, res) => {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/v1/journey-maps`);
        const data = await response.json();
        res.json(data);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.post('/api/admin/knowledge', async (req, res) => {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/api/admin/knowledge`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.put('/api/admin/knowledge/:id', async (req, res) => {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/api/admin/knowledge/${req.params.id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.delete('/api/admin/knowledge/:id', async (req, res) => {
    try {
        const response = await fetch(`${CONFIG.mcpApiUrl}/api/admin/knowledge/${req.params.id}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        res.json(data);
    } catch(e) {
        res.status(500).json({error: e.message});
    }
});

app.listen(CONFIG.port, () => {
  console.log(`🚀 Server running at http://localhost:${CONFIG.port}`);
});
