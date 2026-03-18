import { useState } from 'react';
import { useColorMixerStore } from '../store/color-mixer-store';
import type { ColorMode } from '../store/types';
import { MixerSliders } from './mixer-sliders';

type TabId = ColorMode | 'all';

const TABS: { id: TabId; label: string }[] = [
  { id: 'hue', label: 'Hue' },
  { id: 'saturation', label: 'Saturation' },
  { id: 'luminance', label: 'Luminance' },
  { id: 'all', label: 'All' },
];

const COLOR_MODES: ColorMode[] = ['hue', 'saturation', 'luminance'];

export function ColorMixerPanel() {
  const { hue, saturation, luminance, setValue, reset } = useColorMixerStore();
  const [activeTab, setActiveTab] = useState<TabId>('saturation');

  const modeValues: Record<ColorMode, typeof hue> = { hue, saturation, luminance };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] text-br-muted uppercase tracking-[0.6px] font-semibold">
          Color Mixer
        </span>
        <button
          className="border border-br-elevated text-br-muted rounded-[2px] px-2 py-0.5 text-[10px] bg-transparent cursor-pointer hover:text-br-text hover:border-br-mark"
          onClick={reset}
        >
          Reset
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 px-3 pb-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-2 py-0.5 rounded-[2px] text-[10px] font-semibold cursor-pointer border transition-colors ${
              activeTab === tab.id
                ? 'border-br-accent bg-br-elevated text-br-text'
                : 'border-br-elevated bg-transparent text-br-muted hover:text-br-text hover:border-br-mark'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className="flex flex-col pb-2">
        {activeTab === 'all' ? (
          COLOR_MODES.map((m) => (
            <MixerSliders key={m} mode={m} values={modeValues[m]} onValueChange={setValue} />
          ))
        ) : (
          <MixerSliders
            mode={activeTab as ColorMode}
            values={modeValues[activeTab as ColorMode]}
            onValueChange={setValue}
          />
        )}
      </div>
    </div>
  );
}
