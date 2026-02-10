function clamp01(value) {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function makeCaseInsensitiveMap(object) {
  const result = {};
  for (const [key, value] of Object.entries(object)) {
    result[key.toLowerCase()] = value;
  }
  return result;
}

export class EmotionRuntime {
  constructor(faceMeshes, mappingConfig, options = {}) {
    const meshList = Array.isArray(faceMeshes) ? faceMeshes : [faceMeshes];
    this.faceMeshes = meshList.filter(
      (mesh) => mesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences
    );
    if (this.faceMeshes.length === 0) {
      throw new Error("EmotionRuntime requires at least one morph-target mesh.");
    }

    this.mappingConfig = mappingConfig;
    this.ignoredMissingCoefficients = new Set(
      (options.ignoredMissingCoefficients || []).map((name) => String(name).toLowerCase())
    );
    this.current = {};
    this.target = {};
    this.warnedMissingCoefficients = new Set();
    this.meshStates = this.faceMeshes.map((mesh) => {
      const dict = mesh.morphTargetDictionary || {};
      return {
        morphNameToIndex: makeCaseInsensitiveMap(dict),
        morphInfluences: mesh.morphTargetInfluences || []
      };
    });

    this.availableMorphNames = new Set();
    for (const state of this.meshStates) {
      for (const key of Object.keys(state.morphNameToIndex)) {
        this.availableMorphNames.add(key);
      }
    }
  }

  reset() {
    for (const state of this.meshStates) {
      for (let i = 0; i < state.morphInfluences.length; i += 1) {
        state.morphInfluences[i] = 0;
      }
    }
    this.current = {};
    this.target = {};
  }

  getMissingCoefficients(coefficientNames) {
    const missing = [];
    for (const name of coefficientNames || []) {
      if (!this.availableMorphNames.has(String(name).toLowerCase())) {
        missing.push(name);
      }
    }
    return missing;
  }

  update(emotionLevels, intensity, dtSeconds) {
    this.target = this.composeTargets(emotionLevels, intensity);
    this.updateFromCoefficientMap(this.target, 1, dtSeconds, true);
  }

  updateFromCoefficientMap(coefficientMap, intensity, dtSeconds, applyConflicts = true) {
    const scaledTargets = {};
    const clampedIntensity = clamp01(intensity);

    for (const [name, value] of Object.entries(coefficientMap || {})) {
      scaledTargets[name] = clamp01((value || 0) * clampedIntensity);
    }

    this.target = scaledTargets;
    if (applyConflicts) {
      this.applyConflicts(this.target);
    }
    this.smoothAndWrite(this.target, dtSeconds);
  }

  composeTargets(emotionLevels, intensity) {
    const targets = {};
    const emotions = this.mappingConfig.emotions || {};

    for (const [emotion, level] of Object.entries(emotionLevels)) {
      const entry = emotions[emotion];
      if (!entry || !entry.coefficients) {
        continue;
      }
      const clampedLevel = clamp01(level);
      for (const [coefficient, baseWeight] of Object.entries(entry.coefficients)) {
        const prev = targets[coefficient] || 0;
        targets[coefficient] = prev + baseWeight * clampedLevel;
      }
    }

    const clampedIntensity = clamp01(intensity);
    for (const key of Object.keys(targets)) {
      targets[key] = clamp01(targets[key] * clampedIntensity);
    }

    return targets;
  }

  applyConflicts(targets) {
    const conflicts = this.mappingConfig.conflicts || [];
    for (const conflict of conflicts) {
      const strength = clamp01(conflict.strength ?? 0.7);
      const groupA = conflict.groupA || [];
      const groupB = conflict.groupB || [];

      const aMean = this.meanWeight(targets, groupA);
      const bMean = this.meanWeight(targets, groupB);

      if (aMean === 0 || bMean === 0) {
        continue;
      }

      if (aMean > bMean) {
        this.scaleGroup(targets, groupB, 1 - strength);
      } else if (bMean > aMean) {
        this.scaleGroup(targets, groupA, 1 - strength);
      } else {
        this.scaleGroup(targets, groupA, 1 - strength * 0.5);
        this.scaleGroup(targets, groupB, 1 - strength * 0.5);
      }
    }
  }

  meanWeight(targets, names) {
    if (!names.length) {
      return 0;
    }
    let sum = 0;
    for (const name of names) {
      sum += targets[name] || 0;
    }
    return sum / names.length;
  }

  scaleGroup(targets, names, scale) {
    for (const name of names) {
      if (name in targets) {
        targets[name] = clamp01((targets[name] || 0) * scale);
      }
    }
  }

  smoothAndWrite(targets, dtSeconds) {
    const smoothing = this.mappingConfig.smoothing || {};
    const defaultTau = smoothing.defaultTauSeconds || 0.12;
    const overrides = smoothing.overrides || {};

    const coefficientNames = new Set([
      ...Object.keys(targets),
      ...Object.keys(this.current)
    ]);

    for (const coefficient of coefficientNames) {
      const targetValue = clamp01(targets[coefficient] || 0);
      const currentValue = clamp01(this.current[coefficient] || 0);
      const tau = overrides[coefficient] || defaultTau;
      const alpha = 1 - Math.exp(-Math.max(dtSeconds, 0.0001) / Math.max(tau, 0.0001));
      const nextValue = clamp01(currentValue + (targetValue - currentValue) * alpha);
      this.current[coefficient] = nextValue;
      this.writeCoefficient(coefficient, nextValue);
    }
  }

  writeCoefficient(coefficientName, value) {
    const key = coefficientName.toLowerCase();
    let wroteAny = false;

    for (const state of this.meshStates) {
      const index = state.morphNameToIndex[key];
      if (index === undefined) {
        continue;
      }
      state.morphInfluences[index] = value;
      wroteAny = true;
    }

    if (!wroteAny) {
      if (this.ignoredMissingCoefficients.has(key)) {
        return;
      }
      if (!this.warnedMissingCoefficients.has(key)) {
        this.warnedMissingCoefficients.add(key);
        console.warn(`Coefficient "${coefficientName}" not found in model morph targets.`);
      }
      return;
    }
  }
}
