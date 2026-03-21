import { useEffect, useRef } from 'react';
import type { AgentMessage as AgentMessageType } from '../store/agent-store';
import { AgentMessage } from './agent-message';
import { AgentInput } from './agent-input';

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentStreamText]);

  const panelSize = isMaximized
    ? 'w-[500px] h-[500px]'
    : 'w-[350px] h-[300px]';

  return (
    <div
      className={`absolute bottom-3 left-3 ${panelSize} bg-[#1e1e1e] border border-[#333] rounded-[4px] flex flex-col shadow-xl z-20 overflow-hidden transition-all duration-200`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-black/50 bg-[#191919] shrink-0">
        <span className="text-[11px] font-medium text-br-text">
          AI Agent
          {isStreaming && (
            <span className="ml-1.5 text-br-accent animate-pulse">thinking...</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onClear}
            className="text-[10px] text-br-muted hover:text-br-text px-1"
            title="Clear chat"
          >
            Clear
          </button>
          <button
            onClick={onMaximize}
            className="text-[10px] text-br-muted hover:text-br-text px-1"
            title={isMaximized ? 'Minimize' : 'Maximize'}
          >
            {isMaximized ? '◇' : '◈'}
          </button>
          <button
            onClick={onToggle}
            className="text-[10px] text-br-muted hover:text-br-text px-1"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2.5 py-2 space-y-2">
        {messages.length === 0 && !currentStreamText && (
          <p className="text-[10px] text-br-muted/50 text-center mt-8">
            Ask the AI to edit your photo.
            <br />
            e.g. "Make this photo warmer and more cinematic"
          </p>
        )}

        {messages.map((msg) => (
          <AgentMessage key={msg.id} message={msg} />
        ))}

        {/* Current streaming text */}
        {currentStreamText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-2.5 py-1.5 rounded-[4px] text-[11px] leading-relaxed bg-br-elevated text-br-text">
              <p className="whitespace-pre-wrap break-words">{currentStreamText}</p>
              <span className="inline-block w-1.5 h-3 bg-br-accent animate-pulse ml-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <AgentInput isStreaming={isStreaming} onSend={onSend} onStop={onStop} />
    </div>
  );
}
