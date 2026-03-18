export const inputCls =
  'bg-br-input border border-br-elevated rounded-[2px] text-[#c8c8c8] text-[11px] font-sans px-1.5 h-[22px] outline-none focus:border-br-accent disabled:opacity-40';

export const selectCls = `${inputCls} cursor-pointer appearance-auto pr-5 pl-1.5`;

export function SectionHeader({
  label,
  collapsed,
  onToggle,
  hasActive,
}: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  hasActive?: boolean;
}) {
  return (
    <button
      className="flex items-center gap-1.5 w-full px-3.5 py-1.5 bg-br-section border-none cursor-pointer font-sans hover:bg-br-section-hover"
      onClick={onToggle}
    >
      {hasActive && <span className="w-1.5 h-1.5 rounded-full bg-br-accent shrink-0" />}
      <span className="text-[7px] text-br-dim w-2">{collapsed ? '▶' : '▼'}</span>
      <span className="text-[10px] font-semibold text-br-muted uppercase tracking-[0.7px]">
        {label}
      </span>
    </button>
  );
}

export function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center min-h-[26px] px-3.5 py-0.5 gap-2 hover:bg-br-hover">
      <span className="w-[130px] shrink-0 text-right text-br-dim text-[11px] whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 flex items-center gap-1.5">{children}</div>
    </div>
  );
}
