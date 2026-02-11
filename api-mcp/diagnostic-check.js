// Diagnostic script to check Gemini response
const { VertexAI } = require('@google-cloud/vertexai');

const vertexAI = new VertexAI({
    project: 'journey-mapper-ai-8822',
    location: 'us-central1'
});

const model = vertexAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
});

async function testSimpleResponse() {
    console.log('Testing Gemini 2.5 Flash Lite...\n');

    try {
        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [{ text: 'What is your name and what do you do?' }] },
                { role: 'model', parts: [{ text: 'Hi there! I\'m Max, a UX researcher. I\'m here to understand your daily work and experiences. To start, could you please tell me your name and what you do?' }] },
                { role: 'user', parts: [{ text: 'I am ENzo the Baker' }] }
            ]
        });

        const response = await result.response;
        console.log('Response:', JSON.stringify(response, null, 2));

        if (!response.candidates || response.candidates.length === 0) {
            console.log('\n❌ EMPTY CANDIDATES ERROR');
            console.log('FinishReason:', response.candidates?.[0]?.finishReason);
            console.log('BlockReason:', response.promptFeedback?.blockReason);
            console.log('SafetyRatings:', JSON.stringify(response.candidates?.[0]?.safetyRatings, null, 2));
        } else {
            console.log('\n✅ Response received:');
            console.log(response.candidates[0].content.parts[0].text);
        }

    } catch (error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testSimpleResponse();
