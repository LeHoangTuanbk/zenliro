import { z } from 'zod';
import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerGetScreenshot(server: McpServer) {
  server.registerTool(
    'get_screenshot',
    {
      title: 'Get Screenshot',
      description:
        'Captures the current canvas as a JPEG screenshot. Returns base64-encoded image data for visual analysis.',
      inputSchema: {
        quality: z
          .number()
          .min(0.1)
          .max(1)
          .default(0.7)
          .describe('JPEG quality (0.1–1.0). Default 0.7'),
      },
    },
    async ({ quality }) => {
      const base64 = await requestFromApp<string>(
        AGENT_CHANNELS.GET_SCREENSHOT,
        { quality },
      );
      return {
        content: [{ type: 'image' as const, data: base64, mimeType: 'image/jpeg' }],
      };
    },
  );
}
