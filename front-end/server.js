/**
 * M.AX Chat Server
 * Vertex AI Gemini Streaming Backend
 */

import express from 'express';
import cors from 'cors';
import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  port: process.env.PORT || 3000,
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.VERTEX_AI_LOCATION || 'us-central1',
  model: process.env.VERTEX_AI_MODEL || 'gemini-1.5-flash',
};

// Validate configuration
if (!CONFIG.projectId) {
  console.error('❌ GOOGLE_CLOUD_PROJECT environment variable is required');
  console.error('   Copy .env.example to .env and set your project ID');
  process.exit(1);
}

// Initialize Vertex AI
const vertexAI = new VertexAI({
  project: CONFIG.projectId,
  location: CONFIG.location,
});

// Get the generative model
const generativeModel = vertexAI.getGenerativeModel({
  model: CONFIG.model,
  generationConfig: {
    maxOutputTokens: 2048,
    temperature: 0.7,
    topP: 0.9,
  },
  systemInstruction: {
    parts: [{
      text: `You are M.AX, a helpful and knowledgeable AI assistant. 
You provide clear, accurate, and thoughtful responses.
You are friendly but professional.
When appropriate, you use formatting like bullet points and paragraphs to make responses easy to read.
Keep responses concise but complete.`
    }]
  }
});

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(__dirname));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    model: CONFIG.model,
    location: CONFIG.location 
  });
});

// Chat endpoint with streaming
app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    // Build chat history for context
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // Start streaming chat
    const streamingResult = await generativeModel.generateContentStream({ contents });

    // Stream response chunks
    for await (const chunk of streamingResult.stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        // Send as SSE data event
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    // Send completion signal
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Streaming error:', error);
    
    // Send error as SSE
    res.write(`data: ${JSON.stringify({ error: error.message || 'Failed to generate response' })}\n\n`);
    res.end();
  }
});

// Non-streaming chat endpoint (fallback)
app.post('/api/chat/sync', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const contents = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const result = await generativeModel.generateContent({ contents });
    const response = result.response.candidates?.[0]?.content?.parts?.[0]?.text;

    res.json({ response });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate response' });
  }
});

// Start server
app.listen(CONFIG.port, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   ███╗   ███╗    █████╗ ██╗  ██╗                          ║');
  console.log('║   ████╗ ████║   ██╔══██╗╚██╗██╔╝                          ║');
  console.log('║   ██╔████╔██║   ███████║ ╚███╔╝                           ║');
  console.log('║   ██║╚██╔╝██║   ██╔══██║ ██╔██╗                           ║');
  console.log('║   ██║ ╚═╝ ██║██╗██║  ██║██╔╝ ██╗                          ║');
  console.log('║   ╚═╝     ╚═╝╚═╝╚═╝  ╚═╝╚═╝  ╚═╝                          ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  🚀 Server running at http://localhost:${CONFIG.port}`);
  console.log(`  🤖 Model: ${CONFIG.model}`);
  console.log(`  📍 Location: ${CONFIG.location}`);
  console.log('');
});
