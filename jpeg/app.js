(function () {
  let loadedImageData   = null;
  let DOWNLOAD_BLOB
  const SIZE = 8;
  const MODE_SELECT_ID = "quantModeSelect";
  const SLIDER_IDS = ["A", "B", "C", "D"];
  const useCustomQuant = document.getElementById("useCustomQuant");
  const defaultControls = document.getElementById("defaultControls");
  const customQuantDiv = document.getElementById("customQuantDiv");
  const statsParagraph    = document.getElementById("stats");
  const qualityRange = document.getElementById("qualityRange");
  const qVal = document.getElementById("qVal");
  const feedbackButton    = document.getElementById("feedbackButton");
  const ctx  = canvas.getContext("2d", { willReadFrequently: true });
  const downloadBtn = document.getElementById("downloadButton");
  const modes = [
    { value: "gradient", label: "Gradient" },
    { value: "random", label: "Random" },
    { value: "checkerboard", label: "Checkerboard" },
    { value: "stripes", label: "Stripes" },
  ];
    const defaultBase64 = 
      "data:image/png;base64,[REDACTED]"
      function decodeBase64Size(b64) {
      const idx = b64.indexOf("base64,");
      let raw = (idx >= 0) ? b64.substring(idx + 7) : b64;
      return atob(raw).length;
    }

  const labelTemplates = {
    gradient: ["Y Grad Start (A):", "Y Grad End (B):", "UV Grad Start (C):", "UV Grad End (D):"],
    random: ["Y Random Min (A):", "Y Random Max (B):", "UV Random Min (C):", "UV Random Max (D):"],
    checkerboard: ["Checker A (Y):", "Checker B (Y):", "Checker A (UV):", "Checker B (UV):"],
    stripes: ["Stripe Val 1 (Y):", "Stripe Val 2 (Y):", "Stripe Val 1 (UV):", "Stripe Val 2 (UV):"],
    manual: ["Slider A (Y):", "Slider B (Y):", "Slider C (UV):", "Slider D (UV):"]
  };

  let yInputs = [], uvInputs = [];
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

  document.addEventListener("DOMContentLoaded", () => {
    const modeSelect = id(MODE_SELECT_ID);
    const sliders = SLIDER_IDS.map(id => idGroup("slider" + id));
    const labels = SLIDER_IDS.map(id => idGroup("slider" + id + "Label"));
    const yGridElem = id("quantGridLum");
    const uvGridElem = id("quantGridChrom");
    const button = id("customQuantButton");
    populateModeSelect(modeSelect);
    createQuantGrid(yGridElem, yInputs);
    createQuantGrid(uvGridElem, uvInputs);

    const updateSliderVals = () =>
      sliders.forEach(([input, valSpan]) => (valSpan.textContent = input.value));

    const applyAndUpdate = () => {
      applyMode(modeSelect.value, sliders.map(([s]) => parseInt(s.value)));
      updateEncodedImage();
    };

    modeSelect.addEventListener("change", () => {
      updateSliderLabels(modeSelect.value, labels);
      applyAndUpdate();
    });

    sliders.forEach(([slider]) => {
      slider.addEventListener("input", () => {
        updateSliderVals();
        if (modeSelect.value !== "manual") applyAndUpdate();
      });
    });

    button.addEventListener("click", applyAndUpdate);

    qualityRange.addEventListener("input", () => {
      qVal.textContent = qualityRange.value;
      updateSharedQuantGrids();
      updateEncodedImage();
    });

    useCustomQuant.addEventListener("change", () => {
      toggleQuantizationUI();
      updateEncodedImage();
    });

    updateSliderLabels(modeSelect.value, labels);
    updateSliderVals();
    applyMode(modeSelect.value, sliders.map(([s]) => parseInt(s.value)));
    inputImageBytes = decodeBase64Size(defaultBase64);
    loadImageFromSrc(defaultBase64);
  });
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

  downloadBtn.addEventListener("click", () => {
    if (!DOWNLOAD_BLOB) {
      alert("No encoded JPEG available yet!");
      return;
    }
    const url = URL.createObjectURL(DOWNLOAD_BLOB);

    const tempLink = document.createElement("a");
    tempLink.href = url;
    tempLink.download = "my-output.jpg";
    document.body.appendChild(tempLink);
    tempLink.click();
    document.body.removeChild(tempLink);
    URL.revokeObjectURL(url);
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
  function id(id) {
    return document.getElementById(id);
  }

  function idGroup(baseId) {
    return [id(baseId), id(baseId + "Val")];
  }

  function toggleQuantizationUI() {
    const isCustom = useCustomQuant.checked;
    defaultControls.style.display = isCustom ? "none" : "block";
    customQuantDiv.style.display = isCustom ? "block" : "none";
    updateSharedQuantGrids();
  }

  function updateSharedQuantGrids() {
    const isCustom = useCustomQuant.checked;
    const yTable = isCustom ? window.getCustomYTable() : computeQuantTable(BASE_Y_QT, parseInt(qualityRange.value, 10));
    const uvTable = isCustom ? window.getCustomUVTable() : computeQuantTable(BASE_UV_QT, parseInt(qualityRange.value, 10));
    renderDirectQuantGrid(yTable, "quantGridLum");
    renderDirectQuantGrid(uvTable, "quantGridChrom");
  }

  function populateModeSelect(select) {
    select.innerHTML = "";
    modes.forEach(({ value, label }) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      select.appendChild(opt);
    });
  }

  function updateSliderLabels(mode, labels) {
    const template = labelTemplates[mode] || labelTemplates.manual;
    labels.forEach((label, i) => (label.textContent = template[i]));
  }

  function computeQuantTable(baseTable, quality) {
    if (quality < 1) quality = 1;
    if (quality > 100) quality = 100;
    let sf = quality < 50 ? Math.floor(5000 / quality) : Math.floor(200 - quality * 2);
    return baseTable.map(val => clamp(Math.floor((val * sf + 50) / 100)));
  }

  function renderDirectQuantGrid(values, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    values.forEach(val => {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = "255";
      input.value = val;
      input.className = "quant-cell-input";
      input.readOnly = true;
      container.appendChild(input);
    });
  }

  function createQuantGrid(container, inputsArray) {
    if (!container) return;
    container.innerHTML = "";
    inputsArray.length = 0;
    for (let i = 0; i < SIZE * SIZE; i++) {
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.max = "255";
      input.value = 128;
      input.className = "quant-cell-input";
      input.readOnly = true;
      container.appendChild(input);
      inputsArray.push(input);
    }
  }

  function applyMode(mode, [a, b, c, d]) {
    const fillMap = {
      gradient: fillGradient,
      random: fillRandom,
      checkerboard: fillCheckerboard,
      stripes: fillStripes
    };
    const filler = fillMap[mode];
    if (filler) {
      filler(yInputs, SIZE, a, b);
      filler(uvInputs, SIZE, c, d);
    }
    updateSharedQuantGrids();
  }

  function fillGradient(inputs, size, minVal, maxVal) {
    inputs.forEach((_, idx) => {
      const row = Math.floor(idx / size);
      const col = idx % size;
      const frac = 0.5 * (row / (size - 1) + col / (size - 1));
      inputs[idx].value = clamp(minVal + frac * (maxVal - minVal));
    });
  }

  function fillRandom(inputs, size, minVal, maxVal) {
    inputs.forEach((_, i) => {
      inputs[i].value = clamp(Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal);
    });
  }

  function fillCheckerboard(inputs, size, val1, val2) {
    inputs.forEach((_, i) => {
      const row = Math.floor(i / size);
      const col = i % size;
      inputs[i].value = (row + col) % 2 === 0 ? clamp(val1) : clamp(val2);
    });
  }

  function fillStripes(inputs, size, val1, val2) {
    inputs.forEach((_, i) => {
      const row = Math.floor(i / size);
      inputs[i].value = row % 2 === 0 ? clamp(val1) : clamp(val2);
    });
  }

  function clamp(v) {
    return Math.max(1, Math.min(255, Math.round(v)));
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
      yTable  = computeQuantTable(BASE_Y_QT, quality);
      uvTable = computeQuantTable(BASE_UV_QT, quality);
    }
    const encodedBuffer = globalEncoder.reEncode(yTable, uvTable, subsamplingMode);
    lastEncodedBuffer = encodedBuffer;
    const blob = new Blob([encodedBuffer], { type: "image/jpeg" });
    DOWNLOAD_BLOB = blob;
    const imageBitmap = await createImageBitmap(blob);
    outputImage.width = imageBitmap.width;
    outputImage.height = imageBitmap.height;
    const ctxOutput = outputImage.getContext('2d');
    ctxOutput.drawImage(imageBitmap, 0, 0);
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
      updateEncodedImage();
    };
    img.src = src;
  }

  window.getCustomYTable = () => yInputs.map(i => parseInt(i.value, 10));
  window.getCustomUVTable = () => uvInputs.map(i => parseInt(i.value, 10));
})();
