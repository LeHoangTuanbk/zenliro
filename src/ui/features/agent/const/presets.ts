export type PresetCategory = 'all' | 'portrait' | 'landscape' | 'street' | 'film';

export type StylePreset = {
  id: string;
  label: string;
  description: string;
  category: PresetCategory;
  prompt: string;
  thumbnail: string; // unsplash URL
};

export const PRESET_CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'landscape', label: 'Landscape' },
  { id: 'street', label: 'Street' },
  { id: 'film', label: 'Film' },
];

export const STYLE_PRESETS: StylePreset[] = [
  // Row 1
  {
    id: 'cinematic-teal',
    label: 'Cinematic Teal & Orange',
    description: 'Warm highlights with cool shadows for a cinematic look',
    category: 'film',
    prompt: 'Apply cinematic teal & orange color grade — warm orange highlights, teal/cyan shadows, moderate contrast, slight desaturation in midtones, subtle vignette',
    thumbnail: 'https://images.unsplash.com/photo-1615868175326-cd888cf737f0?w=400&h=300&fit=crop',
  },
  {
    id: 'film-noir-bw',
    label: 'Film Noir B&W',
    description: 'High contrast black and white with deep blacks',
    category: 'film',
    prompt: 'Convert to high contrast black and white — full desaturation, crush blacks, boost whites, strong contrast, add subtle film grain, slight vignette for drama',
    thumbnail: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&h=300&fit=crop',
  },
  {
    id: 'golden-hour',
    label: 'Golden Hour Warm',
    description: 'Warm golden tones mimicking sunset lighting',
    category: 'landscape',
    prompt: 'Apply golden hour warmth — boost temperature +25, add warm orange to highlights, lift shadows slightly, increase vibrance, soft warm glow feel',
    thumbnail: 'https://images.unsplash.com/photo-1623237353316-417116e040a5?w=400&h=300&fit=crop',
  },
  {
    id: 'moody-desat',
    label: 'Moody Desaturated',
    description: 'Muted tones with lifted shadows for a moody feel',
    category: 'street',
    prompt: 'Create moody desaturated look — reduce saturation -30, lift shadows, slight fade to blacks, cool tones in shadows, muted midtones, subtle green tint',
    thumbnail: 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=400&h=300&fit=crop',
  },
  {
    id: 'vibrant-pop',
    label: 'Vibrant Pop',
    description: 'Boosted saturation and vivid colors for impact',
    category: 'landscape',
    prompt: 'Make colors pop — boost vibrance +40, saturation +15, increase clarity +25, moderate contrast boost, make blues deeper and greens richer',
    thumbnail: 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=400&h=300&fit=crop',
  },
  // Row 2
  {
    id: 'faded-vintage',
    label: 'Faded Vintage',
    description: 'Soft faded tones reminiscent of old film photos',
    category: 'film',
    prompt: 'Apply vintage fade — lift blacks with tone curve, reduce contrast, warm color cast, slight yellow in highlights, desaturate -20, add subtle grain',
    thumbnail: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=400&h=300&fit=crop',
  },
  {
    id: 'clean-portrait',
    label: 'Clean Portrait',
    description: 'Natural skin tones with soft light for portraits',
    category: 'portrait',
    prompt: 'Optimize for portrait — warm skin tones slightly, reduce orange saturation, soft contrast, slight exposure lift, gentle clarity, smooth highlight rolloff',
    thumbnail: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=300&fit=crop',
  },
  {
    id: 'night-neon',
    label: 'Night City Neon',
    description: 'Vibrant neon glow for urban night photography',
    category: 'street',
    prompt: 'Apply neon night look — boost blues and purples in HSL, increase vibrance, cool shadows, magenta tint in highlights, strong contrast, slight dehaze',
    thumbnail: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=400&h=300&fit=crop',
  },
  {
    id: 'earthy-tones',
    label: 'Earthy Tones',
    description: 'Warm earthy palette with natural brown tones',
    category: 'landscape',
    prompt: 'Create earthy tones — warm temperature, shift greens towards yellow in HSL, orange warmth, reduce blue saturation, gentle contrast, natural warm palette',
    thumbnail: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=400&h=300&fit=crop',
  },
  {
    id: 'high-contrast-drama',
    label: 'High Contrast Drama',
    description: 'Bold contrast with dramatic light and shadow',
    category: 'street',
    prompt: 'Apply dramatic high contrast — boost contrast +40, clarity +30, deep blacks, bright whites, strong tonal separation, slight vignette, dehaze +15',
    thumbnail: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=300&fit=crop',
  },
  // Row 3
  {
    id: 'trong-treo',
    label: 'Trong Trẻo',
    description: 'Clear, airy, bright tones with lifted shadows and soft highlights',
    category: 'portrait',
    prompt: 'Create trong trẻo look — lift shadows +40, reduce highlights -20, soft contrast, slightly cool temperature, boost clarity gently, pastel-like lifted blacks, airy bright feel',
    thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop',
  },
  {
    id: 'korean-soft',
    label: 'Korean Soft Tone',
    description: 'Soft pastel colors, slightly cool, desaturated with creamy skin tones',
    category: 'portrait',
    prompt: 'Apply Korean soft tone — desaturate -15, cool temperature slightly, lift shadows, reduce contrast, soft pink tint in highlights, creamy smooth skin tones, pastel feel',
    thumbnail: 'https://images.unsplash.com/photo-1542596768-5d1d21f1cf98?w=400&h=300&fit=crop',
  },
  {
    id: 'japanese-film',
    label: 'Japanese Film',
    description: 'Warm nostalgic Fuji film look with subtle grain and muted greens',
    category: 'film',
    prompt: 'Create Fuji film look — warm temperature, mute greens in HSL, slight magenta tint, lift blacks, add grain amount 15, reduce blue luminance, nostalgic warm feeling',
    thumbnail: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=400&h=300&fit=crop',
  },
  {
    id: 'cafe-saigon',
    label: 'Café Sài Gòn',
    description: 'Warm brown tones, cozy vintage feel, golden light',
    category: 'street',
    prompt: 'Apply Café Sài Gòn look — warm temperature +20, brown/amber color grading in shadows, golden highlights, slight fade, reduce blue saturation, cozy vintage warmth',
    thumbnail: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=300&fit=crop',
  },
  {
    id: 'sunset-beach',
    label: 'Sunset Beach',
    description: 'Golden hour warm glow, rich oranges and purples at dusk',
    category: 'landscape',
    prompt: 'Apply sunset beach look — strong warm temperature, boost orange and yellow saturation, purple tint in shadows, golden highlights, vibrance +25, soft contrast',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop',
  },
  // Row 4
  {
    id: 'pastel-dream',
    label: 'Pastel Dream',
    description: 'Soft pastel colors, low contrast, dreamy and ethereal feel',
    category: 'portrait',
    prompt: 'Create pastel dream — lift shadows +30, reduce contrast -20, desaturate -10, soft pink in highlights, light blue in shadows, dreamy low-contrast ethereal mood',
    thumbnail: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=400&h=300&fit=crop',
  },
  {
    id: 'analog-kodak',
    label: 'Analog Kodak',
    description: 'Classic Kodak Portra film emulation with warm skin tones and subtle grain',
    category: 'film',
    prompt: 'Emulate Kodak Portra — warm skin tones, slight orange shift, soft contrast, lift shadows gently, add grain amount 12, natural warm palette, subtle fade in blacks',
    thumbnail: 'https://images.unsplash.com/photo-1495745966610-2a67f2297e5e?w=400&h=300&fit=crop',
  },
  {
    id: 'blue-hour',
    label: 'Blue Hour City',
    description: 'Cool blue twilight tones for urban night photography',
    category: 'street',
    prompt: 'Apply blue hour look — cool temperature -15, boost blue saturation, teal shadows, slight purple in midtones, moderate contrast, slight clarity boost, city twilight feel',
    thumbnail: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&h=300&fit=crop',
  },
  {
    id: 'autumn-warmth',
    label: 'Autumn Warmth',
    description: 'Rich amber and orange tones evoking fall foliage',
    category: 'landscape',
    prompt: 'Create autumn warmth — warm temperature +15, boost orange and red saturation, shift greens toward yellow, amber highlights, rich warm tones, gentle contrast',
    thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&h=300&fit=crop',
  },
  {
    id: 'tropical-vibrant',
    label: 'Tropical Vibrant',
    description: 'Saturated greens and ocean blues, vibrant tropical feel',
    category: 'landscape',
    prompt: 'Apply tropical vibrant — boost green and aqua saturation, increase vibrance +30, clarity +15, warm highlights, vivid blues, lush greens, bright tropical palette',
    thumbnail: 'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=400&h=300&fit=crop',
  },
  // Row 5
  {
    id: 'portrait-glow',
    label: 'Portrait Glow',
    description: 'Soft skin smoothing light with warm backlight glow and creamy bokeh',
    category: 'portrait',
    prompt: 'Apply portrait glow — lift shadows, warm highlights, reduce clarity slightly for soft skin, gentle vignette, warm backlight feel, creamy tones, subtle exposure lift',
    thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=300&fit=crop',
  },
  {
    id: 'street-bw-grit',
    label: 'Street BW Grit',
    description: 'High contrast black and white with deep shadows and gritty urban texture',
    category: 'street',
    prompt: 'Apply gritty street B&W — full desaturation, high contrast +50, deep blacks, boost clarity +35, add grain amount 20, strong shadows, urban documentary feel',
    thumbnail: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=300&fit=crop',
  },
  {
    id: 'dreamy-haze',
    label: 'Dreamy Haze',
    description: 'Ethereal soft glow with lifted blacks, pastel tints and gentle bloom',
    category: 'portrait',
    prompt: 'Create dreamy haze — reduce clarity -15, lift blacks with curve, slight dehaze negative, pastel pink highlights, soft low contrast, ethereal light bloom feel',
    thumbnail: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=400&h=300&fit=crop',
  },
  {
    id: 'dark-moody',
    label: 'Dark & Moody',
    description: 'Low-key dramatic, low lighting with crushed blacks and rich shadows',
    category: 'street',
    prompt: 'Apply dark moody — reduce exposure -0.5, crush blacks, boost contrast +30, cool shadows, desaturate -15, strong vignette, low-key dramatic lighting feel',
    thumbnail: 'https://images.unsplash.com/photo-1493397212122-2b85dda8106b?w=400&h=300&fit=crop',
  },
  {
    id: 'vintage-polaroid',
    label: 'Vintage Polaroid',
    description: 'Faded retro Polaroid look with warm cast, soft vignette and light leak',
    category: 'film',
    prompt: 'Create Polaroid look — warm color cast, fade blacks with curve, reduce contrast, yellow tint in highlights, slight vignette, add grain amount 10, retro warm feel',
    thumbnail: 'https://images.unsplash.com/photo-1501004318855-b174af8812de?w=400&h=300&fit=crop',
  },
];
