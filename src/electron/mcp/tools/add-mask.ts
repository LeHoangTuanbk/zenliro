import { z } from 'zod';
import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerAddMask(server: McpServer) {
  server.registerTool(
    'add_mask',
    {
      title: 'Add Mask',
      description:
        'Creates a new local adjustment mask. Types: linear (gradient), radial (ellipse). Returns the mask ID for setting adjustments.',
      inputSchema: {
        type: z.enum(['linear', 'radial']).describe('Mask type'),
        // Linear params
        x1: z.number().min(0).max(1).optional().describe('Linear start X (0–1)'),
        y1: z.number().min(0).max(1).optional().describe('Linear start Y (0–1)'),
        x2: z.number().min(0).max(1).optional().describe('Linear end X (0–1)'),
        y2: z.number().min(0).max(1).optional().describe('Linear end Y (0–1)'),
        // Radial params
        cx: z.number().min(0).max(1).optional().describe('Radial center X (0–1)'),
        cy: z.number().min(0).max(1).optional().describe('Radial center Y (0–1)'),
        rx: z.number().min(0.01).max(1).optional().describe('Radial X radius (0–1)'),
        ry: z.number().min(0.01).max(1).optional().describe('Radial Y radius (0–1)'),
        angle: z.number().min(-180).max(180).optional().describe('Radial rotation angle'),
        invert: z.boolean().optional().describe('Invert radial mask (affect outside)'),
        feather: z.number().min(0).max(1).optional().describe('Feather (0–1)'),
      },
    },
    async (params) => {
      const result = await requestFromApp<{ maskId: string }>(AGENT_CHANNELS.ADD_MASK, params);
      return {
        content: [{ type: 'text' as const, text: `Created ${params.type} mask: ${result.maskId}` }],
      };
    },
  );
}
