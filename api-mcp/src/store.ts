import fs from 'fs/promises';
import path from 'path';
import { JourneyMap } from './types';

const DATA_DIR = path.join(__dirname, '../data');
const FILE_PATH = path.join(DATA_DIR, 'journey-maps.json');

// Ensure data dir exists
async function initStore() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(FILE_PATH);
    } catch {
      await fs.writeFile(FILE_PATH, JSON.stringify({}, null, 2));
    }
  } catch (error) {
    console.error("Failed to initialize store:", error);
  }
}

async function readAll(): Promise<Record<string, JourneyMap>> {
  await initStore();
  try {
    const data = await fs.readFile(FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveAll(data: Record<string, JourneyMap>) {
    await initStore();
    await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2));
}

export const Store = {
  async get(id: string): Promise<JourneyMap | null> {
    const all = await readAll();
    return all[id] || null;
  },

  async save(journey: JourneyMap): Promise<void> {
    const all = await readAll();
    all[journey.journeyMapId] = journey;
    await saveAll(all);
    // TODO: Emit event here
  },

  async delete(id: string): Promise<void> {
    const all = await readAll();
    delete all[id];
    await saveAll(all);
  },
  
  async list(): Promise<JourneyMap[]> {
      const all = await readAll();
      return Object.values(all);
  }
};
