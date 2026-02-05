import fs from 'fs/promises';
import path from 'path';
import { JourneyMap } from './types';

const DATA_DIR = path.join(__dirname, '../data');
const FILE_PATH = path.join(DATA_DIR, 'journey-maps.json');
const LINKS_FILE_PATH = path.join(DATA_DIR, 'admin-links.json');
const SETTINGS_FILE_PATH = path.join(DATA_DIR, 'settings.json');
const KNOWLEDGE_FILE_PATH = path.join(DATA_DIR, 'context.json');

// Ensure data dir exists
async function initStore() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(FILE_PATH);
    } catch {
      await fs.writeFile(FILE_PATH, JSON.stringify({}, null, 2));
    }
    try {
      await fs.access(LINKS_FILE_PATH);
    } catch {
      await fs.writeFile(LINKS_FILE_PATH, JSON.stringify({}, null, 2));
    }
    try {
      await fs.access(SETTINGS_FILE_PATH);
    } catch {
      await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify({ agentName: "Max" }, null, 2));
    }
    try {
      await fs.access(KNOWLEDGE_FILE_PATH);
    } catch {
      const defaultKnowledge = {
        "default-ux-core": {
          id: "default-ux-core",
          title: "Default: UX Research & Analysis Core",
          content: `### UX Research Core Principles
1. **Empathy First**: Always seek to understand the user's underlying motivations, not just their actions. Ask "Why?" frequently.
2. **Context Matters**: A user's environment (physical, social, technical) significantly impacts their journey. Probe for these details.
3. **Mental Models**: Users approach systems with existing expectations. Identify where the system matches or breaks these models.
4. **Pain Points vs. Opportunities**: Distinguish between a simple frustration (pain point) and a missing capability (opportunity).

### Business Analysis Best Practices
1. **Process Mapping**: Look for the trigger, the steps, decision points, and the outcome.
2. **System Interactions**: explicit identify when a user crosses from manual work to digital tool interaction.
3. **Data Flow**: What information is required at each step? Where does it come from?
4. **Stakeholders**: Who else is involved in this process? (Directly or indirectly).

### Interviewing Techniques
- **The Grand Tour**: "Walk me through a typical day..."
- **Critical Incident**: "Tell me about the last time this went wrong..."
- **Naive Outsider**: "I'm new to this, can you explain it like I'm 5?"
- **Mirroring**: Repeat the last few words to encourage elaboration.`,
          isActive: true,
          createdAt: new Date().toISOString()
        }
      };
      await fs.writeFile(KNOWLEDGE_FILE_PATH, JSON.stringify(defaultKnowledge, null, 2));
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

async function readAllLinks(): Promise<Record<string, any>> {
  await initStore();
  try {
    const data = await fs.readFile(LINKS_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveAll(data: Record<string, JourneyMap>) {
    await initStore();
    await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2));
}

async function saveAllLinks(data: Record<string, any>) {
    await initStore();
    await fs.writeFile(LINKS_FILE_PATH, JSON.stringify(data, null, 2));
}

async function readSettings(): Promise<any> {
  await initStore();
  try {
    const data = await fs.readFile(SETTINGS_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { agentName: "Max" };
  }
}

async function saveSettings(data: any) {
    await initStore();
    await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(data, null, 2));
}

async function readAllKnowledge(): Promise<Record<string, any>> {
  await initStore();
  try {
    const data = await fs.readFile(KNOWLEDGE_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveAllKnowledge(data: Record<string, any>) {
    await initStore();
    await fs.writeFile(KNOWLEDGE_FILE_PATH, JSON.stringify(data, null, 2));
}

export const Store = {
  // Journey Methods
  async get(id: string): Promise<JourneyMap | null> {
    const all = await readAll();
    return all[id] || null;
  },

  async save(journey: JourneyMap): Promise<void> {
    const all = await readAll();
    all[journey.journeyMapId] = journey;
    await saveAll(all);
  },

  async delete(id: string): Promise<void> {
    const all = await readAll();
    delete all[id];
    await saveAll(all);
  },
  
  async list(): Promise<JourneyMap[]> {
      const all = await readAll();
      return Object.values(all);
  },

  // Link Methods
  async getLinks(): Promise<any[]> {
      const all = await readAllLinks();
      return Object.values(all);
  },

  async saveLink(link: any): Promise<void> {
      const all = await readAllLinks();
      all[link.id] = link;
      await saveAllLinks(all);
  },

  async deleteLink(id: string): Promise<void> {
      const all = await readAllLinks();
      delete all[id];
      await saveAllLinks(all);
  },

  // Settings Methods
  async getSettings(): Promise<any> {
      return await readSettings();
  },

  async saveSettings(settings: any): Promise<void> {
      await saveSettings(settings);
  },

  // Knowledge Methods
  async getKnowledge(): Promise<any[]> {
      const all = await readAllKnowledge();
      return Object.values(all);
  },

  async saveKnowledge(item: any): Promise<void> {
      const all = await readAllKnowledge();
      all[item.id] = item;
      await saveAllKnowledge(all);
  },

  async deleteKnowledge(id: string): Promise<void> {
      const all = await readAllKnowledge();
      delete all[id];
      await saveAllKnowledge(all);
  }
};