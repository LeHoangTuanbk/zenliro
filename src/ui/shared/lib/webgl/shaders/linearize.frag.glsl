#version 300 es
precision highp float;
uniform sampler2D u_src;
in vec2 v_texCoord;
out vec4 fragColor;

// Accurate sRGB → linear conversion (IEC 61966-2-1 piecewise transfer)
vec3 srgbToLinear(vec3 c) {
  return mix(
    c / 12.92,
    pow((c + 0.055) / 1.055, vec3(2.4)),
    step(0.04045, c)
  );
}

void main() {
  vec3 srgb = texture(u_src, v_texCoord).rgb;
  fragColor = vec4(srgbToLinear(srgb), 1.0);
}
