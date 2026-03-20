interface ImportedPhoto {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
  dataUrl: string;
  thumbnailDataUrl: string;
  importedAt: number;
}

interface ExportPhotoRequest {
  base64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  defaultName: string;
  customText?: string;
  namingTemplate?: 'filename' | 'filename-sequence' | 'custom' | 'date';
  startNumber?: number;
  /** If provided, save directly to this folder without showing a save dialog */
  destFolder?: string;
}

interface ExportPhotoResult {
  saved: boolean;
  filePath?: string;
}

interface EventPayloadMapping {
  importPhotos: ImportedPhoto[];
}

type CatalogPhoto = {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
  importedAt: number;
  thumbnailPath: string;
  rating: number;
  tags: string[];
};

type WheelData = { hue: number; sat: number; lum: number };

type PhotoEdits = {
  adjustments: Record<string, number>;
  colorMixer: {
    hue: Record<string, number>;
    saturation: Record<string, number>;
    luminance: Record<string, number>;
  };
  colorGrading: {
    shadows: WheelData;
    midtones: WheelData;
    highlights: WheelData;
    blending: number;
    balance: number;
  };
  effects: Record<string, number>;
  toneCurve: {
    points: Record<string, Array<{ x: number; y: number }>>;
    parametric: Record<string, number>;
  };
  crop?: {
    x: number; y: number; w: number; h: number;
    angle: number; aspectPreset: string; lockAspect: boolean;
  };
  masks?: Array<{
    id: string;
    name: string;
    enabled: boolean;
    mask: unknown;
    adjustments: Record<string, number>;
  }>;
};

type Catalog = {
  version: 1;
  photos: CatalogPhoto[];
  edits: Record<string, PhotoEdits>;
  selectedId: string | null;
  lastOpenedAt: number;
};

interface Window {
  electron: {
    importPhotos: () => Promise<ImportedPhoto[]>;
    exportPhoto: (req: ExportPhotoRequest) => Promise<ExportPhotoResult>;
    selectFolder: () => Promise<string | null>;
    catalog: {
      load: () => Promise<Catalog | null>;
      save: (data: Catalog) => Promise<boolean>;
    };
    photo: {
      loadFromPath: (filePath: string) => Promise<{ dataUrl: string } | null>;
      generateThumbnail: (filePath: string, photoId: string) => Promise<{ thumbnailPath: string; thumbnailDataUrl: string } | null>;
      loadThumbnail: (thumbnailPath: string) => Promise<{ thumbnailDataUrl: string } | null>;
      deleteThumbnail: (thumbnailPath: string) => Promise<boolean>;
      deletePhoto: (photoId: string, thumbnailPath: string) => Promise<boolean>;
    };
    onImportProgress: (cb: (progress: { current: number; total: number } | null) => void) => () => void;
    onRequestSave: (cb: () => void) => void;
    sendSaveDone: () => void;
  };
}
