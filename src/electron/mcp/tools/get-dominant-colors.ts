import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerGetDominantColors(server: McpServer) {
  server.registerTool(
    'get_dominant_colors',
    {
      title: 'Get Dominant Colors',
      description:
        'Extract the top 5 most dominant colors in the photo with their percentage. Use this to understand the color palette before color grading — choose complementary or analogous grading that works WITH the existing colors, not against them.',
      inputSchema: {},
    },
    async () => {
      const data = await requestFromApp<unknown>(AGENT_CHANNELS.GET_DOMINANT_COLORS);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
