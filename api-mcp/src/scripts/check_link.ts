
import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'journey-mapper-1770224883';

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();

async function check() {
    console.log(`🔎 Checking 'bernadoodle_owners' in project: ${PROJECT_ID}...`);
    const doc = await db.collection('admin_links').doc('bernadoodle_owners').get();
    
    if (doc.exists) {
        console.log("✅ Found Document:");
        console.log(JSON.stringify(doc.data(), null, 2));
    } else {
        console.log("❌ Document NOT FOUND");
    }
}

check().catch(console.error);
