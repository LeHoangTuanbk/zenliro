import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerGetEditState(server: McpServer) {
  server.registerTool(
    'get_edit_state',
    {
      title: 'Get Edit State',
      description:
        'Returns the full current editing state as JSON — adjustments, tone curve, color mixer, color grading, effects.',
      inputSchema: {},
    },
    async () => {
      const state = await requestFromApp<unknown>(
        AGENT_CHANNELS.GET_EDIT_STATE,
      );
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(state, null, 2) }],
      };
    },
  );
}
