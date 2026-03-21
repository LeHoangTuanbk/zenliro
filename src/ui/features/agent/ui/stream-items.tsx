import type { StreamItem } from '../store/agent-store';
import { AgentToolCallBadge } from './agent-tool-call-badge';
import { MarkdownText } from './markdown-text';

type StreamItemsProps = {
  items: StreamItem[];
};

export function StreamItems({ items }: StreamItemsProps) {
  return (
    <div>
      {items.map((item, i) => {
        if (item.type === 'text') {
          return <MarkdownText key={i} text={item.text} />;
        }
        return (
          <AgentToolCallBadge key={item.toolCall.id || i} toolCall={item.toolCall} />
        );
      })}
    </div>
  );
}
