import { useAgentStore } from '../../store/agent-store';
import type { A2AActor } from '../../store/agent-store';
import { ACTOR_STYLE } from './actor-style';

export function ActivityIndicators() {
  const activity = useAgentStore((s) => s.a2aActivity);
  const entries = Object.entries(activity).filter(([, v]) => v.isRunning || v.toolCount > 0);
  if (entries.length === 0) return null;
  return (
    <>
      {entries.map(([agentId, a]) => (
        <ActivityBubble
          key={agentId}
          agentId={agentId as A2AActor}
          toolCount={a.toolCount}
          lastTool={a.lastTool}
        />
      ))}
    </>
  );
}

type ActivityBubbleProps = {
  agentId: A2AActor;
  toolCount: number;
  lastTool: string | null;
};

function ActivityBubble({ agentId, toolCount, lastTool }: ActivityBubbleProps) {
  const s = ACTOR_STYLE[agentId] ?? ACTOR_STYLE.user;
  const alignRight = agentId === 'user' || agentId === 'reviewer';
  const prettyTool = lastTool?.replace(/^mcp__zenliro__/, '') ?? '';
  const statusText =
    toolCount === 0
      ? 'thinking…'
      : `working · ${toolCount} tool${toolCount === 1 ? '' : 's'}${prettyTool ? ` · ${prettyTool}` : ''}`;
  return (
    <div className={`flex gap-2 ${alignRight ? 'flex-row-reverse' : ''}`}>
      <span
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-semibold text-white mt-0.5"
        style={{ background: s.color }}
        title={s.label}
      >
        {s.avatar}
      </span>
      <div
        className="flex items-center gap-2 rounded-[8px] px-3 py-2 bg-[#222] text-[10px] text-[#aaa]"
        style={{ borderLeft: `2px solid ${s.color}` }}
      >
        <BouncingDots />
        <span>
          <span style={{ color: s.color }} className="font-medium">
            {s.label}
          </span>{' '}
          {statusText}
        </span>
      </div>
    </div>
  );
}

function BouncingDots() {
  return (
    <span className="flex gap-0.5">
      <span
        className="w-1 h-1 rounded-full bg-[#888] animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <span
        className="w-1 h-1 rounded-full bg-[#888] animate-bounce"
        style={{ animationDelay: '120ms' }}
      />
      <span
        className="w-1 h-1 rounded-full bg-[#888] animate-bounce"
        style={{ animationDelay: '240ms' }}
      />
    </span>
  );
}
