import { z } from 'zod';
import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerSampleColors(server: McpServer) {
  server.registerTool(
    'sample_colors',
    {
      title: 'Sample Colors at Points',
      description:
        'Sample RGB color values at specific coordinates in the photo. Use this to check skin tones (healthy skin: R > G > B), verify white balance on neutral surfaces, compare colors at key points. Coordinates are normalized 0–1 (top-left = 0,0). Returns average RGB in a 7x7 pixel area per point.',
      inputSchema: {
        points: z.array(
          z.object({
            x: z.number().min(0).max(1).describe('Horizontal position (0=left, 1=right)'),
            y: z.number().min(0).max(1).describe('Vertical position (0=top, 1=bottom)'),
          }),
        ).describe('Points to sample'),
      },
    },
    async (params: { points: Array<{ x: number; y: number }> }) => {
      const data = await requestFromApp<unknown>(
        AGENT_CHANNELS.SAMPLE_COLORS,
        params,
      );
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
