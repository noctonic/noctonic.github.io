import { EmotionRuntime } from "./emotion-runtime.js";
import { OnnxEmotionController } from "./onnx-controller.js";

const DEFAULT_MODEL_PATH = "./assets/models/new/face.glb";
const MAPPING_PATH = "./assets/config/emotion_coefficients_v0.json";
const ONNX_MODEL_PATH = "./assets/models/new/controller_7emo_to_arkit52.onnx";
const ONNX_COEFF_NAMES_PATH = "./assets/models/new/arkit52_coeff_names.json";
const ONNX_INPUT_NAMES_PATH = "./assets/models/new/emotion_7_input_names.json";
const ONNX_PROFILE_PATH = "./assets/models/new/controller_profile.json";
const ONNX_WASM_DIST_PATH = "./assets/vendor/onnxruntime-web/dist/";

const state = {
  scene: null,
  camera: null,
  renderer: null,
  orbitControls: null,
  runtime: null,
  sliders: {},
  intensitySlider: null,
  statusEl: null,
  three: null,
  gltfLoader: null,
  onnxController: null,
  onnxProfile: null,
  useOnnx: false,
  lastEmotionSignature: ""
};

function setStatus(message) {
  if (state.statusEl) {
    state.statusEl.textContent = message;
  }
}

function getCanvasSize() {
  const canvasWrap = document.getElementById("viewer");
  return {
    width: Math.max(canvasWrap.clientWidth, 320),
    height: Math.max(canvasWrap.clientHeight, 320)
  };
}

async function loadThreeModules() {
  try {
    const [threeModule, gltfModule, fbxModule, orbitModule] = await Promise.all([
      import("../assets/vendor/three/build/three.module.js"),
      import("../assets/vendor/three/examples/jsm/loaders/GLTFLoader.js"),
      import("../assets/vendor/three/examples/jsm/loaders/FBXLoader.js"),
      import("../assets/vendor/three/examples/jsm/controls/OrbitControls.js")
    ]);
    return {
      THREE: threeModule,
      GLTFLoader: gltfModule.GLTFLoader,
      FBXLoader: fbxModule.FBXLoader,
      OrbitControls: orbitModule.OrbitControls
    };
  } catch (error) {
    throw new Error(
      "Missing local Three.js vendor modules. Expected files under assets/vendor/three/."
    );
  }
}

function getRequestedModelPath() {
  const params = new URLSearchParams(window.location.search);
  const queryModel = params.get("model");
  if (queryModel && queryModel.trim()) {
    return queryModel.trim();
  }
  return DEFAULT_MODEL_PATH;
}

function shouldUseOnnx() {
  const params = new URLSearchParams(window.location.search);
  const controller = params.get("controller");
  if (controller && controller.toLowerCase() === "json") {
    return false;
  }
  return true;
}

function shouldDebugOnnx() {
  const params = new URLSearchParams(window.location.search);
  const value = (params.get("onnxDebug") || "").toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function parseBooleanQuery(value, defaultValue = false) {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return defaultValue;
}

function shouldDriveAllMorphMeshes() {
  const params = new URLSearchParams(window.location.search);
  // Default ON: many MetaHuman exports split blendshapes across multiple meshes.
  return parseBooleanQuery(params.get("driveAllMorphMeshes"), true);
}

function shouldRequireOnnx() {
  const params = new URLSearchParams(window.location.search);
  return parseBooleanQuery(params.get("requireOnnx"), true);
}

function formatErrorMessage(error) {
  if (error instanceof Error) {
    return error.message || "Unknown error";
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function getMappingCoefficientNames(mapping) {
  const result = new Set();
  const emotions = mapping?.emotions || {};
  for (const entry of Object.values(emotions)) {
    for (const coefficient of Object.keys(entry?.coefficients || {})) {
      result.add(coefficient);
    }
  }
  return Array.from(result);
}

async function loadJsonIfExists(path) {
  if (!path) {
    return null;
  }
  try {
    const response = await fetch(path);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

function initScene(THREE, OrbitControls) {
  const canvas = document.getElementById("face-canvas");
  const size = getCanvasSize();

  state.renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.renderer.setSize(size.width, size.height, false);

  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0xf8f5ed);

  state.camera = new THREE.PerspectiveCamera(35, size.width / size.height, 0.1, 100);
  state.camera.position.set(0, 0.02, 1.15);
  state.scene.add(state.camera);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(1.5, 2, 2);
  state.scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
  fillLight.position.set(-1.5, 0.5, 1.5);
  state.scene.add(fillLight);

  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  state.scene.add(ambient);

  state.orbitControls = new OrbitControls(state.camera, state.renderer.domElement);
  state.orbitControls.enableDamping = true;
  state.orbitControls.target.set(0, 0, 0);
}

function stabilizeMeshRendering(THREE, root) {
  root.traverse((obj) => {
    if (!obj.isMesh) {
      return;
    }

    // Some imported FBX meshes have unstable bounds; keep them renderable.
    obj.frustumCulled = false;

    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!material) {
        continue;
      }

      if ("side" in material) {
        material.side = THREE.DoubleSide;
      }

      if ("transparent" in material && material.transparent && material.opacity === 0) {
        material.transparent = false;
        material.opacity = 1;
      }

      if ("needsUpdate" in material) {
        material.needsUpdate = true;
      }
    }
  });
}

function collectMorphMeshes(root) {
  const meshes = [];
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.morphTargetDictionary || !obj.morphTargetInfluences) {
      return;
    }
    meshes.push(obj);
  });
  return meshes;
}

function resolveMorphMesh(root, candidates = null, preferredName = "") {
  let result = null;
  let bestScore = -Infinity;
  const meshes = candidates || collectMorphMeshes(root);
  const preferred = String(preferredName || "").trim().toLowerCase();

  if (preferred) {
    const exact = meshes.find((obj) => (obj.name || "").toLowerCase() === preferred);
    if (exact) {
      return exact;
    }
  }

  for (const obj of meshes) {
    const name = (obj.name || "").toLowerCase();
    const morphCount = Object.keys(obj.morphTargetDictionary).length;
    const vertexCount = obj.geometry?.attributes?.position?.count || 0;

    let score = 0;
    if (name.includes("head")) {
      score += 1000;
    }
    if (name.includes("face")) {
      score += 800;
    }
    if (name.includes("teeth")) {
      score += 400;
    }
    if (name.includes("eye")) {
      score += 50;
    }
    score += morphCount * 2;
    score += vertexCount / 1000;

    if (score > bestScore) {
      bestScore = score;
      result = obj;
    }
  }
  return result;
}

function isolateFaceView(root, morphMesh) {
  const includeKeywords = [
    "head",
    "eye",
    "teeth",
    "tongue",
    "nose",
    "brow",
    "hair",
    "glass",
    "teeth"
  ];
  const excludeKeywords = [
    "body",
    "outfit",
    "foot",
    "leg",
    "arm",
    "hand",
    "hip",
    "spine"
  ];

  root.traverse((obj) => {
    if (!obj.isMesh) {
      return;
    }
    if (obj === morphMesh) {
      obj.visible = true;
      return;
    }

    const name = (obj.name || "").toLowerCase();
    const excluded = excludeKeywords.some((keyword) => name.includes(keyword));
    const included = includeKeywords.some((keyword) => name.includes(keyword));

    if (excluded) {
      obj.visible = false;
      return;
    }

    if (included) {
      obj.visible = true;
      return;
    }

    // Keep unknown meshes visible to avoid empty scenes on differently named assets.
    obj.visible = true;
  });

  const visible = [];
  root.traverse((obj) => {
    if (obj.isMesh && obj.visible) {
      visible.push(obj);
    }
  });
  return visible;
}

function applyFallbackCamera(THREE, fallbackMesh) {
  const target = new THREE.Vector3();
  let distance = 0.6;

  if (fallbackMesh) {
    const box = new THREE.Box3().setFromObject(fallbackMesh);
    if (!box.isEmpty()) {
      box.getCenter(target);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (Number.isFinite(maxDim) && maxDim > 0) {
        distance = Math.max(0.35, maxDim * 2.4);
      }
    } else {
      fallbackMesh.getWorldPosition(target);
    }
  }
  target.y += 0.01;

  state.orbitControls.target.copy(target);
  state.camera.position.set(target.x, target.y, target.z + distance);
  state.camera.lookAt(target);
  state.camera.near = 0.01;
  state.camera.far = Math.max(50, distance * 60);
  state.camera.updateProjectionMatrix();
  state.orbitControls.minDistance = 0.25;
  state.orbitControls.maxDistance = Math.max(6, distance * 6);
  state.orbitControls.update();
}

function normalizeModelTransform(THREE, root, pivotMesh) {
  const source = pivotMesh || root;
  root.updateWorldMatrix(true, true);

  const preBox = new THREE.Box3().setFromObject(source);
  if (preBox.isEmpty()) {
    return;
  }

  const preSize = preBox.getSize(new THREE.Vector3());
  const preMaxDim = Math.max(preSize.x, preSize.y, preSize.z);
  if (!Number.isFinite(preMaxDim) || preMaxDim <= 1e-6) {
    return;
  }

  // Normalize model units so face framing is predictable across FBX exports.
  const targetMaxDim = 0.28;
  const scale = targetMaxDim / preMaxDim;
  if (Number.isFinite(scale) && scale > 1e-5 && scale < 1e5) {
    root.scale.multiplyScalar(scale);
    root.updateWorldMatrix(true, true);
  }

  const centeredBox = new THREE.Box3().setFromObject(source);
  if (centeredBox.isEmpty()) {
    return;
  }

  const center = centeredBox.getCenter(new THREE.Vector3());
  root.position.sub(center);
  root.updateWorldMatrix(true, true);
}

function frameCameraToFace(THREE, visibleMeshes, fallbackMesh) {
  if (!state.camera || !state.orbitControls) {
    return;
  }

  if (visibleMeshes.length === 0) {
    applyFallbackCamera(THREE, fallbackMesh);
    return;
  }

  const root = fallbackMesh?.parent;
  if (root) {
    root.updateWorldMatrix(true, true);
  }

  const box = new THREE.Box3();
  box.makeEmpty();

  for (const mesh of visibleMeshes) {
    mesh.updateWorldMatrix(true, false);
    box.expandByObject(mesh);
  }

  if (box.isEmpty() && fallbackMesh) {
    box.setFromObject(fallbackMesh);
  }

  if (box.isEmpty()) {
    applyFallbackCamera(THREE, fallbackMesh);
    return;
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDim) || maxDim < 0.01) {
    applyFallbackCamera(THREE, fallbackMesh);
    return;
  }

  const fovRadians = (state.camera.fov * Math.PI) / 180;
  const fitHeightDistance = size.y / (2 * Math.tan(fovRadians / 2));
  const fitWidthDistance = (size.x / state.camera.aspect) / (2 * Math.tan(fovRadians / 2));
  const distance = Math.max(0.65, fitHeightDistance, fitWidthDistance) * 1.35;

  // Keep default framing centered to avoid initial clipping across models.
  const target = center.clone();
  target.y -= size.y * 0.02;

  state.orbitControls.target.copy(target);
  state.camera.position.set(target.x, target.y + size.y * 0.02, target.z + distance);
  state.camera.lookAt(target);
  state.camera.near = Math.max(0.01, distance / 100);
  state.camera.far = Math.max(20, distance * 30);
  state.camera.updateProjectionMatrix();
  state.orbitControls.minDistance = distance * 0.45;
  state.orbitControls.maxDistance = distance * 4.5;
  state.orbitControls.update();

  // If the computed target is still outside the viewport, force fallback.
  const projected = target.clone().project(state.camera);
  if (
    !Number.isFinite(projected.x) ||
    !Number.isFinite(projected.y) ||
    !Number.isFinite(projected.z) ||
    Math.abs(projected.x) > 1.2 ||
    Math.abs(projected.y) > 1.2
  ) {
    applyFallbackCamera(THREE, fallbackMesh);
  }
}

async function loadFaceModel(
  THREE,
  GLTFLoader,
  FBXLoader,
  modelPath,
  preferredMorphMeshName = ""
) {
  const modelPathLower = modelPath.toLowerCase();
  const isFbx = modelPathLower.endsWith(".fbx");
  const isGltf = modelPathLower.endsWith(".gltf") || modelPathLower.endsWith(".glb");

  if (!isFbx && !isGltf) {
    throw new Error(`Unsupported model extension for ${modelPath}. Use .fbx, .glb, or .gltf.`);
  }

  const loader = isFbx ? new FBXLoader() : new GLTFLoader();
  state.gltfLoader = loader;

  return new Promise((resolve, reject) => {
    loader.load(
      modelPath,
      (loaded) => {
        const root = isFbx ? loaded : loaded.scene;
        root.position.set(0, 0, 0);
        root.scale.setScalar(1.0);
        stabilizeMeshRendering(THREE, root);
        state.scene.add(root);

        const morphMeshes = collectMorphMeshes(root);
        const morphMesh = resolveMorphMesh(root, morphMeshes, preferredMorphMeshName);
        if (!morphMesh || morphMeshes.length === 0) {
          reject(
            new Error(
              `Loaded model has no morph targets: ${modelPath}. Use a model with ARKit-style blendshapes.`
            )
          );
          return;
        }

        normalizeModelTransform(THREE, root, morphMesh);
        isolateFaceView(root, morphMesh);
        frameCameraToFace(THREE, [morphMesh], morphMesh);

        resolve({ root, morphMesh, morphMeshes });
      },
      undefined,
      () => {
        reject(
          new Error(`Could not load ${modelPath}. Check the path and refresh.`)
        );
      }
    );
  });
}

function createSliderRow(label, initial = 0) {
  const row = document.createElement("label");
  row.className = "slider-row";

  const text = document.createElement("span");
  text.className = "slider-label";
  text.textContent = label;

  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "1";
  input.step = "0.01";
  input.value = String(initial);

  const value = document.createElement("span");
  value.className = "slider-value";
  value.textContent = Number(initial).toFixed(2);

  input.addEventListener("input", () => {
    value.textContent = Number(input.value).toFixed(2);
  });

  row.append(text, input, value);
  return { row, input };
}

function buildEmotionUI(emotionNames) {
  const container = document.getElementById("emotion-sliders");
  container.innerHTML = "";
  state.sliders = {};

  for (const emotion of emotionNames) {
    const { row, input } = createSliderRow(emotion, 0);
    container.appendChild(row);
    state.sliders[emotion] = input;
  }

  const intensityWrap = document.getElementById("intensity-slider");
  intensityWrap.innerHTML = "";
  const { row: intensityRow, input: intensityInput } = createSliderRow("intensity", 0.5);
  intensityWrap.appendChild(intensityRow);
  state.intensitySlider = intensityInput;
}

function collectEmotionLevels() {
  const result = {};
  for (const [name, slider] of Object.entries(state.sliders)) {
    result[name] = Number(slider.value);
  }
  return result;
}

function installPresets(emotions) {
  const presetContainer = document.getElementById("presets");
  presetContainer.innerHTML = "";

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "preset-btn";
  clearButton.textContent = "Neutral";
  clearButton.addEventListener("click", () => {
    for (const slider of Object.values(state.sliders)) {
      slider.value = "0";
      slider.dispatchEvent(new Event("input"));
    }
  });
  presetContainer.appendChild(clearButton);

  for (const emotion of emotions) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preset-btn";
    btn.textContent = emotion;
    btn.addEventListener("click", () => {
      for (const [name, slider] of Object.entries(state.sliders)) {
        slider.value = name === emotion ? "1" : "0";
        slider.dispatchEvent(new Event("input"));
      }
    });
    presetContainer.appendChild(btn);
  }
}

function onResize() {
  if (!state.camera || !state.renderer) {
    return;
  }
  const size = getCanvasSize();
  state.camera.aspect = size.width / size.height;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(size.width, size.height, false);
}

async function bootstrap() {
  state.statusEl = document.getElementById("status-text");
  setStatus("Loading mapping...");

  const mappingResponse = await fetch(MAPPING_PATH);
  if (!mappingResponse.ok) {
    throw new Error(`Failed to load ${MAPPING_PATH}`);
  }
  const mapping = await mappingResponse.json();

  const fallbackEmotionNames = Object.keys(mapping.emotions || {});
  let emotionNames = fallbackEmotionNames;

  if (shouldUseOnnx()) {
    try {
      setStatus("Loading ONNX controller...");
      state.onnxController = await OnnxEmotionController.create({
        modelPath: ONNX_MODEL_PATH,
        coeffNamesPath: ONNX_COEFF_NAMES_PATH,
        inputNamesPath: ONNX_INPUT_NAMES_PATH,
        profilePath: ONNX_PROFILE_PATH,
        wasmDistPath: ONNX_WASM_DIST_PATH
      });
      state.onnxProfile = await loadJsonIfExists(ONNX_PROFILE_PATH);
      state.useOnnx = true;
      emotionNames = state.onnxController.getEmotionNames();
      console.info("ONNX input emotion order:", emotionNames);
      if (state.onnxProfile?.mesh_object_name) {
        console.info("ONNX profile mesh:", state.onnxProfile.mesh_object_name);
      }
      if (shouldDebugOnnx()) {
        const probe = await state.onnxController.probeEmotionBasis();
        console.info("ONNX one-hot emotion probe (top ARKit outputs):", probe);
      }
      setStatus("ONNX controller ready");
    } catch (error) {
      console.warn("ONNX controller initialization failed:", error);
      state.useOnnx = false;
      state.onnxController = null;
      state.onnxProfile = null;
      if (shouldRequireOnnx()) {
        throw new Error(`ONNX required but failed: ${formatErrorMessage(error)}`);
      }
      setStatus(`ONNX unavailable (${formatErrorMessage(error)}). Using JSON mapping.`);
    }
  }

  buildEmotionUI(emotionNames);
  installPresets(emotionNames);

  setStatus("Loading local Three.js modules...");
  const { THREE, GLTFLoader, FBXLoader, OrbitControls } = await loadThreeModules();
  state.three = THREE;

  initScene(THREE, OrbitControls);
  window.addEventListener("resize", onResize);
  onResize();

  const modelPath = getRequestedModelPath();
  setStatus(`Loading model: ${modelPath}`);
  const preferredMeshName = state.onnxProfile?.mesh_object_name || "";
  const { morphMesh, morphMeshes } = await loadFaceModel(
    THREE,
    GLTFLoader,
    FBXLoader,
    modelPath,
    preferredMeshName
  );
  console.info("Loaded model path:", modelPath);
  if (String(modelPath).toLowerCase().endsWith(".fbx")) {
    console.warn("FBX model detected. Prefer ./assets/models/new/face.glb to match notebook training/render setup.");
  }
  const runtimeMeshes = shouldDriveAllMorphMeshes() ? morphMeshes : [morphMesh];
  const runtimeMeshNames = runtimeMeshes.map((mesh, index) => {
    const name = String(mesh?.name || "").trim();
    return name || `(unnamed:${index})`;
  });
  console.info(
    `Driving morph meshes (${runtimeMeshes.length}):`,
    runtimeMeshNames
  );
  state.runtime = new EmotionRuntime(runtimeMeshes, mapping);
  console.info("Controller source:", state.useOnnx ? "ONNX" : "JSON fallback");

  const expectedCoefficients =
    state.useOnnx && state.onnxController
      ? state.onnxController.getCoefficientNames()
      : getMappingCoefficientNames(mapping);
  const missingCoefficients = state.runtime.getMissingCoefficients(expectedCoefficients);
  if (missingCoefficients.length > 0) {
    console.warn(
      `Model is missing ${missingCoefficients.length} expected coefficient(s).`,
      missingCoefficients
    );
  }

  const clock = new THREE.Clock();
  setStatus("Ready");

  function frame() {
    const dt = clock.getDelta();
    if (state.runtime) {
      const levels = collectEmotionLevels();
      const intensity = Number(state.intensitySlider.value);

      if (state.useOnnx && state.onnxController) {
        const signature = Object.values(levels)
          .map((v) => Number(v).toFixed(3))
          .join("|");
        if (signature !== state.lastEmotionSignature) {
          state.lastEmotionSignature = signature;
          state.onnxController.updateInput(levels);
        }

        state.runtime.updateFromCoefficientMap(
          state.onnxController.getLatestCoefficients(),
          intensity,
          dt,
          false
        );
      } else {
        state.runtime.update(levels, intensity, dt);
      }
    }
    state.orbitControls.update();
    state.renderer.render(state.scene, state.camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

bootstrap().catch((error) => {
  console.error(error);
  setStatus(error.message);
});
