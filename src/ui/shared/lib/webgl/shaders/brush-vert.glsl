#version 300 es
uniform vec2 u_brCenter;   // UV coords with y=0 at top-of-image
uniform float u_brRadiusPx; // radius in FBO pixels
void main() {
  // FBO y=0 is at bottom, but our coords have y=0 at top -> flip y
  float ndcX = u_brCenter.x * 2.0 - 1.0;
  float ndcY = 1.0 - u_brCenter.y * 2.0;
  gl_Position = vec4(ndcX, ndcY, 0.0, 1.0);
  gl_PointSize = u_brRadiusPx * 2.0;
}
