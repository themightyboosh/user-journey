import { server } from '../server';
import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'journey-mapper-1770224883';
const LOCATION = process.env.VERTEX_AI_LOCATION || 'us-central1';
const MODEL = 'gemini-2.5-flash';

// Mock Vertex AI for Simulator (we assume real creds present or we mock response)
// If we want to run this in CI without creds, we should mock.
// For now, let's assume we have local ADC.
const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const simulatorModel = vertexAI.getGenerativeModel({ model: MODEL });

// Helper to parse SSE stream from Injection Response
function parseSSEResponse(payload: string): { text: string; journeyId?: string }[] {
    const lines = payload.split('\n');
    const results: { text: string; journeyId?: string }[] = [];
    
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            try {
                const data = JSON.parse(line.slice(6));
                results.push(data);
            } catch (e) {
                // ignore
            }
        }
    }
    return results;
}

async function runSimulation(persona: string, name: string, maxTurns = 8) {
    console.log(`\n\n=== STARTING SIMULATION: ${name} ===`);
    
    let history: any[] = [];
    let userMessage = "Hi"; 
    let currentJourneyId: string | null = null;
    
    // Simulator context
    let simulatorHistory: any[] = [
        { role: 'user', parts: [{ text: `You are a user testing a Journey Mapping AI. Your persona is: ${persona}. 
        The AI will ask you questions. Answer them according to your persona. 
        Keep your answers relatively brief (under 2 sentences).
        IMPORTANT: Your first message should introduce yourself based on the persona.` }] },
        { role: 'model', parts: [{ text: userMessage }] }
    ];

    for (let i = 0; i < maxTurns; i++) {
        console.log(`\n👤 User (${name}): ${userMessage}`);
        
        // Inject Request
        const response = await server.inject({
            method: 'POST',
            url: '/api/chat',
            payload: {
                message: userMessage,
                history,
                journeyId: currentJourneyId,
                config: {}
            }
        });

        if (response.statusCode !== 200) {
            console.error(`❌ Request Failed: ${response.statusCode}`, response.body);
            throw new Error(`Request failed with ${response.statusCode}`);
        }

        // Parse SSE
        const events = parseSSEResponse(response.body);
        const systemText = events.map(e => e.text || '').join('');
        const journeyIdEvent = events.find(e => e.journeyId);
        
        if (journeyIdEvent) {
            currentJourneyId = journeyIdEvent.journeyId || null;
            if (currentJourneyId) console.log(`🔑 Journey ID: ${currentJourneyId}`);
        }

        console.log(`🤖 System: ${systemText.substring(0, 100)}...`); // Truncate log

        // Update History
        history.push({ role: 'user', content: userMessage });
        history.push({ role: 'assistant', content: systemText }); // Role must match what server expects in history

        // Generate Next User Message
        simulatorHistory.push({ role: 'user', parts: [{ text: `[SYSTEM MESSAGE]: ${systemText}` }] });
        
        try {
            const simResult = await simulatorModel.generateContent({ contents: simulatorHistory });
            const nextMsg = simResult.response.candidates?.[0]?.content?.parts?.[0]?.text;
            userMessage = nextMsg || "I don't know.";
            simulatorHistory.push({ role: 'model', parts: [{ text: userMessage }] });
        } catch (e) {
            console.warn("Simulator Error (probably safety filter or quota):", e);
            break;
        }

        // Check for completion signal
        if (systemText.includes("generate_artifacts") || systemText.toLowerCase().includes("thank you for your time")) {
            console.log("✅ Conversation appears complete.");
            break;
        }
    }
}

describe('Journey Mapper Integrity Tests', () => {
    
    // Ensure server is ready
    beforeAll(async () => {
        await server.ready();
    });

    // Clean up
    afterAll(async () => {
        await server.close();
    });

    test('Happy Path Simulation', async () => {
        await runSimulation(
            `You are Daniel, a PM mapping 'User Registration'. Steps: Sign Up, Verify. Actors: User, System.`,
            "Happy_Daniel"
        );
    }, 120000); // 2 min timeout

});
