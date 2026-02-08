import { EmotionRuntime } from "./emotion-runtime.js";

const MODEL_PATH = "./assets/models/face.glb";
const MAPPING_PATH = "./assets/config/emotion_coefficients_v0.json";

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
  gltfLoader: null
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
    const [threeModule, gltfModule, orbitModule] = await Promise.all([
      import("../assets/vendor/three/build/three.module.js"),
      import("../assets/vendor/three/examples/jsm/loaders/GLTFLoader.js"),
      import("../assets/vendor/three/examples/jsm/controls/OrbitControls.js")
    ]);
    return {
      THREE: threeModule,
      GLTFLoader: gltfModule.GLTFLoader,
      OrbitControls: orbitModule.OrbitControls
    };
  } catch (error) {
    throw new Error(
      "Missing local Three.js vendor modules. Expected files under assets/vendor/three/."
    );
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

function resolveMorphMesh(root) {
  let result = null;
  let bestScore = -Infinity;
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.morphTargetDictionary || !obj.morphTargetInfluences) {
      return;
    }

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
  });
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
  if (fallbackMesh) {
    fallbackMesh.getWorldPosition(target);
  }
  target.y += 0.03;

  state.orbitControls.target.copy(target);
  state.camera.position.set(target.x, target.y + 0.01, target.z + 0.6);
  state.camera.lookAt(target);
  state.camera.near = 0.01;
  state.camera.far = 50;
  state.camera.updateProjectionMatrix();
  state.orbitControls.minDistance = 0.25;
  state.orbitControls.maxDistance = 6;
  state.orbitControls.update();
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
  if (!Number.isFinite(maxDim) || maxDim < 0.01 || maxDim > 10) {
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

async function loadFaceModel(THREE, GLTFLoader) {
  const loader = new GLTFLoader();
  state.gltfLoader = loader;

  return new Promise((resolve, reject) => {
    loader.load(
      MODEL_PATH,
      (gltf) => {
        const root = gltf.scene;
        root.position.set(0, 0, 0);
        root.scale.setScalar(1.0);
        state.scene.add(root);

        const morphMesh = resolveMorphMesh(root);
        if (!morphMesh) {
          reject(
            new Error(
              "Loaded model has no morph targets. Make sure assets/models/face.glb contains ARKit-style blendshapes."
            )
          );
          return;
        }

        const visibleFaceMeshes = isolateFaceView(root, morphMesh);
        frameCameraToFace(THREE, visibleFaceMeshes, morphMesh);

        resolve({ root, morphMesh });
      },
      undefined,
      (error) => {
        reject(
          new Error(
            `Could not load ${MODEL_PATH}. Add your model at that path and refresh.`
          )
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

function buildEmotionUI(mapping) {
  const container = document.getElementById("emotion-sliders");
  container.innerHTML = "";

  const emotions = Object.keys(mapping.emotions || {});
  state.sliders = {};

  for (const emotion of emotions) {
    const { row, input } = createSliderRow(emotion, 0);
    container.appendChild(row);
    state.sliders[emotion] = input;
  }

  const intensityWrap = document.getElementById("intensity-slider");
  intensityWrap.innerHTML = "";
  const { row: intensityRow, input: intensityInput } = createSliderRow("intensity", 0.30);
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

function installPresets(mapping) {
  const presetContainer = document.getElementById("presets");
  presetContainer.innerHTML = "";
  const emotions = Object.keys(mapping.emotions || {});

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

  buildEmotionUI(mapping);
  installPresets(mapping);

  setStatus("Loading local Three.js modules...");
  const { THREE, GLTFLoader, OrbitControls } = await loadThreeModules();
  state.three = THREE;

  initScene(THREE, OrbitControls);
  window.addEventListener("resize", onResize);
  onResize();

  setStatus("Loading face model...");
  const { morphMesh } = await loadFaceModel(THREE, GLTFLoader);
  state.runtime = new EmotionRuntime(morphMesh, mapping);

  const clock = new THREE.Clock();
  setStatus("Ready");

  function frame() {
    const dt = clock.getDelta();
    if (state.runtime) {
      state.runtime.update(
        collectEmotionLevels(),
        Number(state.intensitySlider.value),
        dt
      );
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
