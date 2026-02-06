import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  port: process.env.PORT || 3000,
  mcpApiUrl: process.env.MCP_API_URL || 'http://localhost:3001'
};

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
// app.use('/admin', express.static(fileURLToPath(new URL('../admin', import.meta.url))));

// Proxy Middleware for all /api requests
app.use('/api', async (req, res) => {
    const url = `${CONFIG.mcpApiUrl}${req.originalUrl}`;
    console.log(`Proxying ${req.method} ${req.originalUrl} -> ${url}`);
    
    try {
        const options = {
            method: req.method,
            headers: {
                ...req.headers,
                host: new URL(CONFIG.mcpApiUrl).host
            },
        };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            options.body = JSON.stringify(req.body);
            options.headers['content-type'] = 'application/json';
        }

        const response = await fetch(url, options);

        // Forward status and headers
        res.status(response.status);
        response.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });

        // Pipe response body
        if (response.body) {
            // Node 18+ fetch returns a ReadableStream, we need to convert or pipe
            // But standard fetch in Node returns a web stream.
            // Simplest way for text/json/sse:
            const reader = response.body.getReader();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
            }
            res.end();
        } else {
            res.end();
        }

    } catch (e) {
        console.error("Proxy Error:", e);
        res.status(500).json({ error: "Proxy Error" });
    }
});

app.listen(CONFIG.port, () => {
  console.log(`🚀 Dev Server running at http://localhost:${CONFIG.port}`);
  console.log(`👉 Proxies API requests to ${CONFIG.mcpApiUrl}`);
});
