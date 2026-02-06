import { v4 as uuidv4 } from 'uuid';
import { Store } from '../store';

export class AdminService {
    private static instance: AdminService;
    
    // Simple In-Memory Cache
    private cache: {
        settings: { data: any, timestamp: number } | null;
        knowledge: { data: any[], timestamp: number } | null;
        links: { data: any[], timestamp: number } | null;
    } = {
        settings: null,
        knowledge: null,
        links: null
    };

    // TTL: 60 Seconds
    private CACHE_TTL = 60 * 1000;

    private constructor() {}

    public static getInstance(): AdminService {
        if (!AdminService.instance) {
            AdminService.instance = new AdminService();
        }
        return AdminService.instance;
    }

    private isFresh(cacheEntry: { timestamp: number } | null): boolean {
        if (!cacheEntry) return false;
        return (Date.now() - cacheEntry.timestamp) < this.CACHE_TTL;
    }

    async getLinks() {
        if (this.isFresh(this.cache.links)) {
            return this.cache.links!.data;
        }
        const data = await Store.getLinks();
        this.cache.links = { data, timestamp: Date.now() };
        return data;
    }

    async getLink(id: string) {
        // Use getLinks() which handles caching
        const links = await this.getLinks();
        return links.find((l: any) => l.id === id) || null;
    }

    async createLink(data: any) {
        let id = data.id;

        if (!id) {
            // Generate sequential ID
            const links = await this.getLinks(); // Uses cache for reading
            
            // Extract numeric IDs
            const numbers = links
                .map((l: any) => parseInt(l.id))
                .filter((n: number) => !isNaN(n));
                
            const maxId = numbers.length > 0 ? Math.max(...numbers) : 0;
            const nextId = maxId + 1;
            
            // Pad to 3 digits (e.g. 001, 002)
            id = nextId.toString().padStart(3, '0');
        }

        const newLink = {
            ...data,
            id,
            createdAt: new Date().toISOString(),
        };
        await Store.saveLink(newLink);
        this.cache.links = null; // Invalidate
        return newLink;
    }

    async updateLink(id: string, data: any) {
        const links = await this.getLinks();
        const existing = links.find((l: any) => l.id === id);
        
        if (!existing) return null;

        const updated = {
            ...existing,
            ...data,
            updatedAt: new Date().toISOString()
        };
        await Store.saveLink(updated);
        this.cache.links = null; // Invalidate
        return updated;
    }

    async deleteLink(id: string) {
        await Store.deleteLink(id);
        this.cache.links = null; // Invalidate
        return { success: true };
    }

    async getSettings() {
        if (this.isFresh(this.cache.settings)) {
            return this.cache.settings!.data;
        }
        const data = await Store.getSettings();
        this.cache.settings = { data, timestamp: Date.now() };
        return data;
    }

    async saveSettings(data: any) {
        await Store.saveSettings(data);
        // Update cache immediately instead of invalidating (Write-Through-ish)
        this.cache.settings = { data, timestamp: Date.now() }; 
        return data;
    }

    async getKnowledge() {
        if (this.isFresh(this.cache.knowledge)) {
            return this.cache.knowledge!.data;
        }
        const data = await Store.getKnowledge();
        this.cache.knowledge = { data, timestamp: Date.now() };
        return data;
    }

    async createKnowledge(data: any) {
        const id = uuidv4();
        const newItem = {
            id,
            createdAt: new Date().toISOString(),
            ...data
        };
        await Store.saveKnowledge(newItem);
        this.cache.knowledge = null; // Invalidate
        return newItem;
    }

    async updateKnowledge(id: string, data: any) {
        const items = await this.getKnowledge();
        const existing = items.find((i: any) => i.id === id);
        
        if (!existing) return null;

        const updated = {
            ...existing,
            ...data,
            updatedAt: new Date().toISOString()
        };
        await Store.saveKnowledge(updated);
        this.cache.knowledge = null; // Invalidate
        return updated;
    }

    async deleteKnowledge(id: string) {
        await Store.deleteKnowledge(id);
        this.cache.knowledge = null; // Invalidate
        return { success: true };
    }
}
