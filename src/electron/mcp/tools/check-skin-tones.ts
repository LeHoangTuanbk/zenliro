import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerCheckSkinTones(server: McpServer) {
  server.registerTool(
    'check_skin_tones',
    {
      title: 'Check Skin Tones',
      description:
        'Evaluates skin tone accuracy for portrait photography. Auto-detects skin-colored pixels and checks if they follow the "skin tone line" (vectorscope: R > G > B with proper ratios). Returns a health score, whether skin is too warm/cool/green/magenta, and correction suggestions for temp/tint/color mixer. If no skin tones are detected, indicates the image may not be a portrait.',
      inputSchema: {},
    },
    async () => {
      const data = await requestFromApp<unknown>(AGENT_CHANNELS.CHECK_SKIN_TONES);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
