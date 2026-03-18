import { useState } from 'react';
import { useExportSettingsStore } from '../model/export-settings-store';

export type ExportFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/tiff';

export interface ExportSettings {
  exportFolder: string;
  putInSubfolder: boolean;
  subfolderName: string;
  namingTemplate: string;
  customText: string;
  startNumber: number;
  format: ExportFormat;
  quality: number;
  colorSpace: 'srgb' | 'argb';
  limitFileSize: boolean;
  maxFileSizeKb: number;
  resizeToFit: boolean;
  resizeMode: 'long-edge' | 'short-edge' | 'width' | 'height' | 'megapixels';
  resizeDimension: number;
  resizeUnit: 'px' | 'in' | 'cm';
  resolution: number;
  sharpen: boolean;
  sharpenFor: 'screen' | 'matte' | 'glossy';
  sharpenAmount: 'low' | 'standard' | 'high';
}

interface Props {
  fileName: string;
  originalW: number;
  originalH: number;
  fileCount?: number;
  onExport: (settings: ExportSettings) => Promise<void>;
  onClose: () => void;
}

const RESIZE_MODES = [
  { value: 'long-edge',  label: 'Long Edge' },
  { value: 'short-edge', label: 'Short Edge' },
  { value: 'width',      label: 'Width' },
  { value: 'height',     label: 'Height' },
  { value: 'megapixels', label: 'Megapixels' },
];

function deriveExampleName(template: string, customText: string, startNum: number, fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, '');
  if (template === 'filename') return `${base}.jpg`;
  if (template === 'custom')   return `${customText || 'photo'}.jpg`;
  return `${base}_${customText || 'edit'}_${startNum}.jpg`;
}

// ── Shared input/select styles ────────────────────────────────────────────────
const inputCls = 'bg-[#2a2a2a] border border-[#3a3a3a] rounded-[2px] text-[#c8c8c8] text-[11px] font-sans px-1.5 h-[22px] outline-none focus:border-[#4a7fa5] disabled:opacity-40';
const selectCls = `${inputCls} cursor-pointer appearance-auto pr-5 pl-1.5`;

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, collapsed, onToggle, hasActive }: {
  label: string; collapsed: boolean; onToggle: () => void; hasActive?: boolean;
}) {
  return (
    <button
      className="flex items-center gap-1.5 w-full px-3.5 py-1.5 bg-[#252525] border-none border-t border-[#111] cursor-pointer font-sans hover:bg-[#2a2a2a]"
      onClick={onToggle}
    >
      {hasActive && <span className="w-1.5 h-1.5 rounded-full bg-[#4d9fec] flex-shrink-0" />}
      <span className="text-[7px] text-[#555] w-2">{collapsed ? '▶' : '▼'}</span>
      <span className="text-[10px] font-semibold text-[#888] uppercase tracking-[0.7px]">{label}</span>
    </button>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center min-h-[26px] px-3.5 py-0.5 gap-2 hover:bg-[#222]">
      <span className="w-[130px] flex-shrink-0 text-right text-[#767676] text-[11px] whitespace-nowrap">{label}</span>
      <div className="flex-1 flex items-center gap-1.5">{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ExportDialog({ fileName, originalW, originalH, fileCount = 1, onExport, onClose }: Props) {
  const settings = useExportSettingsStore((s) => s.settings);
  const set      = useExportSettingsStore((s) => s.set);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const [done, setDone]           = useState(false);

  const toggle = (s: string) => setCollapsed((p) => ({ ...p, [s]: !p[s] }));

  const hasQuality = settings.format === 'image/jpeg' || settings.format === 'image/webp';

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport(settings);
      setDone(true);
      setTimeout(onClose, 900);
    } finally {
      setExporting(false);
    }
  };

  const exampleName = deriveExampleName(settings.namingTemplate, settings.customText, settings.startNumber, fileName);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-[4px] w-[540px] max-h-[88vh] flex flex-col shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden text-[11px]">

        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#252525] border-b border-[#111] flex-shrink-0">
          <span className="text-[12px] font-semibold text-[#d4d4d4] tracking-[0.2px]">Export Settings</span>
          <button
            className="bg-transparent border-none text-[#555] cursor-pointer text-[11px] px-1.5 py-0.5 rounded-[2px] hover:text-[#999] hover:bg-[#333] leading-none"
            onClick={onClose}
          >✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">

          {/* Export Location */}
          <SectionHeader label="Export Location" collapsed={!!collapsed['loc']} onToggle={() => toggle('loc')} />
          {!collapsed['loc'] && (
            <div className="py-1 bg-[#1e1e1e]">
              <FieldRow label="Export To:">
                <span className="text-[#8a8a8a] text-[11px]">Specific Folder</span>
              </FieldRow>
              <FieldRow label="Folder:">
                <input
                  className={`${inputCls} flex-1 min-w-0`}
                  value={settings.exportFolder}
                  onChange={(e) => set('exportFolder', e.target.value)}
                  placeholder="~/Pictures"
                />
                <button
                  className="bg-transparent border border-[#3a3a3a] rounded-[2px] text-[#888] text-[11px] px-2 h-[22px] cursor-pointer font-sans hover:border-[#555] hover:text-[#bbb]"
                  onClick={async () => {
                    const folder = await window.electron.selectFolder();
                    if (folder) set('exportFolder', folder);
                  }}
                >Browse</button>
              </FieldRow>
              <FieldRow label="Put in Subfolder:">
                <input
                  type="checkbox"
                  className="w-[13px] h-[13px] accent-[#4d9fec] cursor-pointer flex-shrink-0"
                  checked={settings.putInSubfolder}
                  onChange={(e) => set('putInSubfolder', e.target.checked)}
                />
                <input
                  className={`${inputCls} flex-1 min-w-0`}
                  disabled={!settings.putInSubfolder}
                  value={settings.subfolderName}
                  onChange={(e) => set('subfolderName', e.target.value)}
                  placeholder="subfolder name"
                />
              </FieldRow>
            </div>
          )}

          <div className="h-px bg-[#111]" />

          {/* File Naming */}
          <SectionHeader label="File Naming" collapsed={!!collapsed['name']} onToggle={() => toggle('name')} />
          {!collapsed['name'] && (
            <div className="py-1 bg-[#1e1e1e]">
              <FieldRow label="Template:">
                <select
                  className={`${selectCls} flex-1`}
                  value={settings.namingTemplate}
                  onChange={(e) => set('namingTemplate', e.target.value)}
                >
                  <option value="filename">Filename</option>
                  <option value="filename-sequence">Filename - Sequence</option>
                  <option value="custom">Custom Name - Sequence</option>
                  <option value="date">Date - Filename</option>
                </select>
              </FieldRow>
              <FieldRow label="Custom Text:">
                <input
                  className={`${inputCls} flex-1 min-w-0`}
                  value={settings.customText}
                  onChange={(e) => set('customText', e.target.value)}
                  placeholder="edit"
                />
              </FieldRow>
              <FieldRow label="Start Number:">
                <input
                  type="number"
                  className={`${inputCls} w-[60px] text-right`}
                  value={settings.startNumber}
                  min={1}
                  onChange={(e) => set('startNumber', Number(e.target.value))}
                />
              </FieldRow>
              <FieldRow label="Example:">
                <span className="text-[#6a9fcc] text-[10px] italic">{exampleName}</span>
              </FieldRow>
            </div>
          )}

          <div className="h-px bg-[#111]" />

          {/* File Settings */}
          <SectionHeader label="File Settings" collapsed={!!collapsed['file']} onToggle={() => toggle('file')} />
          {!collapsed['file'] && (
            <div className="py-1 bg-[#1e1e1e]">
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
                    min={1} max={100}
                    value={settings.quality}
                    onChange={(e) => set('quality', Number(e.target.value))}
                    className="flex-1 accent-[#4d9fec] h-[3px] cursor-pointer"
                  />
                  <span className="w-[26px] text-right text-[#c8a96e] tabular-nums text-[10px]">{settings.quality}</span>
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
                  className="w-[13px] h-[13px] accent-[#4d9fec] cursor-pointer flex-shrink-0"
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
                <span className="text-[#666] text-[10px]">K</span>
              </FieldRow>
            </div>
          )}

          <div className="h-px bg-[#111]" />

          {/* Image Sizing */}
          <SectionHeader
            label="Image Sizing"
            collapsed={!!collapsed['size']}
            onToggle={() => toggle('size')}
            hasActive={settings.resizeToFit}
          />
          {!collapsed['size'] && (
            <div className="py-1 bg-[#1e1e1e]">
              <FieldRow label="Resize to Fit:">
                <input
                  type="checkbox"
                  className="w-[13px] h-[13px] accent-[#4d9fec] cursor-pointer flex-shrink-0"
                  checked={settings.resizeToFit}
                  onChange={(e) => set('resizeToFit', e.target.checked)}
                />
                <select
                  className={`${selectCls}`}
                  disabled={!settings.resizeToFit}
                  value={settings.resizeMode}
                  onChange={(e) => set('resizeMode', e.target.value as ExportSettings['resizeMode'])}
                >
                  {RESIZE_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
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
                    <span className="text-[#666] text-[10px]">PPI</span>
                  </FieldRow>
                </>
              )}
              {!settings.resizeToFit && originalW > 0 && (
                <FieldRow label="">
                  <span className="text-[#555] text-[10px] italic">{originalW} × {originalH} px — full resolution</span>
                </FieldRow>
              )}
            </div>
          )}

          <div className="h-px bg-[#111]" />

          {/* Output Sharpening */}
          <SectionHeader
            label="Output Sharpening"
            collapsed={!!collapsed['sharp']}
            onToggle={() => toggle('sharp')}
            hasActive={settings.sharpen}
          />
          {!collapsed['sharp'] && (
            <div className="py-1 bg-[#1e1e1e]">
              <FieldRow label="Sharpen For:">
                <input
                  type="checkbox"
                  className="w-[13px] h-[13px] accent-[#4d9fec] cursor-pointer flex-shrink-0"
                  checked={settings.sharpen}
                  onChange={(e) => set('sharpen', e.target.checked)}
                />
                <select
                  className={selectCls}
                  disabled={!settings.sharpen}
                  value={settings.sharpenFor}
                  onChange={(e) => set('sharpenFor', e.target.value as ExportSettings['sharpenFor'])}
                >
                  <option value="screen">Screen</option>
                  <option value="matte">Matte Paper</option>
                  <option value="glossy">Glossy Paper</option>
                </select>
              </FieldRow>
              {settings.sharpen && (
                <FieldRow label="Amount:">
                  <select
                    className={selectCls}
                    value={settings.sharpenAmount}
                    onChange={(e) => set('sharpenAmount', e.target.value as ExportSettings['sharpenAmount'])}
                  >
                    <option value="low">Low</option>
                    <option value="standard">Standard</option>
                    <option value="high">High</option>
                  </select>
                </FieldRow>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-[#252525] border-t border-[#111] flex-shrink-0 gap-2">
          <div className="flex items-center gap-2">
            <button
              className="bg-transparent border border-[#3a3a3a] rounded-[3px] text-[#888] px-3 text-[11px] font-sans cursor-pointer h-6 hover:border-[#555] hover:text-[#bbb] disabled:opacity-40 disabled:cursor-default"
              onClick={onClose}
              disabled={exporting}
            >Cancel</button>
            <button
              className="bg-transparent border border-[#3a3a3a] rounded-[3px] text-[#888] px-3 text-[11px] font-sans cursor-pointer h-6 hover:border-[#555] hover:text-[#bbb] disabled:opacity-40 disabled:cursor-default"
              disabled={exporting}
            >Add to Preset</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#555] whitespace-nowrap">
              {fileCount} {fileCount === 1 ? 'file' : 'files'} will be exported
            </span>
            <button
              className={`border-none rounded-[3px] text-white px-4 text-[11px] font-semibold font-sans cursor-pointer h-6 min-w-[70px] transition-colors disabled:opacity-50 disabled:cursor-default ${
                done
                  ? 'bg-[#2e5533] text-[#7ec88a]'
                  : 'bg-[#2b5fa5] hover:bg-[#3a75c4]'
              }`}
              onClick={handleExport}
              disabled={exporting || done}
            >
              {done ? '✓ Exported' : exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
