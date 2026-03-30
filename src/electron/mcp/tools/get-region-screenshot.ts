import { z } from 'zod';
import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerGetRegionScreenshot(server: McpServer) {
  server.registerTool(
    'get_region_screenshot',
    {
      title: 'Get Region Screenshot (Zoom)',
      description:
        'Captures a cropped region of the current photo at higher detail. Use this to zoom into specific areas for close inspection — e.g., check eye sharpness, skin texture, noise in shadows, fine detail in a specific part of the image. Coordinates are normalized 0–1 (top-left = 0,0). Returns base64-encoded JPEG of just that region.',
      inputSchema: {
        x: z.number().min(0).max(1).describe('Left edge of region (0=left, 1=right)'),
        y: z.number().min(0).max(1).describe('Top edge of region (0=top, 1=bottom)'),
        w: z.number().min(0.05).max(1).describe('Width of region (0.05–1.0)'),
        h: z.number().min(0.05).max(1).describe('Height of region (0.05–1.0)'),
        quality: z
          .number()
          .min(0.1)
          .max(1)
          .default(0.8)
          .describe('JPEG quality (0.1–1.0). Default 0.8'),
      },
    },
    async (params: { x: number; y: number; w: number; h: number; quality: number }) => {
      const base64 = await requestFromApp<string>(AGENT_CHANNELS.GET_REGION_SCREENSHOT, params);
      return {
        content: [{ type: 'image' as const, data: base64, mimeType: 'image/jpeg' }],
      };
    },
  );
}
