
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'journey-mapper-ai-8822';

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();

async function fix() {
    console.log(`🔧 Fixing 'bernadoodle_owners' link for project: ${PROJECT_ID}...`);

    // 1. Ensure Knowledge Base exists
    const knowledgeId = "7ec6ccab-860b-4411-b09d-86afaa8f105d";
    const knowledgeData = {
        "id": knowledgeId,
        "createdAt": "2026-02-05T23:08:29.813Z",
        "title": "Bernadoodle Context",
        "content": "# Bernedoodle Care Guide  \n_A structured reference for Retrieval-Augmented Generation (RAG) ingestion_\n\n---\n\n## Overview\n\nA **Bernedoodle** is a cross between a Bernese Mountain Dog and a Poodle. They are typically intelligent, social, energetic, and people-oriented. Coat type (curly, wavy, or straight) significantly affects grooming requirements. Sizes vary: Toy, Mini, and Standard.\n\nPrimary care pillars:\n- Grooming & coat maintenance\n- Exercise & mental stimulation\n- Nutrition & weight management\n- Training & behavioral shaping\n- Preventative health & veterinary care\n- Environment & lifestyle fit\n\n---\n\n## 1. Grooming & Coat Maintenance\n\n### Coat Types\n- **Curly (Poodle-like):** High grooming needs, low shedding.\n- **Wavy (Fleece):** Moderate grooming, minimal shedding.\n- **Straight:** Lower grooming, more shedding.\n\n### Routine\n- Brush: 3–5x per week (daily for curly coats).\n- Professional grooming: Every 6–8 weeks.\n- Bathing: Every 4–6 weeks (or as needed).\n- Ear cleaning: Weekly (prone to ear infections).\n- Nail trimming: Every 3–4 weeks.\n- Teeth brushing: 2–3x per week minimum.\n\n### Risks\n- Matting (especially behind ears, under legs)\n- Moisture-related ear infections\n- Tear staining in lighter coats\n\n---\n\n## 2. Exercise & Mental Stimulation\n\nBernedoodles require both physical and cognitive engagement.\n\n### Daily Exercise\n- Standard: 60–90 minutes\n- Mini/Toy: 30–60 minutes\n\nInclude:\n- Structured walks\n- Off-leash play (secure areas)\n- Fetch or agility work\n\n### Mental Stimulation\n- Puzzle feeders\n- Obedience drills\n- Scent games\n- Training new commands\n\nWithout stimulation, they may develop:\n- Separation anxiety\n- Destructive chewing\n- Excessive barking\n\n---\n\n## 3. Nutrition & Weight Management\n\n### Feeding\n- High-quality protein-based kibble or vet-approved diet\n- Portion based on size, metabolism, and activity level\n- Split into 2 meals per day\n\n### Monitor\n- Weight monthly\n- Body condition score (ribs palpable, waist visible)\n- Stool consistency\n\nAvoid:\n- Overfeeding (large breeds prone to joint strain)\n- Excess treats (>10% daily calories)\n\n---\n\n## 4. Training & Behavioral Development\n\nBernedoodles are intelligent and responsive but can be stubborn.\n\n### Training Principles\n- Positive reinforcement only\n- Short, consistent sessions (5–15 minutes)\n- Early socialization (8–16 weeks critical window)\n\n### Priorities\n- Leash training\n- Crate training\n- Recall reliability\n- Exposure to varied environments\n\nHigh social dependency means they do poorly with prolonged isolation.\n\n---\n\n## 5. Health & Preventative Care\n\n### Common Risks\n- Hip dysplasia\n- Elbow dysplasia\n- Progressive retinal atrophy\n- Allergies\n- Bloat (larger sizes)\n\n### Preventative Care\n- Annual vet exams (biannual for seniors)\n- Vaccination schedule adherence\n- Heartworm & flea prevention\n- Joint supplements (large variants, vet-advised)\n\nSpay/neuter timing should be discussed with a vet, especially for larger dogs due to growth plate development.\n\n---\n\n## 6. Environment & Lifestyle Fit\n\nBernedoodles thrive in:\n- Active households\n- Homes with consistent companionship\n- Moderate-to-large living spaces (Standard size)\n\nThey tolerate cold better than extreme heat (due to Bernese lineage).\n\n---\n\n## Ownership Summary\n\nBernedoodles are high-engagement, relationship-oriented dogs requiring:\n- Consistent grooming\n- Structured daily activity\n- Emotional presence from owners\n- Preventative joint care (especially Standard size)\n\nBest suited for owners seeking an intelligent, affectionate, and interactive companion.",
        "isActive": true,
        "updatedAt": "2026-02-05T23:08:52.281Z"
    };

    await db.collection('knowledge_base').doc(knowledgeId).set(knowledgeData);
    console.log("✅ Knowledge Base entry ensured.");

    // 2. Ensure Link exists
    const linkId = "bernadoodle_owners";
    const linkData = {
        "id": linkId,
        "createdAt": new Date().toISOString(),
        "configName": "Banner Care (Fixed)",
        "name": "Scott",
        "role": "Dog Owner",
        "journey": "A Day of Taking Care of Banner",
        "welcomePrompt": "Welcome Scott and congratulate him on being a new pet parent of Banner, a 10 week old bernadoodle.",
        "journeyPrompt": "",
        "swimlanes": [
          {
            "name": "Activity",
            "description": "The activity they perform"
          },
          {
            "name": "Location",
            "description": "Where they are during this phase"
          },
          {
            "name": "Pain Point",
            "description": "What causes discomfort or stress at this point"
          }
        ],
        "knowledgeIds": [
          knowledgeId
        ],
        "updatedAt": new Date().toISOString()
    };

    await db.collection('admin_links').doc(linkId).set(linkData);
    console.log("✅ Link 'bernadoodle_owners' created/updated.");
}

fix().catch(console.error);
