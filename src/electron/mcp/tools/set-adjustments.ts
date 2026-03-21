import { z } from 'zod';
import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerSetAdjustments(server: McpServer) {
  server.registerTool(
    'set_adjustments',
    {
      title: 'Set Adjustments',
      description:
        'Sets basic photo adjustments. All params optional — only provided values are changed. Ranges: exposure (-5 to 5), all others (-100 to 100).',
      inputSchema: {
        temp: z.number().min(-100).max(100).optional().describe('White balance temperature'),
        tint: z.number().min(-100).max(100).optional().describe('White balance tint'),
        exposure: z.number().min(-5).max(5).optional().describe('Exposure (-5 to 5)'),
        contrast: z.number().min(-100).max(100).optional().describe('Contrast'),
        highlights: z.number().min(-100).max(100).optional().describe('Highlights'),
        shadows: z.number().min(-100).max(100).optional().describe('Shadows'),
        whites: z.number().min(-100).max(100).optional().describe('Whites'),
        blacks: z.number().min(-100).max(100).optional().describe('Blacks'),
        texture: z.number().min(-100).max(100).optional().describe('Texture'),
        clarity: z.number().min(-100).max(100).optional().describe('Clarity'),
        dehaze: z.number().min(-100).max(100).optional().describe('Dehaze'),
        vibrance: z.number().min(-100).max(100).optional().describe('Vibrance'),
        saturation: z.number().min(-100).max(100).optional().describe('Saturation'),
      },
    },
    async (params) => {
      const result = await requestFromApp<{ applied: Record<string, number> }>(
        AGENT_CHANNELS.SET_ADJUSTMENTS,
        params,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: `Applied adjustments: ${JSON.stringify(result.applied)}`,
          },
        ],
      };
    },
  );
}
