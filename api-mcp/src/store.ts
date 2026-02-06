import fs from 'fs/promises';
import path from 'path';
import { JourneyMap } from './types';
import * as admin from 'firebase-admin';
import logger from './logger';

// Initialize Firebase if in Cloud Environment
const isFirebase = process.env.FIREBASE_CONFIG || process.env.K_SERVICE;

if (isFirebase) {
    try {
        if (!admin.apps.length) {
            admin.initializeApp({
                projectId: process.env.GOOGLE_CLOUD_PROJECT || 'journey-mapper-ai-8822'
            });
            logger.info("Firebase Admin Initialized with explicit projectId");
        } else {
            logger.info("Firebase Admin already initialized via apps check");
        }
    } catch (e) {
        logger.error("Firebase Admin initialization failed", { error: e });
    }
}

// --- Interfaces ---
interface StorageAdapter {
    // Journey
    getJourney(id: string): Promise<JourneyMap | null>;
    saveJourney(journey: JourneyMap): Promise<void>;
    deleteJourney(id: string): Promise<void>;
    deleteAllJourneys(): Promise<void>;
    listJourneys(): Promise<JourneyMap[]>;

    // Links
    getLinks(): Promise<any[]>;
    saveLink(link: any): Promise<void>;
    deleteLink(id: string): Promise<void>;

    // Settings
    getSettings(): Promise<any>;
    saveSettings(settings: any): Promise<void>;

    // Knowledge
    getKnowledge(): Promise<any[]>;
    saveKnowledge(item: any): Promise<void>;
    deleteKnowledge(id: string): Promise<void>;
}

// --- File Adapter (Local Dev) ---
class FileStorageAdapter implements StorageAdapter {
    private DATA_DIR = path.join(__dirname, '../data');
    private FILES = {
        JOURNEYS: path.join(this.DATA_DIR, 'journey-maps.json'),
        LINKS: path.join(this.DATA_DIR, 'admin-links.json'),
        SETTINGS: path.join(this.DATA_DIR, 'settings.json'),
        KNOWLEDGE: path.join(this.DATA_DIR, 'context.json')
    };

    constructor() {
        this.init();
    }

    private async init() {
        try {
            await fs.mkdir(this.DATA_DIR, { recursive: true });
            const defaults = [
                { path: this.FILES.JOURNEYS, content: {} },
                { path: this.FILES.LINKS, content: {} },
                { path: this.FILES.SETTINGS, content: { agentName: "Max" } },
                { 
                    path: this.FILES.KNOWLEDGE, 
                    content: {
                        "default-ux-core": {
                            id: "default-ux-core",
                            title: "Default: UX Research & Analysis Core",
                            content: `### UX Research Core Principles...`, // Truncated for brevity in init, essentially same default
                            isActive: true,
                            createdAt: new Date().toISOString()
                        }
                    } 
                }
            ];

            for (const f of defaults) {
                try {
                    await fs.access(f.path);
                } catch {
                    await fs.writeFile(f.path, JSON.stringify(f.content, null, 2));
                }
            }
        } catch (e) {
            console.error("File Store Init Error", e);
        }
    }

    private async read(filePath: string): Promise<any> {
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        } catch { return {}; }
    }

    private async write(filePath: string, data: any) {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }

    // Journey
    async getJourney(id: string) { const all = await this.read(this.FILES.JOURNEYS); return all[id] || null; }
    async saveJourney(j: JourneyMap) { const all = await this.read(this.FILES.JOURNEYS); all[j.journeyMapId] = j; await this.write(this.FILES.JOURNEYS, all); }
    async deleteJourney(id: string) { const all = await this.read(this.FILES.JOURNEYS); delete all[id]; await this.write(this.FILES.JOURNEYS, all); }
    async deleteAllJourneys() { await this.write(this.FILES.JOURNEYS, {}); }
    async listJourneys() { return Object.values(await this.read(this.FILES.JOURNEYS)) as JourneyMap[]; }

    // Links
    async getLinks() { return Object.values(await this.read(this.FILES.LINKS)); }
    async saveLink(l: any) { const all = await this.read(this.FILES.LINKS); all[l.id] = l; await this.write(this.FILES.LINKS, all); }
    async deleteLink(id: string) { const all = await this.read(this.FILES.LINKS); delete all[id]; await this.write(this.FILES.LINKS, all); }

    // Settings
    async getSettings() { return await this.read(this.FILES.SETTINGS); }
    async saveSettings(s: any) { await this.write(this.FILES.SETTINGS, s); }

    // Knowledge
    async getKnowledge() { return Object.values(await this.read(this.FILES.KNOWLEDGE)); }
    async saveKnowledge(k: any) { const all = await this.read(this.FILES.KNOWLEDGE); all[k.id] = k; await this.write(this.FILES.KNOWLEDGE, all); }
    async deleteKnowledge(id: string) { const all = await this.read(this.FILES.KNOWLEDGE); delete all[id]; await this.write(this.FILES.KNOWLEDGE, all); }
}

// --- Firestore Adapter (Production) ---
class FirestoreAdapter implements StorageAdapter {
    private db = admin.firestore();
    private COLLS = {
        JOURNEYS: 'journey_maps',
        LINKS: 'admin_links',
        SETTINGS: 'app_settings',
        KNOWLEDGE: 'knowledge_base'
    };

    // Journey
    async getJourney(id: string): Promise<JourneyMap | null> {
        const doc = await this.db.collection(this.COLLS.JOURNEYS).doc(id).get();
        return doc.exists ? doc.data() as JourneyMap : null;
    }
    async saveJourney(j: JourneyMap): Promise<void> {
        // Use merge to be safe, though usually we overwrite whole state in this app model
        await this.db.collection(this.COLLS.JOURNEYS).doc(j.journeyMapId).set(j); 
    }
    async deleteJourney(id: string): Promise<void> {
        await this.db.collection(this.COLLS.JOURNEYS).doc(id).delete();
    }
    async deleteAllJourneys(): Promise<void> {
        const batchSize = 500;
        const collectionRef = this.db.collection(this.COLLS.JOURNEYS);
        const query = collectionRef.orderBy('__name__').limit(batchSize);

        return new Promise((resolve, reject) => {
            const deleteQueryBatch = (query: FirebaseFirestore.Query) => {
                query.get()
                    .then((snapshot) => {
                        if (snapshot.size === 0) {
                            return 0;
                        }

                        const batch = this.db.batch();
                        snapshot.docs.forEach((doc) => {
                            batch.delete(doc.ref);
                        });
                        return batch.commit().then(() => snapshot.size);
                    })
                    .then((numDeleted) => {
                        if (numDeleted === 0) {
                            resolve();
                            return;
                        }
                        process.nextTick(() => {
                            deleteQueryBatch(query);
                        });
                    })
                    .catch(reject);
            };

            deleteQueryBatch(query);
        });
    }
    async listJourneys(): Promise<JourneyMap[]> {
        const snap = await this.db.collection(this.COLLS.JOURNEYS).get();
        return snap.docs.map(d => d.data() as JourneyMap);
    }

    // Links
    async getLinks(): Promise<any[]> {
        const snap = await this.db.collection(this.COLLS.LINKS).get();
        return snap.docs.map(d => d.data());
    }
    async saveLink(l: any): Promise<void> {
        await this.db.collection(this.COLLS.LINKS).doc(l.id).set(l);
    }
    async deleteLink(id: string): Promise<void> {
        await this.db.collection(this.COLLS.LINKS).doc(id).delete();
    }

    // Settings (Stored as single doc 'global')
    async getSettings(): Promise<any> {
        try {
            const doc = await this.db.collection(this.COLLS.SETTINGS).doc('global').get();
            return doc.exists ? doc.data() : { agentName: "Max" };
        } catch (error) {
            logger.error('Error fetching settings from Firestore', { error });
            throw error;
        }
    }
    async saveSettings(s: any): Promise<void> {
        try {
            logger.info('Starting saveSettings', { input: s });
            // Remove undefined fields which Firestore rejects
            const sanitized = JSON.parse(JSON.stringify(s));
            logger.info('Sanitized data', { sanitized });
            
            const docRef = this.db.collection(this.COLLS.SETTINGS).doc('global');
            logger.info('DocRef created', { path: docRef.path });

            await docRef.set(sanitized);
            logger.info('Settings saved successfully');
        } catch (error) {
            logger.error('Error saving settings to Firestore', { error, data: s });
            throw error;
        }
    }

    // Knowledge
    async getKnowledge(): Promise<any[]> {
        const snap = await this.db.collection(this.COLLS.KNOWLEDGE).get();
        return snap.docs.map(d => d.data());
    }
    async saveKnowledge(k: any): Promise<void> {
        await this.db.collection(this.COLLS.KNOWLEDGE).doc(k.id).set(k);
    }
    async deleteKnowledge(id: string): Promise<void> {
        await this.db.collection(this.COLLS.KNOWLEDGE).doc(id).delete();
    }
}

// Select Adapter
const adapter: StorageAdapter = isFirebase ? new FirestoreAdapter() : new FileStorageAdapter();

// --- Export Facade ---
export const Store = {
  // Journey Methods
  async get(id: string) { return adapter.getJourney(id); },
  async save(journey: JourneyMap) { return adapter.saveJourney(journey); },
  async delete(id: string) { return adapter.deleteJourney(id); },
  async deleteAll() { return adapter.deleteAllJourneys(); },
  async list() { return adapter.listJourneys(); },

  // Link Methods
  async getLinks() { return adapter.getLinks(); },
  async saveLink(link: any) { return adapter.saveLink(link); },
  async deleteLink(id: string) { return adapter.deleteLink(id); },

  // Settings Methods
  async getSettings() { return adapter.getSettings(); },
  async saveSettings(settings: any) { return adapter.saveSettings(settings); },

  // Knowledge Methods
  async getKnowledge() { return adapter.getKnowledge(); },
  async saveKnowledge(item: any) { return adapter.saveKnowledge(item); },
  async deleteKnowledge(id: string) { return adapter.deleteKnowledge(id); }
};