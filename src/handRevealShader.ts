export const handVertexShader = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = vec2((a_position.x + 1.0) * 0.5, (1.0 - a_position.y) * 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

export const handFragmentShader = `
precision highp float;

uniform sampler2D u_chrome;
uniform sampler2D u_skin;
uniform vec2 u_size;
uniform vec2 u_pointer;
uniform vec2 u_velocity;
uniform float u_radius;
uniform float u_time;

varying vec2 v_uv;

void main() {
  vec2 fromPointer = (v_uv - u_pointer) * u_size;
  vec2 pulled = fromPointer - u_velocity * 16.0 * exp(-length(fromPointer) / 110.0);
  float distanceToPointer = length(pulled);
  float angle = atan(pulled.y, pulled.x);

  // Only the material boundary moves. The hand itself never changes size.
  float liquidEdge =
    sin(angle * 7.0 + u_time * 0.8) * 3.2 +
    sin(angle * 13.0 - u_time * 1.1) * 1.4;
  float field = distanceToPointer + liquidEdge;
  float open = (1.0 - smoothstep(u_radius - 11.0, u_radius + 8.0, field))
    * smoothstep(0.0, 4.0, u_radius);
  float seam = exp(-pow((field - u_radius) / 10.0, 2.0))
    * smoothstep(3.0, 12.0, u_radius);

  vec2 direction = normalize(pulled + vec2(0.001));
  vec2 offset = (direction * 3.5 + u_velocity * 1.5) * seam / u_size;
  vec4 chrome = texture2D(u_chrome, clamp(v_uv + offset, vec2(0.0), vec2(1.0)));
  vec4 skin = texture2D(u_skin, clamp(v_uv - offset * 0.45, vec2(0.0), vec2(1.0)));

  vec3 color = mix(chrome.rgb, skin.rgb, open);
  float reflection = pow(max(dot(direction, normalize(vec2(-0.7, -0.7))), 0.0), 1.8);
  color += vec3(0.16, 0.18, 0.19) * seam * reflection;
  color *= 1.0 - seam * (1.0 - reflection) * 0.055;

  gl_FragColor = vec4(color, max(chrome.a, skin.a));
}
`
