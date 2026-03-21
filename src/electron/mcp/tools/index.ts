import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetScreenshot } from './get-screenshot.js';
import { registerGetEditState } from './get-edit-state.js';
import { registerGetPhotoInfo } from './get-photo-info.js';
import { registerSetAdjustments } from './set-adjustments.js';
import { registerSetToneCurve } from './set-tone-curve.js';
import { registerSetColorMixer } from './set-color-mixer.js';
import { registerSetColorGrading } from './set-color-grading.js';
import { registerSetEffects } from './set-effects.js';
import { registerResetAll } from './reset-all.js';

export function registerAllTools(server: McpServer) {
  registerGetScreenshot(server);
  registerGetEditState(server);
  registerGetPhotoInfo(server);
  registerSetAdjustments(server);
  registerSetToneCurve(server);
  registerSetColorMixer(server);
  registerSetColorGrading(server);
  registerSetEffects(server);
  registerResetAll(server);
}
