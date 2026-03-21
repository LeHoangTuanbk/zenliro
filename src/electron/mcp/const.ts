// IPC channels for agent ↔ renderer communication
export const AGENT_CHANNELS = {
  GET_SCREENSHOT: 'agent:get-screenshot',
  GET_EDIT_STATE: 'agent:get-edit-state',
  GET_PHOTO_INFO: 'agent:get-photo-info',
  SET_ADJUSTMENTS: 'agent:set-adjustments',
  SET_TONE_CURVE: 'agent:set-tone-curve',
  SET_COLOR_MIXER: 'agent:set-color-mixer',
  SET_COLOR_GRADING: 'agent:set-color-grading',
  SET_EFFECTS: 'agent:set-effects',
  RESET_ALL: 'agent:reset-all',
} as const;

// Response channels (renderer → main)
export const AGENT_RESPONSE_PREFIX = 'agent:response:';
