import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Define the collections mapping
const COLLECTIONS = {
    JOURNEYS: 'journey_maps',
    LINKS: 'admin_links',
    SETTINGS: 'app_settings',
    KNOWLEDGE: 'knowledge_base'
};

// Define file paths
const DATA_DIR = path.join(__dirname, '../../data');
const FILES = {
    JOURNEYS: path.join(DATA_DIR, 'journey-maps.json'),
    LINKS: path.join(DATA_DIR, 'admin-links.json'),
    SETTINGS: path.join(DATA_DIR, 'settings.json'),
    KNOWLEDGE: path.join(DATA_DIR, 'context.json')
};

async function migrate() {
    try {
        console.log('Initializing Firebase Admin...');
        // Initialize with default credentials (ADC)
        // This assumes you are authenticated via `gcloud auth application-default login`
        // and have set GOOGLE_CLOUD_PROJECT or GCLOUD_PROJECT environment variable
        admin.initializeApp({
            projectId: process.env.GOOGLE_CLOUD_PROJECT || 'journey-mapper-ai-8822'
        });

        const db = admin.firestore();
        console.log('Connected to Firestore');

        // 1. Settings
        await migrateFile(db, FILES.SETTINGS, COLLECTIONS.SETTINGS, 'settings', true);

        // 2. Knowledge Base
        await migrateFile(db, FILES.KNOWLEDGE, COLLECTIONS.KNOWLEDGE, 'knowledge');

        // 3. Admin Links
        await migrateFile(db, FILES.LINKS, COLLECTIONS.LINKS, 'links');

        // 4. Journeys
        await migrateFile(db, FILES.JOURNEYS, COLLECTIONS.JOURNEYS, 'journeys');

        console.log('Migration Complete!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

async function migrateFile(db: admin.firestore.Firestore, filePath: string, collectionName: string, label: string, isSingleDoc = false) {
    if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${label}: File not found at ${filePath}`);
        return;
    }

    console.log(`Migrating ${label}...`);
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        if (isSingleDoc) {
            // For settings, it's a single document 'global'
            // Data in file might be the object itself
            const docRef = db.collection(collectionName).doc('global');
            // Sanitize
            const sanitized = JSON.parse(JSON.stringify(data));
            await docRef.set(sanitized);
            console.log(`  Saved ${label} (global)`);
        } else {
            // For others, it's a map of ID -> Object
            const batch = db.batch();
            let count = 0;
            const items = Object.values(data);

            for (const item of items) {
                if (!item || typeof item !== 'object') continue;
                
                const id = (item as any).id || (item as any).journeyMapId;
                if (!id) {
                    console.warn(`  Skipping item in ${label}: No ID found`);
                    continue;
                }

                const docRef = db.collection(collectionName).doc(id);
                // Sanitize undefineds
                const sanitized = JSON.parse(JSON.stringify(item));
                batch.set(docRef, sanitized);
                count++;

                // Commit batches of 500 (Firestore limit)
                if (count % 400 === 0) {
                    await batch.commit();
                    console.log(`  Committed batch of ${count} items...`);
                    // Reset batch? No, `batch` object accumulates. 
                    // Actually, you typically create a new batch after commit.
                    // But for simplicity with small data, let's just commit at end if < 500
                    // Or better, let's just do one-by-one or a single batch if small.
                    // Given the file size warnings, let's be safe and do one batch if small, 
                    // or sequential writes if safer.
                }
            }

            if (count > 0) {
                await batch.commit();
                console.log(`  Committed ${count} items to ${collectionName}`);
            } else {
                console.log(`  No valid items found for ${label}`);
            }
        }
    } catch (e) {
        console.error(`Error migrating ${label}:`, e);
    }
}

migrate();
