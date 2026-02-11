import { EmotionRuntime } from "./emotion-runtime.js";
import { OnnxEmotionController } from "./onnx-controller.js";

const DEFAULT_MODEL_PATH = "./assets/models/new/face.glb";
const MAPPING_PATH = "./assets/config/emotion_coefficients_v0.json";
const ONNX_MODEL_PATH = "./assets/models/new/controller_7emo_to_arkit52.onnx";
const ONNX_COEFF_NAMES_PATH = "./assets/models/new/arkit52_coeff_names.json";
const ONNX_INPUT_NAMES_PATH = "./assets/models/new/emotion_7_input_names.json";
const ONNX_PROFILE_PATH = "./assets/models/new/controller_profile.json";
const ONNX_WASM_DIST_PATH = "./assets/vendor/onnxruntime-web/dist/";
const DEFAULT_TEXTURE_PATH = "./assets/textures/face.png";
const RANDOM_CYCLE_FREQ_MIN_HZ = 0.03;
const RANDOM_CYCLE_FREQ_MAX_HZ = 0.26;
const RANDOM_CYCLE_INTENSITY_FREQ_MIN_HZ = 0.05;
const RANDOM_CYCLE_INTENSITY_FREQ_MAX_HZ = 0.32;
const INITIAL_ZOOM_CLOSENESS = 0.98;

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
  onnxIntensityInputName: null,
  onnxInputEmotionNames: [],
  useOnnx: false,
  lastEmotionSignature: "",
  randomCycleEnabled: false,
  randomCycleButton: null,
  randomCycleOscillators: {},
  randomCycleStartedAtSeconds: 0,
  textureTargetMeshes: [],
  textureBackups: new Map(),
  appliedTexture: null,
  textureObjectUrl: null
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

function getRequestedTexturePath() {
  const params = new URLSearchParams(window.location.search);
  const queryTexture = params.get("texture");
  if (queryTexture && queryTexture.trim()) {
    return queryTexture.trim();
  }
  return DEFAULT_TEXTURE_PATH;
}

function shouldApplyTextureToAllMeshes() {
  const params = new URLSearchParams(window.location.search);
  return parseBooleanQuery(params.get("textureAllMeshes"), false);
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

function computeInitialOrbitDistance(minDistance, maxDistance, closeness = INITIAL_ZOOM_CLOSENESS) {
  const minD = Math.max(0, Number(minDistance || 0));
  const maxD = Math.max(minD, Number(maxDistance || minD));
  const t = Math.max(0, Math.min(1, Number(closeness || 0)));
  // t=1 means "as close as allowed"; keep a tiny epsilon to avoid edge jitter.
  const epsilon = 1e-4;
  const k = Math.max(0, Math.min(1, 1 - t));
  return minD + (maxD - minD) * k + epsilon;
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
  state.camera.lookAt(target);
  state.camera.near = 0.01;
  state.camera.far = Math.max(50, distance * 60);
  state.camera.updateProjectionMatrix();
  const minDistance = 0.25;
  const maxDistance = Math.max(6, distance * 6);
  state.orbitControls.minDistance = minDistance;
  state.orbitControls.maxDistance = maxDistance;
  const startDistance = computeInitialOrbitDistance(minDistance, maxDistance);
  state.camera.position.set(target.x, target.y, target.z + startDistance);
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
  state.camera.lookAt(target);
  state.camera.near = Math.max(0.01, distance / 100);
  state.camera.far = Math.max(20, distance * 30);
  state.camera.updateProjectionMatrix();
  const minDistance = distance * 0.45;
  const maxDistance = distance * 4.5;
  state.orbitControls.minDistance = minDistance;
  state.orbitControls.maxDistance = maxDistance;
  const startDistance = computeInitialOrbitDistance(minDistance, maxDistance);
  state.camera.position.set(target.x, target.y + size.y * 0.02, target.z + startDistance);
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

function getMeshMaterialList(mesh) {
  if (!mesh || !mesh.material) {
    return [];
  }
  return Array.isArray(mesh.material) ? mesh.material.filter(Boolean) : [mesh.material];
}

function clearAppliedTexture(options = {}) {
  const keepStatus = Boolean(options.keepStatus);
  const keepObjectUrl = Boolean(options.keepObjectUrl);

  for (const backup of state.textureBackups.values()) {
    const material = backup.material;
    if (!material) {
      continue;
    }
    if ("map" in material) {
      material.map = backup.map;
    }
    if ("metalness" in material && backup.metalness !== undefined) {
      material.metalness = backup.metalness;
    }
    if ("roughness" in material && backup.roughness !== undefined) {
      material.roughness = backup.roughness;
    }
    if ("color" in material && material.color && backup.color) {
      material.color.copy(backup.color);
    }
    material.needsUpdate = true;
  }
  state.textureBackups.clear();

  if (state.appliedTexture) {
    state.appliedTexture.dispose();
    state.appliedTexture = null;
  }

  if (!keepObjectUrl && state.textureObjectUrl) {
    URL.revokeObjectURL(state.textureObjectUrl);
    state.textureObjectUrl = null;
  }

  if (!keepStatus) {
    setStatus("Texture cleared");
  }
}

function loadTextureFromUrl(THREE, textureUrl) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      textureUrl,
      (texture) => {
        if ("colorSpace" in texture && THREE.SRGBColorSpace) {
          texture.colorSpace = THREE.SRGBColorSpace;
        } else if ("encoding" in texture && THREE.sRGBEncoding) {
          texture.encoding = THREE.sRGBEncoding;
        }
        texture.flipY = false;
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      () => {
        reject(new Error(`Failed to load texture: ${textureUrl}`));
      }
    );
  });
}

function applyTextureToMeshes(texture, targetMeshes) {
  clearAppliedTexture({ keepStatus: true, keepObjectUrl: true });

  const meshList = Array.isArray(targetMeshes) ? targetMeshes : [];
  const touched = new Set();
  for (const mesh of meshList) {
    for (const material of getMeshMaterialList(mesh)) {
      if (!material || touched.has(material.uuid)) {
        continue;
      }
      touched.add(material.uuid);
      state.textureBackups.set(material.uuid, {
        material,
        map: "map" in material ? material.map : null,
        metalness: "metalness" in material ? material.metalness : undefined,
        roughness: "roughness" in material ? material.roughness : undefined,
        color: "color" in material && material.color ? material.color.clone() : null
      });

      if ("map" in material) {
        material.map = texture;
      }
      if ("color" in material && material.color) {
        material.color.set(0xffffff);
      }
      if ("metalness" in material) {
        material.metalness = Math.min(Number(material.metalness ?? 0), 0.15);
      }
      if ("roughness" in material) {
        material.roughness = Math.max(Number(material.roughness ?? 0.5), 0.7);
      }
      material.needsUpdate = true;
    }
  }

  state.appliedTexture = texture;
}

async function applyTextureFromUrl(THREE, textureUrl, options = {}) {
  if (!textureUrl || !String(textureUrl).trim()) {
    return;
  }

  const texture = await loadTextureFromUrl(THREE, textureUrl);
  applyTextureToMeshes(texture, state.textureTargetMeshes);

  if (!options.keepPreviousObjectUrl && state.textureObjectUrl) {
    URL.revokeObjectURL(state.textureObjectUrl);
    state.textureObjectUrl = null;
  }
  if (options.objectUrl) {
    state.textureObjectUrl = options.objectUrl;
  }

  const label = options.label || textureUrl;
  setStatus(`Texture applied: ${label}`);
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

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function getLevelByName(levels, desiredName) {
  const desired = normalizeName(desiredName);
  if (!desired) {
    return 0;
  }

  for (const [name, value] of Object.entries(levels || {})) {
    if (normalizeName(name) === desired) {
      return clamp01(value);
    }
  }
  return 0;
}

function buildNeutralSpectrumInputs(
  uiLevels,
  intensity,
  controllerEmotionNames,
  onnxIntensityInputName = null
) {
  const names = Array.isArray(controllerEmotionNames) ? controllerEmotionNames : [];
  const intensityNameLower = normalizeName(onnxIntensityInputName);
  const emotionNames = names.filter((name) => normalizeName(name) !== intensityNameLower);

  const neutralName = emotionNames.find((name) => normalizeName(name) === "neutral") || null;
  const nonNeutralNames = emotionNames.filter((name) => normalizeName(name) !== "neutral");

  let sum = 0;
  for (const name of nonNeutralNames) {
    sum += getLevelByName(uiLevels, name);
  }

  const activation = clamp01(sum);
  const blend = clamp01(intensity) * activation;
  const result = {};

  for (const name of emotionNames) {
    result[name] = 0;
  }

  if (sum > 1e-6) {
    for (const name of nonNeutralNames) {
      const normalizedWeight = getLevelByName(uiLevels, name) / sum;
      result[name] = clamp01(normalizedWeight * blend);
    }
  }

  if (neutralName) {
    result[neutralName] = clamp01(1 - blend);
  }

  if (onnxIntensityInputName) {
    result[onnxIntensityInputName] = clamp01(blend);
  }

  return result;
}

function buildRuntimeSpectrumInputs(uiLevels, intensity) {
  const runtimeLevels = {};
  let sum = 0;
  for (const [name, value] of Object.entries(uiLevels || {})) {
    const clamped = clamp01(value);
    runtimeLevels[name] = clamped;
    sum += clamped;
  }

  if (sum > 1e-6) {
    for (const name of Object.keys(runtimeLevels)) {
      runtimeLevels[name] = runtimeLevels[name] / sum;
    }
  } else {
    for (const name of Object.keys(runtimeLevels)) {
      runtimeLevels[name] = 0;
    }
  }

  const activation = clamp01(sum);
  const runtimeIntensity = clamp01(intensity) * activation;
  return { runtimeLevels, runtimeIntensity };
}

function buildInputSignature(levelsByName, orderedNames = null) {
  const order = Array.isArray(orderedNames) && orderedNames.length > 0
    ? orderedNames
    : Object.keys(levelsByName || {});
  return order.map((name) => Number(levelsByName?.[name] || 0).toFixed(3)).join("|");
}

function sampleRange(minValue, maxValue) {
  return minValue + Math.random() * (maxValue - minValue);
}

function setSliderValue(slider, value) {
  if (!slider) {
    return;
  }
  const clamped = Math.max(0, Math.min(1, Number(value || 0)));
  if (Math.abs(clamped - Number(slider.value || 0)) < 1e-4) {
    return;
  }
  slider.value = String(clamped);
  slider.dispatchEvent(new Event("input"));
}

function applyEmotionPreset(emotionName, options = {}) {
  const target = String(emotionName || "").trim().toLowerCase();
  const emotionLevel = Math.max(0, Math.min(1, Number(options.emotionLevel ?? 0.5)));
  const intensity = Math.max(0, Math.min(1, Number(options.intensity ?? 0.5)));

  for (const [name, slider] of Object.entries(state.sliders)) {
    const lower = String(name || "").trim().toLowerCase();
    const value = lower === target ? emotionLevel : 0;
    setSliderValue(slider, value);
  }

  setSliderValue(state.intensitySlider, intensity);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function createRandomOscillator(currentValue, minValue, maxValue, freqMinHz, freqMaxHz) {
  const min = clamp01(Math.min(minValue, maxValue));
  const max = clamp01(Math.max(minValue, maxValue));
  const center = (min + max) * 0.5;
  const amplitude = Math.max(0.001, (max - min) * 0.5);
  const current = clamp01(currentValue);
  const normalized = Math.max(-1, Math.min(1, (current - center) / amplitude));
  let phase = Math.asin(normalized);
  if (Math.random() < 0.5) {
    phase = Math.PI - phase;
  }

  return {
    min,
    max,
    center,
    amplitude,
    frequencyHz: sampleRange(freqMinHz, freqMaxHz),
    phase
  };
}

function initializeRandomCycleOscillators(emotions) {
  const pool = (emotions || []).filter((name) => Boolean(String(name || "").trim()));
  const oscillators = {};
  for (const [name, slider] of Object.entries(state.sliders)) {
    const current = Number(slider.value || 0);
    let min = sampleRange(0.0, 0.22);
    let max = sampleRange(0.35, 1.0);
    if (max - min < 0.12) {
      max = Math.min(1, min + 0.12);
    }
    oscillators[name] = createRandomOscillator(
      current,
      min,
      max,
      RANDOM_CYCLE_FREQ_MIN_HZ,
      RANDOM_CYCLE_FREQ_MAX_HZ
    );
  }

  if (state.intensitySlider && pool.length > 0) {
    const currentIntensity = Number(state.intensitySlider.value || 0);
    oscillators.intensity = createRandomOscillator(
      currentIntensity,
      sampleRange(0.12, 0.40),
      sampleRange(0.60, 1.0),
      RANDOM_CYCLE_INTENSITY_FREQ_MIN_HZ,
      RANDOM_CYCLE_INTENSITY_FREQ_MAX_HZ
    );
  }

  state.randomCycleOscillators = oscillators;
  state.randomCycleStartedAtSeconds = performance.now() * 0.001;
  setStatus("Random cycle: sine mode");
}

function evaluateOscillator(oscillator, elapsedSeconds) {
  if (!oscillator) {
    return 0;
  }
  const angle = (Math.PI * 2 * oscillator.frequencyHz * elapsedSeconds) + oscillator.phase;
  const value = oscillator.center + oscillator.amplitude * Math.sin(angle);
  return clamp01(value);
}

function updateRandomCycle() {
  if (!state.randomCycleEnabled) {
    return;
  }

  const elapsedSeconds = Math.max(0, performance.now() * 0.001 - state.randomCycleStartedAtSeconds);
  for (const [name, slider] of Object.entries(state.sliders)) {
    const oscillator = state.randomCycleOscillators[name];
    const next = evaluateOscillator(oscillator, elapsedSeconds);
    setSliderValue(slider, next);
  }
  if (state.intensitySlider) {
    const intensityOsc = state.randomCycleOscillators.intensity;
    const nextIntensity = evaluateOscillator(intensityOsc, elapsedSeconds);
    setSliderValue(state.intensitySlider, nextIntensity);
  }
}

function stopRandomCycle(options = {}) {
  const resetStatus = Boolean(options.resetStatus);
  state.randomCycleEnabled = false;
  state.randomCycleOscillators = {};
  state.randomCycleStartedAtSeconds = 0;
  if (state.randomCycleButton) {
    state.randomCycleButton.textContent = "Start Random Cycle";
    state.randomCycleButton.classList.remove("preset-btn-active");
  }
  if (resetStatus) {
    setStatus("Ready");
  }
}

function startRandomCycle(emotions, buttonElement) {
  stopRandomCycle();
  if (!emotions || emotions.length === 0) {
    return;
  }

  state.randomCycleEnabled = true;
  state.randomCycleButton = buttonElement || state.randomCycleButton;
  if (state.randomCycleButton) {
    state.randomCycleButton.textContent = "Stop Random Cycle";
    state.randomCycleButton.classList.add("preset-btn-active");
  }
  initializeRandomCycleOscillators(emotions);
}

function installPresets(emotions) {
  const presetContainer = document.getElementById("presets");
  presetContainer.innerHTML = "";
  stopRandomCycle();

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "preset-btn";
  clearButton.textContent = "Reset";
  clearButton.addEventListener("click", () => {
    stopRandomCycle();
    applyEmotionPreset("", { emotionLevel: 0, intensity: 0.5 });
  });
  presetContainer.appendChild(clearButton);

  for (const emotion of emotions) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preset-btn";
    btn.textContent = emotion;
    btn.addEventListener("click", () => {
      stopRandomCycle();
      applyEmotionPreset(emotion, { emotionLevel: 0.5, intensity: 0.5 });
    });
    presetContainer.appendChild(btn);
  }

  const randomCycleButton = document.createElement("button");
  randomCycleButton.type = "button";
  randomCycleButton.className = "preset-btn";
  randomCycleButton.textContent = "Start Random Cycle";
  randomCycleButton.addEventListener("click", () => {
    if (state.randomCycleEnabled) {
      stopRandomCycle({ resetStatus: true });
      return;
    }
    startRandomCycle(emotions, randomCycleButton);
  });
  presetContainer.appendChild(randomCycleButton);
  state.randomCycleButton = randomCycleButton;
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
      state.onnxInputEmotionNames = emotionNames.slice();
      state.onnxIntensityInputName =
        emotionNames.find((name) => String(name || "").trim().toLowerCase() === "intensity") || null;
      console.info("ONNX input emotion order:", emotionNames);
      if (state.onnxIntensityInputName) {
        console.info("ONNX intensity input detected:", state.onnxIntensityInputName);
      }
      if (state.onnxProfile?.mesh_object_name) {
        console.info("ONNX profile mesh:", state.onnxProfile.mesh_object_name);
      }
      if (state.onnxProfile?.export_timestamp_utc) {
        console.info("ONNX profile export timestamp (UTC):", state.onnxProfile.export_timestamp_utc);
      }
      if (state.onnxProfile?.profile_fingerprint) {
        console.info("ONNX profile fingerprint:", state.onnxProfile.profile_fingerprint);
      }
      if (state.onnxProfile?.discovery_mode) {
        console.info("ONNX discovery mode:", state.onnxProfile.discovery_mode);
      }
      if (state.onnxProfile?.discovery_weights) {
        console.info("ONNX discovery weights:", state.onnxProfile.discovery_weights);
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
      state.onnxIntensityInputName = null;
      state.onnxInputEmotionNames = [];
      if (shouldRequireOnnx()) {
        throw new Error(`ONNX required but failed: ${formatErrorMessage(error)}`);
      }
      setStatus(`ONNX unavailable (${formatErrorMessage(error)}). Using JSON mapping.`);
    }
  }

  const uiEmotionNames = emotionNames.filter(
    (name) => {
      const lower = String(name || "").trim().toLowerCase();
      return lower !== "intensity" && lower !== "neutral";
    }
  );
  buildEmotionUI(uiEmotionNames);
  installPresets(uiEmotionNames);

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

  state.textureTargetMeshes = shouldApplyTextureToAllMeshes() ? morphMeshes : [morphMesh];
  const texturePath = getRequestedTexturePath();
  if (texturePath) {
    try {
      await applyTextureFromUrl(THREE, texturePath, { label: texturePath });
      console.info(
        `Applied texture to ${state.textureTargetMeshes.length} mesh(es):`,
        texturePath
      );
    } catch (error) {
      console.warn("Auto texture apply failed:", error);
      setStatus(`Texture load failed: ${formatErrorMessage(error)}`);
    }
  }

  const profileMissing = Array.isArray(state.onnxProfile?.missing_coefficients)
    ? state.onnxProfile.missing_coefficients
    : [];
  state.runtime = new EmotionRuntime(runtimeMeshes, mapping, {
    ignoredMissingCoefficients: profileMissing
  });
  console.info("Controller source:", state.useOnnx ? "ONNX" : "JSON fallback");

  const expectedCoefficients =
    state.useOnnx && state.onnxController
      ? state.onnxController.getCoefficientNames()
      : getMappingCoefficientNames(mapping);
  const missingCoefficients = state.runtime.getMissingCoefficients(expectedCoefficients);
  const ignoredMissingLower = new Set(profileMissing.map((name) => String(name).toLowerCase()));
  const actionableMissing = missingCoefficients.filter(
    (name) => !ignoredMissingLower.has(String(name).toLowerCase())
  );
  if (actionableMissing.length > 0) {
    console.warn(
      `Model is missing ${actionableMissing.length} expected coefficient(s).`,
      actionableMissing
    );
  } else if (missingCoefficients.length > 0) {
    console.info(
      `Model has ${missingCoefficients.length} known unsupported coefficient(s) from profile.`,
      missingCoefficients
    );
  }

  const clock = new THREE.Clock();
  setStatus("Ready");

  function frame() {
    const dt = clock.getDelta();
    if (state.runtime) {
      updateRandomCycle();
      const levels = collectEmotionLevels();
      const intensity = Number(state.intensitySlider.value);

      if (state.useOnnx && state.onnxController) {
        const onnxLevels = buildNeutralSpectrumInputs(
          levels,
          intensity,
          state.onnxInputEmotionNames,
          state.onnxIntensityInputName
        );
        const signature = buildInputSignature(onnxLevels, state.onnxInputEmotionNames);
        if (signature !== state.lastEmotionSignature) {
          state.lastEmotionSignature = signature;
          state.onnxController.updateInput(onnxLevels);
        }

        state.runtime.updateFromCoefficientMap(
          state.onnxController.getLatestCoefficients(),
          1,
          dt,
          false
        );
      } else {
        const { runtimeLevels, runtimeIntensity } = buildRuntimeSpectrumInputs(levels, intensity);
        state.runtime.update(runtimeLevels, runtimeIntensity, dt);
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
