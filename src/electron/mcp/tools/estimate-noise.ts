import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerEstimateNoise(server: McpServer) {
  server.registerTool(
    'estimate_noise',
    {
      title: 'Estimate Noise Level',
      description:
        'Estimate image noise level in shadow and midtone areas. Returns overall noise score, per-zone scores, noise level description, and a suggestion for clarity/texture handling. High noise means avoid clarity/texture boost; low noise means safe to enhance detail.',
      inputSchema: {},
    },
    async () => {
      const data = await requestFromApp<unknown>(AGENT_CHANNELS.ESTIMATE_NOISE);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
