import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerAnalyzeRegions(server: McpServer) {
  server.registerTool(
    'analyze_regions',
    {
      title: 'Analyze Image Regions',
      description:
        'Divides the photo into a 3x3 grid and returns per-region analysis: average brightness, average RGB color, and clipping percentages. Use this to understand spatial distribution of light and color — e.g., is the sky blown out? Are shadows too dark in the bottom corners? Is one side warmer than the other?',
      inputSchema: {},
    },
    async () => {
      const data = await requestFromApp<unknown>(
        AGENT_CHANNELS.ANALYZE_REGIONS,
      );
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
