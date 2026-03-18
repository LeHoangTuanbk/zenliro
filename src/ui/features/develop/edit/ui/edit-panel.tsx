import { useState } from 'react';
import { useAdjustmentsStore } from '../store/adjustments-store';
import { AdjustmentSlider } from './adjustment-slider';
import { SECTIONS } from '../const/section';

export function EditPanel() {
  const { adjustments, setAdjustment, resetAdjustment, resetAll } = useAdjustmentsStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (title: string) => setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));

  return (
    <div className="flex flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-br-elevated">
        <span className="text-[11px] font-semibold text-br-text uppercase tracking-[0.8px]">
          Basic
        </span>
        <button
          className="border border-br-elevated text-br-muted rounded-[2px] px-2 py-0.5 text-[10px] bg-transparent cursor-pointer hover:text-br-text hover:border-br-mark"
          onClick={resetAll}
          title="Reset all"
        >
          Reset
        </button>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="border-b border-br-elevated">
          <button
            className="flex items-center gap-1.5 w-full px-3 py-[7px] bg-br-section border-none cursor-pointer hover:bg-br-section-hover font-sans"
            onClick={() => toggle(section.title)}
          >
            <span className="text-[8px] text-br-dim w-2.5">
              {collapsed[section.title] ? '▶' : '▼'}
            </span>
            <span className="text-[11px] font-semibold text-br-muted uppercase tracking-[0.6px]">
              {section.title}
            </span>
          </button>

          {!collapsed[section.title] && (
            <div className="px-3 py-2 flex flex-col gap-0.5">
              {section.sliders.map((s) => (
                <AdjustmentSlider
                  key={s.name}
                  label={s.label}
                  name={s.name}
                  value={adjustments[s.name]}
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  onChange={setAdjustment}
                  onReset={resetAdjustment}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
