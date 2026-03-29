#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_step;
in vec2 v_texCoord;
out vec4 fragColor;

// 13-tap Gaussian kernel (sigma ~ 3)
const float W[7] = float[7](0.00598, 0.060626, 0.241843, 0.383103, 0.241843, 0.060626, 0.00598);

void main() {
  vec3 result = vec3(0.0);
  float total = 0.0;
  for (int i = -3; i <= 3; i++) {
    float w = W[i + 3];
    result += texture(u_src, v_texCoord + float(i) * u_step).rgb * w;
    total += w;
  }
  fragColor = vec4(result / total, 1.0);
}
