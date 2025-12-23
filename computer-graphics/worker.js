const encoder = new TextEncoder();
const decoder = new TextDecoder();
const FORMAT_IDS = { indexed: 1, rgba: 2 };
const FRAME_INTERVAL_MS = 1000 / 30;
const INSTRUCTION_BUDGET = 0;

let enginePromise = loadEngine();
let running = false;
let paused = false;
let loopHandle = null;
let usingAnimationFrame = false;
let lastTime = 0;

enginePromise
  .then(({ version }) => {
    self.postMessage({ type: 'ready', version });
  })
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', message });
  });

function readCString(memory, ptr) {
  if (!ptr) return '';
  const bytes = new Uint8Array(memory.buffer);
  let end = ptr;
  while (end < bytes.length && bytes[end] !== 0) {
    end += 1;
  }
  return decoder.decode(bytes.subarray(ptr, end));
}

function readBufferString(memory, ptr, len) {
  if (!ptr || !len) return '';
  return decoder.decode(new Uint8Array(memory.buffer, ptr, len));
}

function allocAndWrite(exports, memory, text) {
  const bytes = encoder.encode(text);
  const ptr = exports.engine_malloc(bytes.length);
  if (!ptr) throw new Error('engine_malloc failed');
  new Uint8Array(memory.buffer, ptr, bytes.length).set(bytes);
  return { ptr, len: bytes.length };
}

function formatEngineError(exports, memory, err) {
  if (!memory) {
    if (err instanceof Error) return err.message;
    return String(err);
  }
  const engineMessage =
    readBufferString(memory, exports.engine_last_error_ptr?.(), exports.engine_last_error_len?.()) ||
    readBufferString(memory, exports.engine_log_ptr?.(), exports.engine_log_len?.());
  if (engineMessage) return engineMessage;
  if (err instanceof Error) return err.message;
  return String(err);
}

async function loadEngine() {
  const wasmUrl = new URL('./engine/engine.wasm', import.meta.url);
  const response = await fetch(wasmUrl);
  const bytes = await response.arrayBuffer();
  const imports = buildImports();
  const { instance } = await WebAssembly.instantiate(bytes, imports.imports);
  imports.setMemory(instance.exports.memory);
  if (instance.exports.__indirect_function_table) {
    imports.setTable(instance.exports.__indirect_function_table);
  }
  return {
    exports: instance.exports,
    memory: instance.exports.memory,
    version: readCString(instance.exports.memory, instance.exports.engine_version()),
  };
}

function buildImports() {
  let memory = null;
  let table = null;

  const wasi = {
    fd_close: () => 0,
    fd_seek: (_fd, _low, _high, _whence, outPtr) => {
      if (memory) new DataView(memory.buffer).setBigUint64(outPtr, 0n, true);
      return 0;
    },
    fd_read: (_fd, _iovs, _len, outPtr) => {
      if (memory) new DataView(memory.buffer).setUint32(outPtr, 0, true);
      return 0;
    },
    fd_write: (fd, iovs, iovsLen, outPtr) => {
      if (!memory) return 0;
      const view = new DataView(memory.buffer);
      let written = 0;
      for (let i = 0; i < iovsLen; i += 1) {
        const base = iovs + i * 8;
        const bufPtr = view.getUint32(base + 0, true);
        const bufLen = view.getUint32(base + 4, true);
        const bytes = new Uint8Array(memory.buffer, bufPtr, bufLen);
        if (fd === 1 || fd === 2) {
          const text = decoder.decode(bytes);
          if (text) console.log(text);
        }
        written += bufLen;
      }
      view.setUint32(outPtr, written, true);
      return 0;
    },
    clock_time_get: (_id, _precision, outPtr) => {
      if (memory) {
        const now = BigInt(Date.now()) * 1_000_000n;
        new DataView(memory.buffer).setBigUint64(outPtr, now, true);
      }
      return 0;
    },
  };

  const env = {
    invoke_vii: (index, a1, a2) => {
      if (!table) throw new Error('function table missing');
      const fn = table.get(index);
      if (typeof fn !== 'function') throw new Error(`missing fn ${index}`);
      return fn(a1, a2);
    },
    emscripten_notify_memory_growth: () => {},
    __syscall_dup3: () => -1,
    _emscripten_throw_longjmp: () => {
      const err = new Error('longjmp');
      err.isLongjmp = true;
      throw err;
    },
  };

  return {
    imports: { env, wasi_snapshot_preview1: wasi },
    setMemory: (m) => {
      memory = m;
    },
    setTable: (t) => {
      table = t;
    },
  };
}

function hexToRgba(hex) {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const a = normalized.length === 8 ? parseInt(normalized.slice(6, 8), 16) : 0xff;
  return [r, g, b, a];
}

function buildPaletteBytes(palette) {
  const bytes = new Uint8Array(palette.length * 4);
  for (let i = 0; i < palette.length; i += 1) {
    const [r, g, b, a] = hexToRgba(palette[i]);
    const offset = i * 4;
    bytes[offset + 0] = r;
    bytes[offset + 1] = g;
    bytes[offset + 2] = b;
    bytes[offset + 3] = a;
  }
  return bytes;
}

function uploadPalette(exports, memory, palette) {
  const bytes = buildPaletteBytes(palette);
  if (bytes.length === 0) {
    throw new Error('Palette is empty');
  }

  const ptr = exports.engine_malloc(bytes.length);
  if (!ptr) {
    throw new Error('engine_malloc failed for palette');
  }

  try {
    new Uint8Array(memory.buffer, ptr, bytes.length).set(bytes);
    const rc = exports.engine_palette_set_bulk_rgba32(ptr, palette.length);
    if (rc !== 0) {
      throw new Error(`engine_palette_set_bulk_rgba32 failed (${rc})`);
    }
  } finally {
    exports.engine_free(ptr);
  }
}

function getPaletteView(exports, memory) {
  const ptr = exports.engine_get_palette_ptr?.();
  const len = exports.engine_get_palette_len?.();
  if (!ptr || !len) {
    throw new Error('Palette buffer not available');
  }

  return new Uint8Array(memory.buffer, ptr, len);
}

async function compileAndStart(code, palette) {
  const { exports, memory } = await enginePromise;
  stopLoop();

  try {
    exports.engine_set_exec_instruction_budget(INSTRUCTION_BUDGET);
    exports.engine_set_frame_instruction_budget(INSTRUCTION_BUDGET);

    const paletteSize = Math.max(1, palette.length);
    const initStatus = exports.engine_init(128, 128, paletteSize);
    if (initStatus !== 0) {
      throw new Error(`engine init failed (${initStatus})`);
    }

    uploadPalette(exports, memory, palette);

    const buffer = allocAndWrite(exports, memory, code);
    let status = exports.engine_exec(buffer.ptr, buffer.len);
    exports.engine_free(buffer.ptr);

    if (status === 0) {
      status = exports.engine_call_init();
    }
    if (status !== 0) {
      const msg =
        readBufferString(memory, exports.engine_last_error_ptr(), exports.engine_last_error_len()) ||
        `engine_exec failed (${status})`;
      throw new Error(msg);
    }

    lastTime = performance.now();
    running = true;
    paused = false;
    scheduleLoop();
    flushLog(exports, memory);
    drawFrame(exports, memory, performance.now());
  } catch (err) {
    throw new Error(formatEngineError(exports, memory, err));
  }
}

function flushLog(exports, memory) {
  const text = readBufferString(memory, exports.engine_log_ptr(), exports.engine_log_len());
  if (text) {
    self.postMessage({ type: 'log', text });
    exports.engine_log_clear();
  }
}

function convertIndexedToRgba(framebuffer, palette) {
  const paletteLen = palette.length / 4;
  if (paletteLen < 1) {
    throw new Error('Palette is empty');
  }
  const rgba = new Uint8ClampedArray(framebuffer.length * 4);
  for (let i = 0; i < framebuffer.length; i += 1) {
    let idx = framebuffer[i];
    if (idx >= paletteLen) {
      idx = 0;
    }
    const paletteOffset = idx * 4;
    const dest = i * 4;
    rgba[dest + 0] = palette[paletteOffset + 0];
    rgba[dest + 1] = palette[paletteOffset + 1];
    rgba[dest + 2] = palette[paletteOffset + 2];
    rgba[dest + 3] = palette[paletteOffset + 3];
  }
  return rgba.buffer;
}

function drawFrame(exports, memory, now) {
  try {
    let status = exports.engine_call_draw(Math.floor(now));
    if (status === 0) {
      status = exports.engine_present();
    }
    if (status !== 0) {
      throw new Error(
        readBufferString(memory, exports.engine_last_error_ptr(), exports.engine_last_error_len()) ||
          `draw failed (${status})`
      );
    }

    const w = exports.engine_get_w();
    const h = exports.engine_get_h();
    if (!w || !h) return;

    const format = exports.engine_get_format?.() || FORMAT_IDS.indexed;

    let rgbaBuffer;
    if (format === FORMAT_IDS.indexed) {
      const fbPtr = exports.engine_get_fb_ptr?.();
      const fbLen = exports.engine_get_fb_len?.();
      if (!fbPtr || !fbLen) {
        throw new Error('Framebuffer not available');
      }
      const fb = new Uint8Array(memory.buffer, fbPtr, fbLen);
      const palette = getPaletteView(exports, memory);
      rgbaBuffer = convertIndexedToRgba(fb, palette);
    } else if (format === FORMAT_IDS.rgba) {
      const ptr = exports.engine_get_present_ptr();
      const len = exports.engine_get_present_len();
      if (!ptr || !len) {
        throw new Error('Present surface missing');
      }
      rgbaBuffer = memory.buffer.slice(ptr, ptr + len);
    } else {
      throw new Error(`Unsupported present format: ${format}`);
    }

    self.postMessage({ type: 'frame', w, h, rgba: rgbaBuffer }, [rgbaBuffer]);
    flushLog(exports, memory);
  } catch (err) {
    throw new Error(formatEngineError(exports, memory, err));
  }
}

function cancelLoopTimer() {
  if (loopHandle !== null) {
    if (usingAnimationFrame && typeof self.cancelAnimationFrame === 'function') {
      self.cancelAnimationFrame(loopHandle);
    } else {
      clearTimeout(loopHandle);
    }
    loopHandle = null;
  }
}

function stopLoop() {
  running = false;
  paused = false;
  cancelLoopTimer();
}

async function tick(now = performance.now()) {
  if (!running || paused) return;
  loopHandle = null;
  const { exports, memory } = await enginePromise;
  const frameTime = Number.isFinite(now) ? now : performance.now();
  const dtSeconds = Math.max(0, (frameTime - lastTime) / 1000);
  lastTime = frameTime;

  try {
    if (typeof exports.engine_call_update === 'function') {
      const updateStatus = exports.engine_call_update(dtSeconds);
      if (updateStatus !== 0) {
        throw new Error(
          readBufferString(memory, exports.engine_last_error_ptr(), exports.engine_last_error_len()) ||
            `update failed (${updateStatus})`
        );
      }
    }

    drawFrame(exports, memory, frameTime);
  } catch (err) {
    stopLoop();
    const message = formatEngineError(exports, memory, err);
    self.postMessage({ type: 'error', message });
    return;
  }

  scheduleLoop();
}

function scheduleLoop() {
  if (!running || paused || loopHandle !== null) return;
  if (typeof self.requestAnimationFrame === 'function') {
    usingAnimationFrame = true;
    loopHandle = self.requestAnimationFrame(tick);
  } else {
    usingAnimationFrame = false;
    loopHandle = setTimeout(() => tick(performance.now()), FRAME_INTERVAL_MS);
  }
}

self.onmessage = async (event) => {
  const { type, code, palette } = event.data;
  try {
    switch (type) {
      case 'start':
        await compileAndStart(code, palette);
        break;
      case 'pause':
        paused = true;
        cancelLoopTimer();
        break;
      case 'resume':
        paused = false;
        lastTime = performance.now();
        scheduleLoop();
        break;
      case 'stop':
        stopLoop();
        running = false;
        break;
      default:
        self.postMessage({ type: 'log', text: `Unknown message: ${type}` });
    }
  } catch (err) {
    stopLoop();
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'error', message });
  }
};
