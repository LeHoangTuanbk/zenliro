import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerClearHealSpots(server: McpServer) {
  server.registerTool(
    'clear_heal_spots',
    {
      title: 'Clear All Heal Spots',
      description: 'Removes all heal/clone/fill spots from the current photo.',
      inputSchema: {},
    },
    async () => {
      await requestFromApp(AGENT_CHANNELS.CLEAR_HEAL_SPOTS);
      return {
        content: [{ type: 'text' as const, text: 'Cleared all heal spots' }],
      };
    },
  );
}
