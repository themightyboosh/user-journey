import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || 'http://localhost:3001';

// Serve static files
app.use(express.static(__dirname));

// Proxy API requests to backend
app.use('/api', createProxyMiddleware({
        target: API_URL,
        changeOrigin: true,
        logLevel: 'debug'
}));

// Fallback for SPA (if needed, though this is mostly static)
app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
        console.warn(`
    🚀 Frontend Local Server running at http://localhost:${PORT}
    🔄 Proxying API requests to ${API_URL}
    `);
});
