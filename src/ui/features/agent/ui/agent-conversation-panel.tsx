import { useEffect, useRef, useState } from 'react';
import { useAgentStore } from '../store/agent-store';
import { ActivityIndicators } from './conversation/activity-bubble';
import { ConversationHeader } from './conversation/conversation-header';
import { ConversationMinimized } from './conversation/conversation-minimized';
import { MessageBubble } from './conversation/message-bubble';
import { useConversationDrag } from './conversation/use-conversation-drag';
import { WIDTH_PX, type PanelMode } from './conversation/actor-style';

// Floating popup showing A2A conversation between Editor and Reviewer.
// Three layout modes (matches other tool popups): centered (default, top-
// center anchor, draggable), maximized (fullscreen overlay), minimized
// (pinned pill bottom-right). See ./conversation/* for the pieces.

export function AgentConversationPanel() {
  const isOpen = useAgentStore((s) => s.isConversationOpen);
  const setOpen = useAgentStore((s) => s.setConversationOpen);
  const messages = useAgentStore((s) => s.a2aMessages);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<PanelMode>('centered');
  const { pos, startDrag, resetPos } = useConversationDrag(panelRef, mode === 'maximized');

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
  if (mode === 'minimized') {
    return (
      <ConversationMinimized messageCount={messages.length} onExpand={() => setMode('centered')} />
    );
  }

  const isMax = mode === 'maximized';
  const positionClass = isMax ? 'inset-8' : pos ? '' : 'left-1/2 -translate-x-1/2 top-16';
  const positionStyle = isMax || !pos ? undefined : { left: pos.x, top: pos.y, width: WIDTH_PX };
  const sizeClass = isMax ? '' : pos ? 'max-h-[60vh]' : 'w-[min(380px,92vw)] max-h-[60vh]';

  return (
    <div
      ref={panelRef}
      className={`fixed z-[60] bg-[#1a1a1a] border border-[#333] rounded-[8px] shadow-2xl flex flex-col ${positionClass} ${sizeClass}`}
      style={positionStyle}
    >
      <ConversationHeader
        mode={mode}
        onMouseDown={startDrag}
        onMinimize={() => setMode('minimized')}
        onMaximize={() => setMode('maximized')}
        onRestore={() => {
          setMode('centered');
          resetPos();
        }}
        onClose={() => setOpen(false)}
      />
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
