import { z } from 'zod';
import { requestFromRenderer } from '../ipc-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const pointSchema = z.object({
  x: z.number().min(0).max(1).describe('X position (0–1)'),
  y: z.number().min(0).max(1).describe('Y position (0–1)'),
});

export function registerSetToneCurve(server: McpServer) {
  server.registerTool(
    'set_tone_curve',
    {
      title: 'Set Tone Curve',
      description:
        'Sets control points for a tone curve channel. Points are {x,y} pairs in 0–1 range. Always include endpoints (0,0) and (1,1) or desired endpoints.',
      inputSchema: {
        channel: z
          .enum(['rgb', 'r', 'g', 'b'])
          .describe('Curve channel to modify'),
        points: z
          .array(pointSchema)
          .min(2)
          .describe('Array of control points [{x,y}]'),
      },
    },
    async ({ channel, points }) => {
      await requestFromRenderer(AGENT_CHANNELS.SET_TONE_CURVE, { channel, points });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Set ${channel} tone curve with ${points.length} points`,
          },
        ],
      };
    },
  );
}
