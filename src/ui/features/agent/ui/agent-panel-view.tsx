import { useEffect, useRef } from 'react';
import type { AgentMessage as AgentMessageType } from '../store/agent-store';
import { AgentMessage } from './agent-message';
import { AgentInput } from './agent-input';

const SUGGESTIONS = [
  'Make this photo warmer and more cinematic',
  'Add a moody film look with faded blacks',
  'Boost colors and add punch to this landscape',
  'Create a soft, dreamy portrait look',
];

type AgentPanelViewProps = {
  isMaximized: boolean;
  isStreaming: boolean;
  messages: AgentMessageType[];
  currentStreamText: string;
  onSend: (text: string) => void;
  onStop: () => void;
  onToggle: () => void;
  onMaximize: () => void;
  onClear: () => void;
};

export function AgentPanelView({
  isMaximized,
  isStreaming,
  messages,
  currentStreamText,
  onSend,
  onStop,
  onToggle,
  onMaximize,
  onClear,
}: AgentPanelViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasMessages = messages.length > 0 || !!currentStreamText;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentStreamText]);

  const w = isMaximized ? 480 : 380;
  const h = isMaximized ? 560 : 420;

  return (
    <div
      className="absolute bottom-3 left-3 z-20 flex flex-col overflow-hidden shadow-2xl transition-all duration-200"
      style={{
        width: w,
        height: h,
        background: '#1a1a1a',
        borderRadius: 8,
        border: '1px solid #2a2a2a',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <span className="text-[12px] font-semibold text-[#e0e0e0] tracking-wide">
          AI Agent
        </span>
        <div className="flex items-center gap-2">
          {hasMessages && (
            <button
              onClick={onClear}
              className="text-[10px] text-[#666] hover:text-[#999] transition-colors"
              title="New Chat"
            >
              New Chat
            </button>
          )}
          <button
            onClick={onMaximize}
            className="text-[#666] hover:text-[#999] transition-colors"
            title={isMaximized ? 'Minimize' : 'Maximize'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              {isMaximized ? (
                <path d="M3 1h8v8h-2v2H1V3h2V1zm1 2v6h5V4H4z" fill="currentColor" />
              ) : (
                <path d="M1 1h10v10H1V1zm1 1v8h8V2H2z" fill="currentColor" />
              )}
            </svg>
          </button>
          <button
            onClick={onToggle}
            className="text-[#666] hover:text-[#999] transition-colors"
            title="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3">
        {!hasMessages ? (
          /* Empty state with suggestions */
          <div className="flex flex-col items-center justify-center h-full pb-4">
            <p className="text-[12px] text-[#888] mb-5">
              Ask me to edit your photo...
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[320px]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  className="text-left text-[11px] text-[#aaa] px-3 py-2 rounded-[6px] bg-[#252525] hover:bg-[#2e2e2e] hover:text-[#ccc] transition-colors border border-[#333]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="space-y-2.5 py-2">
            {messages.map((msg) => (
              <AgentMessage key={msg.id} message={msg} />
            ))}

            {currentStreamText && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-2.5 py-1.5 rounded-[6px] text-[11px] leading-relaxed bg-[#252525] text-[#ddd]">
                  <p className="whitespace-pre-wrap break-words">{currentStreamText}</p>
                  <span className="inline-block w-1 h-3.5 bg-[#c89b3c] animate-pulse ml-0.5 rounded-sm" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <AgentInput isStreaming={isStreaming} onSend={onSend} onStop={onStop} />
    </div>
  );
}
