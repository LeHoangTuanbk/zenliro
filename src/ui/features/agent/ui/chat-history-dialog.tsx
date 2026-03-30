import { useAgentStore } from '../store/agent-store';

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ChatHistoryDialog() {
  const list = useAgentStore((s) => s.chatHistoryList);
  const setShow = useAgentStore((s) => s.setShowChatHistory);
  const loadChat = useAgentStore((s) => s.loadChat);
  const deleteChat = useAgentStore((s) => s.deleteChat);
  const activeChatId = useAgentStore((s) => s.chatId);

  return (
    <div className="absolute inset-0 z-30 flex flex-col" style={{ background: '#1a1a1a' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a2a] shrink-0">
        <span className="text-[12px] font-semibold text-[#e0e0e0] tracking-wide">Chat History</span>
        <button
          onClick={() => setShow(false)}
          className="text-[#666] hover:text-[#999] transition-colors cursor-pointer"
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 3l6 6M9 3l-6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-[11px] text-[#555]">No previous chats</span>
          </div>
        ) : (
          <div className="py-1">
            {list.map((chat) => (
              <div
                key={chat.id}
                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                  chat.id === activeChatId ? 'bg-[#2a2a2a]' : 'hover:bg-[#222]'
                }`}
                onClick={() => loadChat(chat.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-[#ccc] truncate">{chat.title}</div>
                  <div className="text-[9px] text-[#555] mt-0.5">{formatDate(chat.updatedAt)}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-[#555] hover:text-red-400 transition-all cursor-pointer shrink-0"
                  title="Delete chat"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M3 3l6 6M9 3l-6 6"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
