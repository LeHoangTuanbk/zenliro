import { z } from 'zod';
import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerGetBeforeAfter(server: McpServer) {
  server.registerTool(
    'get_before_after',
    {
      title: 'Get Original (Before) Screenshot',
      description:
        'Captures the original unedited photo as a JPEG screenshot. Use this to compare before/after — evaluate whether your edits are improving the image or if you have gone too far. Compare with get_screenshot (which shows current edits) to assess the delta.',
      inputSchema: {
        quality: z
          .number()
          .min(0.1)
          .max(1)
          .default(0.7)
          .describe('JPEG quality (0.1–1.0). Default 0.7'),
      },
    },
    async ({ quality }: { quality: number }) => {
      const base64 = await requestFromApp<string>(AGENT_CHANNELS.GET_BEFORE_AFTER, { quality });
      return {
        content: [{ type: 'image' as const, data: base64, mimeType: 'image/jpeg' }],
      };
    },
  );
}
