import { z } from 'zod';
import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerAddHealSpot(server: McpServer) {
  server.registerTool(
    'add_heal_spot',
    {
      title: 'Add Heal/Clone/Fill Spot',
      description:
        'Adds a spot removal point. Mode: heal (blend surrounding), clone (copy from source), fill (content-aware). All coordinates are normalized 0–1.',
      inputSchema: {
        mode: z.enum(['heal', 'clone', 'fill']).describe('Spot removal mode'),
        dstX: z.number().min(0).max(1).describe('Destination X (0–1)'),
        dstY: z.number().min(0).max(1).describe('Destination Y (0–1)'),
        srcX: z.number().min(0).max(1).describe('Source X (0–1)'),
        srcY: z.number().min(0).max(1).describe('Source Y (0–1)'),
        radius: z.number().min(0.005).max(0.5).describe('Brush radius, normalized to image width (0.005–0.5)'),
        feather: z.number().min(0).max(100).default(50).describe('Feather (0–100)'),
        opacity: z.number().min(0).max(100).default(100).describe('Opacity (0–100)'),
      },
    },
    async (params) => {
      await requestFromApp(AGENT_CHANNELS.ADD_HEAL_SPOT, params);
      return {
        content: [{ type: 'text' as const, text: `Added ${params.mode} spot at (${params.dstX}, ${params.dstY})` }],
      };
    },
  );
}
