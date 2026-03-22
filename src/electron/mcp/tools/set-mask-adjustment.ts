import { z } from 'zod';
import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerSetMaskAdjustment(server: McpServer) {
  server.registerTool(
    'set_mask_adjustment',
    {
      title: 'Set Mask Adjustment',
      description:
        'Sets local adjustment values on a specific mask. These are delta values applied within the mask region. Use add_mask first to create a mask.',
      inputSchema: {
        maskId: z.string().describe('Mask ID (from add_mask)'),
        exposure: z.number().min(-5).max(5).optional().describe('Exposure delta'),
        contrast: z.number().min(-100).max(100).optional(),
        highlights: z.number().min(-100).max(100).optional(),
        shadows: z.number().min(-100).max(100).optional(),
        whites: z.number().min(-100).max(100).optional(),
        blacks: z.number().min(-100).max(100).optional(),
        temp: z.number().min(-100).max(100).optional(),
        tint: z.number().min(-100).max(100).optional(),
        texture: z.number().min(-100).max(100).optional(),
        clarity: z.number().min(-100).max(100).optional(),
        dehaze: z.number().min(-100).max(100).optional(),
        vibrance: z.number().min(-100).max(100).optional(),
        saturation: z.number().min(-100).max(100).optional(),
      },
    },
    async (params) => {
      await requestFromApp(AGENT_CHANNELS.SET_MASK_ADJUSTMENT, params);
      const keys = Object.keys(params).filter((k) => k !== 'maskId' && params[k as keyof typeof params] !== undefined);
      return {
        content: [{ type: 'text' as const, text: `Set mask adjustments: ${keys.join(', ')}` }],
      };
    },
  );
}
