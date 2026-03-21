export const STYLE_PRESETS = [
  { id: 'cinematic', label: 'Cinematic', prompt: 'Apply a cinematic color grade — warm highlights, teal shadows, slight contrast boost, subtle vignette' },
  { id: 'film', label: 'Film Analog', prompt: 'Create an analog film look — faded blacks, slight grain, warm tones, reduced clarity' },
  { id: 'moody', label: 'Moody Dark', prompt: 'Apply a moody dark look — crush the blacks slightly, desaturate, cool shadows, low-key feel' },
  { id: 'vibrant', label: 'Vibrant Pop', prompt: 'Make colors pop — boost vibrance and saturation, increase clarity, strong contrast' },
  { id: 'pastel', label: 'Soft Pastel', prompt: 'Create a soft pastel look — lift shadows, reduce contrast, desaturate slightly, warm tones' },
  { id: 'bw-classic', label: 'B&W Classic', prompt: 'Convert to classic black & white — full desaturation, boost contrast, slight grain, deep blacks' },
  { id: 'golden', label: 'Golden Hour', prompt: 'Apply a golden hour warmth — warm temperature, orange highlights, soft shadows, subtle glow' },
  { id: 'portrait', label: 'Portrait Pro', prompt: 'Optimize for portrait — smooth skin tones, warm highlights, slight vignette, gentle contrast' },
  { id: 'landscape', label: 'Landscape HDR', prompt: 'Enhance landscape — boost shadows and highlights recovery, clarity, vibrance, deep sky blues' },
  { id: 'vintage', label: 'Vintage Fade', prompt: 'Apply vintage fade — warm color cast, faded look, low saturation, slight yellow tint in highlights' },
] as const;
