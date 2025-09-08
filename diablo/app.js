const fileInput = document.getElementById('saveFile');
const saveType = document.getElementById('saveType');
const downloadButton = document.getElementById('download');
const statusEl = document.getElementById('status');
const jsonArea = document.getElementById('json');
const applyJsonBtn = document.getElementById('applyJson');

const tabs = [...document.querySelectorAll('.tab')];
const panels = [...document.querySelectorAll('.panel')];

const spellsGrid = document.getElementById('spellsGrid');
const equippedSlotsEl = document.getElementById('equippedSlots');
const invGridEl = document.getElementById('invGrid');
const speedBarEl = document.getElementById('speedBar');
const bpSelectEl = document.getElementById('bpDropdown');
const equipInspectorEl = document.getElementById('equipInspector');
const bpInspectorEl = document.getElementById('bpInspector');
const inspectorEls = [equipInspectorEl, bpInspectorEl].filter(Boolean);

let ready = false;
let state = {
  data: null,
  dirty: false,
  selectedItem: null,
};

const setStatus = (msg) => (statusEl.textContent = msg || '');
function ensureReady() { if (!ready) throw new Error('WASM not initialized yet.'); }
function runEditor(args) { Module.callMain(args); }
function enableDownload(on) { downloadButton.disabled = !on; }
const deepClone = (x) => JSON.parse(JSON.stringify(x));

function getSaveSettings() {
  const type = saveType.value;
  const flags = [];
  let ext = '.sv';
  switch (type) {
    case 'multi': flags.push('--multi'); break;
    case 'spawn': flags.push('--spawn'); break;
    case 'hellfire': flags.push('--hellfire'); ext = '.hsv'; break;
  }
  return { flags, ext };
}

const CLASSES_ALL = ['Warrior', 'Rogue', 'Sorcerer', 'Monk', 'Bard', 'Barbarian'];
const DIFFICULTIES = ['Normal', 'Nightmare', 'Hell'];
function populateEnumSelect(select, items) {
  select.innerHTML = '';
  items.forEach((label, i) => {
    const opt = document.createElement('option');
    opt.value = String(i); opt.textContent = label;
    select.appendChild(opt);
  });
}


const GRID_W = 10, GRID_H = 4;
const uiGridMap = Object.create(null);
const DEFAULT_SIZE = [1,1];
const ITEM_SIZES = {

};

function resetUiGridMap() { for (const k in uiGridMap) delete uiGridMap[k]; }
function clampRect(x, y, w, h) {
  const cw = Math.max(1, Math.min(w, GRID_W));
  const ch = Math.max(1, Math.min(h, GRID_H));
  const nx = Math.max(0, Math.min(GRID_W - cw, x|0));
  const ny = Math.max(0, Math.min(GRID_H - ch, y|0));
  return { x: nx, y: ny, w: cw, h: ch };
}
function keyFor(kind, index) { return `${kind}:${index}`; }
function getItemRect(kind, index, idxValue) {
  const k = keyFor(kind, index);
  if (uiGridMap[k]) return uiGridMap[k];
  if (kind !== 'InvList') return null;
  const [w,h] = ITEM_SIZES[idxValue] || DEFAULT_SIZE;
  return { x: 0, y: 0, w, h };
}
function setItemRect(kind, index, rect, opts = { updateGrid: true }) {
  if (kind !== 'InvList') return;
  uiGridMap[keyFor(kind, index)] = clampRect(rect.x, rect.y, rect.w, rect.h);
  if (opts.updateGrid) {
    recomputeInvGridFromMap();
    applyDataToUI();
    highlightSelectedItemCells();
  }
}
function clearItemRect(kind, index) {
  delete uiGridMap[keyFor(kind, index)];
  recomputeInvGridFromMap();
  applyDataToUI();
  highlightSelectedItemCells();
}
function recomputeInvGridFromMap() {
  if (!state.data || !Array.isArray(state.data.InvGrid)) return;
  const grid = state.data.InvGrid;
  for (let i=0; i<GRID_W*GRID_H; i++) grid[i] = 0;
  for (const k in uiGridMap) {
    const { x, y, w, h } = uiGridMap[k];
    for (let yy=0; yy<h; yy++) for (let xx=0; xx<w; xx++) {
      const gx = x+xx, gy = y+yy;
      if (gx>=0 && gx<GRID_W && gy>=0 && gy<GRID_H) {
        grid[gy*GRID_W + gx] = 1;
      }
    }
  }
  state.dirty = true;
}
function findItemAtCell(cx, cy) {
  for (const k in uiGridMap) {
    const [kind, idxStr] = k.split(':');
    if (kind !== 'InvList') continue;
    const { x, y, w, h } = uiGridMap[k];
    if (cx >= x && cx < x + w && cy >= y && cy < y + h) {
      return { kind, index: Number(idxStr) };
    }
  }
  return null;
}
function inferMapFromGridAndItems() {
  if (!state.data?.InvGrid || !Array.isArray(state.data.InvGrid)) return;
  if (!Array.isArray(state.data.InvList)) return;
  const grid = state.data.InvGrid;
  const visited = Array(GRID_W*GRID_H).fill(false);
  const rects = [];
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  function bfs(si) {
    const q=[si]; visited[si]=true; const cells=[];
    while(q.length){const i=q.shift();cells.push(i);
      const x=i%GRID_W,y=(i/GRID_W)|0;
      for(const[dX,dY]of dirs){const nx=x+dX,ny=y+dY;
        if(nx<0||ny<0||nx>=GRID_W||ny>=GRID_H)continue;
        const ni=ny*GRID_W+nx;
        if(!visited[ni]&&grid[ni]===1){visited[ni]=true;q.push(ni);}
      }
    }
    let minx=GRID_W,miny=GRID_H,maxx=0,maxy=0;
    for(const i of cells){const x=i%GRID_W,y=(i/GRID_W)|0; if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;}
    return {x:minx,y:miny,w:maxx-minx+1,h:maxy-miny+1};
  }
  for(let i=0;i<GRID_W*GRID_H;i++){ if(grid[i]===1 && !visited[i]) rects.push(bfs(i)); }
  const n=Math.min(state.data.InvList.length, rects.length);
  for(let j=0;j<n;j++){ setItemRect('InvList', j, rects[j], {updateGrid:false}); }
}

function getByPath(obj, path) {
  const parts = path.split('.').flatMap(p=>p.match(/([^\[\]]+)|\[(\d+)\]/g)||[p]);
  return parts.reduce((acc, part) => {
    if (acc == null) return acc;
    if (part.startsWith('[')) return acc[Number(part.slice(1, -1))];
    return acc[part];
  }, obj);
}
function setByPath(obj, path, value) {
  const parts = path.split('.').flatMap(p=>p.match(/([^\[\]]+)|\[(\d+)\]/g)||[p]);
  let cur = obj;
  for (let i=0;i<parts.length-1;i++){ const part=parts[i]; cur = part.startsWith('[')? cur[Number(part.slice(1,-1))] : cur[part]; }
  const last=parts[parts.length-1];
  if (last.startsWith('[')) cur[Number(last.slice(1,-1))] = value; else cur[last] = value;
}

function readValueFromHost(host) {
  if (host.classList.contains('spin')) return host._spinGet ? host._spinGet() : 0;
  if (host.tagName === 'INPUT') {
    if (host.type === 'checkbox') return host.checked ? 1 : 0;
    if (host.type === 'number') return Number(host.value || 0);
    return host.value;
  }
  if (host.tagName === 'SELECT') return Number(host.value);
  return null;
}
function commitBindHost(host) {
  if (!state.data || !host?.dataset?.bind) return;
  const path = host.dataset.bind;
  const val = readValueFromHost(host);
  if (val !== null) { setByPath(state.data, path, val); state.dirty = true; }
}
function syncJsonMirror() {
  if (state.data) jsonArea.value = JSON.stringify(state.data, null, 2);
}
function commitFromEventTarget(target) {
  const host = target.closest('[data-bind]');
  if (host) {
    commitBindHost(host);
    syncJsonMirror();
  }
}
function commitAllBindings() {
  if (!state.data) return;
  document.querySelectorAll('[data-bind]').forEach(commitBindHost);
  syncJsonMirror();
}

function initSpin(el) {
  if (el.dataset.enhanced) return;
  const input = document.createElement('input');
  input.type = 'number'; input.className = 'val'; input.inputMode = 'numeric';
  const min = Number(el.dataset.min ?? 0);
  const max = Number(el.dataset.max ?? 999999);
  const step = Number(el.dataset.step ?? 1);
  input.min = String(min); input.max = String(max); input.step = String(step);
  el.innerHTML = ''; el.append(input); el.dataset.enhanced = '1';
  const clamp = (n)=>Math.max(min, Math.min(max, Math.trunc(n)));
  const set = (n)=>{ input.value = String(clamp(n)); el.setAttribute('aria-valuenow', input.value); };
  const get = ()=>Number(input.value || 0);
  input.addEventListener('input', ()=>{ commitBindHost(el); });
  input.addEventListener('change', ()=>{ set(get()); commitBindHost(el); });
  el._spinSet = (n)=>set(n);
  el._spinGet = ()=>get();
}

const SPELL_COUNT = 37;
const SPELL_NAMES = [
  'Firebolt','Healing','Lightning','Flash','Identify','Fire Wall','Town Portal','Stone Curse','Infravision',
  'Phasing','Mana Shield','Fireball','Guardian','Chain Lightning','Flame Wave','Doom Serpents','Blood Ritual',
  'Nova','Invisibility','Inferno','Golem','Rage','Teleport','Apocalypse','Etherealize','Item Repair',
  'Staff Recharge','Trap Disarm','Elemental','Charged Bolt','Holy Bolt','Resurrect','Telekinesis','Heal Other',
  'Blood Star','Bone Spirit','Mana'
];
const EQUIP_LABELS = ['Head','Amulet','Armor','Right Hand','Left Hand','Ring (L)','Ring (R)'];

function buildSpells() {
  spellsGrid.innerHTML = '';
  for (let i = 0; i < SPELL_COUNT; i++) {
    const chip = document.createElement('div');
    chip.className = 'chip';
    const label = SPELL_NAMES[i] ?? `Spell ${i+1}`;
    chip.innerHTML = `
      <span class="name">${label}</span>
      <div class="spin" data-bind="pSplLvl[${i}]" data-min="0" data-max="15" data-step="1"></div>
    `;
    spellsGrid.appendChild(chip);
  }
  [...spellsGrid.querySelectorAll('.spin')].forEach(initSpin);
}

function buildEquipped() {
  equippedSlotsEl.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const slot = document.createElement('button');
    slot.type = 'button'; slot.className = 'slot';
    slot.dataset.kind = 'InvBody'; slot.dataset.index = String(i);
    slot.innerHTML = `<strong>${EQUIP_LABELS[i] ?? ('Slot '+i)}</strong><span class="muted small">idx: <span class="v-idx">—</span></span>`;
    slot.addEventListener('click', () => selectItem('InvBody', i, slot));
    equippedSlotsEl.appendChild(slot);
  }
}

function buildInvGrid() {
  invGridEl.innerHTML = '';
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = String(i);
    cell.textContent = '0';

    cell.addEventListener('click', () => {
      if (!state.data) return;
      const cx = i % GRID_W;
      const cy = Math.floor(i / GRID_W);

      const owner = findItemAtCell(cx, cy);
      if (owner) {
        document.getElementById('tabbtn-backpack')?.click();
        selectItem(owner.kind, owner.index, null);
        highlightSelectedItemCells();
        refreshBackpackListSelection();
        return;
      }

      if (state.selectedItem && state.selectedItem.kind === 'InvList') {
        const idx = state.selectedItem.index;
        const invItem = state.data.InvList?.[idx];
        if (invItem) {
          const [w,h] = ITEM_SIZES[invItem.idx] || DEFAULT_SIZE;
          setItemRect('InvList', idx, { x: cx, y: cy, w, h });
          highlightSelectedItemCells();
          buildBackpackList();
          refreshBackpackListSelection();
        }
        return;
      }

      const current = state.data.InvGrid?.[i] ?? 0;
      state.data.InvGrid[i] = current ? 0 : 1;
      cell.textContent = String(state.data.InvGrid[i]);
      cell.classList.toggle('assigned', !!state.data.InvGrid[i]);
      state.dirty = true;
    });

    invGridEl.appendChild(cell);
  }
}

function buildSpeedBar() {
  speedBarEl.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const slot = document.createElement('button');
    slot.type = 'button'; slot.className = 'slot';
    slot.dataset.kind = 'SpdList'; slot.dataset.index = String(i);
    slot.innerHTML = `<strong>Slot ${i+1}</strong><span class="muted small">idx: <span class="v-idx">—</span></span>`;
    slot.addEventListener('click', () => selectItem('SpdList', i, slot));
    speedBarEl.appendChild(slot);
  }
}

function buildBackpackList() {
  if (!bpSelectEl) return;
  bpSelectEl.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select item…';
  bpSelectEl.appendChild(placeholder);
  const items = state.data?.InvList || [];
  items.forEach((it, i) => {
    const r = getItemRect('InvList', i, it.idx);
    const pos = r ? `(${r.x},${r.y}) ${r.w}×${r.h}` : '—';
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `#${i} idx: ${it?.idx ?? '—'} ${pos}`;
    bpSelectEl.appendChild(opt);
  });
  refreshBackpackListSelection();
}

bpSelectEl?.addEventListener('change', () => {
  const val = bpSelectEl.value;
  if (val === '') return;
  const idx = Number(val);
  selectItem('InvList', idx, null);
  highlightSelectedItemCells();
  refreshBackpackListSelection();
});

function refreshBackpackListSelection() {
  if (!bpSelectEl) return;
  const sel = state.selectedItem?.kind === 'InvList' ? state.selectedItem.index : '';
  bpSelectEl.value = sel === '' ? '' : String(sel);
}

function selectItem(kind, index, slotEl) {
  commitAllBindings();
  [...document.querySelectorAll('.slot')].forEach(s => s.classList.remove('active'));
  slotEl?.classList.add('active');
  state.selectedItem = { kind, index };
  renderInspector();
  highlightSelectedItemCells();
  refreshBackpackListSelection();
}

function hydrateBindingsWithin(root) {
  if (!state.data || !root) return;
  root.querySelectorAll('[data-bind]').forEach((el) => {
    const path = el.dataset.bind;
    const v = getByPath(state.data, path);
    if (el.classList.contains('spin')) {
      initSpin(el);
      el._spinSet(v ?? 0);
    } else if (el.tagName === 'SELECT') {
      el.value = String(Number(v ?? 0));
    } else if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number')) {
      el.value = (v ?? '');
    } else if (el.tagName === 'INPUT' && el.type === 'checkbox') {
      el.checked = !!v;
    }
  });
}

function renderInspector() {
  const sel = state.selectedItem;
  inspectorEls.forEach(el => { el.innerHTML = `<div class="muted">Select an item…</div>`; el.classList.add('muted'); });
  if (!state.data || !sel) return;
  const key = sel.kind;
  const arr = state.data[key];
  const item = arr?.[sel.index];
  const inspector = key === 'InvList' ? bpInspectorEl : equipInspectorEl;
  if (!item || !inspector) {
    return;
  }

  let posEditor = '';
  if (key === 'InvList') {
    const rect = getItemRect('InvList', sel.index, item.idx);
    const rx = rect?.x ?? 0;
    const ry = rect?.y ?? 0;
    const rw = rect?.w ?? (ITEM_SIZES[item.idx]?.[0] || DEFAULT_SIZE[0]);
    const rh = rect?.h ?? (ITEM_SIZES[item.idx]?.[1] || DEFAULT_SIZE[1]);
    posEditor = `
      <div class="card" style="margin-top:10px">
        <h3 style="margin:0 0 6px; color: var(--muted); font-size:13px;">Grid Placement (10×4)</h3>
        <div class="row">
          <div class="field small"><label>X (0-9)</label><input type="number" class="invRectX" min="0" max="9" value="${rx}"></div>
          <div class="field small"><label>Y (0-3)</label><input type="number" class="invRectY" min="0" max="3" value="${ry}"></div>
          <div class="field small"><label>W</label><input type="number" class="invRectW" min="1" max="10" value="${rw}"></div>
          <div class="field small"><label>H</label><input type="number" class="invRectH" min="1" max="4" value="${rh}"></div>
        </div>
        <div class="row right">
          <button class="btnAssignRect" type="button">Apply to Grid</button>
          <button class="btnClearRect" type="button">Clear</button>
        </div>
      </div>
    `;
  }

  inspector.classList.remove('muted');
  inspector.innerHTML = `
    <div class="row">
      <div class="field"><label>Item Index</label><input type="number" data-bind="${key}[${sel.index}].idx" min="0" max="65535" /></div>
      <div class="field"><label>Dur</label><div class="spin" data-bind="${key}[${sel.index}].bDur" data-min="0" data-max="255"></div></div>
      <div class="field"><label>Max Dur</label><div class="spin" data-bind="${key}[${sel.index}].bMDur" data-min="0" data-max="255"></div></div>
    </div>
    <div class="row">
      <div class="field"><label>Charges</label><div class="spin" data-bind="${key}[${sel.index}].bCh" data-min="0" data-max="255"></div></div>
      <div class="field"><label>Max Charges</label><div class="spin" data-bind="${key}[${sel.index}].bMCh" data-min="0" data-max="255"></div></div>
      <div class="field"><label>Value</label><div class="spin" data-bind="${key}[${sel.index}].wValue" data-min="0" data-max="65535"></div></div>
    </div>
    <div class="row">
      <div class="field"><label>Seed</label><div class="spin" data-bind="${key}[${sel.index}].iSeed" data-min="0" data-max="2147483647" data-step="17"></div></div>
      <div class="field"><label>Create Info</label><div class="spin" data-bind="${key}[${sel.index}].iCreateInfo" data-min="0" data-max="65535"></div></div>
      <div class="field"><label>Identified</label>
        <label class="toggle"><input type="checkbox" data-bind="${key}[${sel.index}].bId" data-type="bool" /> <span>Identified</span></label>
      </div>
    </div>
    ${posEditor}
  `;

  hydrateBindingsWithin(inspector);

  if (key === 'InvList') {
    const xEl = inspector.querySelector('.invRectX');
    const yEl = inspector.querySelector('.invRectY');
    const wEl = inspector.querySelector('.invRectW');
    const hEl = inspector.querySelector('.invRectH');

    const apply = () => {
      const x = Number(xEl.value||0), y = Number(yEl.value||0), w = Number(wEl.value||1), h = Number(hEl.value||1);
      setItemRect('InvList', sel.index, { x, y, w, h });
      buildBackpackList();
      refreshBackpackListSelection();
    };

    inspector.querySelector('.btnAssignRect')?.addEventListener('click', apply);
    inspector.querySelector('.btnClearRect')?.addEventListener('click', () => {
      clearItemRect('InvList', sel.index);
      buildBackpackList();
      refreshBackpackListSelection();
    });

    [xEl, yEl, wEl, hEl].forEach(el => el.addEventListener('input', () => {
      const x = Number(xEl.value||0), y = Number(yEl.value||0), w = Number(wEl.value||1), h = Number(hEl.value||1);
      const { x:cx, y:cy, w:cw, h:ch } = clampRect(x,y,w,h);
      [...invGridEl.children].forEach(c => c.classList.remove('sel'));
      for (let yy=0; yy<ch; yy++) for (let xx=0; xx<cw; xx++) {
        const idx = (cy+yy)*GRID_W + (cx+xx);
        invGridEl.children[idx]?.classList.add('sel');
      }
    }));
  }
}

function applyDataToUI() {
  if (!state.data) return;

  populateEnumSelect(document.querySelector('select[data-bind="pClass"]'), CLASSES_ALL);
  populateEnumSelect(document.querySelector('select[data-type="enum:difficulty"]'), DIFFICULTIES);

  document.querySelectorAll('[data-bind]').forEach((el) => {
    const path = el.dataset.bind;
    const v = getByPath(state.data, path);
    if (el.classList.contains('spin')) {
      initSpin(el); el._spinSet(v ?? 0);
    } else if (el.tagName === 'SELECT') {
      el.value = String(Number(v ?? 0));
    } else if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number')) {
      el.value = (v ?? '');
    } else if (el.tagName === 'INPUT' && el.type === 'checkbox') {
      el.checked = !!v;
    }
  });

  [...equippedSlotsEl.querySelectorAll('.slot')].forEach(slot => {
    const idx = Number(slot.dataset.index);
    const item = state.data.InvBody?.[idx];
    slot.querySelector('.v-idx').textContent = String(item?.idx ?? '—');
  });
  [...speedBarEl.querySelectorAll('.slot')].forEach(slot => {
    const idx = Number(slot.dataset.index);
    const item = state.data.SpdList?.[idx];
    slot.querySelector('.v-idx').textContent = String(item?.idx ?? '—');
  });

  for (let i = 0; i < GRID_W*GRID_H; i++) {
    const cell = invGridEl.children[i];
    if (!cell) break;
    const val = state.data.InvGrid?.[i] ?? 0;
    cell.textContent = String(val);
    cell.classList.toggle('on', !!val);
    cell.classList.remove('sel');
  }

  buildBackpackList();
  jsonArea.value = JSON.stringify(state.data, null, 2);
  enableDownload(true);
  highlightSelectedItemCells();
  refreshBackpackListSelection();
}

function collectUIToData() {
  recomputeInvGridFromMap();
  return deepClone(state.data);
}

tabs.forEach((btn, i) => {
  btn.addEventListener('click', () => {
    commitAllBindings();
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    panels[i].classList.remove('hidden');
  });
});

function startUI() {
  ready = true;
  buildSpells();
  buildEquipped();
  buildInvGrid();
  buildSpeedBar();
  document.querySelectorAll('.spin').forEach(initSpin);

  fetch('newbie.json')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(json => {
      state.data = json;
      state.dirty = false;
      resetUiGridMap();
      inferMapFromGridAndItems();
      applyDataToUI();
      setStatus('Default save loaded.');
    })
    .catch(() => setStatus('Engine loaded. Open a save to begin.'));
}
if (window.__d1_calledRun) startUI();
else window.addEventListener('d1:ready', startUI, { once: true });

fileInput.addEventListener('change', async (e) => {
  try {
    ensureReady();
    const file = e.target.files[0];
    if (!file) return;

    setStatus('Reading file…');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { flags, ext } = getSaveSettings();

    const uploadName = `upload${ext}`;
    FS.writeFile(uploadName, bytes);

    const outputName = 'output.json';
    runEditor([uploadName, outputName, ...flags]);

    const json = FS.readFile(outputName, { encoding: 'utf8' });
    state.data = JSON.parse(json);
    state.dirty = false;

    resetUiGridMap();
    inferMapFromGridAndItems();
    setStatus('Parsed to JSON. UI hydrated.');
    applyDataToUI();
    document.getElementById('tabbtn-backpack')?.click();
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`);
    enableDownload(false);
  }
});

downloadButton.addEventListener('click', () => {
  try {
    ensureReady();
    if (!state.data) { setStatus('Open a save first.'); return; }
    commitAllBindings();
    recomputeInvGridFromMap();

    const next = deepClone(state.data);
    const json = JSON.stringify(next, null, 2);

    const { flags, ext } = getSaveSettings();
    const inputName = 'input.json';
    FS.writeFile(inputName, json);

    const outputName = `output${ext}`;
    runEditor([outputName, inputName, '--create', ...flags]);

    const save = FS.readFile(outputName);
    const blob = new Blob([save], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `output${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    state.data = next; jsonArea.value = json; state.dirty = false;
    setStatus('Save generated and downloaded.');
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`);
  }
});

applyJsonBtn?.addEventListener('click', () => {
  try {
    const txt = jsonArea.value || '';
    if (!txt.trim()) { setStatus('JSON is empty.'); return; }
    const obj = JSON.parse(txt);
    state.data = obj;
    state.dirty = true;
    resetUiGridMap();
    inferMapFromGridAndItems();
    applyDataToUI();
    setStatus('JSON applied to UI.');
  } catch (err) {
    console.error(err);
    setStatus(`Invalid JSON: ${err.message}`);
  }
});

document.addEventListener('input',  (e) => commitFromEventTarget(e.target));
document.addEventListener('change', (e) => commitFromEventTarget(e.target));

function highlightSelectedItemCells() {
  [...invGridEl.children].forEach(c => c.classList.remove('assigned','sel'));
  if (!state.selectedItem || state.selectedItem.kind !== 'InvList') return;
  const idx = state.selectedItem.index;
  const item = state.data?.InvList?.[idx];
  if (!item) return;
  const rect = getItemRect('InvList', idx, item.idx);
  if (!rect) return;
  const { x, y, w, h } = rect;
  for (let yy=0; yy<h; yy++) for (let xx=0; xx<w; xx++) {
    const gx = x+xx, gy = y+yy;
    if (gx>=0 && gx<GRID_W && gy>=0 && gy<GRID_H) {
      invGridEl.children[gy*GRID_W + gx]?.classList.add('assigned');
    }
  }
}
