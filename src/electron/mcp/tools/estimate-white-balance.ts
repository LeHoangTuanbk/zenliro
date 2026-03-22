import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerEstimateWhiteBalance(server: McpServer) {
  server.registerTool(
    'estimate_white_balance',
    {
      title: 'Estimate White Balance',
      description:
        'Analyze the photo\'s white balance by examining neutral/grey areas. Returns temperature assessment (very warm → very cool), tint assessment (green → magenta), numerical warmth/tint scores, and a correction suggestion. Use this BEFORE adjusting temp/tint to make data-driven decisions.',
      inputSchema: {},
    },
    async () => {
      const data = await requestFromApp<unknown>(AGENT_CHANNELS.ESTIMATE_WHITE_BALANCE);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
