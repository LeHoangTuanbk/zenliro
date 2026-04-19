import { useEffect, useRef, useState } from 'react';
import { useAgentStore } from '../store/agent-store';
import { MarkdownText } from './markdown-text';
import type { A2AActor, A2AMessage } from '../store/agent-store';

// Floating popup showing A2A conversation between Editor and Reviewer.
//
// Layout states (matches other tool popups in the app):
// - Centered: default — panel floats center-bottom of the canvas, readable
//   but out of the way of the image preview.
// - Maximized: near-fullscreen overlay for easy reading of long exchanges.
// - Minimized: header-only bar pinned to the bottom right so it stays out of
//   the way but the user can pop it back open.

const ACTOR_STYLE: Record<A2AActor, { label: string; color: string; avatar: string }> = {
  editor: { label: 'Editor', color: '#4d9fec', avatar: 'E' },
  reviewer: { label: 'Reviewer', color: '#68c98a', avatar: 'R' },
  user: { label: 'You', color: '#f5c542', avatar: 'U' },
};

type PanelMode = 'centered' | 'maximized' | 'minimized';

export function AgentConversationPanel() {
  const isOpen = useAgentStore((s) => s.isConversationOpen);
  const setOpen = useAgentStore((s) => s.setConversationOpen);
  const messages = useAgentStore((s) => s.a2aMessages);
  const clear = useAgentStore((s) => s.clearA2A);
  const listRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<PanelMode>('centered');

  useEffect(() => {
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

  // Minimized: pill header-only pinned to the bottom-right corner.
  if (mode === 'minimized') {
    return (
      <button
        onClick={() => setMode('centered')}
        className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-full shadow-xl hover:border-[#555] transition-colors"
        title="Expand conversation"
      >
        <span className="text-[11px] font-semibold text-white">Agent Conversation</span>
        <div className="flex items-center gap-0.5">
          <AgentDot actor="editor" />
          <span className="text-[8px] text-[#666]">×</span>
          <AgentDot actor="reviewer" />
        </div>
        {messages.length > 0 && (
          <span className="text-[9px] text-[#888] font-medium tabular-nums">{messages.length}</span>
        )}
      </button>
    );
  }

  const positionClass =
    mode === 'maximized'
      ? 'inset-8'
      : 'left-1/2 -translate-x-1/2 bottom-6 w-[min(640px,90vw)] max-h-[70vh]';

  return (
    <div
      className={`fixed z-[60] bg-[#1a1a1a] border border-[#333] rounded-[8px] shadow-2xl flex flex-col ${positionClass}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#333] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-white">Agent Conversation</span>
          <div className="flex items-center gap-1">
            <AgentDot actor="editor" />
            <span className="text-[9px] text-[#666]">×</span>
            <AgentDot actor="reviewer" />
          </div>
          {messages.length > 0 && (
            <span className="text-[9px] text-[#555] ml-1">
              {messages.length} message{messages.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => clear()}
            className="text-[9px] text-[#666] hover:text-[#aaa] transition-colors px-1.5 py-0.5"
            title="Clear conversation"
          >
            Clear
          </button>
          <IconButton title="Minimize" onClick={() => setMode('minimized')}>
            <path d="M2 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </IconButton>
          {mode === 'maximized' ? (
            <IconButton title="Restore" onClick={() => setMode('centered')}>
              <rect
                x="2"
                y="2"
                width="6"
                height="6"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
                rx="1"
              />
              <rect
                x="4"
                y="4"
                width="6"
                height="6"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
                rx="1"
              />
            </IconButton>
          ) : (
            <IconButton title="Maximize" onClick={() => setMode('maximized')}>
              <rect
                x="2"
                y="2"
                width="8"
                height="8"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                rx="1"
              />
            </IconButton>
          )}
          <IconButton title="Close (Esc)" onClick={() => setOpen(false)}>
            <path
              d="M2 2L10 10M10 2L2 10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </IconButton>
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
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

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 flex items-center justify-center text-[#666] hover:text-white hover:bg-white/5 rounded transition-colors"
      title={title}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        {children}
      </svg>
    </button>
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

  if (message.type === 'status') {
    return (
      <div className="self-center text-[9px] text-[#555] py-1 px-2 rounded bg-[#222] uppercase tracking-wider">
        {message.content}
      </div>
    );
  }

  const alignRight = message.from === 'user' || message.from === 'reviewer';

  return (
    <div className={`flex gap-2 ${alignRight ? 'flex-row-reverse' : ''}`}>
      <span
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-semibold text-white mt-0.5"
        style={{ background: fromStyle.color }}
        title={fromStyle.label}
      >
        {fromStyle.avatar}
      </span>
      <div className={`flex flex-col ${alignRight ? 'items-end' : 'items-start'} max-w-[75%]`}>
        <div className="flex items-center gap-1 text-[9px] text-[#666] mb-1">
          <span style={{ color: fromStyle.color }} className="font-medium">
            {fromStyle.label}
          </span>
          {message.iteration > 0 && <span>· iter {message.iteration}</span>}
        </div>
        <div
          className="rounded-[8px] px-3 py-2 bg-[#222]"
          style={{ borderLeft: `2px solid ${fromStyle.color}` }}
        >
          {message.content ? (
            <MarkdownText text={message.content} />
          ) : (
            <span className="text-[10px] text-[#555] italic">(empty)</span>
          )}
        </div>
      </div>
    </div>
  );
}
