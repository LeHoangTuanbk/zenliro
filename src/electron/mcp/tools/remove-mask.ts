import { z } from 'zod';
import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerRemoveMask(server: McpServer) {
  server.registerTool(
    'remove_mask',
    {
      title: 'Remove Mask',
      description: 'Removes a specific mask by its ID.',
      inputSchema: {
        maskId: z.string().describe('Mask ID to remove'),
      },
    },
    async ({ maskId }) => {
      await requestFromApp(AGENT_CHANNELS.REMOVE_MASK, { maskId });
      return {
        content: [{ type: 'text' as const, text: `Removed mask ${maskId}` }],
      };
    },
  );
}
