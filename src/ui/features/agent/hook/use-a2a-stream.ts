import { useEffect } from 'react';
import { useAgentStore } from '../store/agent-store';
import type { A2AMessage, A2AActor } from '../store/agent-store';

// Orchestrator event shape mirrors src/electron/agent/a2a/types.ts.
// We only consume `message` and `session-*` events in the popup — task-status
// and artifact events are placeholders for when HTTP A2A transport lands.
type OrchestratorEvent =
  | { type: 'session-started'; sessionId: string; agentIds: string[] }
  | { type: 'agent-joined'; sessionId: string; agentId: string; card: unknown }
  | { type: 'agent-turn-started'; sessionId: string; agentId: string; iteration: number }
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

// Subscribes to:
//  - agent:a2a-event: orchestrator lifecycle (session-started, message,
//    session-ended) → fills `a2aMessages` in the store.
//  - agent:a2a-stream: per-agent Claude CLI events (tool_use, text, done) →
//    bumps the `a2aActivity` counter so the popup can render a live
//    "Reviewer is analyzing…" indicator while the agent works.
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
          store.clearAllActivity();
          break;

        case 'agent-turn-started':
          // Orchestrator is about to spawn this agent — flip its activity to
          // running so the UI shows a "thinking…" bubble even before the first
          // tool_use event arrives.
          store.startActivity(ev.agentId);
          break;

        case 'message': {
          const env = ev.envelope;
          // An agent just posted its final message — the activity indicator
          // for that agent can stop (they're done working for this turn).
          store.resetActivity(env.from);
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
          store.clearAllActivity();
          useAgentStore.setState({ isStreaming: false });
          break;
        }

        default:
          break;
      }
    });

    const offStream = api.onA2AStream?.((raw: { agentId: string; event: unknown }) => {
      const store = useAgentStore.getState();
      const ev = raw.event as { type: string; name?: string };
      if (ev.type === 'tool_use' && ev.name) {
        store.bumpActivity(raw.agentId, ev.name);
      } else if (ev.type === 'done' || ev.type === 'error') {
        store.resetActivity(raw.agentId);
      }
    });

    return () => {
      off?.();
      offStream?.();
    };
  }, []);
}
