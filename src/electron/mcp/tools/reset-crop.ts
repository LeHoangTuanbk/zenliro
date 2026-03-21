import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerResetCrop(server: McpServer) {
  server.registerTool(
    'reset_crop',
    {
      title: 'Reset Crop',
      description: 'Resets crop, rotation, and flip to defaults (full image, no rotation, no flip).',
      inputSchema: {},
    },
    async () => {
      await requestFromApp(AGENT_CHANNELS.RESET_CROP);
      return {
        content: [{ type: 'text' as const, text: 'Crop reset to defaults' }],
      };
    },
  );
}
