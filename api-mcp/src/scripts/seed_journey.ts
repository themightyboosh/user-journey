import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://localhost:3001/v1';

const ROLES = ['Product Manager', 'Software Engineer', 'UX Designer', 'Chef', 'Pilot', 'Customer Support'];
const JOURNEY_NAMES = [
    'Onboarding a new user', 
    'Deploying to production', 
    'Cooking a 5-course meal', 
    'Flying a plane from NY to London', 
    'Handling a support ticket'
];
const CONTEXTS = [
    'This is a critical process that often fails due to lack of documentation.',
    'We want to optimize this for speed and efficiency.',
    'Safety is the number one priority here.',
    'Focus on the emotional highs and lows of the user.'
];

const PHASES_POOL = [
    ['Discovery', 'Definition', 'Development', 'Delivery'],
    ['Prep', 'Cook', 'Serve', 'Clean'],
    ['Check-in', 'Security', 'Boarding', 'Flight', 'Landing'],
    ['Triage', 'Investigation', 'Resolution', 'Follow-up']
];

const SWIMLANES_POOL = [
    ['User', 'System', 'Admin'],
    ['Chef', 'Sous Chef', 'Waiter', 'Customer'],
    ['Passenger', 'Gate Agent', 'Pilot', 'Air Traffic Control'],
    ['Agent', 'Knowledge Base', 'Engineering', 'Customer']
];

function getRandom(arr: any[]) {
    return arr[Math.floor(Math.random() * arr.length)];
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson(url: string, options: any = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Error ${response.status}: ${text}`);
        }
        return await response.json();
    } catch (e) {
        console.error(`Fetch failed for ${url}:`, e);
        throw e;
    }
}

async function seed() {
    console.log("🌱 Starting Journey Seeder...");

    const stopProb = Math.random();
    let stopStage = 'COMPLETE';

    if (stopProb < 0.15) stopStage = 'IDENTITY';
    else if (stopProb < 0.3) stopStage = 'METADATA';
    else if (stopProb < 0.45) stopStage = 'PHASES';
    else if (stopProb < 0.6) stopStage = 'SWIMLANES';
    
    console.log(`🎯 Target Stage: ${stopStage}`);

    // 1. Create Journey (Identity)
    const role = getRandom(ROLES);
    const name = "Draft Journey " + new Date().toISOString().split('T')[1].split('.')[0]; // Temporary name
    
    // console.log(`1️⃣  Creating Journey for Role: ${role}...`);
    const initialJourney = await fetchJson(`${API_URL}/journey-maps`, {
        method: 'POST',
        body: JSON.stringify({
            name: name,
            role: role
        })
    }) as any;
    
    const journeyId = initialJourney.journeyMapId;
    console.log(`✅ [${journeyId}] Created (Role: ${role})`);
    
    if (stopStage === 'IDENTITY') {
        console.log("🛑 Stopping at IDENTITY");
        return;
    }

    await delay(100);

    // 2. Define Journey (Metadata)
    const journeyName = getRandom(JOURNEY_NAMES);
    const context = getRandom(CONTEXTS);
    
    await fetchJson(`${API_URL}/journey-maps/${journeyId}`, {
        method: 'PATCH',
        body: JSON.stringify({
            name: journeyName,
            context: context
        })
    });
    console.log(`✅ [${journeyId}] Metadata Set ("${journeyName}")`);

    if (stopStage === 'METADATA') {
        console.log("🛑 Stopping at METADATA");
        return;
    }

    await delay(100);

    // 3. Set Phases
    const phases = getRandom(PHASES_POOL).map((p: string) => ({
        name: p,
        description: `Description for ${p}`
    }));
    
    await fetchJson(`${API_URL}/journey-maps/${journeyId}/phases`, {
        method: 'PUT',
        body: JSON.stringify({
            phases: phases
        })
    });
    console.log(`✅ [${journeyId}] Phases Set (${phases.length})`);

    if (stopStage === 'PHASES') {
        console.log("🛑 Stopping at PHASES");
        return;
    }

    await delay(100);

    // 4. Set Swimlanes
    const swimlanes = getRandom(SWIMLANES_POOL).map((s: string) => ({
        name: s,
        description: `Role of ${s}`
    }));
    
    await fetchJson(`${API_URL}/journey-maps/${journeyId}/swimlanes`, {
        method: 'PUT',
        body: JSON.stringify({
            swimlanes: swimlanes
        })
    });
    console.log(`✅ [${journeyId}] Swimlanes Set (${swimlanes.length})`);

    if (stopStage === 'SWIMLANES') {
        console.log("🛑 Stopping at SWIMLANES");
        return;
    }

    await delay(100);

    // 5. Generate Matrix
    let journeyState = await fetchJson(`${API_URL}/journey-maps/${journeyId}/generate-matrix`, {
        method: 'POST',
        body: JSON.stringify({}) // Send empty object to satisfy Fastify
    }) as any;
    console.log(`✅ [${journeyId}] Matrix Generated`);

    await delay(100);

    // 6. Populate Cells (Randomly)
    // console.log(`6️⃣  Populating Cells...`);
    const cellsToUpdate = journeyState.cells.filter(() => Math.random() > 0.3); // Update 70% of cells
    
    for (const cell of cellsToUpdate) {
        const phase = journeyState.phases.find((p: any) => p.phaseId === cell.phaseId);
        const swimlane = journeyState.swimlanes.find((s: any) => s.swimlaneId === cell.swimlaneId);
        
        await fetchJson(`${API_URL}/journey-maps/${journeyId}/cells/${cell.cellId}`, {
            method: 'PUT',
            body: JSON.stringify({
                action: `${swimlane.name} performs ${phase.name}`,
                context: `Detailed context about how ${swimlane.name} handles the ${phase.name} step in this journey.`
            })
        });
        // process.stdout.write("."); // Progress dot
        // await delay(50); // Visual delay between cells
    }
    
    console.log(`✅ [${journeyId}] Completed (Cells Populated)`);
}

seed().catch(console.error);
