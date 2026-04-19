import { useEffect, useRef } from 'react';
import { useAgentStore } from '../store/agent-store';
import type { A2AActor, A2AMessage } from '../store/agent-store';

// Floating popup showing A2A conversation between Editor and Reviewer.
// Opens automatically when the orchestrator starts (session-started event
// via use-a2a-stream). User can minimize via the header button.

const ACTOR_STYLE: Record<A2AActor, { label: string; color: string; avatar: string }> = {
  editor: { label: 'Editor', color: '#4d9fec', avatar: 'E' },
  reviewer: { label: 'Reviewer', color: '#68c98a', avatar: 'R' },
  user: { label: 'You', color: '#f5c542', avatar: 'U' },
};

export function AgentConversationPanel() {
  const isOpen = useAgentStore((s) => s.isConversationOpen);
  const setOpen = useAgentStore((s) => s.setConversationOpen);
  const messages = useAgentStore((s) => s.a2aMessages);
  const clear = useAgentStore((s) => s.clearA2A);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom as new messages arrive.
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, setOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-[420px] max-h-[60vh] bg-[#1a1a1a] border border-[#333] rounded-[8px] shadow-2xl flex flex-col z-[60]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#333]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-white">Agent Conversation</span>
          <div className="flex items-center gap-1">
            <AgentDot actor="editor" />
            <span className="text-[9px] text-[#666]">×</span>
            <AgentDot actor="reviewer" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => clear()}
            className="text-[9px] text-[#666] hover:text-[#aaa] transition-colors px-1.5 py-0.5"
            title="Clear conversation"
          >
            Clear
          </button>
          <button
            onClick={() => setOpen(false)}
            className="w-5 h-5 flex items-center justify-center text-[#666] hover:text-white transition-colors"
            title="Hide"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
        {messages.length === 0 ? (
          <div className="text-[10px] text-[#555] text-center py-8">
            Waiting for agents to start talking…
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
      </div>
    </div>
  );
}

function AgentDot({ actor }: { actor: A2AActor }) {
  const s = ACTOR_STYLE[actor];
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-semibold text-white"
      style={{ background: s.color }}
      title={s.label}
    >
      {s.avatar}
    </span>
  );
}

function MessageBubble({ message }: { message: A2AMessage }) {
  const fromStyle = ACTOR_STYLE[message.from];

  // Status rows (session-ended etc.) are rendered centered, muted.
  if (message.type === 'status') {
    return (
      <div className="self-center text-[9px] text-[#555] py-1 px-2 rounded bg-[#222] uppercase tracking-wider">
        {message.content}
      </div>
    );
  }

  // Alternate alignment by sender so Editor and Reviewer sit on opposite
  // sides. User messages pin to the right (they came from the panel user).
  const alignRight = message.from === 'user' || message.from === 'reviewer';

  return (
    <div className={`flex gap-2 ${alignRight ? 'flex-row-reverse' : ''}`}>
      <span
        className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold text-white mt-0.5"
        style={{ background: fromStyle.color }}
        title={fromStyle.label}
      >
        {fromStyle.avatar}
      </span>
      <div className={`flex flex-col ${alignRight ? 'items-end' : 'items-start'} max-w-[80%]`}>
        <div className="flex items-center gap-1 text-[9px] text-[#666] mb-0.5">
          <span style={{ color: fromStyle.color }}>{fromStyle.label}</span>
          {message.iteration > 0 && <span>· iter {message.iteration}</span>}
        </div>
        <div
          className="text-[10px] leading-relaxed text-[#ddd] bg-[#222] rounded-[6px] px-2.5 py-1.5 whitespace-pre-wrap break-words"
          style={{ borderLeft: `2px solid ${fromStyle.color}` }}
        >
          {message.content || '(empty)'}
        </div>
      </div>
    </div>
  );
}
