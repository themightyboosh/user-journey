import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
admin.initializeApp({
    projectId: 'journey-mapper-ai-8822',
    credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function importData() {
    console.log('🔄 Starting Firestore import...\n');

    // Import admin links
    const linksPath = path.join(__dirname, '../../data/admin-links.json');
    const linksData = JSON.parse(fs.readFileSync(linksPath, 'utf-8'));

    console.log(`📋 Found ${Object.keys(linksData).length} templates to import`);

    const batch = db.batch();
    let count = 0;

    for (const [id, link] of Object.entries(linksData)) {
        const docRef = db.collection('admin-links').doc(id);
        batch.set(docRef, link);
        count++;
        console.log(`  ✓ Queued: ${(link as any).configName || id}`);
    }

    await batch.commit();
    console.log(`\n✅ Successfully imported ${count} templates to Firestore!`);

    // Import journeys if they exist
    const journeysPath = path.join(__dirname, '../../data/journey-maps.json');
    if (fs.existsSync(journeysPath)) {
        const journeysData = JSON.parse(fs.readFileSync(journeysPath, 'utf-8'));
        const journeyCount = Object.keys(journeysData).length;

        if (journeyCount > 0) {
            console.log(`\n📊 Found ${journeyCount} journeys to import`);
            const journeyBatch = db.batch();

            for (const [id, journey] of Object.entries(journeysData)) {
                const docRef = db.collection('journey-maps').doc(id);
                journeyBatch.set(docRef, journey);
                console.log(`  ✓ Queued: ${(journey as any).name || id}`);
            }

            await journeyBatch.commit();
            console.log(`\n✅ Successfully imported ${journeyCount} journeys to Firestore!`);
        }
    }

    // Import users if they exist
    const usersPath = path.join(__dirname, '../../data/users.json');
    if (fs.existsSync(usersPath)) {
        const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
        const userCount = Object.keys(usersData).length;

        if (userCount > 0) {
            console.log(`\n👥 Found ${userCount} users to import`);
            const userBatch = db.batch();

            for (const [uid, user] of Object.entries(usersData)) {
                const docRef = db.collection('users').doc(uid);
                userBatch.set(docRef, user);
                console.log(`  ✓ Queued: ${(user as any).email || uid}`);
            }

            await userBatch.commit();
            console.log(`\n✅ Successfully imported ${userCount} users to Firestore!`);
        }
    }

    // Import settings
    const settingsPath = path.join(__dirname, '../../data/settings.json');
    if (fs.existsSync(settingsPath)) {
        const settingsData = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        await db.collection('settings').doc('global').set(settingsData);
        console.log(`\n⚙️  Successfully imported settings to Firestore!`);
    }

    console.log('\n🎉 Import complete!');
    process.exit(0);
}

importData().catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
});
