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
import { registerAddHealSpot } from './add-heal-spot.js';
import { registerClearHealSpots } from './clear-heal-spots.js';
import { registerAddMask } from './add-mask.js';
import { registerSetMaskAdjustment } from './set-mask-adjustment.js';
import { registerRemoveMask } from './remove-mask.js';
import { registerSetCrop } from './set-crop.js';
import { registerResetCrop } from './reset-crop.js';

export function registerAllTools(server: McpServer) {
  // Read tools
  registerGetScreenshot(server);
  registerGetEditState(server);
  registerGetPhotoInfo(server);
  // Global adjustments
  registerSetAdjustments(server);
  registerSetToneCurve(server);
  registerSetColorMixer(server);
  registerSetColorGrading(server);
  registerSetEffects(server);
  registerResetAll(server);
  // Heal / Clone / Fill
  registerAddHealSpot(server);
  registerClearHealSpots(server);
  // Masking
  registerAddMask(server);
  registerSetMaskAdjustment(server);
  registerRemoveMask(server);
  // Crop, Rotate & Flip
  registerSetCrop(server);
  registerResetCrop(server);
}
