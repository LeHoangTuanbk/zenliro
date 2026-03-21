import type { AgentMessage as AgentMessageType } from '../store/agent-store';
import { AgentToolCallBadge } from './agent-tool-call-badge';
import { AgentThinking } from './agent-thinking';

type AgentMessageProps = {
  message: AgentMessageType;
};

export function AgentMessage({ message }: AgentMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-2.5 py-1.5 rounded-[4px] text-[11px] leading-relaxed ${
          isUser
            ? 'bg-br-accent/20 text-br-text'
            : 'bg-br-elevated text-br-text'
        }`}
      >
        {message.thinking && <AgentThinking text={message.thinking} />}

        {message.text && (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        )}

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {message.toolCalls.map((tc) => (
              <AgentToolCallBadge key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
