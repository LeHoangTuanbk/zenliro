import { z } from 'zod';
import { requestFromRenderer } from '../ipc-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerSetColorGrading(server: McpServer) {
  server.registerTool(
    'set_color_grading',
    {
      title: 'Set Color Grading',
      description:
        'Sets color grading wheel values for shadows/midtones/highlights. Hue: 0–360, sat: 0–1, lum: -100 to 100.',
      inputSchema: {
        range: z.enum(['shadows', 'midtones', 'highlights']).describe('Tonal range'),
        hue: z.number().min(0).max(360).optional().describe('Hue (0–360)'),
        sat: z.number().min(0).max(1).optional().describe('Saturation (0–1)'),
        lum: z.number().min(-100).max(100).optional().describe('Luminance (-100 to 100)'),
      },
    },
    async ({ range, hue, sat, lum }) => {
      await requestFromRenderer(AGENT_CHANNELS.SET_COLOR_GRADING, { range, hue, sat, lum });
      const parts: string[] = [];
      if (hue !== undefined) parts.push(`hue=${hue}`);
      if (sat !== undefined) parts.push(`sat=${sat}`);
      if (lum !== undefined) parts.push(`lum=${lum}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Set ${range} color grading: ${parts.join(', ')}`,
          },
        ],
      };
    },
  );
}
