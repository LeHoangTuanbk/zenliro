import { useState } from 'react';
import { useExportSettingsStore } from '../model/export-settings-store';

export type ExportFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/tiff';

interface ExportSettings {
  // Export Location
  exportFolder: string;
  putInSubfolder: boolean;
  subfolderName: string;
  // File Naming
  namingTemplate: string;
  customText: string;
  startNumber: number;
  // File Settings
  format: ExportFormat;
  quality: number;
  colorSpace: 'srgb' | 'argb';
  limitFileSize: boolean;
  maxFileSizeKb: number;
  // Image Sizing
  resizeToFit: boolean;
  resizeMode: 'long-edge' | 'short-edge' | 'width' | 'height' | 'megapixels';
  resizeDimension: number;
  resizeUnit: 'px' | 'in' | 'cm';
  resolution: number;
  // Output Sharpening
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
  { value: 'long-edge',   label: 'Long Edge' },
  { value: 'short-edge',  label: 'Short Edge' },
  { value: 'width',       label: 'Width' },
  { value: 'height',      label: 'Height' },
  { value: 'megapixels',  label: 'Megapixels' },
];

function deriveExampleName(template: string, customText: string, startNum: number, fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, '');
  if (template === 'filename') return `${base}.jpg`;
  if (template === 'custom') return `${customText || 'photo'}.jpg`;
  return `${base}_${customText || 'edit'}_${startNum}.jpg`;
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, collapsed, onToggle, hasActive }: {
  label: string; collapsed: boolean; onToggle: () => void; hasActive?: boolean;
}) {
  return (
    <button className="es-section-header" onClick={onToggle}>
      {hasActive && <span className="es-active-dot" />}
      <span className="es-section-arrow">{collapsed ? '▶' : '▼'}</span>
      <span className="es-section-label">{label}</span>
    </button>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="es-field-row">
      <span className="es-field-label">{label}</span>
      <div className="es-field-control">{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ExportDialog({ fileName, originalW, originalH, fileCount = 1, onExport, onClose }: Props) {
  const settings = useExportSettingsStore((s) => s.settings);
  const set      = useExportSettingsStore((s) => s.set);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const toggle = (section: string) =>
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));

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

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const exampleName = deriveExampleName(settings.namingTemplate, settings.customText, settings.startNumber, fileName);

  return (
    <div className="es-backdrop" onClick={handleBackdrop}>
      <div className="es-dialog">

        {/* ── Title bar ─────────────────────────────────── */}
        <div className="es-titlebar">
          <span className="es-title">Export Settings</span>
          <button className="es-titlebar-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Scrollable body ───────────────────────────── */}
        <div className="es-body">

          {/* Export Location */}
          <SectionHeader label="Export Location" collapsed={!!collapsed['loc']} onToggle={() => toggle('loc')} />
          {!collapsed['loc'] && (
            <div className="es-section-body">
              <FieldRow label="Export To:">
                <span className="es-value-text">Specific Folder</span>
              </FieldRow>
              <FieldRow label="Folder:">
                <input
                  className="es-input es-input-grow"
                  value={settings.exportFolder}
                  onChange={(e) => set('exportFolder', e.target.value)}
                  placeholder="~/Pictures"
                />
                <button
                  className="es-btn-sm"
                  onClick={async () => {
                    const folder = await window.electron.selectFolder();
                    if (folder) set('exportFolder', folder);
                  }}
                >Browse</button>
              </FieldRow>
              <FieldRow label="Put in Subfolder:">
                <input
                  type="checkbox"
                  className="es-checkbox"
                  checked={settings.putInSubfolder}
                  onChange={(e) => set('putInSubfolder', e.target.checked)}
                />
                <input
                  className="es-input es-input-grow"
                  disabled={!settings.putInSubfolder}
                  value={settings.subfolderName}
                  onChange={(e) => set('subfolderName', e.target.value)}
                  placeholder="subfolder name"
                />
              </FieldRow>
            </div>
          )}

          <div className="es-divider" />

          {/* File Naming */}
          <SectionHeader label="File Naming" collapsed={!!collapsed['name']} onToggle={() => toggle('name')} />
          {!collapsed['name'] && (
            <div className="es-section-body">
              <FieldRow label="Template:">
                <select
                  className="es-select es-select-grow"
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
                  className="es-input es-input-grow"
                  value={settings.customText}
                  onChange={(e) => set('customText', e.target.value)}
                  placeholder="edit"
                />
              </FieldRow>
              <FieldRow label="Start Number:">
                <input
                  type="number"
                  className="es-input es-input-num"
                  value={settings.startNumber}
                  min={1}
                  onChange={(e) => set('startNumber', Number(e.target.value))}
                />
              </FieldRow>
              <FieldRow label="Example:">
                <span className="es-value-text es-example">{exampleName}</span>
              </FieldRow>
            </div>
          )}

          <div className="es-divider" />

          {/* File Settings */}
          <SectionHeader label="File Settings" collapsed={!!collapsed['file']} onToggle={() => toggle('file')} />
          {!collapsed['file'] && (
            <div className="es-section-body">
              <FieldRow label="Image Format:">
                <select
                  className="es-select es-select-grow"
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
                    className="es-slider"
                  />
                  <span className="es-slider-val">{settings.quality}</span>
                </FieldRow>
              )}
              <FieldRow label="Color Space:">
                <select
                  className="es-select"
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
                  className="es-checkbox"
                  checked={settings.limitFileSize}
                  onChange={(e) => set('limitFileSize', e.target.checked)}
                />
                <input
                  type="number"
                  className="es-input es-input-num"
                  disabled={!settings.limitFileSize}
                  value={settings.maxFileSizeKb}
                  min={50}
                  onChange={(e) => set('maxFileSizeKb', Number(e.target.value))}
                />
                <span className="es-unit-label">K</span>
              </FieldRow>
            </div>
          )}

          <div className="es-divider" />

          {/* Image Sizing */}
          <SectionHeader
            label="Image Sizing"
            collapsed={!!collapsed['size']}
            onToggle={() => toggle('size')}
            hasActive={settings.resizeToFit}
          />
          {!collapsed['size'] && (
            <div className="es-section-body">
              <FieldRow label="Resize to Fit:">
                <input
                  type="checkbox"
                  className="es-checkbox"
                  checked={settings.resizeToFit}
                  onChange={(e) => set('resizeToFit', e.target.checked)}
                />
                <select
                  className="es-select"
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
                      className="es-input es-input-num"
                      value={settings.resizeDimension}
                      min={1}
                      onChange={(e) => set('resizeDimension', Number(e.target.value))}
                    />
                    <select
                      className="es-select"
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
                      className="es-input es-input-num"
                      value={settings.resolution}
                      min={1}
                      onChange={(e) => set('resolution', Number(e.target.value))}
                    />
                    <span className="es-unit-label">PPI</span>
                  </FieldRow>
                </>
              )}
              {!settings.resizeToFit && originalW > 0 && (
                <FieldRow label="">
                  <span className="es-hint">{originalW} × {originalH} px — full resolution</span>
                </FieldRow>
              )}
            </div>
          )}

          <div className="es-divider" />

          {/* Output Sharpening */}
          <SectionHeader
            label="Output Sharpening"
            collapsed={!!collapsed['sharp']}
            onToggle={() => toggle('sharp')}
            hasActive={settings.sharpen}
          />
          {!collapsed['sharp'] && (
            <div className="es-section-body">
              <FieldRow label="Sharpen For:">
                <input
                  type="checkbox"
                  className="es-checkbox"
                  checked={settings.sharpen}
                  onChange={(e) => set('sharpen', e.target.checked)}
                />
                <select
                  className="es-select"
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
                    className="es-select"
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

        </div>{/* end es-body */}

        {/* ── Footer ────────────────────────────────────── */}
        <div className="es-footer">
          <div className="es-footer-left">
            <button className="es-btn-cancel" onClick={onClose} disabled={exporting}>Cancel</button>
            <button className="es-btn-preset" disabled={exporting}>Add to Preset</button>
          </div>
          <div className="es-footer-right">
            <span className="es-file-count">
              {fileCount} {fileCount === 1 ? 'file' : 'files'} will be exported
            </span>
            <button
              className={`es-btn-export ${done ? 'done' : ''}`}
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

export type { ExportSettings };
