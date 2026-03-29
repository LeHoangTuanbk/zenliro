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
  orientation: number;
  importedAt: number;
}

type LoadedPhotoBinary = {
  mimeType: string;
  bytes: Uint8Array;
};

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
  orientation: number;
  rating: number;
  tags: string[];
};

type Collection = {
  id: string;
  name: string;
  parentId: string | null;
  photoIds: string[];
  createdAt: number;
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
    parametric: Record<string, Record<string, number>>;
  };
  crop?: {
    x: number;
    y: number;
    w: number;
    h: number;
    angle: number;
    aspectPreset: string;
    lockAspect: boolean;
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
  collections: Collection[];
  /** Unified order of items in library grid. Photo IDs or "collection:{id}" */
  libraryOrder: string[];
  selectedId: string | null;
  activeCollectionId: string | null;
  lastOpenedAt: number;
};

interface Window {
  electron: {
    getPathForFile: (file: File) => string;
    importPhotos: () => Promise<ImportedPhoto[]>;
    importPhotosFromPaths: (paths: string[]) => Promise<ImportedPhoto[]>;
    exportPhoto: (req: ExportPhotoRequest) => Promise<ExportPhotoResult>;
    selectFolder: () => Promise<string | null>;
    catalog: {
      load: () => Promise<Catalog | null>;
      save: (data: Catalog) => Promise<boolean>;
    };
    photo: {
      loadFromPath: (filePath: string) => Promise<LoadedPhotoBinary | null>;
      saveThumbnail: (
        photoId: string,
        thumbnailDataUrl: string,
      ) => Promise<{ thumbnailPath: string; thumbnailDataUrl: string } | null>;
      generateThumbnail: (
        photoId: string,
        thumbnailDataUrl: string,
      ) => Promise<{ thumbnailPath: string; thumbnailDataUrl: string } | null>;
      loadThumbnail: (thumbnailPath: string) => Promise<{ thumbnailDataUrl: string } | null>;
      deleteThumbnail: (thumbnailPath: string) => Promise<boolean>;
      deletePhoto: (photoId: string, thumbnailPath: string) => Promise<boolean>;
    };
    onImportProgress: (
      cb: (progress: { current: number; total: number } | null) => void,
    ) => () => void;
    onRequestSave: (cb: () => void) => void;
    sendSaveDone: () => void;

    onMenuImport: (cb: () => void) => () => void;
    onMenuExport: (cb: () => void) => () => void;
    onMenuAction: (cb: (action: string) => void) => () => void;

    logger: {
      error: (scope: string, message: string, meta?: unknown) => Promise<void>;
      warn: (scope: string, message: string, meta?: unknown) => Promise<void>;
      info: (scope: string, message: string, meta?: unknown) => Promise<void>;
      debug: (scope: string, message: string, meta?: unknown) => Promise<void>;
    };
    exportLogs: () => Promise<{ saved: boolean; filePath?: string }>;

    agent: {
      startSession: () => Promise<void>;
      sendMessage: (text: string, options?: { model?: string; provider?: string }) => Promise<void>;
      stopSession: () => Promise<void>;
      getStatus: () => Promise<{ running: boolean }>;
      saveReferenceImage: (dataUrl: string) => Promise<string | null>;
      loadModels: () => Promise<
        Array<{ id: string; label: string; description: string; provider: string }>
      >;

      onToolRequest: (
        channel: string,
        cb: (req: { requestId: string; payload?: unknown }) => void,
      ) => () => void;
      sendToolResult: (channel: string, data: unknown) => void;

      onStreamText: (cb: (chunk: string) => void) => () => void;
      onStreamToolUse: (
        cb: (data: { id: string; name: string; params: unknown }) => void,
      ) => () => void;
      onStreamThinking: (cb: (text: string) => void) => () => void;
      onStreamDone: (cb: () => void) => () => void;
      onStreamError: (cb: (error: string) => void) => () => void;
    };
  };
}
