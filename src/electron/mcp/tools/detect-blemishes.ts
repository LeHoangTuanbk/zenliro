import { z } from 'zod';
import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerDetectBlemishes(server: McpServer) {
  server.registerTool(
    'detect_blemishes',
    {
      title: 'Detect Skin Blemishes',
      description:
        'Automatically detect skin blemishes, spots, pimples, and imperfections by analyzing pixel-level color anomalies on skin-toned areas. Returns precise normalized coordinates, confidence scores, and suggested brush radius for each detected spot. ALWAYS use this tool before adding heal spots — never guess coordinates from screenshots.',
      inputSchema: {
        maxSpots: z.number().min(1).max(20).optional().describe('Maximum spots to detect (default: 10)'),
      },
    },
    async (params: { maxSpots?: number }) => {
      const data = await requestFromApp<unknown>(
        AGENT_CHANNELS.DETECT_BLEMISHES,
        params,
      );
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
