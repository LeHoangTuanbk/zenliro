import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetScreenshot } from './get-screenshot.js';
import { registerGetEditState } from './get-edit-state.js';
import { registerGetPhotoInfo } from './get-photo-info.js';
import { registerGetHistogram } from './get-histogram.js';
import { registerSampleColors } from './sample-colors.js';
import { registerAnalyzeRegions } from './analyze-regions.js';
import { registerGetDominantColors } from './get-dominant-colors.js';
import { registerMeasureSharpness } from './measure-sharpness.js';
import { registerEstimateWhiteBalance } from './estimate-white-balance.js';
import { registerEstimateNoise } from './estimate-noise.js';
// TODO: Re-enable heal/blemish tools when detection accuracy improves
// import { registerDetectBlemishes } from './detect-blemishes.js';
import { registerSetAdjustments } from './set-adjustments.js';
import { registerSetToneCurve } from './set-tone-curve.js';
import { registerSetColorMixer } from './set-color-mixer.js';
import { registerSetColorGrading } from './set-color-grading.js';
import { registerSetEffects } from './set-effects.js';
import { registerResetAll } from './reset-all.js';
// TODO: Re-enable heal tools when detection accuracy improves
// import { registerAddHealSpot } from './add-heal-spot.js';
// import { registerClearHealSpots } from './clear-heal-spots.js';
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
  registerGetHistogram(server);
  registerSampleColors(server);
  registerAnalyzeRegions(server);
  registerGetDominantColors(server);
  registerMeasureSharpness(server);
  registerEstimateWhiteBalance(server);
  registerEstimateNoise(server);
  // TODO: Re-enable when blemish detection is more accurate
  // registerDetectBlemishes(server);
  // Global adjustments
  registerSetAdjustments(server);
  registerSetToneCurve(server);
  registerSetColorMixer(server);
  registerSetColorGrading(server);
  registerSetEffects(server);
  registerResetAll(server);
  // TODO: Heal / Clone / Fill — disabled, AI can't accurately target blemishes yet
  // registerAddHealSpot(server);
  // registerClearHealSpots(server);
  // Masking
  registerAddMask(server);
  registerSetMaskAdjustment(server);
  registerRemoveMask(server);
  // Crop, Rotate & Flip
  registerSetCrop(server);
  registerResetCrop(server);
}
