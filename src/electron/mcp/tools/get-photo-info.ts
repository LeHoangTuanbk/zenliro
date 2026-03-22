import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerGetPhotoInfo(server: McpServer) {
  server.registerTool(
    'get_photo_info',
    {
      title: 'Get Photo Info',
      description:
        'Returns metadata about the currently selected photo — filename, dimensions, file size, MIME type.',
      inputSchema: {},
    },
    async () => {
      const info = await requestFromApp<unknown>(
        AGENT_CHANNELS.GET_PHOTO_INFO,
      );
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }],
      };
    },
  );
}
