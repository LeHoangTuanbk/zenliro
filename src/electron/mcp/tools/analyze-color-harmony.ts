import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerAnalyzeColorHarmony(server: McpServer) {
  server.registerTool(
    'analyze_color_harmony',
    {
      title: 'Analyze Color Harmony',
      description:
        'Analyzes the color palette for harmonic relationships. Identifies the palette type (monochromatic, analogous, complementary, triadic, split-complementary, or mixed), computes a harmony score, and suggests color grading direction to enhance the existing palette. Use this before making color grading decisions to understand the current color structure.',
      inputSchema: {},
    },
    async () => {
      const data = await requestFromApp<unknown>(AGENT_CHANNELS.ANALYZE_COLOR_HARMONY);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
