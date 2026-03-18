import { useState } from 'react';
import { SectionHeader, FieldRow, inputCls, selectCls } from '../export-primitives';
import type { ExportSettings } from '../../export-dialog-container';

const RESIZE_MODES = [
  { value: 'long-edge', label: 'Long Edge' },
  { value: 'short-edge', label: 'Short Edge' },
  { value: 'width', label: 'Width' },
  { value: 'height', label: 'Height' },
  { value: 'megapixels', label: 'Megapixels' },
];

type Props = {
  settings: ExportSettings;
  originalW: number;
  originalH: number;
  set: <K extends keyof ExportSettings>(key: K, val: ExportSettings[K]) => void;
};

export function SizingSection({ settings, originalW, originalH, set }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      <SectionHeader
        label="Image Sizing"
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        hasActive={settings.resizeToFit}
      />
      {!collapsed && (
        <div className="py-1">
          <FieldRow label="Resize to Fit:">
            <input
              type="checkbox"
              className="w-[13px] h-[13px] cursor-pointer shrink-0"
              style={{ accentColor: 'var(--color-br-accent)' }}
              checked={settings.resizeToFit}
              onChange={(e) => set('resizeToFit', e.target.checked)}
            />
            <select
              className={selectCls}
              disabled={!settings.resizeToFit}
              value={settings.resizeMode}
              onChange={(e) => set('resizeMode', e.target.value as ExportSettings['resizeMode'])}
            >
              {RESIZE_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </FieldRow>
          {settings.resizeToFit && (
            <>
              <FieldRow label="Dimensions:">
                <input
                  type="number"
                  className={`${inputCls} w-[60px] text-right`}
                  value={settings.resizeDimension}
                  min={1}
                  onChange={(e) => set('resizeDimension', Number(e.target.value))}
                />
                <select
                  className={selectCls}
                  value={settings.resizeUnit}
                  onChange={(e) => set('resizeUnit', e.target.value as 'px' | 'in' | 'cm')}
                >
                  <option value="px">px</option>
                  <option value="in">in</option>
                  <option value="cm">cm</option>
                </select>
              </FieldRow>
              <FieldRow label="Resolution:">
                <input
                  type="number"
                  className={`${inputCls} w-[60px] text-right`}
                  value={settings.resolution}
                  min={1}
                  onChange={(e) => set('resolution', Number(e.target.value))}
                />
                <span className="text-br-dim text-[10px]">PPI</span>
              </FieldRow>
            </>
          )}
          {!settings.resizeToFit && originalW > 0 && (
            <FieldRow label="">
              <span className="text-br-dim text-[10px] italic">
                {originalW} × {originalH} px — full resolution
              </span>
            </FieldRow>
          )}
        </div>
      )}
    </>
  );
}
