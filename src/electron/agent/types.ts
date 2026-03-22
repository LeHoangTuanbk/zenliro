export type StreamEventType =
  | 'assistant'
  | 'tool_use'
  | 'tool_result'
  | 'result'
  | 'error';

export type StreamEvent = {
  type: StreamEventType;
  subtype?: string;
  // assistant text
  content_block?: {
    type: string;
    text?: string;
    name?: string;
    id?: string;
    input?: unknown;
    thinking?: string;
  };
  // result
  result?: string;
  // error
  error?: string;
};

export type AgentSessionStatus = {
  running: boolean;
};
