
const useCustomQuant     = document.getElementById("useCustomQuant");
const standardQuantDiv   = document.getElementById("standardQuantDiv");
const customQuantDiv     = document.getElementById("customQuantDiv");

const qualityRange       = document.getElementById("qualityRange");
const qVal               = document.getElementById("qVal");
const subsamplingSelect  = document.getElementById("subsamplingSelect");
const outputImage        = document.getElementById("outputImage");
const statsParagraph     = document.getElementById("stats");
const feedbackButton     = document.getElementById("feedbackButton");
const imgFileInput       = document.getElementById("imgFileInput");
const originalImage      = document.getElementById("originalImage");
const canvas             = document.getElementById("canvas");
const ctx                = canvas.getContext("2d", { willReadFrequently: true });

let loadedImageData = null;
let inputImageBytes = 0;

let globalEncoder = null;

const defaultBase64 = 
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAAXNSR0IArs4c6QAAAMZlWElmTU0AKgAAAAgABgESAAMAAAABAAEAAAEaAAUAAAABAAAAVgEbAAUAAAABAAAAXgEoAAMAAAABAAIAAAExAAIAAAAWAAAAZodpAAQAAAABAAAAfAAAAAAAAAEsAAAAAQAAASwAAAABUGl4ZWxtYXRvciBQcm8gMy42LjE0AAAEkAQAAgAAABQAAACyoAEAAwAAAAEAAQAAoAIABAAAAAEAAAAQoAMABAAAAAEAAAAQAAAAADIwMjU6MDQ6MDYgMTM6NTE6MzEAaUX6OwAAAAlwSFlzAAAuIwAALiMBeKU/dgAAA7NpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDYuMC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIgogICAgICAgICAgICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iPgogICAgICAgICA8dGlmZjpZUmVzb2x1dGlvbj4zMDAwMDAwLzEwMDAwPC90aWZmOllSZXNvbHV0aW9uPgogICAgICAgICA8dGlmZjpYUmVzb2x1dGlvbj4zMDAwMDAwLzEwMDAwPC90aWZmOkxSZXNvbHV0aW9uPgogICAgICAgICA8dGlmZjpSZXNvbHV0aW9uVW5pdD4yPC90aWZmOlJlc29sdXRpb25Vbml0PgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICAgICA8ZXhpZjpQaXhlbFlEaW1lbnNpb24+MTY8L2V4aWY6UGl4ZWxZRGltZW5zaW9uPgogICAgICAgICA8ZXhpZjpQaXhlbFhEaW1lbnNpb24+MTY8L2V4aWY6UGl4ZWxYRGltZW5zaW9uPgogICAgICAgICA8eG1wOk1ldGFkYXRhRGF0ZT4yMDI1LTA0LTA2VDEzOjUyOjQ1LTA0OjAwPC94bXA6TWV0YWRhdGFEYXRlPgogICAgICAgICA8eG1wOkNyZWF0ZURhdGU+MjAyNS0wNC0wNlQxMzo1MTozMS0wNDowMDwveG1wOkNyZWF0ZURhdGU+CiAgICAgICAgIDx4bXA6Q3JlYXRvclRvb2w+UGl4ZWxtYXRvciBQcm8gMy42LjE0PC94bXA6Q3JlYXRvclRvb2w+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgqD4F+JAAAAYUlEQVQoFWNU5H3LQApgIkUxSC3tNbDAnXRGTAHCNnn1AI8gyU5iHDShBPchwg9wIbiPsTIQGrBKQwSBZsGDDhGsQCGIJXA5rHZiCSW4OrhOZMuxaECWxmQT5QdkbSRrAABKlRiRQBRSQAAAAABJRU5ErkJggg==";

function decodeBase64Size(b64) {
  const idx = b64.indexOf("base64,");
  let raw = (idx >= 0) ? b64.substring(idx + 7) : b64;
  return atob(raw).length;
}

const BASE_Y_QT = [
  16, 11, 10, 16, 24, 40, 51, 61,
  12, 12, 14, 19, 26, 58, 60, 55,
  14, 13, 16, 24, 40, 57, 69, 56,
  14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68,109,103, 77,
  24, 35, 55, 64, 81,104,113, 92,
  49, 64, 78, 87,103,121,120,101,
  72, 92, 95, 98,112,100,103, 99
];
const BASE_UV_QT = [
  17, 18, 24, 47, 99, 99, 99, 99,
  18, 21, 26, 66, 99, 99, 99, 99,
  24, 26, 56, 99, 99, 99, 99, 99,
  47, 66, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99
];

function computeQuantTable(baseTable, quality) {
  if (quality < 1) quality = 1;
  if (quality > 100) quality = 100;
  let sf;
  if (quality < 50) {
    sf = Math.floor(5000 / quality);
  } else {
    sf = Math.floor(200 - quality * 2);
  }
  const scaled = new Array(64);
  for (let i = 0; i < 64; i++) {
    let t = Math.floor((baseTable[i] * sf + 50) / 100);
    if (t < 1)   t = 1;
    if (t > 255) t = 255;
    scaled[i] = t;
  }
  return scaled;
}

function renderQuantGrid(baseTable, quality, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const values = computeQuantTable(baseTable, quality);

  for (let i = 0; i < 64; i++) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "255";
    input.value = values[i];
    input.className = "quant-cell-input";
    input.readOnly = true;
    container.appendChild(input);
  }
}

function updateDefaultTables(quality) {
  renderQuantGrid(BASE_Y_QT,  quality, "yQuantGrid");
  renderQuantGrid(BASE_UV_QT, quality, "uvQuantGrid");
}

function extractYUVPlanes(rgbaData, width, height, subsampling) {
  let cw = width, ch = height;
  if (subsampling === '4:2:2') {
    cw = width >> 1;
    ch = height;
  } else if (subsampling === '4:2:0') {
    cw = width >> 1;
    ch = height >> 1;
  }
  const Y  = new Uint8Array(width * height);
  const Cb = new Uint8Array(cw * ch);
  const Cr = new Uint8Array(cw * ch);
  const stride = width * 4;

  const clamp = (val, low, high) => val < low ? low : (val > high ? high : val);

  for (let yPos = 0; yPos < height; yPos++) {
    for (let xPos = 0; xPos < width; xPos++) {
      const idx = yPos * stride + (xPos << 2);
      const r = rgbaData[idx + 0];
      const g = rgbaData[idx + 1];
      const b = rgbaData[idx + 2];
      let yVal = (19595 * r + 38470 * g + 7471 * b + 32768) >> 16;
      yVal = clamp(yVal, 0, 255);
      Y[yPos * width + xPos] = yVal;
    }
  }

  if (subsampling === '4:4:4') {
    for (let yPos = 0; yPos < height; yPos++) {
      for (let xPos = 0; xPos < width; xPos++) {
        const idx = yPos * stride + (xPos << 2);
        const r = rgbaData[idx + 0];
        const g = rgbaData[idx + 1];
        const b = rgbaData[idx + 2];
        let tmpCb = ((-11059 * r - 21709 * g + 32768 * b + 8421375) >> 16);
        let tmpCr = ((32768 * r - 27439 * g - 5329  * b + 8421375) >> 16);
        tmpCb = clamp(tmpCb + 128, 0, 255);
        tmpCr = clamp(tmpCr + 128, 0, 255);
        const planeIdx = yPos * width + xPos;
        Cb[planeIdx] = tmpCb;
        Cr[planeIdx] = tmpCr;
      }
    }
  } 
  else if (subsampling === '4:2:2') {
    for (let yPos = 0; yPos < height; yPos++) {
      for (let xPos = 0; xPos < width; xPos += 2) {
        let sumCb = 0, sumCr = 0;
        for (let i = 0; i < 2; i++) {
          const realX = xPos + i;
          if (realX >= width) break;
          const idx = yPos * stride + (realX << 2);
          const r = rgbaData[idx + 0];
          const g = rgbaData[idx + 1];
          const b = rgbaData[idx + 2];
          sumCb += ((-11059 * r - 21709 * g + 32768 * b + 8421375) >> 16);
          sumCr += ((32768 * r - 27439 * g - 5329  * b + 8421375) >> 16);
        }
        let cB = clamp((sumCb / 2) + 128, 0, 255);
        let cR = clamp((sumCr / 2) + 128, 0, 255);
        const outX = xPos >> 1;
        const planeIdx = yPos * (width >> 1) + outX;
        Cb[planeIdx] = cB;
        Cr[planeIdx] = cR;
      }
    }
  } 
  else {
    for (let yPos = 0; yPos < height; yPos += 2) {
      for (let xPos = 0; xPos < width; xPos += 2) {
        let sumCb = 0, sumCr = 0;
        for (let yy = 0; yy < 2; yy++) {
          for (let xx = 0; xx < 2; xx++) {
            const realX = xPos + xx;
            const realY = yPos + yy;
            if (realX >= width || realY >= height) continue;
            const idx = realY * stride + (realX << 2);
            const r = rgbaData[idx + 0];
            const g = rgbaData[idx + 1];
            const b = rgbaData[idx + 2];
            sumCb += ((-11059 * r - 21709 * g + 32768 * b + 8421375) >> 16);
            sumCr += ((32768 * r - 27439 * g - 5329  * b + 8421375) >> 16);
          }
        }
        let cB = clamp((sumCb / 4) + 128, 0, 255);
        let cR = clamp((sumCr / 4) + 128, 0, 255);
        const outX = xPos >> 1;
        const outY = yPos >> 1;
        const planeIdx = outY * (width >> 1) + outX;
        Cb[planeIdx] = cB;
        Cr[planeIdx] = cR;
      }
    }
  }

  return { Y, Cb, Cr };
}

function drawPlaneGrayscale(plane, planeWidth, planeHeight, canvasElem) {
  canvasElem.width  = planeWidth;
  canvasElem.height = planeHeight;
  const ctx2 = canvasElem.getContext("2d", { willReadFrequently: true });
  const imageData = ctx2.createImageData(planeWidth, planeHeight);
  let out = imageData.data;
  for (let i = 0; i < planeWidth * planeHeight; i++) {
    const val = plane[i];
    const idx = i * 4;
    out[idx + 0] = val;
    out[idx + 1] = val;
    out[idx + 2] = val;
    out[idx + 3] = 255;
  }
  ctx2.putImageData(imageData, 0, 0);
}

function updatePlanesPreview() {
  if (!loadedImageData) return;
  const subsamplingMode = subsamplingSelect.value;
  const { data, width, height } = loadedImageData;
  const { Y, Cb, Cr } = extractYUVPlanes(data, width, height, subsamplingMode);
  
  drawPlaneGrayscale(Y,  width, height, canvasY);

  let cw = width, ch = height;
  if (subsamplingMode === '4:2:2') {
    cw = width >> 1;
    ch = height;
  } else if (subsamplingMode === '4:2:0') {
    cw = width >> 1;
    ch = height >> 1;
  }
  drawPlaneGrayscale(Cb, cw, ch, canvasCb);
  drawPlaneGrayscale(Cr, cw, ch, canvasCr);

  updateEncodedImage();
}

function toggleQuantizationUI() {
  const isCustom = useCustomQuant.checked;
  standardQuantDiv.style.display = isCustom ? "none" : "block";
  customQuantDiv.style.display   = isCustom ? "block" : "none";
}

async function updateEncodedImage() {
  if (!loadedImageData || !globalEncoder) return;
  
  const isCustom = useCustomQuant.checked;
  const subsamplingMode = subsamplingSelect.value;

  let yTable, uvTable;
  if (isCustom) {
    yTable  = window.getCustomYTable();
    uvTable = window.getCustomUVTable();
  } else {
    const quality = parseInt(qualityRange.value, 10);
    yTable  = computeQuantTable(BASE_Y_QT,  quality);
    uvTable = computeQuantTable(BASE_UV_QT, quality);
  }

  const encodedBuffer = globalEncoder.reEncode(yTable, uvTable, subsamplingMode);
  lastEncodedBuffer = encodedBuffer;

  const blob = new Blob([encodedBuffer], { type: "image/jpeg" });

  const imageBitmap = await createImageBitmap(blob);

  const outputImage = document.getElementById('outputImage');
  outputImage.width = imageBitmap.width;
  outputImage.height = imageBitmap.height;
  const ctx = outputImage.getContext('2d');
  ctx.drawImage(imageBitmap, 0, 0);

  imageBitmap.close();

  const outputSize = encodedBuffer.length;
  if (outputSize > 0) {
    const ratio = (inputImageBytes / outputSize).toFixed(2);
    statsParagraph.textContent = 
      `Input: ${inputImageBytes} bytes, Output: ${outputSize} bytes, Ratio: ${ratio}:1`;
  } else {
    statsParagraph.textContent = 
      `Input: ${inputImageBytes} bytes, Output: 0 bytes, Ratio: -`;
  }
}

function loadImageFromSrc(src) {
  const img = new Image();
  img.onload = () => {
    originalImage.src = src;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const raw = ctx.getImageData(0, 0, canvas.width, canvas.height);
    loadedImageData = {
      data:   raw.data,
      width:  raw.width,
      height: raw.height
    };

    globalEncoder = new window["jpeg-js"].JPEGEncoder();
    globalEncoder.initialEncode({
      data:   loadedImageData.data,
      width:  loadedImageData.width,
      height: loadedImageData.height
    });

    updatePlanesPreview();
  };
  img.src = src;
}

imgFileInput.addEventListener("change", () => {
  const file = imgFileInput.files[0];
  if (!file) return;
  inputImageBytes = file.size;
  const reader = new FileReader();
  reader.onload = () => {
    loadImageFromSrc(reader.result);
  };
  reader.readAsDataURL(file);
});

useCustomQuant.addEventListener("change", () => {
  toggleQuantizationUI();
});

subsamplingSelect.addEventListener("change", updatePlanesPreview);

qualityRange.addEventListener("input", () => {
  const q = parseInt(qualityRange.value, 10);
  qVal.textContent = q;
  updateDefaultTables(q);
  updateEncodedImage();
});

document.addEventListener("DOMContentLoaded", () => {
  inputImageBytes = decodeBase64Size(defaultBase64);
  loadImageFromSrc(defaultBase64);
  updateDefaultTables(50);
  toggleQuantizationUI();
});


feedbackButton.addEventListener("click", () => {
  if (!lastEncodedBuffer) {
    alert("No encoded JPEG in memory yet.");
    return;
  }
  const blob = new Blob([lastEncodedBuffer], { type: "image/jpeg" });
  const reader = new FileReader();
  reader.onload = () => {
    inputImageBytes = lastEncodedBuffer.length;
    loadImageFromSrc(reader.result);
  };
  reader.readAsDataURL(blob);
});