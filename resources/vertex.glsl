varying vec2 v_texcoord;
varying vec3 v_worldPos;
varying vec3 v_normal;

void main() {
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    v_texcoord = uv;
    v_worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    v_normal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
}