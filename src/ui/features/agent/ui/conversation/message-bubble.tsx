import type { A2AMessage } from '../../store/agent-store';
import { MarkdownText } from '../markdown-text';
import { ACTOR_STYLE } from './actor-style';

export function MessageBubble({ message }: { message: A2AMessage }) {
  if (message.type === 'status') return <StatusBubble content={message.content} />;

  const fromStyle = ACTOR_STYLE[message.from];
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

function StatusBubble({ content }: { content: string }) {
  return (
    <div className="self-center text-[9px] text-[#555] py-1 px-2 rounded bg-[#222] uppercase tracking-wider">
      {content}
    </div>
  );
}
