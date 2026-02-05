import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from the root or api-mcp (assuming we are running from api-mcp)
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); 

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'journey-mapper-1770224883';
const LOCATION = 'us-central1';
const MODEL = 'gemini-2.5-flash'; // Use the fast one for tests

const FRONTEND_URL = 'http://localhost:3000/api/chat/sync'; // We added a sync endpoint in server.js
const API_URL = 'http://localhost:3001/v1/journey-maps';

// Initialize Vertex AI for the User Simulator
const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const model = vertexAI.getGenerativeModel({ model: MODEL });

// Helper to send message to System (Frontend)
async function sendToSystem(message: string, history: any[], journeyId: string | null = null) {
    const body: any = { message, history };
    if (journeyId) {
        body.journeyId = journeyId;
    }

    const response = await fetch(FRONTEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        throw new Error(`System Error: ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    return { response: data.response, journeyId: data.journeyId };
}

// Helper to get Latest Journey
async function getLatestJourney() {
    // Since we don't have a list endpoint exposed easily, we'll try to sniff it or 
    // we just have to rely on the fact that the system *should* have created one.
    // Actually, we can list the store if we are running locally, but let's assume black box.
    // We will ask the System "What is the journey ID?" in the test? No.
    // We'll just check if *any* journey exists.
    // For this test, we care about the *Conversation Flow* primarily.
    return null; 
}

async function runSimulation(persona: string, name: string, maxTurns = 10) {
    console.log(`\n\n=== STARTING SIMULATION: ${name} ===`);
    console.log(`Persona: ${persona}`);
    
    let history: any[] = [];
    let userMessage = "Hi"; // Start with a greeting
    let currentJourneyId: string | null = null;
    
    // User Simulator History (separate from System History)
    let simulatorHistory: any[] = [
        { role: 'user', parts: [{ text: `You are a user testing a Journey Mapping AI. Your persona is: ${persona}. 
        The AI will ask you questions. Answer them according to your persona. 
        Keep your answers relatively brief (under 3 sentences).
        IMPORTANT: Your first message should introduce yourself based on the persona.` }] },
        { role: 'model', parts: [{ text: userMessage }] }
    ];

    for (let i = 0; i < maxTurns; i++) {
        // 1. Send User Message to System
        console.log(`\n👤 User (${name}): ${userMessage}`);
        let systemResponse;
        try {
            const result = await sendToSystem(userMessage, history, currentJourneyId);
            systemResponse = result.response;
            if (result.journeyId) {
                currentJourneyId = result.journeyId;
                console.log(`🔑 Captured Journey ID: ${currentJourneyId}`);
            }
        } catch (e) {
            console.error("❌ System crashed:", e);
            break;
        }
        
        console.log(`🤖 System: ${systemResponse}`);
        
        // Update System History
        history.push({ role: 'user', content: userMessage });
        history.push({ role: 'model', content: systemResponse });
        
        // 2. Generate Next User Message using AI Simulator
        // CRITICAL FIX: The System's response is INPUT (User) to the Simulator Model.
        // The Simulator's output is the Persona's response (Model).
        simulatorHistory.push({ role: 'user', parts: [{ text: `[SYSTEM MESSAGE]: ${systemResponse}` }] });
        
        const result = await model.generateContent({ contents: simulatorHistory });
        
        if (!result.response.candidates?.[0]?.content?.parts?.[0]?.text) {
             console.log("⚠️ SIMULATOR GENERATED EMPTY/INVALID RESPONSE:", JSON.stringify(result, null, 2));
        }

        const nextUserMessage = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "I don't know.";
        
        userMessage = nextUserMessage;
        simulatorHistory.push({ role: 'model', parts: [{ text: userMessage }] });
        
        // Break if finished
        if (systemResponse.includes("generate_artifacts") || systemResponse.toLowerCase().includes("thank you")) {
            console.log("✅ Conversation appears complete.");
            // break; // Don't break immediately, let it run a bit to see if it finalizes
        }
    }
}

describe('Journey Mapper AI Probing Tests', () => {
    
    test('Happy Path: Cooperative Product Manager', async () => {
        await runSimulation(
            `You are Daniel, a helpful Product Manager wanting to map the 'User Registration' flow. 
             You know the steps clearly: Sign Up, Verify Email, Onboarding. 
             You act happy and cooperative.
             
             IMPORTANT INSTRUCTIONS:
             - When asked for your name and role, reply: "I'm Daniel, the Product Manager."
             - When asked about the process, reply: "I want to map the User Registration flow."
             - When asked for steps/phases, reply: "Sign Up, Verify Email, Onboarding."
             - When asked for swimlanes/actors, reply: "User, System, Email Service."
             - When asked about cells, give a brief description of what happens.
             `,
            "Happy_Daniel"
        );
    }, 120000);

    test('Oppositional: Vague Stakeholder', async () => {
        await runSimulation(
            `You are Grumpy Gary. You want to map 'Something about login'. 
             You are vague, give one word answers, and challenge the AI. 
             You don't know the steps.
             But eventually, you grudgingly give in.
             
             IMPORTANT:
             - When asked for name, say "Gary". Role: "Boss".
             - Be difficult but answer eventually so the test progresses.
             `,
            "Grumpy_Gary"
        );
    }, 120000);

});
