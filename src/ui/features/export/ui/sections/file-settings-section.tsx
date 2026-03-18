import { useState } from 'react';
import { SectionHeader, FieldRow, inputCls, selectCls } from '../export-primitives';
import type { ExportSettings, ExportFormat } from '../../export-dialog-container';

type Props = {
  settings: ExportSettings;
  set: <K extends keyof ExportSettings>(key: K, val: ExportSettings[K]) => void;
};

export function FileSettingsSection({ settings, set }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const hasQuality = settings.format === 'image/jpeg' || settings.format === 'image/webp';
  return (
    <>
      <SectionHeader
        label="File Settings"
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      {!collapsed && (
        <div className="py-1">
          <FieldRow label="Image Format:">
            <select
              className={`${selectCls} flex-1`}
              value={settings.format}
              onChange={(e) => set('format', e.target.value as ExportFormat)}
            >
              <option value="image/jpeg">JPEG</option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WebP</option>
              <option value="image/tiff">TIFF</option>
            </select>
          </FieldRow>
          {hasQuality && (
            <FieldRow label="Quality:">
              <input
                type="range"
                min={1}
                max={100}
                value={settings.quality}
                onChange={(e) => set('quality', Number(e.target.value))}
                className="flex-1 h-[3px] cursor-pointer"
                style={{ accentColor: 'var(--color-br-accent)' }}
              />
              <span className="w-[26px] text-right text-br-warm tabular-nums text-[10px]">
                {settings.quality}
              </span>
            </FieldRow>
          )}
          <FieldRow label="Color Space:">
            <select
              className={selectCls}
              value={settings.colorSpace}
              onChange={(e) => set('colorSpace', e.target.value as 'srgb' | 'argb')}
            >
              <option value="srgb">sRGB</option>
              <option value="argb">AdobeRGB</option>
            </select>
          </FieldRow>
          <FieldRow label="Limit File Size To:">
            <input
              type="checkbox"
              className="w-[13px] h-[13px] cursor-pointer shrink-0"
              style={{ accentColor: 'var(--color-br-accent)' }}
              checked={settings.limitFileSize}
              onChange={(e) => set('limitFileSize', e.target.checked)}
            />
            <input
              type="number"
              className={`${inputCls} w-[60px] text-right`}
              disabled={!settings.limitFileSize}
              value={settings.maxFileSizeKb}
              min={50}
              onChange={(e) => set('maxFileSizeKb', Number(e.target.value))}
            />
            <span className="text-br-dim text-[10px]">K</span>
          </FieldRow>
        </div>
      )}
    </>
  );
}
