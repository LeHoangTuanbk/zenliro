import { requestFromRenderer } from '../ipc-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerResetAll(server: McpServer) {
  server.registerTool(
    'reset_all',
    {
      title: 'Reset All Edits',
      description: 'Resets all photo edits back to defaults.',
      inputSchema: {},
    },
    async () => {
      await requestFromRenderer(AGENT_CHANNELS.RESET_ALL);
      return {
        content: [{ type: 'text' as const, text: 'All edits reset to defaults' }],
      };
    },
  );
}
