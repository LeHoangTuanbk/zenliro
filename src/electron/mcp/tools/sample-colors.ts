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
        'Sample RGB color values at specific coordinates in the photo. Use this to check skin tones, verify white balance on neutral objects, or compare colors at different points. Each point returns average RGB in a 7x7 pixel area. Coordinates are normalized 0–1 (top-left = 0,0).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          points: {
            type: 'array' as const,
            description: 'Array of {x, y} points to sample (normalized 0–1)',
            items: {
              type: 'object' as const,
              properties: {
                x: { type: 'number' as const, description: 'Horizontal position (0=left, 1=right)' },
                y: { type: 'number' as const, description: 'Vertical position (0=top, 1=bottom)' },
              },
              required: ['x', 'y'],
            },
          },
        },
        required: ['points'],
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
