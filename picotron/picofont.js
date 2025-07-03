
let flag1Chk, flag2Chk;
const FLAGS_IDX = 5;

let previewScale, editScale, editorCanvas;
let fontBytes, selectedIndex, isMouseDown, drawMode;
let widthSelect, offsetChk;
const META_BASE = 8;

window.addEventListener('DOMContentLoaded', () => {
  previewScale = 4;
  editScale = 40;

  editorCanvas = document.getElementById('editor-canvas');
  editorCanvas.width  = 8 * editScale;
  editorCanvas.height = 8 * editScale;

  fontBytes = new Uint8Array(2048);
  selectedIndex = null;
  isMouseDown = false;
  drawMode = true;

  widthSelect = document.getElementById('width-select');
  for (let val = -4; val <= 3; val++) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    widthSelect.append(opt);
  }
  offsetChk = document.getElementById('offset-chk');

  widthSelect.addEventListener('change', applyNibbleChange);
  offsetChk.addEventListener('change', applyNibbleChange);

  document.getElementById('file-input').addEventListener('change', handleFileLoad);
  document.getElementById('save-btn').addEventListener('click', handleFileSave);
  flag1Chk = document.getElementById('flag1');
  flag2Chk = document.getElementById('flag2');
  flag1Chk.addEventListener('change', updateFlagsFromUI);
  flag2Chk.addEventListener('change', updateFlagsFromUI);
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('click', () => {
    setTheme(
      document.documentElement.getAttribute('data-theme') === 'light'
        ? 'dark'
        : 'light'
    );
    drawAllPreviews();
  });

  setTheme(localStorage.getItem('theme') || 'light');

  setupGlobalControls();
  setupCodepointGrid();

  editorCanvas.addEventListener('mousedown', handleMouseDown);
  editorCanvas.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
});

function parsePod(podText) {
  const match = podText.match(/--\[\[pod\]\]userdata\("u8",\s*2048,\s*"hex:([0-9A-Fa-f]+)"\)/);
  return match ? match[1] : null;
}
function hexToBytes(hex) {
  const clean = hex.replace(/\s+/g, '');
  const bytes = new Uint8Array(clean.length/2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i*2,2), 16);
  }
  return bytes;
}
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2,'0'))
    .join('');
}
function varGet(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
function drawGlyph(ctx, glyph, scale) {
  ctx.clearRect(0, 0, 8*scale, 8*scale);
  ctx.fillStyle = varGet('--fg');
  glyph.forEach((row, y) => {
    for (let x = 0; x < 8; x++) {
      if (row & (1 << x)) {
        ctx.fillRect(x*scale, y*scale, scale, scale);
      }
    }
  });
}
function drawCodepointPreview(i) {
  const cp = document.querySelector(`.codepoint[data-index="${i}"]`);
  if (!cp) return;
  const ctx = cp.querySelector('canvas').getContext('2d');
  drawGlyph(ctx, fontBytes.slice(i*8, i*8+8), previewScale);
}
function drawAllPreviews() {
  for (let i = 16; i < 256; i++) drawCodepointPreview(i);
  drawEditor();
}

function setupCodepointGrid() {
  const grid = document.getElementById('codepoint-grid');
  grid.innerHTML = '';
  selectedIndex = null;
  document.getElementById('editor-label').textContent = 'Select a character to edit';
  document.getElementById('save-btn').disabled = true;

  for (let i = 16; i < 256; i++) {
    const cp = document.createElement('div');
    cp.className = 'codepoint';
    cp.dataset.index = i;
    const c = document.createElement('canvas');
    c.width = 8 * previewScale;
    c.height = 8 * previewScale;
    cp.appendChild(c);
    const lbl = document.createElement('div');
    lbl.className = 'codepoint-label';
    lbl.textContent = i.toString(16).padStart(2,'0').toUpperCase();
    cp.appendChild(lbl);
    cp.addEventListener('click', () => selectCodepoint(i));
    grid.appendChild(cp);
    drawCodepointPreview(i);
  }
}

function selectCodepoint(i) {
  selectedIndex = i;
  document.querySelectorAll('.codepoint').forEach(el =>
    el.classList.toggle('selected', +el.dataset.index === i)
  );
  document.getElementById('editor-label').textContent =
    `Editing: 0x${i.toString(16).padStart(2,'0').toUpperCase()}`;

  const metaIdx = META_BASE + Math.floor((i - 16) / 2);
  let nibble = (fontBytes[metaIdx] >> (((i - 16) % 2) * 4)) & 0xF;
  let adj = nibble & 0x7;
  if (adj >= 4) adj -= 8;
  widthSelect.value = adj;
  offsetChk.checked = !!(nibble & 0x8);

  drawEditor();
  document.getElementById('save-btn').disabled = false;
}

function drawEditor() {
  const ctx = editorCanvas.getContext('2d');
  ctx.clearRect(0, 0, 8*editScale, 8*editScale);
  if (selectedIndex === null) return;
  drawGlyph(
    ctx,
    fontBytes.slice(selectedIndex*8, selectedIndex*8+8),
    editScale
  );
}

function applyNibbleChange() {
  if (selectedIndex === null) return;
  const i = selectedIndex;
  const metaIdx = META_BASE + Math.floor((i - 16) / 2);
  let newNib = parseInt(widthSelect.value);
  if (newNib < 0) newNib += 8;
  if (offsetChk.checked) newNib |= 0x8;
  let orig = fontBytes[metaIdx];
  if ((i - 16) % 2 === 0) orig = (orig & 0xF0) | newNib;
  else orig = (orig & 0x0F) | (newNib << 4);
  fontBytes[metaIdx] = orig;
  drawCodepointPreview(i);
  drawEditor();
}

function applyDraw(x, y) {
  if (selectedIndex === null) return;
  const idx = selectedIndex*8 + y;
  const mask = 1 << x;
  fontBytes[idx] = drawMode
    ? (fontBytes[idx] | mask)
    : (fontBytes[idx] & ~mask);
  drawEditor();
  drawCodepointPreview(selectedIndex);
}
function handleMouseDown(e) {
  if (selectedIndex === null) return;
  isMouseDown = true;
  const r = editorCanvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / editScale);
  const y = Math.floor((e.clientY - r.top) / editScale);
  if (x < 0 || x > 7 || y < 0 || y > 7) return;
  const idx = selectedIndex*8 + y;
  drawMode = !(fontBytes[idx] & (1 << x));
  applyDraw(x, y);
}
function handleMouseMove(e) {
  if (!isMouseDown) return;
  const r = editorCanvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / editScale);
  const y = Math.floor((e.clientY - r.top) / editScale);
  if (x < 0 || x > 7 || y < 0 || y > 7) return;
  applyDraw(x, y);
}
function handleMouseUp() { isMouseDown = false; }

function setupGlobalControls() {
  const labels = [
    '0-127 Width',
    '128-256 Width',
    'Height',
    'Off X',
    'Off Y',
    'Tab Width'
  ];
  const container = document.getElementById('global-attr-controls');
  container.innerHTML = '';
  labels.forEach((lbl, idx) => {
    const wrap = document.createElement('div');
    const label = document.createElement('label'); label.textContent = lbl + ':';
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = '0'; inp.max = '255'; inp.value = fontBytes[idx];
    inp.addEventListener('change', () => {
      fontBytes[idx] = parseInt(inp.value) & 0xFF;
      drawAllPreviews();
    });
    wrap.append(label, inp);
    container.appendChild(wrap);
  });
}
 function updateFlagsFromUI() {
   let flags = 0;
   if (flag1Chk.checked) flags |= 0x1;
   if (flag2Chk.checked) flags |= 0x2;
   fontBytes[FLAGS_IDX] = flags;
   drawAllPreviews();
 }

 function loadFlagsIntoUI() {
   const flags = fontBytes[FLAGS_IDX];
   flag1Chk.checked = !!(flags & 0x1);
   flag2Chk.checked = !!(flags & 0x2);
 }
function handleFileLoad(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const hx = parsePod(r.result);
    if (hx && hx.length === 4096) {
      fontBytes = hexToBytes(hx);
      setupGlobalControls();
      setupCodepointGrid();
      loadFlagsIntoUI();
    } else alert('Invalid POD file');
  };
  r.readAsText(f);
}
function handleFileSave() {
  const pod = `--[[pod]]userdata("u8",2048,"hex:${bytesToHex(fontBytes)}")`;
  const blob = new Blob([pod], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'font.font';
  link.click();
}
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('theme-toggle').textContent = t === 'light' ? 'Dark Mode' : 'Light Mode';
  localStorage.setItem('theme', t);
}
