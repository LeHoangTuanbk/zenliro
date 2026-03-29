import { z } from 'zod';
import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const pointSchema = z.object({
  x: z.number().min(0).max(1).describe('X position (0–1)'),
  y: z.number().min(0).max(1).describe('Y position (0–1)'),
});

const parametricSchema = z
  .object({
    highlights: z.number().min(-100).max(100).optional(),
    lights: z.number().min(-100).max(100).optional(),
    darks: z.number().min(-100).max(100).optional(),
    shadows: z.number().min(-100).max(100).optional(),
  })
  .optional()
  .describe('Parametric sliders for the channel (-100 to 100). Bends the curve in tonal zones.');

export function registerSetToneCurve(server: McpServer) {
  server.registerTool(
    'set_tone_curve',
    {
      title: 'Set Tone Curve',
      description:
        'Sets control points and/or parametric sliders for a tone curve channel. Points are {x,y} pairs in 0–1 range. Parametric sliders (highlights, lights, darks, shadows) bend the curve in their respective tonal zones (-100 to 100). Each channel (rgb, r, g, b) has independent parametric values.',
      inputSchema: {
        channel: z.enum(['rgb', 'r', 'g', 'b']).describe('Curve channel to modify'),
        points: z
          .array(pointSchema)
          .min(2)
          .optional()
          .describe('Array of control points [{x,y}]. Include endpoints.'),
        parametric: parametricSchema,
      },
    },
    async ({ channel, points, parametric }) => {
      await requestFromApp(AGENT_CHANNELS.SET_TONE_CURVE, { channel, points, parametric });
      const parts: string[] = [];
      if (points) parts.push(`${points.length} points`);
      if (parametric) parts.push(`parametric: ${JSON.stringify(parametric)}`);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Set ${channel} tone curve: ${parts.join(', ')}`,
          },
        ],
      };
    },
  );
}
