// Bradford matrix for D65->D50
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

function bradfordAdaptXYZtoD50(x, y, z) {
  const X = x*M_D65toD50[0][0] + y*M_D65toD50[0][1] + z*M_D65toD50[0][2];
  const Y = x*M_D65toD50[1][0] + y*M_D65toD50[1][1] + z*M_D65toD50[1][2];
  const Z = x*M_D65toD50[2][0] + y*M_D65toD50[2][1] + z*M_D65toD50[2][2];
  return [X, Y, Z];
}

function bradfordAdaptXYZtoD65(x, y, z) {
  const X = x * M_D50toD65[0][0] + y * M_D50toD65[0][1] + z * M_D50toD65[0][2];
  const Y = x * M_D50toD65[1][0] + y * M_D50toD65[1][1] + z * M_D50toD65[1][2];
  const Z = x * M_D50toD65[2][0] + y * M_D50toD65[2][1] + z * M_D50toD65[2][2];
  return [X, Y, Z];
}

function rgb2xyz(r, g, b) {
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

function xyz2rgb(x, y, z) {
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

function xyz2lab(x, y, z,refX = 95.047, refY = 100.0, refZ = 108.883) {
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

function lab2xyz(L, a, b, refX = 95.047, refY = 100.0, refZ = 108.883) {
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

function lab2lch(L, a, b) {
  const C = Math.sqrt(a * a + b * b);
  let H = Math.atan2(b, a) * 180 / Math.PI;
  if (H < 0) {
    H += 360;
  }
  return [L, C, H];
}

function lch2lab(L, C, H) {
  const Hr = H * Math.PI / 180;
  const a = C * Math.cos(Hr);
  const b = C * Math.sin(Hr);
  return [L, a, b];
}

function rgb2lch(r, g, _b) {
  const [x65, y65, z65] = rgb2xyz(r, g, _b);
  const [x50, y50, z50] = bradfordAdaptXYZtoD50(x65, y65, z65);
  const [l, a, b]   = xyz2lab(x50, y50, z50, 96.422, 100.0, 82.521);
  const [L, C, H] = lab2lch(l, a, b);
  return [L, C, H];
}
function lch2rgb(L, C, H) {
  const [l, a, b] = lch2lab(L, C, H);
  const [x50, y50, z50] = lab2xyz(l, a, b, 96.422, 100.0, 82.521);
  const [x65, y65, z65] = bradfordAdaptXYZtoD65(x50, y50, z50);
  const [r, g, _b] = xyz2rgb(x65, y65, z65);
  return [r, g, _b];
}

function isLCHInGamut(lchArr) {
  const [L, C, H] = lchArr;
  const [r, g, b] = lch2rgb(L, C, H);
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


function hex2rgb(hexStr) {
  const hex = hexStr.replace(/^#/, '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return [r, g, b];
}

function rgb2hex(r, g, b) {
  r = Math.max(0, Math.min(255, Math.round(r)));
  g = Math.max(0, Math.min(255, Math.round(g)));
  b = Math.max(0, Math.min(255, Math.round(b)));

  const toHex = (value) => {
    const hex = value.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    rgb2lch,
    lch2rgb
  };
}
