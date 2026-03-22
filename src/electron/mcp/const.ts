// IPC channels for agent ↔ renderer communication
export const AGENT_CHANNELS = {
  // Read
  GET_SCREENSHOT: 'agent:get-screenshot',
  GET_EDIT_STATE: 'agent:get-edit-state',
  GET_PHOTO_INFO: 'agent:get-photo-info',
  GET_HISTOGRAM: 'agent:get-histogram',
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
} as const;

// Response channels (renderer → main)
export const AGENT_RESPONSE_PREFIX = 'agent:response:';
