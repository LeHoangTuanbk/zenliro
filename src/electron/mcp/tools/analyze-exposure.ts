import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerAnalyzeExposure(server: McpServer) {
  server.registerTool(
    'analyze_exposure',
    {
      title: 'Analyze Exposure (Zone System)',
      description:
        'Professional exposure analysis using the Ansel Adams Zone System (11 zones, 0–X). Returns: exposure key (high-key/normal/low-key), dynamic range utilization (how many zones are used), per-zone pixel distribution, mean luminance, and actionable suggestions. Use this to evaluate whether the image is properly exposed and how much dynamic range is being utilized.',
      inputSchema: {},
    },
    async () => {
      const data = await requestFromApp<unknown>(AGENT_CHANNELS.ANALYZE_EXPOSURE);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
