import { z } from 'zod';
import { requestFromRenderer } from '../ipc-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerSetColorMixer(server: McpServer) {
  server.registerTool(
    'set_color_mixer',
    {
      title: 'Set Color Mixer',
      description:
        'Sets an HSL color mixer value. Mode is hue/saturation/luminance. Channel is the color. Value range: -100 to 100.',
      inputSchema: {
        mode: z.enum(['hue', 'saturation', 'luminance']).describe('HSL mode'),
        channel: z
          .enum(['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'magenta'])
          .describe('Color channel'),
        value: z.number().min(-100).max(100).describe('Value (-100 to 100)'),
      },
    },
    async ({ mode, channel, value }) => {
      await requestFromRenderer(AGENT_CHANNELS.SET_COLOR_MIXER, { mode, channel, value });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Set color mixer ${mode}/${channel} = ${value}`,
          },
        ],
      };
    },
  );
}
