import type { A2AActor } from '../../store/agent-store';
import { ACTOR_STYLE } from './actor-style';

export function AgentDot({ actor }: { actor: A2AActor }) {
  const s = ACTOR_STYLE[actor];
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-semibold text-white"
      style={{ background: s.color }}
      title={s.label}
    >
      {s.avatar}
    </span>
  );
}
