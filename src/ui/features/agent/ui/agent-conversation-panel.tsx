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

const WIDTH_PX = 380;

export function AgentConversationPanel() {
  const isOpen = useAgentStore((s) => s.isConversationOpen);
  const setOpen = useAgentStore((s) => s.setConversationOpen);
  const messages = useAgentStore((s) => s.a2aMessages);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<PanelMode>('centered');
  // null = default anchored position (top-center); otherwise absolute px.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{ offsetX: number; offsetY: number } | null>(null);

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

  // Keep the dragged panel inside the viewport when the window resizes.
  useEffect(() => {
    if (!pos) return;
    const clamp = () => {
      const el = panelRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const maxX = Math.max(0, window.innerWidth - r.width);
      const maxY = Math.max(0, window.innerHeight - r.height);
      setPos((p) =>
        p ? { x: Math.min(Math.max(0, p.x), maxX), y: Math.min(Math.max(0, p.y), maxY) } : p,
      );
    };
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [pos]);

  const startDrag = (e: React.MouseEvent) => {
    // Ignore drags that start on buttons inside the header.
    if ((e.target as HTMLElement).closest('button')) return;
    if (mode === 'maximized') return;
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    dragState.current = { offsetX: e.clientX - r.left, offsetY: e.clientY - r.top };

    // Pin the panel to absolute coords so CSS transforms don't fight us.
    if (!pos) setPos({ x: r.left, y: r.top });

    const onMove = (ev: MouseEvent) => {
      const d = dragState.current;
      if (!d) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const nx = Math.min(Math.max(0, ev.clientX - d.offsetX), window.innerWidth - w);
      const ny = Math.min(Math.max(0, ev.clientY - d.offsetY), window.innerHeight - h);
      setPos({ x: nx, y: ny });
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  };

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

  // Maximized → fullscreen overlay. Otherwise use the dragged position if
  // the user has moved the panel, else fall back to the top-center default.
  const isMax = mode === 'maximized';
  const positionClass = isMax ? 'inset-8' : pos ? '' : 'left-1/2 -translate-x-1/2 top-16';
  const positionStyle: React.CSSProperties | undefined =
    isMax || !pos ? undefined : { left: pos.x, top: pos.y, width: WIDTH_PX };
  // Tailwind JIT can't interpolate template literals — keep the width class
  // literal. WIDTH_PX is only used when pos is set (inline style below).
  const sizeClass = isMax ? '' : pos ? 'max-h-[60vh]' : 'w-[min(380px,92vw)] max-h-[60vh]';

  return (
    <div
      ref={panelRef}
      className={`fixed z-[60] bg-[#1a1a1a] border border-[#333] rounded-[8px] shadow-2xl flex flex-col ${positionClass} ${sizeClass}`}
      style={positionStyle}
    >
      {/* Header — drag handle */}
      <div
        onMouseDown={startDrag}
        style={{ cursor: isMax ? 'default' : 'move' }}
        className="flex items-center justify-between px-3 py-2 border-b border-[#333] shrink-0 select-none"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-white">Agent Conversation</span>
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton title="Minimize" onClick={() => setMode('minimized')}>
            <path d="M2 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </IconButton>
          {mode === 'maximized' ? (
            <IconButton
              title="Restore"
              onClick={() => {
                setMode('centered');
                setPos(null);
              }}
            >
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
        <ActivityIndicators />
      </div>
    </div>
  );
}

function ActivityIndicators() {
  const activity = useAgentStore((s) => s.a2aActivity);
  const entries = Object.entries(activity).filter(([, v]) => v.isRunning || v.toolCount > 0);
  if (entries.length === 0) return null;
  return (
    <>
      {entries.map(([agentId, a]) => (
        <ActivityBubble
          key={agentId}
          agentId={agentId as A2AActor}
          toolCount={a.toolCount}
          lastTool={a.lastTool}
        />
      ))}
    </>
  );
}

function ActivityBubble({
  agentId,
  toolCount,
  lastTool,
}: {
  agentId: A2AActor;
  toolCount: number;
  lastTool: string | null;
}) {
  const s = ACTOR_STYLE[agentId] ?? ACTOR_STYLE.user;
  const alignRight = agentId === 'user' || agentId === 'reviewer';
  const prettyTool = lastTool?.replace(/^mcp__zenliro__/, '') ?? '';
  const statusText =
    toolCount === 0
      ? 'thinking…'
      : `working · ${toolCount} tool${toolCount === 1 ? '' : 's'}${prettyTool ? ` · ${prettyTool}` : ''}`;
  return (
    <div className={`flex gap-2 ${alignRight ? 'flex-row-reverse' : ''}`}>
      <span
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-semibold text-white mt-0.5"
        style={{ background: s.color }}
        title={s.label}
      >
        {s.avatar}
      </span>
      <div
        className={`flex items-center gap-2 rounded-[8px] px-3 py-2 bg-[#222] text-[10px] text-[#aaa]`}
        style={{ borderLeft: `2px solid ${s.color}` }}
      >
        <span className="flex gap-0.5">
          <span
            className="w-1 h-1 rounded-full bg-[#888] animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-1 h-1 rounded-full bg-[#888] animate-bounce"
            style={{ animationDelay: '120ms' }}
          />
          <span
            className="w-1 h-1 rounded-full bg-[#888] animate-bounce"
            style={{ animationDelay: '240ms' }}
          />
        </span>
        <span>
          <span style={{ color: s.color }} className="font-medium">
            {s.label}
          </span>{' '}
          {statusText}
        </span>
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
    <div className={`flex gap-2 min-w-0 ${alignRight ? 'flex-row-reverse' : ''}`}>
      <span
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-semibold text-white mt-0.5"
        style={{ background: fromStyle.color }}
        title={fromStyle.label}
      >
        {fromStyle.avatar}
      </span>
      <div
        className={`flex flex-col min-w-0 max-w-[85%] ${alignRight ? 'items-end' : 'items-start'}`}
      >
        <div className="flex items-center gap-1 text-[9px] text-[#666] mb-1">
          <span style={{ color: fromStyle.color }} className="font-medium">
            {fromStyle.label}
          </span>
          {message.iteration > 0 && <span>· iter {message.iteration}</span>}
        </div>
        <div
          className="rounded-[8px] px-3 py-2 bg-[#222] max-w-full overflow-hidden break-words"
          style={{ borderLeft: `2px solid ${fromStyle.color}`, overflowWrap: 'anywhere' }}
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
