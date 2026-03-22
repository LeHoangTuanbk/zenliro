import { z } from 'zod';
import { requestFromApp } from '../http-bridge.js';
import { AGENT_CHANNELS } from '../const.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerSetCrop(server: McpServer) {
  server.registerTool(
    'set_crop',
    {
      title: 'Set Crop, Rotate & Flip',
      description:
        'Sets crop rectangle, rotation, and flip. All rect values normalized 0–1. Rotation: straighten angle -45 to +45. RotationSteps: 90° increments (1=CW, -1=CCW, 2=180°).',
      inputSchema: {
        x: z.number().min(0).max(1).optional().describe('Crop rect left (0–1)'),
        y: z.number().min(0).max(1).optional().describe('Crop rect top (0–1)'),
        w: z.number().min(0.01).max(1).optional().describe('Crop rect width (0–1)'),
        h: z.number().min(0.01).max(1).optional().describe('Crop rect height (0–1)'),
        rotation: z.number().min(-45).max(45).optional().describe('Straighten angle (-45 to 45°)'),
        rotationSteps: z.number().min(-3).max(3).optional().describe('90° rotation steps (+1=CW, -1=CCW)'),
        flipH: z.boolean().optional().describe('Flip horizontal'),
        flipV: z.boolean().optional().describe('Flip vertical'),
        aspectPreset: z.enum(['free', 'original', '1:1', '4:3', '3:2', '16:9', '5:4', '7:5', '2:3']).optional().describe('Aspect ratio preset'),
      },
    },
    async (params) => {
      await requestFromApp(AGENT_CHANNELS.SET_CROP, params);
      const parts: string[] = [];
      if (params.x !== undefined || params.y !== undefined) parts.push('crop position');
      if (params.w !== undefined || params.h !== undefined) parts.push('crop size');
      if (params.rotation !== undefined) parts.push(`rotation ${params.rotation}°`);
      if (params.rotationSteps !== undefined) parts.push(`rotate ${params.rotationSteps * 90}°`);
      if (params.flipH !== undefined) parts.push('flip H');
      if (params.flipV !== undefined) parts.push('flip V');
      if (params.aspectPreset) parts.push(`aspect ${params.aspectPreset}`);
      return {
        content: [{ type: 'text' as const, text: `Set ${parts.join(', ')}` }],
      };
    },
  );
}
