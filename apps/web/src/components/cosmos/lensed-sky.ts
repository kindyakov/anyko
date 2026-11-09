const vertexSource = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

// Independent implementation of curved-ray integration. The sky is sampled
// after bending the ray, so lens motion deforms background imagery itself.
const fragmentSource = `
precision highp float;
uniform vec2 resolution;
uniform vec2 center;
uniform float scale;
uniform vec2 drift;
uniform sampler2D sky;
void main() {
  vec2 screen = (gl_FragCoord.xy - center) / scale;
  float influence = 1.0 - smoothstep(0.85, 1.85, length(screen));
  vec2 originalUV = (gl_FragCoord.xy - drift) / resolution;
  if (influence < 0.001) {
    gl_FragColor = texture2D(sky, fract(originalUV));
    return;
  }
  vec3 direction = normalize(vec3(screen * 0.45, -1.0));
  vec3 point = vec3(0.0, 0.0, 8.0);
  vec3 velocity = direction;
  vec3 momentum = cross(point, velocity);
  float angularMomentum = dot(momentum, momentum);
  bool captured = false;
  for (int step = 0; step < 240; step++) {
    float radius = length(point);
    if (radius < 1.0) { captured = true; break; }
    if (radius > 18.0) break;
    float stride = clamp(radius * 0.055, 0.025, 0.45);
    vec3 acceleration = -1.5 * angularMomentum * point / pow(radius, 5.0);
    velocity += acceleration * stride;
    point += velocity * stride;
  }
  vec2 bend = (normalize(velocity).xy - direction.xy) * scale * 2.0;
  vec2 uv = originalUV + bend * influence / resolution;
  vec3 color = texture2D(sky, fract(uv)).rgb;
  gl_FragColor = vec4(captured ? vec3(0.003) : color, 1.0);
}
`;

export function createLensedSky() {
  const surface = document.createElement('canvas');
  const gl = surface.getContext('webgl', {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;
  const shaders: WebGLShader[] = [];
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  function dispose() {
    shaders.forEach((shader) => gl?.deleteShader(shader));
    gl?.deleteProgram(program);
    gl?.deleteBuffer(buffer);
    gl?.deleteTexture(texture);
  }
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertexSource],
    [gl.FRAGMENT_SHADER, fragmentSource],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) {
      dispose();
      return null;
    }
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      dispose();
      return null;
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    dispose();
    return null;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const panorama = document.createElement('canvas');
  const paint = panorama.getContext('2d');
  if (!paint) {
    dispose();
    return null;
  }
  function updateStars(width: number, height: number, ratio: number) {
    if (!paint) return;
    panorama.width = Math.round(width * ratio);
    panorama.height = Math.round(height * ratio);
    paint.setTransform(ratio, 0, 0, ratio, 0, 0);
    paint.fillStyle = '#08080b';
    paint.fillRect(0, 0, width, height);
    // Dense, barely visible field stars make the lens readable: near the
    // shadow they are stretched into arcs as the sky drifts past.
    let seed = 0x6b6f;
    const next = () =>
      (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    paint.shadowBlur = 0;
    for (let i = Math.round((width * height) / 900); i > 0; i--) {
      paint.globalAlpha = 0.2 + next() * 0.3;
      paint.fillStyle =
        next() < 0.3 ? '#c4dcff' : next() < 0.5 ? '#ffe8c2' : '#f4f7ff';
      paint.fillRect(next() * width, next() * height, 1.1, 1.1);
    }
    for (let i = 0; i < 520; i++) {
      const x = (((i * 719 + 137) % 997) / 997) * width;
      const y = (((i * 433 + 311) % 991) / 991) * height;
      const bright = i % 13 === 0;
      const radius = bright ? 1.3 : i % 5 === 0 ? 0.85 : 0.5;
      const color = i % 7 < 2 ? '#a8d4ff' : i % 7 < 4 ? '#ffe3a0' : '#f4f7ff';
      paint.globalAlpha = bright ? 0.85 : 0.42;
      paint.fillStyle = color;
      paint.shadowColor = color;
      paint.shadowBlur = bright ? 4 : 0;
      paint.beginPath();
      paint.arc(x, y, radius, 0, Math.PI * 2);
      paint.fill();
    }
    gl?.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl?.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      panorama,
    );
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const resolution = gl.getUniformLocation(program, 'resolution');
  const center = gl.getUniformLocation(program, 'center');
  const scale = gl.getUniformLocation(program, 'scale');
  const drift = gl.getUniformLocation(program, 'drift');
  let last = '';
  return {
    draw(
      context: CanvasRenderingContext2D,
      width: number,
      height: number,
      x: number,
      y: number,
      radius: number,
      time: number,
    ) {
      if (gl.isContextLost()) return false;
      const ratio = Math.min(window.devicePixelRatio, 1.5);
      const key = [
        width,
        height,
        ratio,
        x.toFixed(2),
        y.toFixed(2),
        radius,
        time.toFixed(1),
      ].join(':');
      if (key !== last) {
        if (
          surface.width !== Math.round(width * ratio) ||
          surface.height !== Math.round(height * ratio)
        ) {
          surface.width = Math.round(width * ratio);
          surface.height = Math.round(height * ratio);
          updateStars(width, height, ratio);
        }
        gl.viewport(0, 0, surface.width, surface.height);
        gl.uniform2f(resolution, surface.width, surface.height);
        gl.uniform2f(center, x * ratio, (height - y) * ratio);
        gl.uniform1f(scale, radius * ratio);
        gl.uniform2f(drift, time * 0.65 * ratio, -time * 0.16 * ratio);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        last = key;
      }
      context.drawImage(surface, 0, 0, width, height);
      return true;
    },
    dispose,
  };
}
