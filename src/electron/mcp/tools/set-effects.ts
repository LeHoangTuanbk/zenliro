import { z } from 'zod';
import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerSetEffects(server: McpServer) {
  server.registerTool(
    'set_effects',
    {
      title: 'Set Effects',
      description:
        'Sets vignette and grain effects. All params optional. vigAmount: -100 to 100, grain params: 0 to 100.',
      inputSchema: {
        vigAmount: z.number().min(-100).max(100).optional().describe('Vignette amount'),
        vigMidpoint: z.number().min(0).max(100).optional().describe('Vignette midpoint'),
        vigRoundness: z.number().min(-100).max(100).optional().describe('Vignette roundness'),
        vigFeather: z.number().min(0).max(100).optional().describe('Vignette feather'),
        vigHighlights: z.number().min(0).max(100).optional().describe('Vignette highlights'),
        grainAmount: z.number().min(0).max(100).optional().describe('Grain amount'),
        grainSize: z.number().min(0).max(100).optional().describe('Grain size'),
        grainRoughness: z.number().min(0).max(100).optional().describe('Grain roughness'),
      },
    },
    async (params) => {
      await requestFromApp(AGENT_CHANNELS.SET_EFFECTS, params);
      const keys = Object.keys(params).filter(
        (k) => params[k as keyof typeof params] !== undefined,
      );
      return {
        content: [
          { type: 'text' as const, text: `Applied effects: ${keys.join(', ')}` },
        ],
      };
    },
  );
}
