function kmeans_lch(data, k) {
  if (data.length === 0) return [];

  let centroids = [];
  for (let i = 0; i < k; i++) {
    centroids.push(data[Math.floor(Math.random() * data.length)]);
  }

  let assignments = new Array(data.length).fill(-1);

  let changed = true;
  let maxIterations = 30;

  while (changed && maxIterations > 0) {
    changed = false;
    maxIterations--;

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      let bestDist = Infinity;
      let bestIndex = -1;

      for (let c = 0; c < centroids.length; c++) {
        const dist = distanceLCH(point, centroids[c]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = c;
        }
      }

      if (assignments[i] !== bestIndex) {
        assignments[i] = bestIndex;
        changed = true;
      }
    }

    let clusterSums = Array.from({ length: k }, () => [0, 0, 0]);
    let clusterCounts = new Array(k).fill(0);

    for (let i = 0; i < data.length; i++) {
      const clusterIndex = assignments[i];
      const point = data[i];
      clusterSums[clusterIndex][0] += point[0];
      clusterSums[clusterIndex][1] += point[1];
      clusterSums[clusterIndex][2] += point[2];
      clusterCounts[clusterIndex]++;
    }

    for (let c = 0; c < k; c++) {
      if (clusterCounts[c] > 0) {
        centroids[c] = [
          clusterSums[c][0] / clusterCounts[c],
          clusterSums[c][1] / clusterCounts[c],
          clusterSums[c][2] / clusterCounts[c]
        ];
      } else {
        centroids[c] = data[Math.floor(Math.random() * data.length)];
      }
    }
  }

  return centroids;
}

function kmeans_lch_weighted(data, weights, k) {
  if (data.length === 0 || !weights || data.length !== weights.length) {
    return [];
  }

  let centroids = [];
  for (let i = 0; i < k; i++) {
    const randIndex = Math.floor(Math.random() * data.length);
    centroids.push(data[randIndex]);
  }

  let assignments = new Array(data.length).fill(-1);

  let changed = true;
  let maxIterations = 30;

  while (changed && maxIterations > 0) {
    changed = false;
    maxIterations--;

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      let bestDist = Infinity;
      let bestIndex = -1;

      for (let c = 0; c < centroids.length; c++) {
        const dist = distanceLCH(point, centroids[c]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = c;
        }
      }

      if (assignments[i] !== bestIndex) {
        assignments[i] = bestIndex;
        changed = true;
      }
    }

    let clusterSums = Array.from({ length: k }, () => [0, 0, 0]);
    let clusterWeights = new Array(k).fill(0);

    for (let i = 0; i < data.length; i++) {
      const clusterIndex = assignments[i];
      const w = weights[i];
      clusterSums[clusterIndex][0] += data[i][0] * w;
      clusterSums[clusterIndex][1] += data[i][1] * w;
      clusterSums[clusterIndex][2] += data[i][2] * w;
      clusterWeights[clusterIndex] += w;
    }

    for (let c = 0; c < k; c++) {
      if (clusterWeights[c] > 0) {
        centroids[c] = [
          clusterSums[c][0] / clusterWeights[c],
          clusterSums[c][1] / clusterWeights[c],
          clusterSums[c][2] / clusterWeights[c]
        ];
      } else {
        const randIndex = Math.floor(Math.random() * data.length);
        centroids[c] = data[randIndex];
      }
    }
  }

  return centroids;
}

function distanceLCH(a, b) {
  const dL = a[0] - b[0];
  const dC = a[1] - b[1];
  let dH = a[2] - b[2];
  if (dH > 180) dH -= 360;
  if (dH < -180) dH += 360;

  return Math.sqrt(dL * dL + dC * dC + dH * dH);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    kmeans_lch,
    kmeans_lch_weighted
  };
}
