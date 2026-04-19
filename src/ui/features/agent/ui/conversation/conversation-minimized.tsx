import { AgentDot } from './agent-dot';

type ConversationMinimizedProps = {
  messageCount: number;
  onExpand: () => void;
};

export function ConversationMinimized({ messageCount, onExpand }: ConversationMinimizedProps) {
  return (
    <button
      onClick={onExpand}
      className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#333] rounded-full shadow-xl hover:border-[#555] transition-colors"
      title="Expand conversation"
    >
      <span className="text-[11px] font-semibold text-white">Agent Conversation</span>
      <div className="flex items-center gap-0.5">
        <AgentDot actor="editor" />
        <span className="text-[8px] text-[#666]">×</span>
        <AgentDot actor="reviewer" />
      </div>
      {messageCount > 0 && (
        <span className="text-[9px] text-[#888] font-medium tabular-nums">{messageCount}</span>
      )}
    </button>
  );
}
