// ── Samplers ──────────────────────────────────────────────────────────────────
uniform sampler2D u_image;
uniform sampler2D u_smallBlur;
uniform sampler2D u_largeBlur;

// ── Crop & rotate ─────────────────────────────────────────────────────────────
uniform vec2  u_cropOrigin;
uniform vec2  u_cropSize;
uniform float u_rotation;     // fine rotation (straighten) in radians
uniform int   u_rotSteps;     // 90-deg rotation steps (0-3, CW)
uniform float u_flipH;
uniform float u_flipV;
uniform float u_imgAspect;

// ── Basic adjustments ─────────────────────────────────────────────────────────
uniform float u_temp;
uniform float u_tint;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_whites;
uniform float u_blacks;
uniform float u_texture;
uniform float u_clarity;
uniform float u_dehaze;
uniform float u_vibrance;
uniform float u_saturation;

// ── Tone curve LUT (256x1 RGBA: R=r, G=g, B=b) ──────────────────────────────
uniform sampler2D u_toneCurveLUT;

// ── Color mixer (8 hue channels) ─────────────────────────────────────────────
uniform float u_cmHue[8];
uniform float u_cmSat[8];
uniform float u_cmLum[8];

// ── Color grading ────────────────────────────────────────────────────────────
uniform vec3 u_cgShadows;    // hue(0-1), sat(0-1), lum(-1..1)
uniform vec3 u_cgMidtones;
uniform vec3 u_cgHighlights;
uniform float u_cgBlending;  // 0-1
uniform float u_cgBalance;   // -1 to 1

// ── Effects — vignette ───────────────────────────────────────────────────────
uniform float u_vigAmount;     // -1 to 1
uniform float u_vigMidpoint;   // 0 to 1
uniform float u_vigRoundness;  // -1 to 1
uniform float u_vigFeather;    // 0 to 1
uniform float u_vigHighlights; // 0 to 1

// ── Effects — grain ──────────────────────────────────────────────────────────
uniform float u_grainAmount;   // 0 to 1
uniform float u_grainSize;     // 0 to 1
uniform float u_grainRoughness;// 0 to 1

// ── Local adjustments (masks) ────────────────────────────────────────────────
#define MAX_MASKS 4
uniform int u_maskCount;
uniform int u_maskType[MAX_MASKS];        // 0=off 1=brush 2=linear 3=radial
uniform sampler2D u_maskTex0;
uniform sampler2D u_maskTex1;
uniform sampler2D u_maskTex2;
uniform sampler2D u_maskTex3;
uniform sampler2D u_maskEraseTex0;
uniform sampler2D u_maskEraseTex1;
uniform sampler2D u_maskEraseTex2;
uniform sampler2D u_maskEraseTex3;
uniform vec4  u_maskLinear[MAX_MASKS];
uniform float u_maskLinearFeather[MAX_MASKS];
uniform vec4  u_maskRadial[MAX_MASKS];
uniform vec3  u_maskRadialParams[MAX_MASKS];
uniform float u_maskExp[MAX_MASKS];
uniform float u_maskCon[MAX_MASKS];
uniform float u_maskHigh[MAX_MASKS];
uniform float u_maskShad[MAX_MASKS];
uniform float u_maskWhites[MAX_MASKS];
uniform float u_maskBlacks[MAX_MASKS];
uniform float u_maskTemp[MAX_MASKS];
uniform float u_maskTint_[MAX_MASKS];
uniform float u_maskTexVal[MAX_MASKS];
uniform float u_maskClar[MAX_MASKS];
uniform float u_maskDehaze[MAX_MASKS];
uniform float u_maskVib[MAX_MASKS];
uniform float u_maskSat[MAX_MASKS];

// ── Varyings ─────────────────────────────────────────────────────────────────
in vec2 v_texCoord;
out vec4 fragColor;

const float PI = 3.14159265;
