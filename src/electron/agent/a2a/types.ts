// Types re-exported from Google's @a2a-js/sdk. Using the SDK's schema lets us
// add HTTP transport later (swap the Room implementation for the SDK's
// AgentExecutor + Express server) without changing message shapes.
//
// Transport in this build is in-process via Room (see ./room.ts). The schemas
// themselves are the real contract — agents communicate in Messages composed
// of Parts, and work is tracked in Tasks with standard lifecycle states.

import type { AgentCard, Message, Part, Task, Artifact } from '@a2a-js/sdk';

export type { AgentCard, Message, Part, Task, Artifact };

// App-specific identifiers. These match the `agentId` fields we attach to
// A2A Messages so the Room can route 1:1 or broadcast.
export type AgentId = 'editor' | 'reviewer' | 'orchestrator';

// Internal routing envelope. Holds one SDK Message plus addressing info and
// the shared conversation id. The Room strips this back down to pure A2A
// objects before exposing them to subscribers.
export type RoomEnvelope = {
  id: string;
  from: AgentId;
  to: AgentId | 'broadcast';
  message: Message;
  inReplyTo?: string;
  iteration: number;
  timestamp: number;
};

// Orchestrator lifecycle events. Emitted per team preset run so IPC + UI can
// track when agents join, finish, or the whole conversation ends.
export type OrchestratorEvent =
  | { type: 'session-started'; sessionId: string; agentIds: AgentId[] }
  | { type: 'agent-joined'; sessionId: string; agentId: AgentId; card: AgentCard }
  | { type: 'agent-turn-started'; sessionId: string; agentId: AgentId; iteration: number }
  | { type: 'message'; sessionId: string; envelope: RoomEnvelope }
  | { type: 'artifact'; sessionId: string; fromAgent: AgentId; artifact: Artifact }
  | { type: 'task-status'; sessionId: string; agentId: AgentId; task: Task }
  | {
      type: 'session-ended';
      sessionId: string;
      reason: 'approved' | 'max-iterations' | 'cancelled' | 'error';
      detail?: string;
    };

export type SessionState = {
  id: string;
  agentIds: AgentId[];
  messages: RoomEnvelope[];
  artifacts: Artifact[];
  iteration: number;
  maxIterations: number;
  status: 'running' | 'completed' | 'cancelled' | 'error';
};
