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

export const AGENT_RESPONSE_PREFIX = 'agent:response:';

export const AGENT_SESSION_CHANNELS = {
  START: 'agent:start-session',
  SEND_MESSAGE: 'agent:send-message',
  STOP: 'agent:stop-session',
  GET_STATUS: 'agent:get-status',
  STREAM_TEXT: 'agent:stream-text',
  STREAM_TOOL_USE: 'agent:stream-tool-use',
  STREAM_THINKING: 'agent:stream-thinking',
  STREAM_DONE: 'agent:stream-done',
  STREAM_ERROR: 'agent:stream-error',
} as const;
