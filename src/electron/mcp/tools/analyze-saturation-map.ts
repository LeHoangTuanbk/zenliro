import { z } from 'zod';
import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerAnalyzeSaturationMap(server: McpServer) {
  server.registerTool(
    'analyze_saturation_map',
    {
      title: 'Analyze Saturation Map',
      description:
        'Analyzes per-region saturation levels across the image. Detects over-saturated areas (potential color channel clipping) and under-saturated regions. Helps decide between vibrance vs saturation adjustments, and guides color mixer decisions. Flags regions that are oversaturated or have color clipping.',
      inputSchema: {
        gridSize: z
          .number()
          .min(3)
          .max(5)
          .default(3)
          .describe('Grid size: 3 (3x3) or 5 (5x5). Default 3'),
      },
    },
    async (params: { gridSize: number }) => {
      const data = await requestFromApp<unknown>(AGENT_CHANNELS.ANALYZE_SATURATION_MAP, params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
