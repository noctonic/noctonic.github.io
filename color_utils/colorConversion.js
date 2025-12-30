function rgb2hex(rgb) {
  const [R, G, B] = rgb
  let r = Math.max(0, Math.min(255, Math.round(R)));
  let g = Math.max(0, Math.min(255, Math.round(G)));
  let b = Math.max(0, Math.min(255, Math.round(B)));

  const toHex = (value) => {
    const hx = value.toString(16);
    return hx.length === 1 ? '0' + hx : hx;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hex2rgb(hex) {
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }

  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return [r, g, b];
  } else if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [r, g, b];
  } else {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
}

const M_D65toD50 = [
  [ 1.0478112,  0.0228866, -0.0501270 ],
  [ 0.0295424,  0.9904844, -0.0170491 ],
  [-0.0092345,  0.0150436,  0.7521316 ]
];

const M_D50toD65 = [
  [  0.9555766, -0.0230393,  0.0631636 ],
  [ -0.0282895,  1.0099416,  0.0210077 ],
  [  0.0122982, -0.0204830,  1.3299098 ]
];

function bradfordAdaptXYZtoD50(xyz) {
  const [x, y, z] = xyz;
  const X = x*M_D65toD50[0][0] + y*M_D65toD50[0][1] + z*M_D65toD50[0][2];
  const Y = x*M_D65toD50[1][0] + y*M_D65toD50[1][1] + z*M_D65toD50[1][2];
  const Z = x*M_D65toD50[2][0] + y*M_D65toD50[2][1] + z*M_D65toD50[2][2];
  return [X, Y, Z];
}

function bradfordAdaptXYZtoD65(xyz) {
  const [x, y, z] = xyz;
  const X = x * M_D50toD65[0][0] + y * M_D50toD65[0][1] + z * M_D50toD65[0][2];
  const Y = x * M_D50toD65[1][0] + y * M_D50toD65[1][1] + z * M_D50toD65[1][2];
  const Z = x * M_D50toD65[2][0] + y * M_D50toD65[2][1] + z * M_D50toD65[2][2];
  return [X, Y, Z];
}

function rgb2xyz(rgb) {
  let [r, g, b] = rgb;
  r /= 255;
  g /= 255;
  b /= 255;

  r = r <= 0.04045 ? r / 12.92 : ((r + 0.055) / 1.055) ** 2.4;
  g = g <= 0.04045 ? g / 12.92 : ((g + 0.055) / 1.055) ** 2.4;
  b = b <= 0.04045 ? b / 12.92 : ((b + 0.055) / 1.055) ** 2.4;

  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;

  return [x, y, z];
}

function xyz2rgb(xyz) {
  let [x, y, z] = xyz;
  x /= 100;
  y /= 100;
  z /= 100;

  let r = (x * 3.2406) + (y * -1.5372) + (z * -0.4986);
  let g = (x * -0.9689) + (y *  1.8758) + (z *  0.0415);
  let b = (x *  0.0557) + (y * -0.2040) + (z *  1.0570);

  r = r > 0.0031308 ? 1.055 * (r ** (1.0 / 2.4)) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * (g ** (1.0 / 2.4)) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * (b ** (1.0 / 2.4)) - 0.055 : 12.92 * b;

  r = Math.min(Math.max(0, r * 255), 255);
  g = Math.min(Math.max(0, g * 255), 255);
  b = Math.min(Math.max(0, b * 255), 255);

  return [Math.round(r), Math.round(g), Math.round(b)];
}

function xyz2lab(xyz,refX = 95.047, refY = 100.0, refZ = 108.883) {
  let [x, y, z] = xyz;
  x /= refX;
  y /= refY;
  z /= refZ;

  x = x > 0.008856 ? Math.cbrt(x) : (7.787 * x) + 16 / 116;
  y = y > 0.008856 ? Math.cbrt(y) : (7.787 * y) + 16 / 116;
  z = z > 0.008856 ? Math.cbrt(z) : (7.787 * z) + 16 / 116;

  const L = (116 * y) - 16;
  const a = 500 * (x - y);
  const b = 200 * (y - z);

  return [L, a, b];
}

function lab2xyz(Lab, refX = 95.047, refY = 100.0, refZ = 108.883) {
  const [L,a,b] = Lab;
  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  x = x ** 3 > 0.008856 ? x ** 3 : (x - 16 / 116) / 7.787;
  y = y ** 3 > 0.008856 ? y ** 3 : (y - 16 / 116) / 7.787;
  z = z ** 3 > 0.008856 ? z ** 3 : (z - 16 / 116) / 7.787;

  x *= refX;
  y *= refY;
  z *= refZ;
  return [x, y, z];
}

function lab2lch(Lab) {
  const [L,a,b] = Lab;
  const C = Math.sqrt(a * a + b * b);
  let H = Math.atan2(b, a) * 180 / Math.PI;
  if (H < 0) {
    H += 360;
  }
  return [L, C, H];
}

function lch2lab(LCH) {
  const [L,C,H] = LCH;
  const Hr = H * Math.PI / 180;
  const a = C * Math.cos(Hr);
  const b = C * Math.sin(Hr);
  return [L, a, b];
}


function isLCHInGamut(lch) {
  const [r, g, b] = lch2rgb(lch);
  return (
    r >= 0 && r <= 255 &&
    g >= 0 && g <= 255 &&
    b >= 0 && b <= 255
  );
}

function maxChromaForLCH(lchArr, tolerance = 0.001) {
  const [L, _unusedC, H] = lchArr;

  let low = 0;
  let high = 150;
  while ((high - low) > tolerance) {
    const mid = (low + high) / 2;
    if (isLCHInGamut([L, mid, H])) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return low;
}

function normalizeLCH(lchArr) {
  const [L, C, H] = lchArr;
  const maxC = maxChromaForLCH([L, 0, H]); 
  const scale = maxC / 100;

  let C_normalized = (scale === 0) ? 0 : C / scale;

  if (C_normalized > 100) {
    C_normalized = 100;
  }

  return [L, C_normalized, H, scale];
}

function denormalizeLCH(lchsArr) {
  const [L, C_normalized, H, scale] = lchsArr;
  const C = C_normalized * scale;
  return [L, C, H];
}

function helixPoint(helixParams, t) {
  const {
    startZ, endZ, turns, amplitude, direction,
    initialAngleDeg, scaleX, scaleZ
  } = helixParams;

  const initialAngle = (initialAngleDeg || 0) * (Math.PI / 180);
  const z = startZ + (endZ - startZ) * t;
  const angle = initialAngle + direction * turns * 2.0 * Math.PI * t;
  const r = amplitude * Math.sin(Math.PI * t);

  return {
    x: r * Math.cos(angle) * scaleX,
    y: r * Math.sin(angle) * scaleZ,
    z: z
  };
}

function buildArcLengthTable(helixParams, steps = 2000) {
  const arcTable = [];
  arcTable.push({ t: 0, length: 0 });

  let oldPt = helixPoint(helixParams, 0);
  let lengthSoFar = 0;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const newPt = helixPoint(helixParams, t);
    const dx = newPt.x - oldPt.x;
    const dy = newPt.y - oldPt.y;
    const dz = newPt.z - oldPt.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

    lengthSoFar += dist;
    arcTable.push({ t, length: lengthSoFar });
    oldPt = newPt;
  }
  return arcTable;
}

function findTforArcLength(arcTable, sDesired) {
  if (sDesired <= 0) return 0;
  const last = arcTable[arcTable.length - 1].length;
  if (sDesired >= last) return 1;

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
  return t0 + ratio * (t1 - t0);
}

function pointToColorHex(xyz, maxChromaValue) {
  const [x,y,z] = xyz;
  const cylBottom = -0.5;
  const cylHeight = 1.0;
  const heightVal = z - cylBottom;
  let L = (heightVal / cylHeight) * 100;
  L = Math.max(0, Math.min(100, L));
  let angleDeg = (Math.atan2(y, x) * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;
  const distanceVal = Math.sqrt(x*x + y*y);
  const maxChr = Math.min(maxChromaValue, maxChromaForLCH([L,0, angleDeg]));
  const chroma = maxChr * Math.min(1, distanceVal);
  const rgb = lch2rgb([L, chroma, angleDeg]);
  return rgb2hex(rgb);
}

function rgb2lch(rgb) {
  const xyz = rgb2xyz(rgb);
  const d50 = bradfordAdaptXYZtoD50(xyz);
  const lab = xyz2lab(d50, 96.422, 100.0, 82.521);
  const lch = lab2lch(lab);
  return lch;
}
function lch2rgb(lch) {
  const lab = lch2lab(lch);
  const xyz = lab2xyz(lab, 96.422, 100.0, 82.521);
  const d65 = bradfordAdaptXYZtoD65(xyz);
  const rgb = xyz2rgb(d65);
  return rgb;
}

function getHelixColors(helixParams) {

  // helixParams = {
  // Suggested Ranges:
  //   startZ:          [-1, 0]
  //   endZ:            [ 0, 1]
  //   turns:           [-2, 2]
  //   amplitude:       [-2, 2]
  //   direction:       [-1, 1]
  //   scaleX:          [-1, 1]
  //   scaleZ:          [-1, 1]
  //   initialAngleDeg: [ 0, 360]
  //   maxChroma:       [ 0, 150]
  //   numColors:       [ 2, 256]
  //   }
  const numColors = helixParams.numColors;
  const maxChromaValue = helixParams.maxChroma;
  const arcTable = buildArcLengthTable(helixParams);
  const totalLength = arcTable[arcTable.length - 1].length;
  const colors = [];

  if (numColors === 1) {
    const { x, y, z } = helixPoint(helixParams, 0);
    colors.push(pointToColorHex([x, y, z], maxChromaValue));
    return colors;
  }

  for (let i = 0; i < numColors; i++) {
    const sDesired = (i * totalLength) / (numColors - 1);
    const t_i = findTforArcLength(arcTable, sDesired);
    const { x, y, z } = helixPoint(helixParams, t_i);
    colors.push(pointToColorHex([x, y, z], maxChromaValue));
  }
  return colors;
}

//CAM16 adapted from https://observablehq.com/@jrus/cam16
function rgb2cam16(rgb,
  {
    whitepoint = 'D65',
    adapting_luminance = 40,
    background_luminance = 20,
    surround = 'average',
    discounting = false
  } = {}
) {

  const pow  = Math.pow;
  const sqrt = Math.sqrt;
  const sgn  = x => (x > 0) - (x < 0);
  const lerp = (a, b, t) => (1 - t)*a + t*b;
  const clip = (lo, hi, v) => Math.min(Math.max(v, lo), hi);

  function degrees(rad) {
    const deg = rad * 180/Math.PI;
    return deg - 360 * Math.floor(deg/360);
  }

  const standard_whitepoints = {
    A:   [109.850, 100,    35.585],
    B:   [ 99.090, 100,    85.324],
    C:   [ 98.074, 100,   118.232],
    E:   [100.000, 100,   100.000],
    D50: [ 96.422, 100,    82.521],
    D55: [ 95.682, 100,    92.149],
    D65: [ 95.047, 100,   108.883],
    D75: [ 94.972, 100,   122.638],
    F2:  [ 99.186, 100,    67.393],
    F7:  [ 95.041, 100,   108.747],
    F11: [100.962, 100,    64.350],
  };

  const XYZ_w = Array.isArray(whitepoint)
    ? whitepoint.slice()
    : standard_whitepoints[whitepoint] || standard_whitepoints.D65;

  const L_A = adapting_luminance;
  const Y_b = background_luminance;
  const Y_w = XYZ_w[1];
  let s;
  switch (surround) {
    case 'dark':    s = 0;        break;
    case 'dim':     s = 1;        break;
    case 'average': s = 2;        break;
    default:        s = +surround;
  }
  
  function surround_c(s) {
    if (s >= 1) {
      return lerp(0.59, 0.69, s - 1);
    } else {
      return lerp(0.525, 0.59, s);
    }
  }
  const c = surround_c(s);
  const F = c >= 0.59
    ? lerp(0.9, 1.0, (c - 0.59)/0.10)
    : lerp(0.8, 0.9, (c - 0.525)/0.065);
  const N_c  = F;
  const N_bb = 0.725 * pow(Y_b/Y_w, -0.2);
  const N_cb = N_bb;

  const D = discounting
    ? 1
    : clip(0, 1, F * (1 - 1/3.6 * Math.exp((-L_A - 42)/92)));

  function M16([X, Y, Z]) {
    return [
       0.401288*X + 0.650173*Y - 0.051461*Z,
      -0.250268*X + 1.204414*Y + 0.045854*Z,
      -0.002079*X + 0.048952*Y + 0.953127*Z
    ];
  }

  function elemMul(a, b) { return a.map((v,i) => v*b[i]); }

  const RGB_w = M16(XYZ_w);

  const D_RGB = RGB_w.map((W_i) => lerp(1, Y_w/W_i, D));

  const k   = 1 / (5*L_A + 1);
  const F_L = (() => {
    const k4 = k**4;
    return k4 * L_A + 0.1*(1 - k4)**2 * pow(5*L_A, 1/3);
  })();
  const F_L_4 = pow(F_L, 0.25);

  const n = Y_b / Y_w;
  const z = 1.48 + sqrt(n);

  function adaptChannel(C) {
    const x = pow(F_L * Math.abs(C)*0.01, 0.42);
    return sgn(C) * 400*x / (x + 27.13);
  }

  const [R_w, G_w, B_w] = elemMul(RGB_w, D_RGB).map(adaptChannel);
  const A_w = N_bb*(2*R_w + G_w + 0.05*B_w);

  function cam16_of_XYZ([X, Y, Z]) {
    const [Rc, Gc, Bc] = elemMul(M16([X, Y, Z]), D_RGB).map(adaptChannel);
    const a = Rc + (-12*Gc + Bc)/11;
    const b = (Rc + Gc - 2*Bc)/9;
    const h_rad = Math.atan2(b, a);
    const h = degrees(h_rad);

    const A = N_bb*(2*Rc + Gc + 0.05*Bc);

    const J_root = pow(A / A_w, 0.5*c*z);
    const J = 100*(J_root*J_root);
    const Q = (4/c)*J_root*(A_w + 4)*F_L_4;

    const e_t = 0.25*(Math.cos(h_rad + 2) + 3.8);
    const t   = (50000/13)*N_c*N_cb*e_t * sqrt(a*a + b*b)
                / (Rc + Gc + 1.05*Bc + 0.305);
    const alpha = pow(t, 0.9)*pow(1.64 - pow(0.29, n), 0.73);
    const C = alpha*J_root;
    const M = C*F_L_4;
    const s = 50* sqrt((c*alpha)/(A_w + 4));

    return {J, C, h, Q, M, s};
  }

  const XYZ = rgb2xyz(rgb);
  return cam16_of_XYZ(XYZ);
}

function rgb2cam16ucs(rgb, {
  whitepoint = 'D65',
  adapting_luminance = 40,
  background_luminance = 20,
  surround = 'average',
  discounting = false
} = {}) {
  const cam16 = rgb2cam16(rgb, {
    whitepoint,
    adapting_luminance,
    background_luminance,
    surround,
    discounting
  });
  const {J, M, h} = cam16;
  const h_rad = h * Math.PI / 180;
  const c1 = 0.007;
  const c2 = 0.0228;
  const Jp = ((1 + 100*c1) * J) / (1 + c1 * J);
  const Mp = (1 / c2) * Math.log(1 + c2 * M);
  const aP = Mp * Math.cos(h_rad);
  const bP = Mp * Math.sin(h_rad);

  return { 
    Jp,  // Lightness
    aP,  // Red/green axis
    bP   // Yellow/blue axis
  };
}

// Code adapted from libDaltonLens https://daltonlens.org (public domain)
// https://raw.githubusercontent.com/MaPePeR/jsColorblindSimulator/refs/heads/master/brettel_colorblind_simulation.js

function linearRGB_from_sRGB(v)
{
    var fv = v / 255.0;
    if (fv < 0.04045) return fv / 12.92;
    return Math.pow((fv + 0.055) / 1.055, 2.4);
}

function sRGB_from_linearRGB(v)
{
    if (v <= 0.) return 0;
    if (v >= 1.) return 255;
    if (v < 0.0031308) return 0.5 + (v * 12.92 * 255);
    return 0 + 255 * (Math.pow(v, 1.0 / 2.4) * 1.055 - 0.055);
}

var sRGB_to_linearRGB_Lookup = Array(256);
(function () {
    var i;
    for (i = 0; i < 256; i++) {
        sRGB_to_linearRGB_Lookup[i] = linearRGB_from_sRGB(i);
    }

})();

brettel_params = {
    protan: {
        rgbCvdFromRgb_1: [
            0.14510, 1.20165, -0.34675,
            0.10447, 0.85316, 0.04237,
            0.00429, -0.00603, 1.00174
        ],
        rgbCvdFromRgb_2: [
            0.14115, 1.16782, -0.30897,
            0.10495, 0.85730, 0.03776,
            0.00431, -0.00586, 1.00155
        ],
        separationPlaneNormal: [ 0.00048, 0.00416, -0.00464 ]
    },

    deutan: {
        rgbCvdFromRgb_1: [
            0.36198, 0.86755, -0.22953,
            0.26099, 0.64512, 0.09389,
           -0.01975, 0.02686, 0.99289,
        ],
        rgbCvdFromRgb_2: [
            0.37009, 0.88540, -0.25549,
            0.25767, 0.63782, 0.10451,
           -0.01950, 0.02741, 0.99209,
        ],
        separationPlaneNormal: [ -0.00293, -0.00645, 0.00938 ]
    },

    tritan: {
        rgbCvdFromRgb_1: [
            1.01354, 0.14268, -0.15622,
           -0.01181, 0.87561, 0.13619,
            0.07707, 0.81208, 0.11085,
        ],
        rgbCvdFromRgb_2: [
            0.93337, 0.19999, -0.13336,
            0.05809, 0.82565, 0.11626,
            -0.37923, 1.13825, 0.24098,
        ],
        separationPlaneNormal: [ 0.03960, -0.02831, -0.01129 ]
    },
};

function brettel(srgb, t, severity) {
    // Go from sRGB to linearRGB
    var rgb = Array(3);
    rgb[0] = sRGB_to_linearRGB_Lookup[srgb[0]]
    rgb[1] = sRGB_to_linearRGB_Lookup[srgb[1]]
    rgb[2] = sRGB_to_linearRGB_Lookup[srgb[2]]
    
    var params = brettel_params[t];
    var separationPlaneNormal = params['separationPlaneNormal'];
    var rgbCvdFromRgb_1 = params['rgbCvdFromRgb_1'];
    var rgbCvdFromRgb_2 = params['rgbCvdFromRgb_2'];

    // Check on which plane we should project by comparing wih the separation plane normal.
    var dotWithSepPlane = rgb[0]*separationPlaneNormal[0] + rgb[1]*separationPlaneNormal[1] + rgb[2]*separationPlaneNormal[2];
    var rgbCvdFromRgb = (dotWithSepPlane >= 0 ? rgbCvdFromRgb_1 : rgbCvdFromRgb_2);

    // Transform to the full dichromat projection plane.
    var rgb_cvd = Array(3);
    rgb_cvd[0] = rgbCvdFromRgb[0]*rgb[0] + rgbCvdFromRgb[1]*rgb[1] + rgbCvdFromRgb[2]*rgb[2];
    rgb_cvd[1] = rgbCvdFromRgb[3]*rgb[0] + rgbCvdFromRgb[4]*rgb[1] + rgbCvdFromRgb[5]*rgb[2];
    rgb_cvd[2] = rgbCvdFromRgb[6]*rgb[0] + rgbCvdFromRgb[7]*rgb[1] + rgbCvdFromRgb[8]*rgb[2];

    // Apply the severity factor as a linear interpolation.
    // It's the same to do it in the RGB space or in the LMS
    // space since it's a linear transform.
    rgb_cvd[0] = rgb_cvd[0]*severity + rgb[0]*(1.0-severity);
    rgb_cvd[1] = rgb_cvd[1]*severity + rgb[1]*(1.0-severity);
    rgb_cvd[2] = rgb_cvd[2]*severity + rgb[2]*(1.0-severity);

    // Go back to sRGB
    return ([sRGB_from_linearRGB(rgb_cvd[0]),sRGB_from_linearRGB(rgb_cvd[1]),sRGB_from_linearRGB(rgb_cvd[2])]);
}

function simulateColorBlindness(rgb, type,severity) {
  const simRGB = brettel(rgb, type,severity);
  return simRGB;
}

function simulateColorBlindPalette(palette, type,severity = 1.0) {
  return palette.map(hex => {
    const rgb = hex2rgb(hex);
    const simulatedRgb = simulateColorBlindness(rgb, type, severity);
    return rgb2hex(simulatedRgb);
  });
}

function getMinimumPerceptualDistance(hexPalette, options = {}) {
  const camPalette = hexPalette.map(hex => {
    const rgb = hex2rgb(hex);
    return rgb2cam16ucs(rgb, options);
  });

  if (camPalette.length < 2) return 0;

  let minDistance = Infinity;

  for (let i = 0; i < camPalette.length; i++) {
    for (let j = i + 1; j < camPalette.length; j++) {
      const d = Math.sqrt(
        Math.pow(camPalette[i].Jp - camPalette[j].Jp, 2) +
        Math.pow(camPalette[i].aP - camPalette[j].aP, 2) +
        Math.pow(camPalette[i].bP - camPalette[j].bP, 2)
      );
      if (d < minDistance) {
        minDistance = d;
      }
    }
  }

  return minDistance;
}


if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    rgb2lch,
    lch2rgb,
    getHelixColors,
    getMinimumPerceptualDistance,
    rgb2cam16ucs
  };
}
