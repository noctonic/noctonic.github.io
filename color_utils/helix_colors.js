//depends on colorConversion.js
function helixPoint(helixParams, t) {
  const {
    startZ,
    endZ,
    turns,
    amplitude,
    direction,
    initialAngleDeg,
    scaleX,
    scaleZ
  } = helixParams;

  const initialAngle = (initialAngleDeg || 0) * (Math.PI / 180);
  const z = startZ + (endZ - startZ) * t;
  const angle = initialAngle + direction * turns * 2 * Math.PI * t;
  const r = amplitude * Math.sin(Math.PI * t);

  return {
    x: r * Math.cos(angle) * scaleX,
    y: r * Math.sin(angle) * scaleZ,
    z: z
  };
}

function buildArcLengthTable(helixParams, NUM_STEPS_FOR_ARCLENGTH = 2000) {
  const arcTable = [];
  arcTable.push({ t: 0, length: 0 });

  let oldPt = helixPoint(helixParams, 0);
  let lengthSoFar = 0;

  for (let i = 1; i <= NUM_STEPS_FOR_ARCLENGTH; i++) {
    const t = i / NUM_STEPS_FOR_ARCLENGTH;
    const newPt = helixPoint(helixParams, t);

    const dx = newPt.x - oldPt.x;
    const dy = newPt.y - oldPt.y;
    const dz = newPt.z - oldPt.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

    lengthSoFar += dist;
    arcTable.push({ t: t, length: lengthSoFar });

    oldPt = newPt;
  }

  return arcTable;
}

function findTforArcLength(arcTable, sDesired) {
  if (sDesired <= 0) {
    return 0;
  }
  const last = arcTable[arcTable.length - 1].length;
  if (sDesired >= last) {
    return 1;
  }

  let low = 0;
  let high = arcTable.length - 1;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (arcTable[mid].length < sDesired) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const s0 = arcTable[low].length;
  const s1 = arcTable[high].length;
  const t0 = arcTable[low].t;
  const t1 = arcTable[high].t;

  const ratio = (sDesired - s0) / (s1 - s0);
  return t0 + ratio*(t1 - t0);
}
function isInGamut(rgb) {
  return (
    rgb.r >= 0 && rgb.r <= 1 &&
    rgb.g >= 0 && rgb.g <= 1 &&
    rgb.b >= 0 && rgb.b <= 1
  );
}

function computeMaxChroma(L, h,maxChromaValue, epsilon = 0.01) {
  let low = 0;
  let high = maxChromaValue;
  while (high - low > epsilon) {
    const mid = (low + high) / 2;
    const rgb = lch2rgb(L, mid, h);
    if (isInGamut(rgb)) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return low;
}
function pointToColorHex(x, y, z,maxChromaValue) {

  const cylBottom = -0.5; 
  const cylHeight = 1.0;
  const heightVal = z - cylBottom;
  let L = (heightVal / cylHeight) * 100;
  L = Math.max(0, Math.min(100, L));

  let angleDeg = (Math.atan2(y, x) * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  const distanceVal = Math.sqrt(x*x + y*y);

  const maxChr = computeMaxChroma(L, angleDeg,maxChromaValue);
  const chroma = maxChr * Math.min(1, distanceVal);

  const rgb = lch2rgb(L, chroma, angleDeg);
  return rgbToHex(rgb);
}
function getHelixColors(helixParams) {
  const { numColors, maxChroma } = helixParams;

  const arcTable = buildArcLengthTable(helixParams);
  const totalLength = arcTable[arcTable.length - 1].length;
  const colors = [];

  if (numColors === 1) {
    const { x, y, z } = helixPoint(helixParams, 0);
    const colorHex = pointToColorHex(x, y, z, maxChroma);
    colors.push(colorHex);
    return colors;
  }

  for (let i = 0; i < numColors; i++) {
    const sDesired = (i * totalLength) / (numColors - 1);

    const t_i = findTforArcLength(arcTable, sDesired);

    const { x, y, z } = helixPoint(helixParams, t_i);

    const colorHex = pointToColorHex(x, y, z, maxChroma);
    colors.push(colorHex);
  }

  return colors;
}

function getHelixColors(helixParams, numColors,maxChromaValue) {
  const arcTable = buildArcLengthTable(helixParams);

  const totalLength = arcTable[arcTable.length - 1].length;
  const colors = [];

  if (numColors === 1) {
    const { x, y, z } = helixPoint(helixParams, 0);
    const colorHex = pointToColorHex(x, y, z);
    colors.push(colorHex);
    return colors;
  }

  for (let i = 0; i < numColors; i++) {
    const sDesired = (i * totalLength) / (numColors - 1);

    const t_i = findTforArcLength(arcTable, sDesired);

    const { x, y, z } = helixPoint(helixParams, t_i);

    const colorHex = pointToColorHex(x, y, z,maxChromaValue);
    colors.push(colorHex);
  }

  return colors;
}

// helixParams = {
//   // startZ: float in the range [-1, 1]
//   // Controls where the helix starts on the Z-axis
//   startZ: -0.5,
//
//   // endZ: float in the range [-1, 1]
//   // Controls where the helix ends on the Z-axis
//   endZ: 0.5,
//
//   // turns: float in the range [-2, 2]
//   // The total number of rotations from startZ to endZ
//   turns: 0.6,
//
//   // amplitude: float in the range [-1, 1]
//   // The maximum radial offset for each rotation (wave-like effect)
//   amplitude: 1,
//
//   // direction: float in the range [-1, 1]
//   // Determines the spiral direction and can invert the helix
//   direction: -1,
//
//   // initialAngleDeg: float in the range [0, 360]
//   // The starting angle in degrees when drawing the helix
//   initialAngleDeg: 0,
//
//   // scaleX: float in the range [0.1, 3]
//   // Elliptical scaling on the X-axis
//   scaleX: 1,
//
//   // scaleZ: float in the range [0.1, 3]
//   // Elliptical scaling on the Z-axis
//   scaleZ: 1,
//
//   // maxChroma: integer in the range [1, 400]
//   // Maximum chroma (intensity) for color generation
//   maxChroma: 60,
//
//   // numColors: integer in the range [1, 256]
//   // Number of discrete colors along the helix
//   numColors: 32
// };
