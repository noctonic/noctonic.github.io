let tiles = Array(384).fill(null).map(() => {
  return Array(8).fill(null).map(() => Array(8).fill(0));
});

let  tilemap = Array.from({ length: 32 }, () =>
    Array(32).fill(0)
  );
let selectedTileIndex = 0;

const color0Select = document.getElementById("color0Select");
const color1Select = document.getElementById("color1Select");
const color2Select = document.getElementById("color2Select");
const color3Select = document.getElementById("color3Select");
const chrFileInput = document.getElementById("chrFileInput");
const tlmFileInput = document.getElementById("tlmFileInput");
const tilesetCanvas = document.getElementById("tilesetCanvas");
const tileEditorCanvas = document.getElementById("tileEditorCanvas");
const tilemapCanvas = document.getElementById("tilemapCanvas");
const tilesetCtx = tilesetCanvas.getContext("2d");
const tileEditorCtx = tileEditorCanvas.getContext("2d");
const tilemapCtx = tilemapCanvas.getContext("2d");
let addressingMode = "$8000";
const addressingModeSelect = document.getElementById("addressingModeSelect");

const gameBoyShades = ["#e8fccc", "#acd490", "#548c71", "#152C38"];
let palette = ["#e8fccc", "#acd490", "#548c71", "#152C38"];
let selectedPaletteIndex = 0;
const colorBoxElements = [
  document.getElementById("colorBox0"),
  document.getElementById("colorBox1"),
  document.getElementById("colorBox2"),
  document.getElementById("colorBox3")
];

function updateColorBoxes() {
  colorBoxElements.forEach((box, i) => {
    box.style.backgroundColor = palette[i];
  });
}
function updateShadeBoxes() {
  shadeBoxElements.forEach((shadeBox, i) => {
    const currentColor = palette[i];
    shadeBox.style.backgroundColor = currentColor;
    shadeBox.dataset.shade = currentColor;
  });
}
function highlightSelectedBox() {
  colorBoxElements.forEach((box, i) => {
    if (i === selectedPaletteIndex) {
      box.classList.add("selected");
    } else {
      box.classList.remove("selected");
    }
  });
}

const shadeBoxElements = document.querySelectorAll(".shade-box");
function highlightAssignedShade() {
  const currentShade = palette[selectedPaletteIndex];
  shadeBoxElements.forEach((shadeBox) => {
    shadeBox.style.backgroundColor = shadeBox.dataset.shade;
    if (shadeBox.dataset.shade === currentShade) {
      shadeBox.classList.add("selected");
    } else {
      shadeBox.classList.remove("selected");
    }
  });
}

colorBoxElements.forEach((box, i) => {
  box.addEventListener("click", () => {
    selectedPaletteIndex = i;
    highlightSelectedBox();
    highlightAssignedShade();
  });
});

shadeBoxElements.forEach((shadeBox) => {
  shadeBox.addEventListener("click", () => {
    const newShade = shadeBox.dataset.shade;
    palette[selectedPaletteIndex] = newShade;
    updateColorBoxes();

    highlightAssignedShade();
    renderTileset();
    renderTilemap();
  });
});

updateColorBoxes();
updateShadeBoxes(); 
highlightSelectedBox();
highlightAssignedShade();

const colorSchemes = {
  NiceGameboy: ["#e8fccc", "#acd490", "#548c71", "#152C38"],
  OGGameboy: ["#9bbc0f", "#8bac0f", "#306230", "#0f380f"],
  Grayscale: ["#ffffff", "#aaaaaa", "#555555", "#000000"],
  Red: ["#ffcccc", "#ff9999", "#ff6666", "#ff0000"],
  Blue: ["#ccccff", "#9999ff", "#6666ff", "#0000ff"]
};

const colorSchemeSelect = document.getElementById("colorSchemeSelect");

colorSchemeSelect.addEventListener("change", (event) => {
  const selectedScheme = event.target.value;
  palette = [...colorSchemes[selectedScheme]];

  updateColorBoxes();
  updateShadeBoxes();
  highlightSelectedBox();   
  highlightAssignedShade();
  initializeDrawColorPicker();
  renderTileEditor(0);
  renderTileset();
  renderTilemap();
});


chrFileInput.addEventListener("change", () => {
  if (chrFileInput.files.length === 0) return;
  const file = chrFileInput.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    const buffer = e.target.result;
    parseCHR(buffer);
    renderTileset();
    renderTilemap();
  };
  reader.readAsArrayBuffer(file);
});

function parseCHR(buffer) {
  const bytes = new Uint8Array(buffer);
  tiles = [];
  const tileCount = bytes.length / 16;
  for (let t = 0; t < tileCount; t++) {
    const tileStart = t * 16;
    const tilePixels = [];
    for (let row = 0; row < 8; row++) {
      const lowByte = bytes[tileStart + row * 2];
      const highByte = bytes[tileStart + row * 2 + 1];
      const rowPixels = [];
      for (let col = 0; col < 8; col++) {
        const bit0 = (lowByte >> (7 - col)) & 1;
        const bit1 = (highByte >> (7 - col)) & 1;
        const colorIndex = bit0 + (bit1 << 1);
        rowPixels.push(colorIndex);
      }
      tilePixels.push(rowPixels);
    }
    tiles.push(tilePixels);
  }
}

function renderTileset() {
  const tilesPerRow = 16;
  const tileSize = 8;
  const scale = 2;
  tilesetCtx.clearRect(0, 0, tilesetCanvas.width, tilesetCanvas.height);
  tiles.forEach((tilePixels, index) => {
    const xTile = index % tilesPerRow;
    const yTile = Math.floor(index / tilesPerRow);
    tilePixels.forEach((rowPixels, row) => {
      rowPixels.forEach((colorIndex, col) => {
        tilesetCtx.fillStyle = palette[colorIndex];
        tilesetCtx.fillRect(
          xTile * tileSize * scale + col * scale,
          yTile * tileSize * scale + row * scale,
          scale,
          scale
        );
      });
    });
  });
}

tilesetCanvas.addEventListener("click", (e) => {
  const rect = tilesetCanvas.getBoundingClientRect();
  const scaleX = tilesetCanvas.width / rect.width;
  const scaleY = tilesetCanvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;
  const tilesPerRow = 16;
  const tileSize = 8;
  const scale = 2;
  const tileX = Math.floor(mouseX / (tileSize * scale));
  const tileY = Math.floor(mouseY / (tileSize * scale));
  selectedTileIndex = tileY * tilesPerRow + tileX;
  renderTileEditor(selectedTileIndex);
});

function renderTileEditor(tileIndex) {
  tileEditorCtx.clearRect(0, 0, tileEditorCanvas.width, tileEditorCanvas.height);
  const tilePixels = tiles[tileIndex];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const colorIndex = tilePixels[row][col];
      tileEditorCtx.fillStyle = palette[colorIndex];
      tileEditorCtx.fillRect(col, row, 1, 1);
    }
  }
}

function initializeDrawColorPicker() {
  const drawColorBoxes = document.querySelectorAll(".draw-color-box");
  drawColorBoxes.forEach((box) => {
    const colorIndex = parseInt(box.dataset.colorindex, 10);
    box.style.backgroundColor = palette[colorIndex];
    if (colorIndex === currentDrawColorIndex) {
      box.classList.add("selected");
    } else {
      box.classList.remove("selected");
    }
    box.addEventListener("click", () => {
      currentDrawColorIndex = colorIndex;
      drawColorBoxes.forEach((b) => b.classList.remove("selected"));
      box.classList.add("selected");
    });
  });
}

let currentDrawColorIndex = 3;

tileEditorCanvas.addEventListener("click", (e) => {
  const rect = tileEditorCanvas.getBoundingClientRect();
  const scaleX = tileEditorCanvas.width / rect.width;
  const scaleY = tileEditorCanvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;
  const col = Math.floor(mouseX);
  const row = Math.floor(mouseY);
  tiles[selectedTileIndex][row][col] = currentDrawColorIndex;
  renderTileEditor(selectedTileIndex);
});

initializeDrawColorPicker();
let isMouseDown = false;

tileEditorCanvas.addEventListener("mousedown", (e) => {
  isMouseDown = true;
  paintPixel(e);
});

tileEditorCanvas.addEventListener("mousemove", (e) => {
  if (isMouseDown) {
    paintPixel(e);
  }
});

tileEditorCanvas.addEventListener("mouseup", () => {
  isMouseDown = false;
});

tileEditorCanvas.addEventListener("mouseleave", () => {
  isMouseDown = false;
});

function paintPixel(e) {
  const rect = tileEditorCanvas.getBoundingClientRect();
  const scaleX = tileEditorCanvas.width / rect.width;
  const scaleY = tileEditorCanvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;
  const col = Math.floor(mouseX);
  const row = Math.floor(mouseY);
  tiles[selectedTileIndex][row][col] = currentDrawColorIndex;
  renderTileEditor(selectedTileIndex);
  renderTileset();
  renderTilemap();
}

tlmFileInput.addEventListener("change", () => {
  if (tlmFileInput.files.length === 0) return;
  const file = tlmFileInput.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    const buffer = e.target.result;
    parseTLM(buffer);
    renderTilemap();
  };
  reader.readAsArrayBuffer(file);
});

function parseTLM(buffer) {
  const bytes = new Uint8Array(buffer);
  const tilemapWidth = 32;
  const tilemapHeight = 32;
  tilemap = [];
  let idx = 0;
  for (let y = 0; y < tilemapHeight; y++) {
    const row = [];
    for (let x = 0; x < tilemapWidth; x++) {
      row.push(bytes[idx]);
      idx++;
    }
    tilemap.push(row);
  }
}

function renderTilemap() {
  if (!tilemap || tilemap.length === 0) {
    console.warn("No tilemap data to render.");
    return;
  }
  tilemapCtx.clearRect(0, 0, tilemapCanvas.width, tilemapCanvas.height);
  const tileSize = 8;
  const scale = 2;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const mapByte = tilemap[y][x];
      const tileIndex = convertTileIndex(mapByte);
      if (tiles[tileIndex]) {
        drawTile(tilemapCtx, tiles[tileIndex], x, y, palette);
      }
    }
  }
}

function drawTile(ctx, tilePixels, mapX, mapY, palette) {
  const tileSize = 8;
  const scale = 2;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const colorIndex = tilePixels[row][col];
      ctx.fillStyle = palette[colorIndex];
      ctx.fillRect(
        mapX * tileSize * scale + col * scale,
        mapY * tileSize * scale + row * scale,
        scale,
        scale
      );
    }
  }
}

addressingModeSelect.addEventListener("change", () => {
  addressingMode = addressingModeSelect.value;
  renderTilemap();
});

function convertTileIndex(mapByte) {
  if (addressingMode === "$8000") {
    return mapByte;
  } else if (addressingMode === "$8800") {
    if (mapByte < 128) {
      return mapByte + 256;
    } else {
      return mapByte;
    }
  }
  return mapByte;
}

tilemapCanvas.addEventListener("click", (e) => {
  const rect = tilemapCanvas.getBoundingClientRect();
  const scaleX = tilemapCanvas.width / rect.width;
  const scaleY = tilemapCanvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;
  const tileSize = 8;
  const scale = 2;
  const col = Math.floor(mouseX / (tileSize * scale));
  const row = Math.floor(mouseY / (tileSize * scale));
  if (row < tilemap.length && col < tilemap[row].length) {
    tilemap[row][col] = selectedTileIndex;
    renderTilemap();
  }
});

function encodeCHR() {
  const tileCount = tiles.length;
  const out = new Uint8Array(tileCount * 16);
  for (let t = 0; t < tileCount; t++) {
    for (let row = 0; row < 8; row++) {
      let lowByte = 0;
      let highByte = 0;
      for (let col = 0; col < 8; col++) {
        const colorIndex = tiles[t][row][col];
        const bit0 = colorIndex & 1;
        const bit1 = (colorIndex >> 1) & 1;
        lowByte |= (bit0 << (7 - col));
        highByte |= (bit1 << (7 - col));
      }
      out[t * 16 + row * 2] = lowByte;
      out[t * 16 + row * 2 + 1] = highByte;
    }
  }
  return out;
}

document.getElementById("downloadTilesetBtn").addEventListener("click", () => {
  const encoded = encodeCHR();
  const blob = new Blob([encoded], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "edited_tileset.chr";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

function encodeTLM() {
  const tilemapHeight = tilemap.length;
  const tilemapWidth = tilemap[0].length;
  const out = new Uint8Array(tilemapWidth * tilemapHeight);
  let idx = 0;
  for (let y = 0; y < tilemapHeight; y++) {
    for (let x = 0; x < tilemapWidth; x++) {
      out[idx++] = tilemap[y][x];
    }
  }
  return out;
}

document.getElementById("downloadTilemapBtn").addEventListener("click", () => {
  const encoded = encodeTLM();
  const blob = new Blob([encoded], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "edited_tilemap.tlm";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

renderTileset();
renderTilemap();
renderTileEditor(0);
