import { useState } from 'react';
import { useMaskStore } from '../store/mask-store';
import type { MaskAdjustments } from '../store/types';
import type { Adjustments } from '@/features/develop/edit/store/adjustments-store';
import { AdjustmentSlider } from '@/features/develop/edit/ui/adjustment-slider';
import { BrButton } from '@/shared/ui/base';
import { SECTIONS } from '../const/sections';

type Props = { photoId: string; maskId: string };

export function MaskAdjPanel({ photoId, maskId }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const mask = useMaskStore((s) => (s.masksByPhoto[photoId] ?? []).find((m) => m.id === maskId));
  const setMaskAdjustment = useMaskStore((s) => s.setMaskAdjustment);
  const resetMaskAdjustments = useMaskStore((s) => s.resetMaskAdjustments);

  if (!mask) return null;
  const adj = mask.adjustments;

  const toggle = (title: string) => setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));

  // AdjustmentSlider is typed to Adjustments; mask adj keys are a subset, so cast is safe
  const handleChange = (key: keyof Adjustments, value: number) =>
    setMaskAdjustment(photoId, maskId, key as keyof MaskAdjustments, value);

  const handleReset = (key: keyof Adjustments) =>
    setMaskAdjustment(photoId, maskId, key as keyof MaskAdjustments, 0);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-br-elevated">
        <span className="text-[11px] font-semibold text-br-text uppercase tracking-[0.8px]">
          {mask.name}
        </span>
        <BrButton onClick={() => resetMaskAdjustments(photoId, maskId)} title="Reset">
          Reset
        </BrButton>
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
              {section.sliders.map(({ key, label, min, max, step }) => (
                <AdjustmentSlider
                  key={key}
                  label={label}
                  name={key as keyof Adjustments}
                  value={adj[key]}
                  min={min}
                  max={max}
                  step={step}
                  onChange={handleChange}
                  onReset={handleReset}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
