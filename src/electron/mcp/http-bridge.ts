import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PORT_FILE = path.join(os.homedir(), '.zenliro', 'mcp-port');

const BULK_PHOTO_ID = process.env.ZENLIRO_BULK_PHOTO_ID ?? null;

function readPort(): number {
  try {
    return parseInt(fs.readFileSync(PORT_FILE, 'utf-8').trim(), 10);
  } catch {
    throw new Error('Zenliro app is not running (no port file found)');
  }
}

function enrichPayload(payload: unknown): unknown {
  if (!BULK_PHOTO_ID) return payload;
  if (payload && typeof payload === 'object') {
    return { ...(payload as Record<string, unknown>), __bulkPhotoId: BULK_PHOTO_ID };
  }
  return { __bulkPhotoId: BULK_PHOTO_ID };
}

export function requestFromApp<T>(
  channel: string,
  payload?: unknown,
  timeoutMs = 15_000,
): Promise<T> {
  const port = readPort();
  const body = JSON.stringify({ channel, payload: enrichPayload(payload), timeout: timeoutMs });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/tool',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.ok) {
              resolve(parsed.result as T);
            } else {
              reject(new Error(parsed.error ?? 'Unknown error from Zenliro'));
            }
          } catch {
            reject(new Error('Invalid response from Zenliro'));
          }
        });
      },
    );

    req.on('error', (err) => reject(new Error(`Cannot reach Zenliro: ${err.message}`)));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request to Zenliro timed out'));
    });

    req.write(body);
    req.end();
  });
}
