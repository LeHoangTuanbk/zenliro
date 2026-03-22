import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerMeasureSharpness(server: McpServer) {
  server.registerTool(
    'measure_sharpness',
    {
      title: 'Measure Sharpness',
      description:
        'Measure image sharpness/detail level in a 3x3 grid. Returns a sharpness score and descriptive label (very soft → very sharp) per region plus overall. Use this to decide texture/clarity values — high sharpness photos need less clarity boost, soft/blurry photos may benefit from texture increase.',
      inputSchema: {},
    },
    async () => {
      const data = await requestFromApp<unknown>(AGENT_CHANNELS.MEASURE_SHARPNESS);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
