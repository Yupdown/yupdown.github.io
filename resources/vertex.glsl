varying vec2 v_texcoord;
varying vec3 v_worldPos;
varying vec3 v_normal;

void main() {
    mat4 m = modelMatrix * instanceMatrix;
    gl_Position = projectionMatrix * viewMatrix * m * vec4(position, 1.0);
    v_texcoord = uv;
    v_worldPos = (m * vec4(position, 1.0)).xyz;
    v_normal = normalize((m * vec4(normal, 0.0)).xyz);
}