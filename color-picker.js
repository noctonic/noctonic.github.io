function rgbToHsb(r, g, b) {
  let nr = r / 255, ng = g / 255, nb = b / 255;
  let max = Math.max(nr, ng, nb);
  let min = Math.min(nr, ng, nb);
  let delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === nr) { h = ((ng - nb) / delta) % 6; }
    else if (max === ng) { h = ((nb - nr) / delta) + 2; }
    else { h = ((nr - ng) / delta) + 4; }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  let s = max === 0 ? 0 : (delta / max);
  let v = max;
  return { h: Math.round(h), s: Math.round(s * 100), b: Math.round(v * 100) };
}

function hsbToRgb(h, s, b) {
  let sat = s / 100, bri = b / 100;
  let c = bri * sat;
  let x = c * (1 - Math.abs((h / 60) % 2 - 1));
  let m = bri - c;
  let nr, ng, nb;
  if (0 <= h && h < 60) { nr = c; ng = x; nb = 0; }
  else if (60 <= h && h < 120) { nr = x; ng = c; nb = 0; }
  else if (120 <= h && h < 180) { nr = 0; ng = c; nb = x; }
  else if (180 <= h && h < 240) { nr = 0; ng = x; nb = c; }
  else if (240 <= h && h < 300) { nr = x; ng = 0; nb = c; }
  else { nr = c; ng = 0; nb = x; }
  return {
    r: Math.round((nr + m) * 255),
    g: Math.round((ng + m) * 255),
    b: Math.round((nb + m) * 255)
  };
}

function rgbToHex(r, g, b) {
  const hr = r.toString(16).padStart(2, "0");
  const hg = g.toString(16).padStart(2, "0");
  const hb = b.toString(16).padStart(2, "0");
  return "#" + hr + hg + hb;
}

function hexToRgb(hex) {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    let r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
    let g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
    let b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
    return { r, g, b };
  } else if (hex.length === 6) {
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function hsbToHex(h, s, b) {
  const rgbObj = hsbToRgb(h, s, b);
  return rgbToHex(rgbObj.r, rgbObj.g, rgbObj.b);
}

const hexInput = document.getElementById("hexInput");
const rRange = document.getElementById("rRange");
const gRange = document.getElementById("gRange");
const bRange = document.getElementById("bRange");
const rNumber = document.getElementById("rNumber");
const gNumber = document.getElementById("gNumber");
const bNumber = document.getElementById("bNumber");
const hRange = document.getElementById("hRange");
const sRange = document.getElementById("sRange");
const vRange = document.getElementById("vRange");
const hNumber = document.getElementById("hNumber");
const sNumber = document.getElementById("sNumber");
const vNumber = document.getElementById("vNumber");
const namedColors = document.getElementById("namedColors");
const colorSwatch = document.getElementById("currentColorContainer");
const saveColorButton = document.getElementById("saveColorButton");
const deleteColorButton = document.getElementById("deleteColorButton");
const savedColorsContainer = document.getElementById("savedColorsContainer");
const compContainer = document.getElementById("compContainer");
const analogContainer = document.getElementById("analogContainer");
const triadContainer = document.getElementById("triadContainer");
const distanceContainer = document.getElementById("distanceContainer");
const shadowContainer = document.getElementById("shadowContainer");
const spotlightContainer = document.getElementById("spotlightContainer");
const rainbowContainer = document.getElementById("rainbowContainer");

function clearSavedColorSelection() {
  document.querySelectorAll('.saved-color.selected')
    .forEach(box => box.classList.remove('selected'));
}

function lerp(a, b, factor) {
  return a + (b - a) * factor;
}

function lerpAngle(angle1, angle2, factor) {
  let diff = angle2 - angle1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  let result = angle1 + diff * factor;
  return (result + 360) % 360;
}

function getGradientColors(h, s, bri, targetH, targetS, targetB, steps) {
  const colors = [];
  for (let i = 0; i < steps; i++) {
    const factor = i / (steps - 1);
    const newH = lerpAngle(h, targetH, factor);
    const newS = lerp(s, targetS, factor);
    const newB = lerp(bri, targetB, factor);
    colors.push(hsbToHex(newH, newS, newB));
  }
  return colors;
}

function getRainbowColors(h, s, bri, steps) {
  const colors = [];
  const increment = 360 / steps;
  for (let i = 0; i < steps; i++) {
    const newHue = (h + i * increment) % 360;
    colors.push(hsbToHex(newHue, s, bri));
  }
  return colors;
}

function updateSwatch(r, g, b) {
  const hex = rgbToHex(r, g, b);
  const currentColorEl = document.getElementById("currentColorContainer");
  if (currentColorEl) {
    let swatch = currentColorEl.querySelector(".swatch");
    if (!swatch) {
      currentColorEl.innerHTML = "";
      swatch = document.createElement("div");
      swatch.className = "swatch";
      swatch.style.width = "30px";
      swatch.style.height = "30px";
      swatch.style.borderRadius = "2px";
      currentColorEl.appendChild(swatch);
    }
    swatch.style.backgroundColor = hex;
  }
}



function resetNamedColorsDropdown() {
  namedColors.value = "";
}

function syncFromRGB(r, g, b) {
  rRange.value = rNumber.value = r;
  gRange.value = gNumber.value = g;
  bRange.value = bNumber.value = b;
  const { h, s, b: bri } = rgbToHsb(r, g, b);
  hRange.value = hNumber.value = h;
  sRange.value = sNumber.value = s;
  vRange.value = vNumber.value = bri;
  hexInput.value = rgbToHex(r, g, b).slice(1);
  updateSwatch(r, g, b);
  updateExtras(h, s, bri);
}

function syncFromHSB(h, s, bri) {
  hRange.value = hNumber.value = h;
  sRange.value = sNumber.value = s;
  vRange.value = vNumber.value = bri;
  const rgb = hsbToRgb(h, s, bri);
  syncFromRGB(rgb.r, rgb.g, rgb.b);
}

function syncFromHex(hexStr) {
  const rgb = hexToRgb(hexStr);
  if (rgb) {
    syncFromRGB(rgb.r, rgb.g, rgb.b);
  }
}

namedColors.addEventListener("change", () => {
  if (namedColors.value) {
    clearSavedColorSelection();
    syncFromHex(namedColors.value);
  }
});

hexInput.addEventListener("input", () => {
  const val = hexInput.value.trim();
  if (val.length === 6 && /^[0-9A-Fa-f]{6}$/.test(val)) {
    resetNamedColorsDropdown();
    clearSavedColorSelection();
    syncFromHex(val);
  }
});

function updateRGB() {
  resetNamedColorsDropdown();
  clearSavedColorSelection();
  const r = parseInt(rNumber.value, 10) || 0;
  const g = parseInt(gNumber.value, 10) || 0;
  const b = parseInt(bNumber.value, 10) || 0;
  syncFromRGB(r, g, b);
}

rRange.addEventListener("input", () => { rNumber.value = rRange.value; updateRGB(); });
rNumber.addEventListener("input", () => { rRange.value = rNumber.value; updateRGB(); });
gRange.addEventListener("input", () => { gNumber.value = gRange.value; updateRGB(); });
gNumber.addEventListener("input", () => { gRange.value = gNumber.value; updateRGB(); });
bRange.addEventListener("input", () => { bNumber.value = bRange.value; updateRGB(); });
bNumber.addEventListener("input", () => { bRange.value = bNumber.value; updateRGB(); });

function updateHSB() {
  resetNamedColorsDropdown();
  clearSavedColorSelection();
  const h = parseInt(hNumber.value, 10) || 0;
  const s = parseInt(sNumber.value, 10) || 0;
  const bri = parseInt(vNumber.value, 10) || 0;
  syncFromHSB(h, s, bri);
}

hRange.addEventListener("input", () => { hNumber.value = hRange.value; updateHSB(); });
hNumber.addEventListener("input", () => { hRange.value = hNumber.value; updateHSB(); });
sRange.addEventListener("input", () => { sNumber.value = sRange.value; updateHSB(); });
sNumber.addEventListener("input", () => { sRange.value = sNumber.value; updateHSB(); });
vRange.addEventListener("input", () => { vNumber.value = vRange.value; updateHSB(); });
vNumber.addEventListener("input", () => { vRange.value = vNumber.value; updateHSB(); });

saveColorButton.addEventListener("click", () => {
  const currentHex = hexInput.value.trim();
  if (currentHex.length === 6 && /^[0-9A-Fa-f]{6}$/.test(currentHex)) {
    const savedBox = document.createElement("div");
    savedBox.className = "saved-color";
    savedBox.style.backgroundColor = "#" + currentHex;
    savedBox.addEventListener("click", () => {
      clearSavedColorSelection();
      savedBox.classList.add("selected");
      resetNamedColorsDropdown();
      syncFromHex(currentHex);
    });
    savedColorsContainer.appendChild(savedBox);
  }
});

deleteColorButton.addEventListener("click", () => {
  const selected = document.querySelector(".saved-color.selected");
  if (selected) { selected.remove(); }
});

function updateExtras(h, s, bri) {
  updateSchemesDistanceShadowSpotlight(h, s, bri);
}

function updateSchemesDistanceShadowSpotlight(h, s, bri) {
  const currentColorContainer = document.getElementById("currentColorContainer");
  if (currentColorContainer) {
    currentColorContainer.innerHTML = "";
    addSchemeSwatches([hsbToHex(h, s, bri)], currentColorContainer);
  }

  compContainer.innerHTML = "";
  analogContainer.innerHTML = "";
  triadContainer.innerHTML = "";
  distanceContainer.innerHTML = "";
  shadowContainer.innerHTML = "";
  spotlightContainer.innerHTML = "";
  rainbowContainer.innerHTML = "";
  
  const comp = getComplementary(h, s, bri);
  const analog = getAnalogous(h, s, bri);
  const triad = getTriadic(h, s, bri);
  
  addSchemeSwatches(comp, compContainer);
  addSchemeSwatches(analog, analogContainer);
  addSchemeSwatches(triad, triadContainer);
  
  const rainbow = getRainbowColors(h, s, bri, 8);
  addSchemeSwatches(rainbow, rainbowContainer);
  
  const distance = getFixedDistanceColors(h, s, bri);
  addSchemeSwatches(distance, distanceContainer);
  
  const shadow = getFixedShadowColors(h, s, bri);
  addSchemeSwatches(shadow, shadowContainer);
  
  const spotlight = getFixedSpotlightColors(h, s, bri);
  addSchemeSwatches(spotlight, spotlightContainer);
}

function addSchemeSwatches(hexArray, container) {
  Array.from(hexArray).forEach(hexStr => {
    const div = document.createElement("div");
    div.className = "scheme-swatch";
    div.style.backgroundColor = hexStr;
    div.title = hexStr;
    div.addEventListener("click", () => {
      clearSavedColorSelection();
      resetNamedColorsDropdown();
      syncFromHex(hexStr.slice(1));
    });
    container.appendChild(div);
  });
}

function getComplementary(h, s, bri) {
  const hComp = (h + 180) % 360;
  return [hsbToHex(h, s, bri), hsbToHex(hComp, s, bri)];
}

function getAnalogous(h, s, bri) {
  const h1 = h;
  const h2 = (h + 30) % 360;
  const h3 = (h - 30 + 360) % 360;
  return [hsbToHex(h1, s, bri), hsbToHex(h2, s, bri), hsbToHex(h3, s, bri)];
}

function getTriadic(h, s, bri) {
  const h2 = (h + 120) % 360;
  const h3 = (h + 240) % 360;
  return [hsbToHex(h, s, bri), hsbToHex(h2, s, bri), hsbToHex(h3, s, bri)];
}

function getFixedDistanceColors(h, s, bri) {
  const targetH = 210;
  const targetS = s * 0.01;
  const targetB = Math.min(100, bri + 15);
  return getGradientColors(h, s, bri, targetH, targetS, targetB, 8);
}

function getFixedShadowColors(h, s, bri) {
  const targetH = (h - 20 + 360) % 360;
  const targetS = s * 0.8;
  const targetB = Math.max(0, bri - 40);
  return getGradientColors(h, s, bri, targetH, targetS, targetB, 8);
}

function getFixedSpotlightColors(h, s, bri) {
  const targetH = (h + 20) % 360;
  const targetS = Math.min(100, s * 1.2);
  const targetB = Math.min(100, bri + 40);
  return getGradientColors(h, s, bri, targetH, targetS, targetB, 8);
}

function getRainbowColors(h, s, bri, steps) {
  const colors = [];
  const increment = 360 / steps;
  for (let i = 0; i < steps; i++) {
    const newHue = (h + i * increment) % 360;
    colors.push(hsbToHex(newHue, s, bri));
  }
  return colors;
}

function saveScheme(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  Array.from(container.children).forEach(swatch => {
    const hexStr = swatch.title;
    const savedBox = document.createElement("div");
    savedBox.className = "saved-color";
    savedBox.style.backgroundColor = hexStr;
    savedBox.title = hexStr;
    savedBox.addEventListener("click", () => {
      clearSavedColorSelection();
      savedBox.classList.add("selected");
      resetNamedColorsDropdown();
      syncFromHex(hexStr.slice(1));
    });
    savedColorsContainer.appendChild(savedBox);
  });
}

syncFromHex("9a17ff");

fetch("named-colors.json")
  .then(response => response.json())
  .then(data => {
    data.forEach(group => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.section;
      group.colors.forEach(color => {
        const option = document.createElement("option");
        option.value = color.value;
        option.textContent = color.name;
        optgroup.appendChild(option);
      });
      namedColors.appendChild(optgroup);
    });
  })
  .catch(error => console.error("Error loading named colors:", error));

document.getElementById("exportButton").addEventListener("click", () => {
  const squares = Array.from(savedColorsContainer.children).map(el => el.title || el.style.backgroundColor);
  const count = squares.length;
  const cols = 8;
  const rows = Math.ceil(count / cols);
  const squareSize = 30;
  const canvas = document.createElement("canvas");
  canvas.width = cols * squareSize;
  canvas.height = rows * squareSize;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * squareSize;
    const y = row * squareSize;
    if (i < count) {
      ctx.fillStyle = squares[i];
      ctx.fillRect(x, y, squareSize, squareSize);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, squareSize, squareSize);
    }
  }
  const dataURL = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = "saved_colors.png";
  a.click();
});
