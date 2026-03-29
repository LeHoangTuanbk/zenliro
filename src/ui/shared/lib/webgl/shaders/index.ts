// Standalone shaders (each has its own #version / precision)
import VERT_SRC from './vert.glsl?raw';
import BLUR_FRAG_SRC from './blur.frag.glsl?raw';
import HEAL_FRAG_SRC from './heal.frag.glsl?raw';
import BRUSH_VERT_SRC from './brush-vert.glsl?raw';
import BRUSH_FRAG_SRC from './brush-frag.glsl?raw';

// Main fragment shader — assembled from modular .glsl parts
import header from './main/header.glsl?raw';
import utils from './main/utils.glsl?raw';
import whiteBalance from './main/white-balance.glsl?raw';
import tone from './main/tone.glsl?raw';
import contrast from './main/contrast.glsl?raw';
import clarity from './main/clarity.glsl?raw';
import textureDetail from './main/texture-detail.glsl?raw';
import dehaze from './main/dehaze.glsl?raw';
import saturation from './main/saturation.glsl?raw';
import vibrance from './main/vibrance.glsl?raw';
import toneCurve from './main/tone-curve.glsl?raw';
import colorMixer from './main/color-mixer.glsl?raw';
import colorGrading from './main/color-grading.glsl?raw';
import vignette from './main/vignette.glsl?raw';
import grain from './main/grain.glsl?raw';
import masks from './main/masks.glsl?raw';
import entry from './main/entry.glsl?raw';

const MAIN_FRAG_SRC = [
  '#version 300 es',
  'precision highp float;',
  header,
  utils,
  whiteBalance,
  tone,
  contrast,
  clarity,
  textureDetail,
  dehaze,
  saturation,
  vibrance,
  toneCurve,
  colorMixer,
  colorGrading,
  vignette,
  grain,
  masks,
  entry,
].join('\n');

export { VERT_SRC, BLUR_FRAG_SRC, HEAL_FRAG_SRC, BRUSH_VERT_SRC, BRUSH_FRAG_SRC, MAIN_FRAG_SRC };
