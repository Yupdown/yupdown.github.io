precision mediump float;

varying vec2 v_texcoord;
varying vec3 v_worldPos;
varying vec3 v_normal;

uniform sampler2D u_texture;

void main() {
    vec2 uv = vec2(v_texcoord.x, v_texcoord.y);
    vec4 col = texture2D(u_texture, uv);
    col.rgb = min(mix(vec3(0.1215, 0.4823, 0.5607), col.rgb, pow(clamp(v_worldPos.z * 2.0 + 0.5, 0.0, 1.0), 0.5) * normalize(v_normal).z), col.rgb);
    gl_FragColor = col;
}