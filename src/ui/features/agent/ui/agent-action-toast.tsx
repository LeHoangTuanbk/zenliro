import { useAgentStore } from '../store/agent-store';

export function AgentActionToast() {
  const actionToast = useAgentStore((s) => s.actionToast);

  if (!actionToast) return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 bg-black/80 border border-br-accent/30 rounded-[3px] text-[10px] text-br-accent shadow-lg pointer-events-none animate-fade-in">
      {actionToast}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -4px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
