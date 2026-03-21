import type { StreamItem } from '../store/agent-store';
import { AgentToolCallBadge } from './agent-tool-call-badge';

type StreamItemsProps = {
  items: StreamItem[];
};

export function StreamItems({ items }: StreamItemsProps) {
  return (
    <div>
      {items.map((item, i) => {
        if (item.type === 'text') {
          return (
            <p
              key={i}
              className="text-[11px] leading-relaxed text-[#ddd] whitespace-pre-wrap break-words"
            >
              {item.text}
            </p>
          );
        }
        return (
          <AgentToolCallBadge key={item.toolCall.id || i} toolCall={item.toolCall} />
        );
      })}
    </div>
  );
}
