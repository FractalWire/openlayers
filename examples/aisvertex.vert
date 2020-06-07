precision highp int;
precision highp float;
uniform mat4 u_projectionMatrix;
uniform mat4 u_offsetScaleMatrix;
uniform mat4 u_offsetRotateMatrix;
attribute vec2 a_position;
attribute float a_index;
attribute float a_size;
{{init}}
varying vec2 v_texCoord;
varying float v_size;

void main(void) {
  {{main}}

  mat4 offsetMatrix = u_offsetScaleMatrix;
  float size = a_size;
  if (a_iscircle == 0.){
      mat4 rotateMatrix = mat4(
              vec4(a_cosangle, -a_sinangle, 0., 0.),
              vec4(a_sinangle, a_cosangle, 0., 0.),
              vec4(0.),
              vec4(0.)
              );
      offsetMatrix *= rotateMatrix*u_offsetRotateMatrix;
  } else {
      size /= 3.;
  }

  float offsetX = a_index == 0.0 || a_index == 3.0 ? -size / 2.0 : size / 2.0;
  float offsetY = a_index == 0.0 || a_index == 1.0 ? -size / 2.0 : size / 2.0;
  vec4 offsets = offsetMatrix * vec4(offsetX, offsetY, 0.0, 0.0);
  gl_Position = u_projectionMatrix * vec4(a_position, 0.0, 1.0) + offsets;
  float u = a_index == 0.0 || a_index == 3.0 ? 0.0 : 1.0;
  float v = a_index == 0.0 || a_index == 1.0 ? 0.0 : 1.0;
  v_texCoord = vec2(u, v);
  v_size = size;
}
