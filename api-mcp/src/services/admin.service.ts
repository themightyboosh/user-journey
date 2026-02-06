import { v4 as uuidv4 } from 'uuid';
import { Store } from '../store';

export class AdminService {
    private static instance: AdminService;

    private constructor() {}

    public static getInstance(): AdminService {
        if (!AdminService.instance) {
            AdminService.instance = new AdminService();
        }
        return AdminService.instance;
    }

    async getLinks() {
        return await Store.getLinks();
    }

    async getLink(id: string) {
        const links = await Store.getLinks();
        return links.find((l: any) => l.id === id) || null;
    }

    async createLink(data: any) {
        let id = data.id;

        if (!id) {
            // Generate sequential ID
            const links = await Store.getLinks();
            
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
        return newLink;
    }

    async updateLink(id: string, data: any) {
        const links = await Store.getLinks();
        const existing = links.find((l: any) => l.id === id);
        
        if (!existing) return null;

        const updated = {
            ...existing,
            ...data,
            updatedAt: new Date().toISOString()
        };
        await Store.saveLink(updated);
        return updated;
    }

    async deleteLink(id: string) {
        await Store.deleteLink(id);
        return { success: true };
    }

    async getSettings() {
        return await Store.getSettings();
    }

    async saveSettings(data: any) {
        await Store.saveSettings(data);
        return data;
    }

    async getKnowledge() {
        return await Store.getKnowledge();
    }

    async createKnowledge(data: any) {
        const id = uuidv4();
        const newItem = {
            id,
            createdAt: new Date().toISOString(),
            ...data
        };
        await Store.saveKnowledge(newItem);
        return newItem;
    }

    async updateKnowledge(id: string, data: any) {
        const items = await Store.getKnowledge();
        const existing = items.find((i: any) => i.id === id);
        
        if (!existing) return null;

        const updated = {
            ...existing,
            ...data,
            updatedAt: new Date().toISOString()
        };
        await Store.saveKnowledge(updated);
        return updated;
    }

    async deleteKnowledge(id: string) {
        await Store.deleteKnowledge(id);
        return { success: true };
    }
}
