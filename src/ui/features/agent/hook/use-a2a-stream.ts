import { useEffect } from 'react';
import { useAgentStore } from '../store/agent-store';
import type { A2AMessage, A2AActor } from '../store/agent-store';

// Orchestrator event shape mirrors src/electron/agent/a2a/types.ts.
// We only consume `message` and `session-*` events in the popup — task-status
// and artifact events are placeholders for when HTTP A2A transport lands.
type OrchestratorEvent =
  | { type: 'session-started'; sessionId: string; agentIds: string[] }
  | { type: 'agent-joined'; sessionId: string; agentId: string; card: unknown }
  | {
      type: 'message';
      sessionId: string;
      envelope: {
        id: string;
        from: string;
        to: string;
        message: { role: 'user' | 'agent'; parts: Array<{ kind?: string; text?: string }> };
        iteration: number;
        timestamp: number;
      };
    }
  | { type: 'artifact'; sessionId: string; fromAgent: string; artifact: unknown }
  | { type: 'task-status'; sessionId: string; agentId: string; task: unknown }
  | {
      type: 'session-ended';
      sessionId: string;
      reason: 'approved' | 'max-iterations' | 'cancelled' | 'error';
      detail?: string;
    };

function extractText(parts: Array<{ kind?: string; text?: string }> | undefined): string {
  if (!parts) return '';
  return parts
    .filter((p) => (p.kind ?? (p as unknown as { type?: string }).type) === 'text')
    .map((p) => p.text ?? '')
    .join('\n');
}

function normaliseActor(id: string): A2AActor {
  if (id === 'editor' || id === 'reviewer' || id === 'user') return id;
  return 'user';
}

// Subscribes to a2a-event IPC and keeps the agent store's a2aMessages in sync.
// Also toggles isStreaming off / records a status message on session end.
export function useA2AStream() {
  useEffect(() => {
    const api = window.electron?.agent;
    if (!api?.onA2AEvent) return;

    const off = api.onA2AEvent((raw: unknown) => {
      const ev = raw as OrchestratorEvent;
      const store = useAgentStore.getState();

      switch (ev.type) {
        case 'session-started':
          store.setConversationOpen(true);
          break;

        case 'message': {
          const env = ev.envelope;
          const msg: A2AMessage = {
            id: env.id,
            from: normaliseActor(env.from),
            to: normaliseActor(env.to),
            type: 'result',
            content: extractText(env.message.parts),
            iteration: env.iteration,
            timestamp: env.timestamp,
          };
          store.appendA2A(msg);
          break;
        }

        case 'session-ended': {
          const statusMsg: A2AMessage = {
            id: `end-${Date.now()}`,
            from: 'user',
            to: 'user',
            type: 'status',
            content: `Session ${ev.reason}${ev.detail ? `: ${ev.detail}` : ''}`,
            iteration: 0,
            timestamp: Date.now(),
          };
          store.appendA2A(statusMsg);
          useAgentStore.setState({ isStreaming: false });
          break;
        }

        default:
          // agent-joined / artifact / task-status — not rendered yet
          break;
      }
    });

    return () => {
      off?.();
    };
  }, []);
}
