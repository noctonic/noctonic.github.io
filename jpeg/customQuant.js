(function(){
  const MODE_SELECT_ID    = "quantModeSelect";
  const SLIDER_A_ID       = "sliderA";
  const SLIDER_B_ID       = "sliderB";
  const SLIDER_C_ID       = "sliderC";
  const SLIDER_D_ID       = "sliderD";

  const SLIDER_A_VAL_ID   = "sliderAVal";
  const SLIDER_B_VAL_ID   = "sliderBVal";
  const SLIDER_C_VAL_ID   = "sliderCVal";
  const SLIDER_D_VAL_ID   = "sliderDVal";

  const SLIDER_A_LABEL    = "sliderALabel";
  const SLIDER_B_LABEL    = "sliderBLabel";
  const SLIDER_C_LABEL    = "sliderCLabel";
  const SLIDER_D_LABEL    = "sliderDLabel";

  const BUTTON_ID         = "customQuantButton";

  const Y_GRID_ID         = "customYQuantGrid";
  const UV_GRID_ID        = "customUVQuantGrid";

  const SIZE = 8;

  let modeSelect, sliderA, sliderB, sliderC, sliderD;
  let sliderAVal, sliderBVal, sliderCVal, sliderDVal;
  let sliderALabel, sliderBLabel, sliderCLabel, sliderDLabel;
  let customQuantButton;
  let yGridElem, uvGridElem;

  let yInputs = [];
  let uvInputs = [];

  const modes = [
    { value: "gradient",     label: "Gradient" },
    { value: "random",       label: "Random"   },
    { value: "checkerboard", label: "Checkerboard" },
    { value: "stripes",      label: "Stripes"  },
    { value: "manual",       label: "Manual"   }
  ];

  document.addEventListener("DOMContentLoaded", function(){
    modeSelect       = document.getElementById(MODE_SELECT_ID);

    sliderA          = document.getElementById(SLIDER_A_ID);
    sliderB          = document.getElementById(SLIDER_B_ID);
    sliderC          = document.getElementById(SLIDER_C_ID);
    sliderD          = document.getElementById(SLIDER_D_ID);

    sliderAVal       = document.getElementById(SLIDER_A_VAL_ID);
    sliderBVal       = document.getElementById(SLIDER_B_VAL_ID);
    sliderCVal       = document.getElementById(SLIDER_C_VAL_ID);
    sliderDVal       = document.getElementById(SLIDER_D_VAL_ID);

    sliderALabel     = document.getElementById(SLIDER_A_LABEL);
    sliderBLabel     = document.getElementById(SLIDER_B_LABEL);
    sliderCLabel     = document.getElementById(SLIDER_C_LABEL);
    sliderDLabel     = document.getElementById(SLIDER_D_LABEL);

    customQuantButton= document.getElementById(BUTTON_ID);

    yGridElem        = document.getElementById(Y_GRID_ID);
    uvGridElem       = document.getElementById(UV_GRID_ID);

    populateModeSelect();

    createQuantGrid(yGridElem, yInputs, "Y");
    createQuantGrid(uvGridElem, uvInputs, "UV");

    modeSelect.addEventListener("change", handleModeChange);
    sliderA.addEventListener("input", handleSliderChange);
    sliderB.addEventListener("input", handleSliderChange);
    sliderC.addEventListener("input", handleSliderChange);
    sliderD.addEventListener("input", handleSliderChange);

    customQuantButton.addEventListener("click", handleCustomButtonClick);

    sliderAVal.textContent = sliderA.value;
    sliderBVal.textContent = sliderB.value;
    sliderCVal.textContent = sliderC.value;
    sliderDVal.textContent = sliderD.value;

    applyMode(modeSelect.value);
  });

  function populateModeSelect() {
    modeSelect.innerHTML = "";
    modes.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.value;
      opt.textContent = m.label;
      modeSelect.appendChild(opt);
    });
  }

  function createQuantGrid(containerElem, inputsArray, prefix) {
    const container = containerElem;
    if (!container) return;
    container.innerHTML = "";
    
    inputsArray.length = 0;
    
    for (let i = 0; i < SIZE * SIZE; i++){
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

  function handleModeChange() {
    const mode = modeSelect.value;
    updateSliderLabels(mode);
    applyMode(mode);
    updateEncodedImage();
  }

  function handleSliderChange() {
    sliderAVal.textContent = sliderA.value;
    sliderBVal.textContent = sliderB.value;
    sliderCVal.textContent = sliderC.value;
    sliderDVal.textContent = sliderD.value;

    if (["gradient", "random", "checkerboard", "stripes"].includes(modeSelect.value)) {
      applyMode(modeSelect.value);
    }

    updateEncodedImage();
  }

  function handleCustomButtonClick() {
    const mode = modeSelect.value;
    applyMode(mode);
  }

  function updateSliderLabels(mode) {
    switch(mode) {
      case "gradient":
        sliderALabel.textContent = "Y Grad Start (A):";
        sliderBLabel.textContent = "Y Grad End (B):";
        sliderCLabel.textContent = "UV Grad Start (C):";
        sliderDLabel.textContent = "UV Grad End (D):";
        break;
      case "random":
        sliderALabel.textContent = "Y Random Min (A):";
        sliderBLabel.textContent = "Y Random Max (B):";
        sliderCLabel.textContent = "UV Random Min (C):";
        sliderDLabel.textContent = "UV Random Max (D):";
        break;
      case "checkerboard":
        sliderALabel.textContent = "Checker A (Y):";
        sliderBLabel.textContent = "Checker B (Y):";
        sliderCLabel.textContent = "Checker A (UV):";
        sliderDLabel.textContent = "Checker B (UV):";
        break;
      case "stripes":
        sliderALabel.textContent = "Stripe Val 1 (Y):";
        sliderBLabel.textContent = "Stripe Val 2 (Y):";
        sliderCLabel.textContent = "Stripe Val 1 (UV):";
        sliderDLabel.textContent = "Stripe Val 2 (UV):";
        break;
      case "manual":
      default:
        sliderALabel.textContent = "Slider A (Y):";
        sliderBLabel.textContent = "Slider B (Y):";
        sliderCLabel.textContent = "Slider C (UV):";
        sliderDLabel.textContent = "Slider D (UV):";
        break;
    }
  }

  function applyMode(mode) {
    const aVal = parseInt(sliderA.value, 10);
    const bVal = parseInt(sliderB.value, 10);
    const cVal = parseInt(sliderC.value, 10);
    const dVal = parseInt(sliderD.value, 10);

    switch(mode) {
      case "gradient":
        fillGradient(yInputs, SIZE, aVal, bVal);
        fillGradient(uvInputs, SIZE, cVal, dVal);
        break;
      case "random":
        fillRandom(yInputs, SIZE, aVal, bVal);
        fillRandom(uvInputs, SIZE, cVal, dVal);
        break;
      case "checkerboard":
        fillCheckerboard(yInputs, SIZE, aVal, bVal);
        fillCheckerboard(uvInputs, SIZE, cVal, dVal);
        break;
      case "stripes":
        fillStripes(yInputs, SIZE, aVal, bVal);
        fillStripes(uvInputs, SIZE, cVal, dVal);
        break;
      case "manual":
      default:
        break;
    }
  }

  function fillGradient(inputs, gridSize, minVal, maxVal) {
    for (let row = 0; row < gridSize; row++){
      for (let col = 0; col < gridSize; col++){
        const idx = row * gridSize + col;
        const rowFrac = row / (gridSize - 1);
        const colFrac = col / (gridSize - 1);
        const frac = 0.5 * (rowFrac + colFrac);
        const val = Math.round(minVal + frac * (maxVal - minVal));
        inputs[idx].value = clampVal(val);
      }
    }
  }

  function fillRandom(inputs, gridSize, minVal, maxVal) {
    for (let i = 0; i < gridSize * gridSize; i++){
      const val = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
      inputs[i].value = clampVal(val);
    }
  }

  function fillCheckerboard(inputs, gridSize, val1, val2) {
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const idx = row * gridSize + col;
        inputs[idx].value = ((row + col) % 2 === 0) ? clampVal(val1) : clampVal(val2);
      }
    }
  }

  function fillStripes(inputs, gridSize, val1, val2) {
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const idx = row * gridSize + col;
        inputs[idx].value = (row % 2 === 0) ? clampVal(val1) : clampVal(val2);
      }
    }
  }

  function clampVal(v) {
    return Math.max(1, Math.min(255, v));
  }

  window.getCustomYTable = function() {
    return yInputs.map(input => parseInt(input.value, 10));
  };
  window.getCustomUVTable = function() {
    return uvInputs.map(input => parseInt(input.value, 10));
  };

})();
