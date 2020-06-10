precision highp int;
precision highp float;
uniform mat4 u_projectionMatrix;
uniform mat4 u_offsetScaleMatrix;
uniform mat4 u_offsetRotateMatrix;

uniform mat4 u_projTransform;
uniform vec2 u_eyepos;
uniform vec2 u_eyeposlow;

attribute vec2 a_position;
attribute float a_index;
attribute float a_size;
attribute float a_iscircle;
attribute float a_cosangle;
attribute float a_sinangle;

varying vec2 v_texCoord;
varying float v_size;
varying float v_iscircle;

void main(void) {
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

  vec2 p = a_position - u_eyepos;
  p -= u_eyeposlow;
  vec4 outPosition = u_projTransform * vec4(p, 0., 1.);
  gl_Position = outPosition + offsets;

  float u = a_index == 0.0 || a_index == 3.0 ? 0.0 : 1.0;
  float v = a_index == 0.0 || a_index == 1.0 ? 0.0 : 1.0;
  v_texCoord = vec2(u, v);

  v_size = size;
  v_iscircle = a_iscircle;
}
