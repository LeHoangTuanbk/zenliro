#version 300 es
precision highp float;

#define MAX_SPOTS 32

uniform sampler2D u_image;
uniform int u_spotCount;
uniform float u_hOverW;  // imgH / imgW for aspect-correct circular distance

// Per-spot data (packed as vec4 arrays)
uniform vec4 u_dstSrc[MAX_SPOTS];    // dst.xy, src.xy (normalized 0-1)
uniform vec4 u_params[MAX_SPOTS];    // radius, feather, opacity, mode(0=heal 1=clone 2=fill)
uniform vec4 u_colorData[MAX_SPOTS]; // rgb = fill color or heal color offset (0-1), w unused

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  vec3 color = texture(u_image, v_texCoord).rgb;

  for (int i = 0; i < MAX_SPOTS; i++) {
    if (i >= u_spotCount) break;

    vec2  dst     = u_dstSrc[i].xy;
    vec2  src     = u_dstSrc[i].zw;
    float radius  = u_params[i].x;
    float feather = u_params[i].y;
    float opacity = u_params[i].z;
    int   mode    = int(u_params[i].w + 0.5);

    vec2  d    = v_texCoord - dst;
    float dist = length(vec2(d.x, d.y * u_hOverW));
    if (dist > radius) continue;

    float alpha;
    if (mode == 2) {
      float nd = dist / radius;
      alpha = exp(-3.5 * nd * nd) * opacity;
    } else {
      float hardR = radius * (1.0 - feather);
      float zone  = max(radius - hardR, 0.001);
      float t     = clamp((dist - hardR) / zone, 0.0, 1.0);
      alpha = (1.0 - t * t * (3.0 - 2.0 * t)) * opacity;
    }
    if (alpha <= 0.001) continue;

    vec3 srcColor;
    if (mode == 2) {
      srcColor = u_colorData[i].rgb;
    } else {
      vec2 srcUV = clamp(src + d, vec2(0.0), vec2(1.0));
      srcColor = texture(u_image, srcUV).rgb;
      if (mode == 0) {
        float hw = (1.0 - dist / radius) * 0.6 + 0.4;
        srcColor = clamp(srcColor + u_colorData[i].rgb * hw, 0.0, 1.0);
      }
    }

    color = mix(color, clamp(srcColor, 0.0, 1.0), alpha);
  }

  fragColor = vec4(color, 1.0);
}
