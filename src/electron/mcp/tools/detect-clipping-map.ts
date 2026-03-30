import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerDetectClippingMap(server: McpServer) {
  server.registerTool(
    'detect_clipping_map',
    {
      title: 'Detect Clipping Map',
      description:
        'Creates a detailed spatial map of where highlight and shadow clipping occurs across the image (5x5 grid). Goes beyond histogram clipping percentages by showing exactly which regions are affected and how severely. Also detects per-channel (R/G/B) clipping. Use this to decide if graduated/radial masks are needed for local recovery, or if global highlights/shadows adjustments suffice.',
      inputSchema: {},
    },
    async () => {
      const data = await requestFromApp<unknown>(AGENT_CHANNELS.DETECT_CLIPPING_MAP);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
