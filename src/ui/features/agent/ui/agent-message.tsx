import type { AgentMessage as AgentMessageType } from '../store/agent-store';
import { AgentToolCallBadge } from './agent-tool-call-badge';
import { AgentThinking } from './agent-thinking';
import { StreamItems } from './stream-items';

type AgentMessageProps = {
  message: AgentMessageType;
};

export function AgentMessage({ message }: AgentMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-2.5 py-1.5 rounded-[6px] text-[11px] leading-relaxed bg-[#333] text-[#e0e0e0]">
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        </div>
      </div>
    );
  }

  // Assistant message — render items inline (text + tool calls interleaved)
  return (
    <div>
      {message.thinking && <AgentThinking text={message.thinking} />}
      {message.items ? (
        <StreamItems items={message.items} />
      ) : (
        message.text && (
          <p className="text-[11px] leading-relaxed text-[#ddd] whitespace-pre-wrap break-words">
            {message.text}
          </p>
        )
      )}
    </div>
  );
}
