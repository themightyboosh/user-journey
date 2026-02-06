import { onRequest } from 'firebase-functions/v2/https';
import { server } from './server';

// Ensure plugins are loaded
const proxy = async (req: any, res: any) => {
    await server.ready();
    server.server.emit('request', req, res);
};

export const api = onRequest({
    region: 'us-central1', // Set your preferred region
    cors: true,
    minInstances: 0,
    memory: '1GiB',
    timeoutSeconds: 300
}, proxy);
