#version 300 es
precision mediump float;
uniform float u_brFeather;
uniform float u_brOpacity;
out vec4 fragColor;
void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord); // 0 at center, 0.5 at edge
  float hard = 0.5 * (1.0 - u_brFeather);
  float alpha = (1.0 - smoothstep(hard, max(0.5, hard + 0.001), dist)) * u_brOpacity;
  if (dist > 0.5) discard;
  fragColor = vec4(alpha, 0.0, 0.0, 1.0);
}
