declare module 'libraw-wasm' {
  type LibRawOptions = {
    bright?: number;
    expShift?: number;
    expPreser?: number;
    expCorrec?: boolean;
    noAutoBright?: boolean;
    autoBrightThr?: number;
    threshold?: number;
    fbddNoiserd?: number;
    userQual?: number;
    halfSize?: boolean;
    fourColorRgb?: boolean;
    medPasses?: number;
    useAutoWb?: boolean;
    useCameraWb?: boolean;
    userMul?: [number, number, number, number] | null;
    outputColor?: number;
    outputBps?: number;
    useCameraMatrix?: number;
    highlight?: number;
    gamm?: [number, number] | null;
    userFlip?: number;
    noAutoScale?: boolean;
    greybox?: [number, number, number, number] | null;
    cropbox?: [number, number, number, number] | null;
    aber?: [number, number, number] | null;
    userBlack?: number;
    userSat?: number;
  };

  type RawImageData = {
    width: number;
    height: number;
    colors: number;
    bits: number;
    dataSize: number;
    data: Uint8Array;
  };

  type RawMetadata = {
    width: number;
    height: number;
    raw_width: number;
    raw_height: number;
    camera_make: string;
    camera_model: string;
    aperture: number;
    shutter: number;
    focal_len: number;
    iso_speed: number;
    timestamp: Date;
    artist: string;
    desc: string;
    thumb_format: string;
    thumb_width: number;
    thumb_height: number;
  };

  class LibRaw {
    constructor();
    open(data: Uint8Array, options?: LibRawOptions): Promise<void>;
    metadata(fullOutput?: boolean): Promise<RawMetadata>;
    imageData(): Promise<RawImageData>;
  }

  export default LibRaw;
}
