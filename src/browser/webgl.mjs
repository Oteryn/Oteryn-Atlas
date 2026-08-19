export class WebGLRendererError extends Error {}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'shader compile failed';
    gl.deleteShader(shader);
    throw new WebGLRendererError(message);
  }
  return shader;
}

function createProgram(gl) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, `#version 300 es
    in vec2 a_position;
    in vec2 a_uv;
    out vec2 v_uv;
    void main() { v_uv = a_uv; gl_Position = vec4(a_position, 0.0, 1.0); }
  `);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `#version 300 es
    precision mediump float;
    uniform sampler2D u_texture;
    in vec2 v_uv;
    out vec4 out_color;
    void main() { out_color = texture(u_texture, v_uv); }
  `);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'program link failed';
    gl.deleteProgram(program);
    throw new WebGLRendererError(message);
  }
  return program;
}

function nextPowerOfTwo(value) {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

function makeTextureLayout(blobs, width = 2048) {
  const sorted = [...blobs.values()].sort((a, b) =>
    b.height - a.height || b.width - a.width || a.contentId.localeCompare(b.contentId));
  const placements = new Map();
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  for (const blob of sorted) {
    if (blob.width > width) throw new WebGLRendererError('pixel blob exceeds texture width');
    if (x + blob.width > width) {
      y += rowHeight;
      x = 0;
      rowHeight = 0;
    }
    placements.set(blob.contentId, { x, y, width: blob.width, height: blob.height });
    x += blob.width;
    rowHeight = Math.max(rowHeight, blob.height);
  }
  return { placements, width, height: nextPowerOfTwo(y + rowHeight) };
}

function createTexture(gl, pixelStore) {
  const started = performance.now();
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const width = maxTextureSize >= 2048 ? 2048 : maxTextureSize;
  const layout = makeTextureLayout(pixelStore.blobs, width);
  if (layout.height > maxTextureSize) throw new WebGLRendererError('verified pixel set does not fit GPU texture limit');

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, layout.width, layout.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  for (const blob of pixelStore.blobs.values()) {
    const placement = layout.placements.get(blob.contentId);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      placement.x,
      placement.y,
      blob.width,
      blob.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      blob.bytes,
    );
  }

  return {
    texture,
    placements: layout.placements,
    width: layout.width,
    height: layout.height,
    textureBytes: layout.width * layout.height * 4,
    uploadMs: performance.now() - started,
    maxTextureSize,
  };
}

function pushVertex(vertices, x, y, u, v) {
  vertices.push(x, y, u, v);
}
function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return dpr;
}

export function createWebGLRenderer(canvas, pixelStore) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    stencil: false,
  });
  if (!gl) throw new WebGLRendererError('WebGL2 unavailable');

  const program = createProgram(gl);
  const textureState = createTexture(gl, pixelStore);
  const buffer = gl.createBuffer();
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const uvLocation = gl.getAttribLocation(program, 'a_uv');
  const textureLocation = gl.getUniformLocation(program, 'u_texture');
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(uvLocation);
  gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, textureState.texture);
  gl.uniform1i(textureLocation, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.027, 0.043, 0.067, 1);

  let records = [];

  function setRecords(nextRecords) {
    records = [...nextRecords];
  }

  function render(view) {
    const started = performance.now();
    const dpr = resizeCanvas(canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const vertices = [];
    let visiblePrimitives = 0;
    const scale = view.zoom * dpr;
    const centerWorldX = view.x * 32;
    const centerWorldY = view.y * 32;
    const halfWidth = canvas.width / 2;
    const halfHeight = canvas.height / 2;

    for (const record of records) {
      const primitive = record.primitive;
      const blob = pixelStore.sprites.get(primitive.spriteSourceId);
      if (!blob) throw new WebGLRendererError(`missing verified pixel for sprite ${primitive.spriteSourceId}`);
      const placement = textureState.placements.get(blob.contentId);
      if (!placement) throw new WebGLRendererError(`missing texture placement for ${blob.contentId}`);

      const worldX = record.x * 32 - (primitive.widthUnits - 32) + primitive.displacement.dxUnits;
      const worldY = record.y * 32 - (primitive.heightUnits - 32) + primitive.displacement.dyUnits;
      const screenX0 = halfWidth + (worldX - centerWorldX) * scale;
      const screenY0 = halfHeight + (worldY - centerWorldY) * scale;
      const screenX1 = screenX0 + primitive.widthUnits * scale;
      const screenY1 = screenY0 + primitive.heightUnits * scale;
      if (screenX1 <= 0 || screenY1 <= 0 || screenX0 >= canvas.width || screenY0 >= canvas.height) continue;

      const x0 = (screenX0 / canvas.width) * 2 - 1;
      const x1 = (screenX1 / canvas.width) * 2 - 1;
      const y0 = 1 - (screenY0 / canvas.height) * 2;
      const y1 = 1 - (screenY1 / canvas.height) * 2;
      const u0 = placement.x / textureState.width;
      const u1 = (placement.x + placement.width) / textureState.width;
      const v0 = placement.y / textureState.height;
      const v1 = (placement.y + placement.height) / textureState.height;
      pushVertex(vertices, x0, y0, u0, v0);
      pushVertex(vertices, x1, y0, u1, v0);
      pushVertex(vertices, x0, y1, u0, v1);
      pushVertex(vertices, x0, y1, u0, v1);
      pushVertex(vertices, x1, y0, u1, v0);
      pushVertex(vertices, x1, y1, u1, v1);
      visiblePrimitives += 1;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    const drawCalls = visiblePrimitives > 0 ? 1 : 0;
    if (drawCalls) gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 4);
    gl.finish();

    return {
      backend: 'WebGL2',
      drawCalls,
      renderMs: performance.now() - started,
      textureBytes: textureState.textureBytes,
      textureHeight: textureState.height,
      textureUploadMs: textureState.uploadMs,
      textureWidth: textureState.width,
      visiblePrimitives,
      viewportHeight: canvas.height,
      viewportWidth: canvas.width,
    };
  }

  return Object.freeze({
    gl,
    render,
    setRecords,
    textureState: Object.freeze({ ...textureState, placements: undefined, texture: undefined }),
  });
}
