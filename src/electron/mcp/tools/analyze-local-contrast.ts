import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerAnalyzeLocalContrast(server: McpServer) {
  server.registerTool(
    'analyze_local_contrast',
    {
      title: 'Analyze Local Contrast',
      description:
        'Measures micro-contrast (tonal separation in local areas) per 3x3 grid region. Different from sharpness — this measures how much tonal variation exists within small patches. Returns Michelson contrast (0–1) and RMS contrast per region. Use this to decide clarity and texture values: flat/hazy images need clarity boost, already high-contrast images should avoid it.',
      inputSchema: {},
    },
    async () => {
      const data = await requestFromApp<unknown>(AGENT_CHANNELS.ANALYZE_LOCAL_CONTRAST);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
