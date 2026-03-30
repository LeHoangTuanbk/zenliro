// IPC channels for agent ↔ renderer communication
export const AGENT_CHANNELS = {
  // Read
  GET_SCREENSHOT: 'agent:get-screenshot',
  GET_EDIT_STATE: 'agent:get-edit-state',
  GET_PHOTO_INFO: 'agent:get-photo-info',
  GET_HISTOGRAM: 'agent:get-histogram',
  SAMPLE_COLORS: 'agent:sample-colors',
  ANALYZE_REGIONS: 'agent:analyze-regions',
  GET_DOMINANT_COLORS: 'agent:get-dominant-colors',
  MEASURE_SHARPNESS: 'agent:measure-sharpness',
  ESTIMATE_WHITE_BALANCE: 'agent:estimate-white-balance',
  ESTIMATE_NOISE: 'agent:estimate-noise',
  DETECT_BLEMISHES: 'agent:detect-blemishes',
  // Global adjustments
  SET_ADJUSTMENTS: 'agent:set-adjustments',
  SET_TONE_CURVE: 'agent:set-tone-curve',
  SET_COLOR_MIXER: 'agent:set-color-mixer',
  SET_COLOR_GRADING: 'agent:set-color-grading',
  SET_EFFECTS: 'agent:set-effects',
  RESET_ALL: 'agent:reset-all',
  // Heal / Clone / Fill
  ADD_HEAL_SPOT: 'agent:add-heal-spot',
  CLEAR_HEAL_SPOTS: 'agent:clear-heal-spots',
  // Masking
  ADD_MASK: 'agent:add-mask',
  SET_MASK_ADJUSTMENT: 'agent:set-mask-adjustment',
  REMOVE_MASK: 'agent:remove-mask',
  // Crop, Rotate & Flip
  SET_CROP: 'agent:set-crop',
  RESET_CROP: 'agent:reset-crop',
  // Advanced analysis
  GET_REGION_SCREENSHOT: 'agent:get-region-screenshot',
  ANALYZE_EXPOSURE: 'agent:analyze-exposure',
  ANALYZE_COLOR_HARMONY: 'agent:analyze-color-harmony',
  CHECK_SKIN_TONES: 'agent:check-skin-tones',
  ANALYZE_SATURATION_MAP: 'agent:analyze-saturation-map',
  DETECT_CLIPPING_MAP: 'agent:detect-clipping-map',
  GET_BEFORE_AFTER: 'agent:get-before-after',
  ANALYZE_LOCAL_CONTRAST: 'agent:analyze-local-contrast',
} as const;

// Response channels (renderer → main)
export const AGENT_RESPONSE_PREFIX = 'agent:response:';
