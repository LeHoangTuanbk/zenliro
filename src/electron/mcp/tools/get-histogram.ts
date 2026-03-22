import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerGetHistogram(server: McpServer) {
  server.registerTool(
    'get_histogram',
    {
      title: 'Get Histogram Analysis',
      description:
        'Returns histogram statistics of the current photo: per-channel (R/G/B) mean brightness, zone distribution (shadows/midtones/highlights %), clipping percentages, and overall luminosity. Use this to evaluate tonal balance and exposure accuracy.',
      inputSchema: {},
    },
    async () => {
      const data = await requestFromApp<unknown>(
        AGENT_CHANNELS.GET_HISTOGRAM,
      );
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
