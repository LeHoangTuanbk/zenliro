import { useAgentStore } from '../store/agent-store';

export function ScanOverlay() {
  const isScanning = useAgentStore((s) => s.isScanning);

  if (!isScanning) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
      <div
        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-br-accent to-transparent opacity-80 animate-scan"
      />
      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          5% { opacity: 0.8; }
          95% { opacity: 0.8; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 1.5s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
}
