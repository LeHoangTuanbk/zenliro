import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { requestFromRenderer } from './ipc-bridge.js';

const PORT_FILE_DIR = path.join(os.homedir(), '.zenliro');
const PORT_FILE = path.join(PORT_FILE_DIR, 'mcp-port');

let server: http.Server | null = null;

export function getPortFilePath() {
  return PORT_FILE;
}

export function startLocalServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    server = http.createServer(async (req, res) => {
      if (req.method !== 'POST' || req.url !== '/tool') {
        res.writeHead(404);
        res.end();
        return;
      }

      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const { channel, payload, timeout } = JSON.parse(body);
          const result = await requestFromRenderer(channel, payload, timeout);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, result }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: (err as Error).message }));
        }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      if (!addr || typeof addr === 'string') {
        return reject(new Error('Failed to get server address'));
      }
      const port = addr.port;

      // Write port file so the standalone MCP server can find us
      fs.mkdirSync(PORT_FILE_DIR, { recursive: true });
      fs.writeFileSync(PORT_FILE, String(port), 'utf-8');

      console.log(`[Zenliro] Local MCP bridge running on 127.0.0.1:${port}`);
      resolve(port);
    });

    server.on('error', reject);
  });
}

export function stopLocalServer() {
  server?.close();
  server = null;
  try {
    fs.unlinkSync(PORT_FILE);
  } catch {
    // ignore
  }
}
