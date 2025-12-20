const startButton = document.getElementById('start');
const pauseButton = document.getElementById('pause');
const restartButton = document.getElementById('restart');
const shareButton = document.getElementById('share');
const canvas = document.getElementById('preview');
const canvasInfo = document.getElementById('canvasInfo');
const canvasWrap = document.getElementById('canvasWrap');
const logLines = document.getElementById('logLines');
const engineInfo = document.getElementById('engineInfo');
const paletteJsonInput = document.getElementById('paletteJson');

const DEFAULT_LUA = `function init()
  video(128, 128, "indexed")
end

function draw(t_ms)
  local t = t_ms / 1000
  for y=0,127 do
    for x=0,127 do
      local v = math.sin((x + t * 20) * 0.08)
      v = v + math.sin((y + t * 30) * 0.06)
      v = v + math.sin((x + y + t * 10) * 0.04)
      local c = math.floor(((v + 3) / 6) * 15) % 16
      pset(x, y, c)
    end
  end
end`;

const DEFAULT_PALETTE_JSON =
  '["#000000","#240F1B","#3B1638","#48245B","#483681","#344CA3","#0063BF","#0079D3","#008EDC","#00A2DE","#00B5D9","#00C6D2","#5ED6CD","#9EE4D1","#D3F1E0","#FFFFFF"]';
const DEFAULT_PALETTE = JSON.parse(DEFAULT_PALETTE_JSON);

let editor;
let worker = null;
let workerReady = false;
let readyResolvers = [];
let lastFrameTimestamp = null;
let fpsValue = 0;
let canvasSize = { w: 128, h: 128 };
let isRunning = false;
let isPaused = false;

function padBase64(b64) {
  const missing = (4 - (b64.length % 4)) % 4;
  if (missing === 0) return b64;
  return b64 + '='.repeat(missing);
}

function base64EncodeUnicode(str) {
  const utf8 = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16)),
  );
  return btoa(utf8).replace(/=+$/, '');
}

function base64DecodeUnicode(b64) {
  const binary = atob(padBase64(b64));
  const pairs = Array.from(binary, (ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`);
  return decodeURIComponent(pairs.join(''));
}

function settleWorkerReady(error) {
  if (readyResolvers.length === 0) return;
  const pending = readyResolvers;
  readyResolvers = [];
  for (const waiter of pending) {
    if (error) {
      waiter.reject(error);
    } else {
      waiter.resolve();
    }
  }
}

function updateControls() {
  startButton.disabled = isRunning;
  pauseButton.disabled = !isRunning;
  pauseButton.classList.toggle('is-paused', isPaused);
  pauseButton.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
}

function resetFps() {
  lastFrameTimestamp = null;
  fpsValue = 0;
}

function appendLog(text) {
  const stamp = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.textContent = `[${stamp}] ${text}`;
  logLines.append(line);
  logLines.scrollTop = logLines.scrollHeight;
}

function clearLogs() {
  logLines.innerHTML = '';
}

function formatFpsLabel() {
  if (Number.isFinite(fpsValue) && fpsValue > 0) {
    return `${fpsValue.toFixed(0)} FPS`;
  }
  return '-- FPS';
}

function computeScale() {
  const w = canvasSize.w;
  const h = canvasSize.h;
  const panelW = canvasWrap.clientWidth || w;
  const panelH = canvasWrap.clientHeight || h;
  const scale = Math.max(1, Math.min(Math.floor(panelW / w), Math.floor(panelH / h)));
  return scale;
}

function resizeCanvas(size = canvasSize) {
  canvasSize = { ...size };
  canvas.width = canvasSize.w;
  canvas.height = canvasSize.h;
  const scale = computeScale();
  canvas.style.width = `${canvasSize.w * scale}px`;
  canvas.style.height = `${canvasSize.h * scale}px`;
  updateCanvasInfo(scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function updateCanvasInfo(scale = computeScale()) {
  canvasInfo.textContent = `${canvasSize.w}×${canvasSize.h} @ ${scale}x · ${formatFpsLabel()}`;
}

function parsePaletteJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error('Palette JSON is invalid');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Palette must be a JSON array');
  }
  if (parsed.length < 1) {
    throw new Error('Palette must include at least one color');
  }

  const hexRegex = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
  parsed.forEach((entry, index) => {
    if (typeof entry !== 'string') {
      throw new Error(`Palette entry ${index} must be a string`);
    }
    if (!hexRegex.test(entry)) {
      throw new Error(`Palette entry ${index} is not a valid hex color`);
    }
  });

  return parsed;
}

function normalizePaletteEntry(entry) {
  const hex = entry.startsWith('#') ? entry.slice(1) : entry;
  return hex.toUpperCase();
}

function palettesMatchDefault(palette) {
  if (palette.length !== DEFAULT_PALETTE.length) return false;
  return palette.every(
    (color, index) => normalizePaletteEntry(color) === normalizePaletteEntry(DEFAULT_PALETTE[index]),
  );
}

function encodePaletteParam(palette) {
  return palette.map(normalizePaletteEntry).join(',');
}

function decodePaletteParam(param) {
  const colors = param.split(',').filter((entry) => entry.length > 0);
  if (colors.length === 0) {
    throw new Error('Palette parameter is empty');
  }

  const decoded = colors.map((color, index) => {
    const hex = color.toUpperCase();
    if (!/^[0-9A-F]{6}([0-9A-F]{2})?$/.test(hex)) {
      throw new Error(`Palette entry ${index} is not a valid hex color`);
    }
    return `#${hex}`;
  });

  const json = JSON.stringify(decoded);
  parsePaletteJson(json);
  return json;
}

function encodeSharePayload(payload) {
  return base64EncodeUnicode(JSON.stringify(payload));
}

function decodeSharePayload(encoded) {
  const raw = base64DecodeUnicode(encoded);
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Shared payload is not valid JSON');
  }
  return parsed;
}

function handleWorkerMessage(event) {
  const { data } = event;
  switch (data.type) {
    case 'ready': {
      workerReady = true;
      engineInfo.textContent = `Worker ready · Engine ${data.version}`;
      settleWorkerReady();
      isRunning = false;
      isPaused = false;
      updateControls();
      break;
    }
    case 'frame': {
      drawFrame(data);
      isRunning = true;
      updateControls();
      break;
    }
    case 'log': {
      appendLog(data.text);
      break;
    }
    case 'error': {
      isRunning = false;
      isPaused = false;
      updateControls();
      if (!workerReady) {
        settleWorkerReady(new Error(data.message));
      }
      appendLog(data.message);
      resetFps();
      updateCanvasInfo();
      break;
    }
    default:
      break;
  }
}

function drawFrame(payload) {
  if (payload.w !== canvas.width || payload.h !== canvas.height) {
    resizeCanvas({ w: payload.w, h: payload.h });
  }
  const ctx = canvas.getContext('2d');
  const rgba = new Uint8ClampedArray(payload.rgba);
  const imageData = new ImageData(rgba, payload.w, payload.h);
  ctx.putImageData(imageData, 0, 0);

  const now = performance.now();
  if (lastFrameTimestamp !== null) {
    const delta = now - lastFrameTimestamp;
    if (delta > 0) {
      const instantFps = 1000 / delta;
      fpsValue = fpsValue ? fpsValue * 0.7 + instantFps * 0.3 : instantFps;
    }
  }
  lastFrameTimestamp = now;
  updateCanvasInfo();
}

function spawnWorker() {
  if (worker) {
    worker.terminate();
  }
  workerReady = false;
  readyResolvers = [];
  worker = new Worker('./worker.js', { type: 'module' });
  worker.onmessage = handleWorkerMessage;
  worker.onerror = (err) => {
    appendLog(`Worker error: ${err.message}`);
    isRunning = false;
    isPaused = false;
    updateControls();
    settleWorkerReady(err);
  };
}

function waitForWorkerReady() {
  if (workerReady) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    readyResolvers.push({ resolve, reject });
  });
}

async function startRun() {
  let palette;
  try {
    palette = parsePaletteJson(paletteJsonInput.value.trim());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Palette is invalid';
    appendLog(message);
    isRunning = false;
    isPaused = false;
    updateControls();
    return;
  }

  isRunning = true;
  isPaused = false;
  updateControls();

  try {
    if (!worker) {
      spawnWorker();
    }
    await waitForWorkerReady();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Worker failed to start';
    appendLog(message);
    isRunning = false;
    isPaused = false;
    updateControls();
    resetFps();
    updateCanvasInfo();
    return;
  }

  resetFps();
  worker.postMessage({ type: 'start', code: editor.getValue(), palette });
}

async function restartRun() {
  clearLogs();
  appendLog('Restarting runtime…');
  resetFps();
  resizeCanvas(canvasSize);
  if (worker) {
    worker.terminate();
    worker = null;
    workerReady = false;
    readyResolvers = [];
  }
  isRunning = false;
  isPaused = false;
  updateControls();
  spawnWorker();
  await startRun();
}

async function shareState() {
  const code = editor.getValue();
  const paletteText = paletteJsonInput.value.trim();

  let palette;
  try {
    palette = parsePaletteJson(paletteText);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Palette is invalid';
    appendLog(message);
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete('share');
  url.searchParams.set('c', base64EncodeUnicode(code));

  if (palettesMatchDefault(palette)) {
    url.searchParams.delete('p');
  } else {
    url.searchParams.set('p', encodePaletteParam(palette));
  }
  const shareUrl = url.toString();

  window.history.replaceState(null, '', url);

  try {
    await navigator.clipboard.writeText(shareUrl);
    appendLog('Share URL copied to clipboard.');
  } catch (err) {
    appendLog(`Share URL ready: ${shareUrl}`);
  }
}

function applySharedState(payload) {
  if (payload && typeof payload === 'object') {
    if (typeof payload.code === 'string') {
      editor.setValue(payload.code);
    }
    if (typeof payload.palette === 'string') {
      paletteJsonInput.value = payload.palette;
    }
  }
}

function loadSharedState() {
  const params = new URL(window.location.href).searchParams;
  const encodedCode = params.get('c');
  const encodedPalette = params.get('p');
  const legacyShare = params.get('share');

  if (encodedCode) {
    try {
      const code = base64DecodeUnicode(encodedCode);
      const paletteJson = encodedPalette ? decodePaletteParam(encodedPalette) : DEFAULT_PALETTE_JSON;
      applySharedState({ code, palette: paletteJson });
      appendLog('Loaded shared state from URL.');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load shared data';
      appendLog(message);
      return false;
    }
  }

  if (legacyShare) {
    try {
      const payload = decodeSharePayload(legacyShare);
      applySharedState(payload);
      appendLog('Loaded shared state from URL.');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load shared data';
      appendLog(message);
      return false;
    }
  }

  return false;
}

function togglePause() {
  if (!worker || !isRunning) return;

  isPaused = !isPaused;
  if (isPaused) {
    appendLog('Pausing runtime…');
    lastFrameTimestamp = null;
    worker.postMessage({ type: 'pause' });
  } else {
    appendLog('Resuming runtime…');
    worker.postMessage({ type: 'resume' });
  }
  updateControls();
}

function setupEditor() {
  editor = CodeMirror.fromTextArea(document.getElementById('editor'), {
    mode: 'lua',
    theme: 'material-darker',
    lineNumbers: true,
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
  });

  editor.setValue(DEFAULT_LUA);
}

function setupPaletteInput() {
  paletteJsonInput.value = DEFAULT_PALETTE_JSON;
}

function setupControls() {
  startButton.addEventListener('click', () => startRun());
  pauseButton.addEventListener('click', () => togglePause());
  restartButton.addEventListener('click', () => restartRun());
  shareButton.addEventListener('click', () => shareState());

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      startRun();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      restartRun();
    }
  });

  window.addEventListener('resize', () => resizeCanvas(canvasSize));
}

function boot() {
  setupEditor();
  setupPaletteInput();
  const shouldAutoStart = loadSharedState();
  resizeCanvas(canvasSize);
  setupControls();
  spawnWorker();
  startButton.disabled = true;
  pauseButton.disabled = true;
  startRun();

}

boot();
