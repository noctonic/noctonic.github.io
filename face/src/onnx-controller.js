export const DEFAULT_ONNX_EMOTIONS = [
  "angry",
  "disgust",
  "fear",
  "happy",
  "sad",
  "surprise",
  "neutral"
];
const CANONICAL_EMOTION_SET = new Set(DEFAULT_ONNX_EMOTIONS);

const DEFAULT_SUPPRESSED_EMOTION_CHANNELS = [
  "eyeLookDownLeft",
  "eyeLookDownRight",
  "eyeLookInLeft",
  "eyeLookInRight",
  "eyeLookOutLeft",
  "eyeLookOutRight",
  "eyeLookUpLeft",
  "eyeLookUpRight",
  "jawForward",
  "jawLeft",
  "jawRight",
  "mouthLeft",
  "mouthRight",
  "tongueOut"
];

const DEFAULT_SYMMETRY_PAIRS = [
  ["browDownLeft", "browDownRight"],
  ["browOuterUpLeft", "browOuterUpRight"],
  ["cheekSquintLeft", "cheekSquintRight"],
  ["eyeBlinkLeft", "eyeBlinkRight"],
  ["eyeSquintLeft", "eyeSquintRight"],
  ["eyeWideLeft", "eyeWideRight"],
  ["mouthSmileLeft", "mouthSmileRight"],
  ["mouthFrownLeft", "mouthFrownRight"],
  ["mouthDimpleLeft", "mouthDimpleRight"],
  ["mouthStretchLeft", "mouthStretchRight"],
  ["mouthPressLeft", "mouthPressRight"],
  ["mouthLowerDownLeft", "mouthLowerDownRight"],
  ["mouthUpperUpLeft", "mouthUpperUpRight"],
  ["noseSneerLeft", "noseSneerRight"]
];

const DEFAULT_MAX_CAPS = {
  jawOpen: 0.05,
  mouthUpperUpLeft: 0.35,
  mouthUpperUpRight: 0.35,
  cheekPuff: 0.25,
  mouthClose: 0.8,
  mouthFunnel: 0.85,
  mouthPucker: 0.85
};

function ensureTrailingSlash(path) {
  if (!path) {
    return "";
  }
  return path.endsWith("/") ? path : `${path}/`;
}

function toAbsoluteUrl(path) {
  if (!path) {
    return "";
  }
  try {
    const baseHref = globalThis.location?.href || "http://localhost/";
    return new URL(path, baseHref).href;
  } catch {
    return path;
  }
}

function toModelSidecarConfig(modelPath) {
  if (!modelPath) {
    return null;
  }

  try {
    const modelUrl = new URL(toAbsoluteUrl(modelPath));
    const modelName = modelUrl.pathname.split("/").pop();
    if (!modelName) {
      return null;
    }
    const sidecarName = `${modelName}.data`;
    const sidecarUrl = new URL(sidecarName, modelUrl).href;
    return {
      path: sidecarName,
      data: sidecarUrl
    };
  } catch {
    const modelName = String(modelPath).split(/[\\/]/).pop();
    if (!modelName) {
      return null;
    }
    return {
      path: `${modelName}.data`,
      data: `${modelPath}.data`
    };
  }
}

function clamp01(value) {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function describeError(error) {
  if (error === null || error === undefined) {
    return "unknown error";
  }
  if (error instanceof Error) {
    return error.message || error.toString();
  }
  if (typeof error === "number") {
    return `numeric runtime error: ${error}`;
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

function getQueryParam(name) {
  try {
    const params = new URLSearchParams(globalThis.location?.search || "");
    return params.get(name);
  } catch {
    return null;
  }
}

function normalizeChannelName(name) {
  return String(name || "").trim();
}

function normalizeSymmetryPairs(pairs) {
  if (!Array.isArray(pairs)) {
    return DEFAULT_SYMMETRY_PAIRS.slice();
  }
  const out = [];
  for (const pair of pairs) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      continue;
    }
    const left = normalizeChannelName(pair[0]);
    const right = normalizeChannelName(pair[1]);
    if (!left || !right) {
      continue;
    }
    out.push([left, right]);
  }
  return out.length > 0 ? out : DEFAULT_SYMMETRY_PAIRS.slice();
}

function normalizeSuppressedChannels(channels) {
  if (!Array.isArray(channels)) {
    return DEFAULT_SUPPRESSED_EMOTION_CHANNELS.slice();
  }
  const out = [];
  for (const name of channels) {
    const normalized = normalizeChannelName(name);
    if (normalized) {
      out.push(normalized);
    }
  }
  return out.length > 0 ? out : DEFAULT_SUPPRESSED_EMOTION_CHANNELS.slice();
}

function normalizeMaxCaps(caps) {
  const merged = { ...DEFAULT_MAX_CAPS };
  if (!caps || typeof caps !== "object") {
    return merged;
  }

  for (const [name, value] of Object.entries(caps)) {
    const key = normalizeChannelName(name);
    const numeric = Number(value);
    if (!key || !Number.isFinite(numeric)) {
      continue;
    }
    merged[key] = clamp01(numeric);
  }
  return merged;
}

function resolvePostprocessMode(modeFromArgs = null) {
  const fromQuery = (getQueryParam("onnxPostprocess") || "").trim().toLowerCase();
  if (fromQuery === "legacy" || fromQuery === "soft" || fromQuery === "raw") {
    return fromQuery;
  }

  const fromArgs = String(modeFromArgs || "").trim().toLowerCase();
  if (fromArgs === "legacy" || fromArgs === "soft" || fromArgs === "raw") {
    return fromArgs;
  }

  // Default to raw so runtime mirrors model outputs from notebook training.
  return "raw";
}

function buildPostprocessConfig(profile, mode) {
  const suppressed = normalizeSuppressedChannels(profile?.suppressed_channels);
  const symmetryPairs = normalizeSymmetryPairs(profile?.symmetry_pairs);
  const maxCaps = normalizeMaxCaps(profile?.max_caps);

  if (mode === "legacy") {
    return {
      mode,
      deadzone: 0.01,
      suppressedScale: 0.0,
      symmetryBlend: 1.0,
      suppressedSet: new Set(suppressed),
      symmetryPairs,
      maxCaps
    };
  }

  if (mode === "soft") {
    return {
      mode,
      deadzone: 0.005,
      suppressedScale: 0.85,
      symmetryBlend: 0.2,
      suppressedSet: new Set(suppressed),
      symmetryPairs,
      maxCaps
    };
  }

  return {
    mode: "raw",
    deadzone: 0.0,
    suppressedScale: 1.0,
    symmetryBlend: 0.0,
    suppressedSet: new Set(),
    symmetryPairs: [],
    maxCaps
  };
}

function stabilizeCoefficientMap(rawMap, postprocessConfig) {
  const cfg = postprocessConfig || {
    deadzone: 0.0,
    suppressedScale: 1.0,
    symmetryBlend: 0.0,
    suppressedSet: new Set(),
    symmetryPairs: [],
    maxCaps: { ...DEFAULT_MAX_CAPS }
  };

  const result = {};
  for (const [name, value] of Object.entries(rawMap || {})) {
    let v = clamp01(value);
    if (cfg.suppressedSet.has(name)) {
      v *= cfg.suppressedScale;
    }
    if (v < cfg.deadzone) {
      v = 0;
    }
    const cap = cfg.maxCaps?.[name];
    if (Number.isFinite(cap)) {
      v = Math.min(v, clamp01(cap));
    }
    result[name] = v;
  }

  const blend = clamp01(cfg.symmetryBlend);
  for (const [left, right] of cfg.symmetryPairs) {
    if (!(left in result) || !(right in result)) {
      continue;
    }
    if (blend <= 0) {
      continue;
    }
    const leftValue = clamp01(result[left]);
    const rightValue = clamp01(result[right]);
    const avg = clamp01((leftValue + rightValue) * 0.5);
    result[left] = clamp01(leftValue * (1 - blend) + avg * blend);
    result[right] = clamp01(rightValue * (1 - blend) + avg * blend);
  }

  for (const [name, cap] of Object.entries(cfg.maxCaps || {})) {
    if (!(name in result)) {
      continue;
    }
    result[name] = Math.min(clamp01(result[name]), clamp01(cap));
  }

  return result;
}

function normalizeEmotionVector(levelsByName, emotionNames) {
  const vector = new Float32Array(emotionNames.length);
  const normalizedNames = emotionNames.map((name) => String(name || "").trim().toLowerCase());
  const emotionIndices = [];
  const passthroughIndices = [];
  let intensityIndex = -1;

  for (let i = 0; i < normalizedNames.length; i += 1) {
    const name = normalizedNames[i];
    if (name === "intensity") {
      intensityIndex = i;
      continue;
    }
    if (CANONICAL_EMOTION_SET.has(name)) {
      emotionIndices.push(i);
      continue;
    }
    passthroughIndices.push(i);
  }

  // Normalize only canonical emotion channels as a simplex.
  let sum = 0;
  for (const i of emotionIndices) {
    const name = emotionNames[i];
    const value = Math.max(0, Number(levelsByName[name] || 0));
    vector[i] = value;
    sum += value;
  }
  if (emotionIndices.length > 0) {
    if (sum <= 0) {
      const neutralIndex = normalizedNames.indexOf("neutral");
      if (neutralIndex >= 0) {
        vector[neutralIndex] = 1;
      }
    } else {
      for (const i of emotionIndices) {
        vector[i] /= sum;
      }
    }
  }

  // Unknown additional channels are passthrough [0,1].
  for (const i of passthroughIndices) {
    const name = emotionNames[i];
    vector[i] = clamp01(Number(levelsByName[name] || 0));
  }

  // Intensity is independent and not part of simplex normalization.
  if (intensityIndex >= 0) {
    const key = emotionNames[intensityIndex];
    vector[intensityIndex] = clamp01(Number(levelsByName[key] ?? 1));
  }

  return vector;
}

function normalizeEmotionNames(emotionNames) {
  return emotionNames.map((name) => String(name || "").trim().toLowerCase());
}

function validateEmotionNames(emotionNames) {
  if (!Array.isArray(emotionNames) || emotionNames.length < 7 || emotionNames.length > 16) {
    throw new Error("ONNX input names must be a JSON array of length 7-16.");
  }

  const normalized = normalizeEmotionNames(emotionNames);
  if (normalized.some((name) => !name)) {
    throw new Error("ONNX input emotion names cannot be empty.");
  }

  const unique = new Set(normalized);
  if (unique.size !== normalized.length) {
    throw new Error("ONNX input emotion names must be unique.");
  }

  return normalized;
}

async function loadInputEmotionNames(inputNamesPath) {
  if (!inputNamesPath) {
    return DEFAULT_ONNX_EMOTIONS.slice();
  }

  const response = await fetch(inputNamesPath);
  if (!response.ok) {
    throw new Error(`Failed to load input emotion names from ${inputNamesPath}`);
  }

  const inputNames = await response.json();
  return validateEmotionNames(inputNames);
}

async function loadOptionalJson(path) {
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

async function fetchBinary(path) {
  const url = toAbsoluteUrl(path);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch binary: ${url} (${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export class OnnxEmotionController {
  static async create({
    modelPath,
    coeffNamesPath,
    wasmDistPath,
    inputNamesPath = null,
    profilePath = null,
    postprocessMode = null
  }) {
    const ortModule = await import("../assets/vendor/onnxruntime-web/dist/ort.wasm.min.mjs");
    const ort = ortModule.default || ortModule;

    const wasmBasePath = ensureTrailingSlash(toAbsoluteUrl(wasmDistPath));
    ort.env.wasm.wasmPaths = {
      mjs: `${wasmBasePath}ort-wasm-simd-threaded.mjs`,
      wasm: `${wasmBasePath}ort-wasm-simd-threaded.wasm`
    };
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;
    ort.env.wasm.proxy = false;

    const coeffNamesResponse = await fetch(coeffNamesPath);
    if (!coeffNamesResponse.ok) {
      throw new Error(`Failed to load coefficient names from ${coeffNamesPath}`);
    }
    const coeffNames = await coeffNamesResponse.json();
    if (!Array.isArray(coeffNames) || coeffNames.length !== 52) {
      throw new Error(`Coefficient names must be a JSON array of length 52: ${coeffNamesPath}`);
    }
    let emotionNames = DEFAULT_ONNX_EMOTIONS.slice();
    try {
      emotionNames = await loadInputEmotionNames(inputNamesPath);
    } catch (error) {
      console.warn(
        `Failed to load ONNX input emotion names (${error?.message || error}). Using defaults.`,
        DEFAULT_ONNX_EMOTIONS
      );
    }

    const profile = await loadOptionalJson(profilePath);
    const mode = resolvePostprocessMode(postprocessMode);
    const postprocessConfig = buildPostprocessConfig(profile, mode);
    console.info("ONNX postprocess mode:", postprocessConfig.mode);

    const sessionOptions = {
      executionProviders: ["wasm"]
    };
    const resolvedModelPath = toAbsoluteUrl(modelPath);
    const sidecarConfig = toModelSidecarConfig(resolvedModelPath);

    const attemptErrors = [];
    const tryCreate = async (label, createFn) => {
      try {
        const session = await createFn();
        return session;
      } catch (error) {
        attemptErrors.push(`${label}: ${describeError(error)}`);
        return null;
      }
    };

    let modelBinary = null;
    let sidecarBinary = null;

    modelBinary = await tryCreate("model fetch", async () => {
      const bytes = await fetchBinary(resolvedModelPath);
      return bytes;
    });

    if (sidecarConfig) {
      sidecarBinary = await tryCreate("sidecar fetch", async () => {
        const bytes = await fetchBinary(sidecarConfig.data);
        return bytes;
      });
    }

    let session = null;
    if (modelBinary && sidecarConfig && sidecarBinary) {
      session = await tryCreate("create from model+sidecar bytes", async () =>
        ort.InferenceSession.create(modelBinary, {
          ...sessionOptions,
          externalData: [
            {
              path: sidecarConfig.path,
              data: sidecarBinary
            }
          ]
        })
      );
    }

    if (!session && modelBinary) {
      session = await tryCreate("create from model bytes", async () =>
        ort.InferenceSession.create(modelBinary, sessionOptions)
      );
    }

    if (!session) {
      session = await tryCreate("create from model URL", async () =>
        ort.InferenceSession.create(resolvedModelPath, sessionOptions)
      );
    }

    if (!session && sidecarConfig) {
      session = await tryCreate("create from URL + sidecar URL", async () =>
        ort.InferenceSession.create(resolvedModelPath, {
          ...sessionOptions,
          externalData: [sidecarConfig]
        })
      );
    }

    if (!session) {
      throw new Error(
        `Failed to initialize ONNX session. Attempts: ${attemptErrors.join(" | ")}`
      );
    }

    return new OnnxEmotionController(ort, session, coeffNames, emotionNames, postprocessConfig);
  }

  constructor(ort, session, coeffNames, emotionNames, postprocessConfig) {
    this.ort = ort;
    this.session = session;
    this.coeffNames = coeffNames;
    this.emotionNames = emotionNames;
    this.postprocessConfig = postprocessConfig || buildPostprocessConfig(null, "raw");
    this.latestCoefficients = {};
    this.lastError = null;
    this.isRunning = false;
    this.shouldRunAgain = false;
    this.latestLevels = {};
  }

  getEmotionNames() {
    return this.emotionNames.slice();
  }

  getLatestCoefficients() {
    return this.latestCoefficients;
  }

  getCoefficientNames() {
    return this.coeffNames.slice();
  }

  getInputEmotionNames() {
    return this.emotionNames.slice();
  }

  getLastError() {
    return this.lastError;
  }

  updateInput(levelsByName) {
    this.latestLevels = { ...levelsByName };

    if (this.isRunning) {
      this.shouldRunAgain = true;
      return;
    }

    this.runLoop();
  }

  async runLoop() {
    this.isRunning = true;
    do {
      this.shouldRunAgain = false;
      try {
        const coeffs = await this.infer(this.latestLevels);
        this.latestCoefficients = coeffs;
        this.lastError = null;
      } catch (error) {
        this.lastError = error;
      }
    } while (this.shouldRunAgain);
    this.isRunning = false;
  }

  async infer(levelsByName) {
    const vector = normalizeEmotionVector(levelsByName, this.emotionNames);
    const input = new this.ort.Tensor("float32", vector, [1, this.emotionNames.length]);

    const outputMap = await this.session.run({
      emotion_probs: input
    });

    const coeffTensor = outputMap.arkit52_coeffs || outputMap[Object.keys(outputMap)[0]];
    if (!coeffTensor) {
      throw new Error("ONNX output did not contain arkit52 coefficients.");
    }

    const values = coeffTensor.data;
    const result = {};
    const count = Math.min(this.coeffNames.length, values.length);
    for (let i = 0; i < count; i += 1) {
      result[this.coeffNames[i]] = clamp01(values[i]);
    }

    return stabilizeCoefficientMap(result, this.postprocessConfig);
  }

  async probeEmotionBasis(topK = 8) {
    const summaries = {};
    for (const emotion of this.emotionNames) {
      const levels = {};
      for (const name of this.emotionNames) {
        levels[name] = name === emotion ? 1 : 0;
      }

      const coeffs = await this.infer(levels);
      const top = Object.entries(coeffs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.max(1, topK))
        .map(([name, value]) => [name, Number(value).toFixed(3)]);
      summaries[emotion] = top;
    }
    return summaries;
  }
}
