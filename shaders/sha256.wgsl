struct Config {
    prefixLength   : u32,
    totalLength    : u32,
    suffixRange    : u32,
    charSetLength  : u32,
    dispatchWidth  : u32,
    rowStart       : u32,
}

struct FoundIndexAtomic {
    value : atomic<u32>,
}

struct ExpectedSHA256 {
    hash : array<u32, 8>,
}

@group(0) @binding(0) var<storage> globalCharSet  : array<u32>;
@group(0) @binding(1) var<storage> prefixChars    : array<u32>;
@group(0) @binding(2) var<storage> expectedBuffer : ExpectedSHA256;
@group(0) @binding(3) var<uniform> config         : Config;
@group(0) @binding(4) var<storage, read_write> foundIndexAtomic : FoundIndexAtomic;

var<workgroup> sharedCharset        : array<u32, 256>;
var<workgroup> sharedExpectedSHA256 : array<u32, 8>;
var<workgroup> sharedBaseBlock      : array<u32, 16>;

var<private> K : array<u32, 64> = array<u32, 64>(
    0x428A2F98u, 0x71374491u, 0xB5C0FBCFu, 0xE9B5DBA5u,
    0x3956C25Bu, 0x59F111F1u, 0x923F82A4u, 0xAB1C5ED5u,
    0xD807AA98u, 0x12835B01u, 0x243185BEu, 0x550C7DC3u,
    0x72BE5D74u, 0x80DEB1FEu, 0x9BDC06A7u, 0xC19BF174u,
    0xE49B69C1u, 0xEFBE4786u, 0x0FC19DC6u, 0x240CA1CCu,
    0x2DE92C6Fu, 0x4A7484AAu, 0x5CB0A9DCu, 0x76F988DAu,
    0x983E5152u, 0xA831C66Du, 0xB00327C8u, 0xBF597FC7u,
    0xC6E00BF3u, 0xD5A79147u, 0x06CA6351u, 0x14292967u,
    0x27B70A85u, 0x2E1B2138u, 0x4D2C6DFCu, 0x53380D13u,
    0x650A7354u, 0x766A0ABBu, 0x81C2C92Eu, 0x92722C85u,
    0xA2BFE8A1u, 0xA81A664Bu, 0xC24B8B70u, 0xC76C51A3u,
    0xD192E819u, 0xD6990624u, 0xF40E3585u, 0x106AA070u,
    0x19A4C116u, 0x1E376C08u, 0x2748774Cu, 0x34B0BCB5u,
    0x391C0CB3u, 0x4ED8AA4Au, 0x5B9CCA4Fu, 0x682E6FF3u,
    0x748F82EEu, 0x78A5636Fu, 0x84C87814u, 0x8CC70208u,
    0x90BEFFFAu, 0xA4506CEBu, 0xBEF9A3F7u, 0xC67178F2u
);

fn rotr(x : u32, n : u32) -> u32 {
    return (x >> n) | (x << (32u - n));
}

fn ch(x : u32, y : u32, z : u32) -> u32 { return (x & y) ^ ((~x) & z); }
fn maj(x : u32, y : u32, z : u32) -> u32 { return (x & y) ^ (x & z) ^ (y & z); }

fn bigSigma0(x : u32) -> u32 { return rotr(x, 2u) ^ rotr(x, 13u) ^ rotr(x, 22u); }
fn bigSigma1(x : u32) -> u32 { return rotr(x, 6u) ^ rotr(x, 11u) ^ rotr(x, 25u); }

fn smallSigma0(x : u32) -> u32 { return rotr(x, 7u) ^ rotr(x, 18u) ^ (x >> 3u); }
fn smallSigma1(x : u32) -> u32 { return rotr(x, 17u) ^ rotr(x, 19u) ^ (x >> 10u); }

fn swapBytes32(x : u32) -> u32 {
    let b0 = (x >>  0u) & 0xFFu;
    let b1 = (x >>  8u) & 0xFFu;
    let b2 = (x >> 16u) & 0xFFu;
    let b3 = (x >> 24u) & 0xFFu;
    return (b0 << 24u) | (b1 << 16u) | (b2 << 8u) | b3;
}

fn atomicMinValue(addr : ptr<storage, atomic<u32>, read_write>, val : u32) {
    atomicMin(addr, val);
}

fn initBaseBlock() {
    for (var i = 0u; i < 16u; i = i + 1u) {
        sharedBaseBlock[i] = 0u;
    }

    let pLen = config.prefixLength;
    let tLen = config.totalLength;

    for (var i = 0u; i < pLen; i = i + 1u) {
        let byteVal   = prefixChars[i] & 0xFFu;
        let wordIndex = i >> 2u;          // i/4
        let shift     = (3u - (i & 3u)) * 8u;
        sharedBaseBlock[wordIndex] |= (byteVal << shift);
    }

    let wordIndex = tLen >> 2u;          
    let shift     = (3u - (tLen & 3u)) * 8u;
    sharedBaseBlock[wordIndex] |= (0x80u << shift);

    let bitLength : u32 = tLen * 8u;
    sharedBaseBlock[14] = 0u;
    sharedBaseBlock[15] = bitLength;
}


fn sha256_transform_unrolled(
    stateIn: array<u32, 8>,
    block:  array<u32, 16>
) -> array<u32, 8> {
    var W: array<u32, 64>;

    W[0] = block[0];
    W[1] = block[1];
    W[2] = block[2];
    W[3] = block[3];
    W[4] = block[4];
    W[5] = block[5];
    W[6] = block[6];
    W[7] = block[7];
    W[8] = block[8];
    W[9] = block[9];
    W[10] = block[10];
    W[11] = block[11];
    W[12] = block[12];
    W[13] = block[13];
    W[14] = block[14];
    W[15] = block[15];

    W[16] = W[0] + smallSigma0(W[1]) + W[9] + smallSigma1(W[14]);
    W[17] = W[1] + smallSigma0(W[2]) + W[10] + smallSigma1(W[15]);
    W[18] = W[2] + smallSigma0(W[3]) + W[11] + smallSigma1(W[16]);
    W[19] = W[3] + smallSigma0(W[4]) + W[12] + smallSigma1(W[17]);
    W[20] = W[4] + smallSigma0(W[5]) + W[13] + smallSigma1(W[18]);
    W[21] = W[5] + smallSigma0(W[6]) + W[14] + smallSigma1(W[19]);
    W[22] = W[6] + smallSigma0(W[7]) + W[15] + smallSigma1(W[20]);
    W[23] = W[7] + smallSigma0(W[8]) + W[16] + smallSigma1(W[21]);
    W[24] = W[8] + smallSigma0(W[9]) + W[17] + smallSigma1(W[22]);
    W[25] = W[9] + smallSigma0(W[10]) + W[18] + smallSigma1(W[23]);
    W[26] = W[10] + smallSigma0(W[11]) + W[19] + smallSigma1(W[24]);
    W[27] = W[11] + smallSigma0(W[12]) + W[20] + smallSigma1(W[25]);
    W[28] = W[12] + smallSigma0(W[13]) + W[21] + smallSigma1(W[26]);
    W[29] = W[13] + smallSigma0(W[14]) + W[22] + smallSigma1(W[27]);
    W[30] = W[14] + smallSigma0(W[15]) + W[23] + smallSigma1(W[28]);
    W[31] = W[15] + smallSigma0(W[16]) + W[24] + smallSigma1(W[29]);
    W[32] = W[16] + smallSigma0(W[17]) + W[25] + smallSigma1(W[30]);
    W[33] = W[17] + smallSigma0(W[18]) + W[26] + smallSigma1(W[31]);
    W[34] = W[18] + smallSigma0(W[19]) + W[27] + smallSigma1(W[32]);
    W[35] = W[19] + smallSigma0(W[20]) + W[28] + smallSigma1(W[33]);
    W[36] = W[20] + smallSigma0(W[21]) + W[29] + smallSigma1(W[34]);
    W[37] = W[21] + smallSigma0(W[22]) + W[30] + smallSigma1(W[35]);
    W[38] = W[22] + smallSigma0(W[23]) + W[31] + smallSigma1(W[36]);
    W[39] = W[23] + smallSigma0(W[24]) + W[32] + smallSigma1(W[37]);
    W[40] = W[24] + smallSigma0(W[25]) + W[33] + smallSigma1(W[38]);
    W[41] = W[25] + smallSigma0(W[26]) + W[34] + smallSigma1(W[39]);
    W[42] = W[26] + smallSigma0(W[27]) + W[35] + smallSigma1(W[40]);
    W[43] = W[27] + smallSigma0(W[28]) + W[36] + smallSigma1(W[41]);
    W[44] = W[28] + smallSigma0(W[29]) + W[37] + smallSigma1(W[42]);
    W[45] = W[29] + smallSigma0(W[30]) + W[38] + smallSigma1(W[43]);
    W[46] = W[30] + smallSigma0(W[31]) + W[39] + smallSigma1(W[44]);
    W[47] = W[31] + smallSigma0(W[32]) + W[40] + smallSigma1(W[45]);
    W[48] = W[32] + smallSigma0(W[33]) + W[41] + smallSigma1(W[46]);
    W[49] = W[33] + smallSigma0(W[34]) + W[42] + smallSigma1(W[47]);
    W[50] = W[34] + smallSigma0(W[35]) + W[43] + smallSigma1(W[48]);
    W[51] = W[35] + smallSigma0(W[36]) + W[44] + smallSigma1(W[49]);
    W[52] = W[36] + smallSigma0(W[37]) + W[45] + smallSigma1(W[50]);
    W[53] = W[37] + smallSigma0(W[38]) + W[46] + smallSigma1(W[51]);
    W[54] = W[38] + smallSigma0(W[39]) + W[47] + smallSigma1(W[52]);
    W[55] = W[39] + smallSigma0(W[40]) + W[48] + smallSigma1(W[53]);
    W[56] = W[40] + smallSigma0(W[41]) + W[49] + smallSigma1(W[54]);
    W[57] = W[41] + smallSigma0(W[42]) + W[50] + smallSigma1(W[55]);
    W[58] = W[42] + smallSigma0(W[43]) + W[51] + smallSigma1(W[56]);
    W[59] = W[43] + smallSigma0(W[44]) + W[52] + smallSigma1(W[57]);
    W[60] = W[44] + smallSigma0(W[45]) + W[53] + smallSigma1(W[58]);
    W[61] = W[45] + smallSigma0(W[46]) + W[54] + smallSigma1(W[59]);
    W[62] = W[46] + smallSigma0(W[47]) + W[55] + smallSigma1(W[60]);
    W[63] = W[47] + smallSigma0(W[48]) + W[56] + smallSigma1(W[61]);

    // Initialize working variables
    var a = stateIn[0];
    var b = stateIn[1];
    var c = stateIn[2];
    var d = stateIn[3];
    var e = stateIn[4];
    var f = stateIn[5];
    var g = stateIn[6];
    var h = stateIn[7];

    let T1_0 = h + bigSigma1(e) + ch(e, f, g) + K[0] + W[0];
    let T2_0 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_0;
    d = c;
    c = b;
    b = a;
    a = T1_0 + T2_0;

    let T1_1 = h + bigSigma1(e) + ch(e, f, g) + K[1] + W[1];
    let T2_1 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_1;
    d = c;
    c = b;
    b = a;
    a = T1_1 + T2_1;

    let T1_2 = h + bigSigma1(e) + ch(e, f, g) + K[2] + W[2];
    let T2_2 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_2;
    d = c;
    c = b;
    b = a;
    a = T1_2 + T2_2;

    let T1_3 = h + bigSigma1(e) + ch(e, f, g) + K[3] + W[3];
    let T2_3 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_3;
    d = c;
    c = b;
    b = a;
    a = T1_3 + T2_3;

    let T1_4 = h + bigSigma1(e) + ch(e, f, g) + K[4] + W[4];
    let T2_4 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_4;
    d = c;
    c = b;
    b = a;
    a = T1_4 + T2_4;

    let T1_5 = h + bigSigma1(e) + ch(e, f, g) + K[5] + W[5];
    let T2_5 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_5;
    d = c;
    c = b;
    b = a;
    a = T1_5 + T2_5;

    let T1_6 = h + bigSigma1(e) + ch(e, f, g) + K[6] + W[6];
    let T2_6 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_6;
    d = c;
    c = b;
    b = a;
    a = T1_6 + T2_6;

    let T1_7 = h + bigSigma1(e) + ch(e, f, g) + K[7] + W[7];
    let T2_7 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_7;
    d = c;
    c = b;
    b = a;
    a = T1_7 + T2_7;

    let T1_8 = h + bigSigma1(e) + ch(e, f, g) + K[8] + W[8];
    let T2_8 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_8;
    d = c;
    c = b;
    b = a;
    a = T1_8 + T2_8;

    let T1_9 = h + bigSigma1(e) + ch(e, f, g) + K[9] + W[9];
    let T2_9 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_9;
    d = c;
    c = b;
    b = a;
    a = T1_9 + T2_9;

    let T1_10 = h + bigSigma1(e) + ch(e, f, g) + K[10] + W[10];
    let T2_10 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_10;
    d = c;
    c = b;
    b = a;
    a = T1_10 + T2_10;

    let T1_11 = h + bigSigma1(e) + ch(e, f, g) + K[11] + W[11];
    let T2_11 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_11;
    d = c;
    c = b;
    b = a;
    a = T1_11 + T2_11;

    let T1_12 = h + bigSigma1(e) + ch(e, f, g) + K[12] + W[12];
    let T2_12 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_12;
    d = c;
    c = b;
    b = a;
    a = T1_12 + T2_12;

    let T1_13 = h + bigSigma1(e) + ch(e, f, g) + K[13] + W[13];
    let T2_13 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_13;
    d = c;
    c = b;
    b = a;
    a = T1_13 + T2_13;

    let T1_14 = h + bigSigma1(e) + ch(e, f, g) + K[14] + W[14];
    let T2_14 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_14;
    d = c;
    c = b;
    b = a;
    a = T1_14 + T2_14;

    let T1_15 = h + bigSigma1(e) + ch(e, f, g) + K[15] + W[15];
    let T2_15 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_15;
    d = c;
    c = b;
    b = a;
    a = T1_15 + T2_15;

    let T1_16 = h + bigSigma1(e) + ch(e, f, g) + K[16] + W[16];
    let T2_16 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_16;
    d = c;
    c = b;
    b = a;
    a = T1_16 + T2_16;

    let T1_17 = h + bigSigma1(e) + ch(e, f, g) + K[17] + W[17];
    let T2_17 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_17;
    d = c;
    c = b;
    b = a;
    a = T1_17 + T2_17;

    let T1_18 = h + bigSigma1(e) + ch(e, f, g) + K[18] + W[18];
    let T2_18 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_18;
    d = c;
    c = b;
    b = a;
    a = T1_18 + T2_18;

    let T1_19 = h + bigSigma1(e) + ch(e, f, g) + K[19] + W[19];
    let T2_19 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_19;
    d = c;
    c = b;
    b = a;
    a = T1_19 + T2_19;

    let T1_20 = h + bigSigma1(e) + ch(e, f, g) + K[20] + W[20];
    let T2_20 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_20;
    d = c;
    c = b;
    b = a;
    a = T1_20 + T2_20;

    let T1_21 = h + bigSigma1(e) + ch(e, f, g) + K[21] + W[21];
    let T2_21 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_21;
    d = c;
    c = b;
    b = a;
    a = T1_21 + T2_21;

    let T1_22 = h + bigSigma1(e) + ch(e, f, g) + K[22] + W[22];
    let T2_22 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_22;
    d = c;
    c = b;
    b = a;
    a = T1_22 + T2_22;

    let T1_23 = h + bigSigma1(e) + ch(e, f, g) + K[23] + W[23];
    let T2_23 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_23;
    d = c;
    c = b;
    b = a;
    a = T1_23 + T2_23;

    let T1_24 = h + bigSigma1(e) + ch(e, f, g) + K[24] + W[24];
    let T2_24 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_24;
    d = c;
    c = b;
    b = a;
    a = T1_24 + T2_24;

    let T1_25 = h + bigSigma1(e) + ch(e, f, g) + K[25] + W[25];
    let T2_25 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_25;
    d = c;
    c = b;
    b = a;
    a = T1_25 + T2_25;

    let T1_26 = h + bigSigma1(e) + ch(e, f, g) + K[26] + W[26];
    let T2_26 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_26;
    d = c;
    c = b;
    b = a;
    a = T1_26 + T2_26;

    let T1_27 = h + bigSigma1(e) + ch(e, f, g) + K[27] + W[27];
    let T2_27 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_27;
    d = c;
    c = b;
    b = a;
    a = T1_27 + T2_27;

    let T1_28 = h + bigSigma1(e) + ch(e, f, g) + K[28] + W[28];
    let T2_28 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_28;
    d = c;
    c = b;
    b = a;
    a = T1_28 + T2_28;

    let T1_29 = h + bigSigma1(e) + ch(e, f, g) + K[29] + W[29];
    let T2_29 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_29;
    d = c;
    c = b;
    b = a;
    a = T1_29 + T2_29;

    let T1_30 = h + bigSigma1(e) + ch(e, f, g) + K[30] + W[30];
    let T2_30 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_30;
    d = c;
    c = b;
    b = a;
    a = T1_30 + T2_30;

    let T1_31 = h + bigSigma1(e) + ch(e, f, g) + K[31] + W[31];
    let T2_31 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_31;
    d = c;
    c = b;
    b = a;
    a = T1_31 + T2_31;

    let T1_32 = h + bigSigma1(e) + ch(e, f, g) + K[32] + W[32];
    let T2_32 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_32;
    d = c;
    c = b;
    b = a;
    a = T1_32 + T2_32;

    let T1_33 = h + bigSigma1(e) + ch(e, f, g) + K[33] + W[33];
    let T2_33 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_33;
    d = c;
    c = b;
    b = a;
    a = T1_33 + T2_33;

    let T1_34 = h + bigSigma1(e) + ch(e, f, g) + K[34] + W[34];
    let T2_34 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_34;
    d = c;
    c = b;
    b = a;
    a = T1_34 + T2_34;

    let T1_35 = h + bigSigma1(e) + ch(e, f, g) + K[35] + W[35];
    let T2_35 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_35;
    d = c;
    c = b;
    b = a;
    a = T1_35 + T2_35;

    let T1_36 = h + bigSigma1(e) + ch(e, f, g) + K[36] + W[36];
    let T2_36 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_36;
    d = c;
    c = b;
    b = a;
    a = T1_36 + T2_36;

    let T1_37 = h + bigSigma1(e) + ch(e, f, g) + K[37] + W[37];
    let T2_37 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_37;
    d = c;
    c = b;
    b = a;
    a = T1_37 + T2_37;

    let T1_38 = h + bigSigma1(e) + ch(e, f, g) + K[38] + W[38];
    let T2_38 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_38;
    d = c;
    c = b;
    b = a;
    a = T1_38 + T2_38;

    let T1_39 = h + bigSigma1(e) + ch(e, f, g) + K[39] + W[39];
    let T2_39 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_39;
    d = c;
    c = b;
    b = a;
    a = T1_39 + T2_39;

    let T1_40 = h + bigSigma1(e) + ch(e, f, g) + K[40] + W[40];
    let T2_40 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_40;
    d = c;
    c = b;
    b = a;
    a = T1_40 + T2_40;

    let T1_41 = h + bigSigma1(e) + ch(e, f, g) + K[41] + W[41];
    let T2_41 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_41;
    d = c;
    c = b;
    b = a;
    a = T1_41 + T2_41;

    let T1_42 = h + bigSigma1(e) + ch(e, f, g) + K[42] + W[42];
    let T2_42 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_42;
    d = c;
    c = b;
    b = a;
    a = T1_42 + T2_42;

    let T1_43 = h + bigSigma1(e) + ch(e, f, g) + K[43] + W[43];
    let T2_43 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_43;
    d = c;
    c = b;
    b = a;
    a = T1_43 + T2_43;

    let T1_44 = h + bigSigma1(e) + ch(e, f, g) + K[44] + W[44];
    let T2_44 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_44;
    d = c;
    c = b;
    b = a;
    a = T1_44 + T2_44;

    let T1_45 = h + bigSigma1(e) + ch(e, f, g) + K[45] + W[45];
    let T2_45 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_45;
    d = c;
    c = b;
    b = a;
    a = T1_45 + T2_45;

    let T1_46 = h + bigSigma1(e) + ch(e, f, g) + K[46] + W[46];
    let T2_46 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_46;
    d = c;
    c = b;
    b = a;
    a = T1_46 + T2_46;

    let T1_47 = h + bigSigma1(e) + ch(e, f, g) + K[47] + W[47];
    let T2_47 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_47;
    d = c;
    c = b;
    b = a;
    a = T1_47 + T2_47;

    let T1_48 = h + bigSigma1(e) + ch(e, f, g) + K[48] + W[48];
    let T2_48 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_48;
    d = c;
    c = b;
    b = a;
    a = T1_48 + T2_48;

    let T1_49 = h + bigSigma1(e) + ch(e, f, g) + K[49] + W[49];
    let T2_49 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_49;
    d = c;
    c = b;
    b = a;
    a = T1_49 + T2_49;

    let T1_50 = h + bigSigma1(e) + ch(e, f, g) + K[50] + W[50];
    let T2_50 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_50;
    d = c;
    c = b;
    b = a;
    a = T1_50 + T2_50;

    let T1_51 = h + bigSigma1(e) + ch(e, f, g) + K[51] + W[51];
    let T2_51 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_51;
    d = c;
    c = b;
    b = a;
    a = T1_51 + T2_51;

    let T1_52 = h + bigSigma1(e) + ch(e, f, g) + K[52] + W[52];
    let T2_52 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_52;
    d = c;
    c = b;
    b = a;
    a = T1_52 + T2_52;

    let T1_53 = h + bigSigma1(e) + ch(e, f, g) + K[53] + W[53];
    let T2_53 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_53;
    d = c;
    c = b;
    b = a;
    a = T1_53 + T2_53;

    let T1_54 = h + bigSigma1(e) + ch(e, f, g) + K[54] + W[54];
    let T2_54 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_54;
    d = c;
    c = b;
    b = a;
    a = T1_54 + T2_54;

    let T1_55 = h + bigSigma1(e) + ch(e, f, g) + K[55] + W[55];
    let T2_55 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_55;
    d = c;
    c = b;
    b = a;
    a = T1_55 + T2_55;

    let T1_56 = h + bigSigma1(e) + ch(e, f, g) + K[56] + W[56];
    let T2_56 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_56;
    d = c;
    c = b;
    b = a;
    a = T1_56 + T2_56;

    let T1_57 = h + bigSigma1(e) + ch(e, f, g) + K[57] + W[57];
    let T2_57 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_57;
    d = c;
    c = b;
    b = a;
    a = T1_57 + T2_57;

    let T1_58 = h + bigSigma1(e) + ch(e, f, g) + K[58] + W[58];
    let T2_58 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_58;
    d = c;
    c = b;
    b = a;
    a = T1_58 + T2_58;

    let T1_59 = h + bigSigma1(e) + ch(e, f, g) + K[59] + W[59];
    let T2_59 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_59;
    d = c;
    c = b;
    b = a;
    a = T1_59 + T2_59;

    let T1_60 = h + bigSigma1(e) + ch(e, f, g) + K[60] + W[60];
    let T2_60 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_60;
    d = c;
    c = b;
    b = a;
    a = T1_60 + T2_60;

    let T1_61 = h + bigSigma1(e) + ch(e, f, g) + K[61] + W[61];
    let T2_61 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_61;
    d = c;
    c = b;
    b = a;
    a = T1_61 + T2_61;

    let T1_62 = h + bigSigma1(e) + ch(e, f, g) + K[62] + W[62];
    let T2_62 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_62;
    d = c;
    c = b;
    b = a;
    a = T1_62 + T2_62;

    let T1_63 = h + bigSigma1(e) + ch(e, f, g) + K[63] + W[63];
    let T2_63 = bigSigma0(a) + maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + T1_63;
    d = c;
    c = b;
    b = a;
    a = T1_63 + T2_63;

    var outState = array<u32, 8>();
    outState[0] = stateIn[0] + a;
    outState[1] = stateIn[1] + b;
    outState[2] = stateIn[2] + c;
    outState[3] = stateIn[3] + d;
    outState[4] = stateIn[4] + e;
    outState[5] = stateIn[5] + f;
    outState[6] = stateIn[6] + g;
    outState[7] = stateIn[7] + h;

    return outState;
}

@compute
@workgroup_size(256)
fn main(@builtin(global_invocation_id) gid : vec3<u32>,
        @builtin(local_invocation_id)  lid : vec3<u32>)
{
    for (var i = lid.x; i < config.charSetLength; i = i + 256u) {
        sharedCharset[i] = globalCharSet[i];
    }
    for (var j = lid.x + config.charSetLength; j < 256u; j = j + 256u) {
        sharedCharset[j] = 0u;
    }

    if (lid.x == 0u) {
        initBaseBlock();

        for (var k = 0u; k < 8u; k = k + 1u) {
            let leVal = expectedBuffer.hash[k];
            sharedExpectedSHA256[k] = swapBytes32(leVal);
        }
    }

    workgroupBarrier();

    let rowWidth  = config.dispatchWidth * 256u;
    let globalRow = config.rowStart + gid.y;
    let suffixId  = globalRow * rowWidth + gid.x;

    if (suffixId >= config.suffixRange) {
        return;
    }

    var block = array<u32, 16>();
    for (var i = 0u; i < 16u; i = i + 1u) {
        block[i] = sharedBaseBlock[i];
    }

    let pLen     = config.prefixLength;
    let totalLen = config.totalLength;
    let sLen     = totalLen - pLen;

    var idx = suffixId;
    for (var i = 0u; i < sLen; i = i + 1u) {
        let digit = idx % config.charSetLength;
        idx = idx / config.charSetLength;

        let byteVal = sharedCharset[digit] & 0xFFu;

        let pos       = pLen + i;
        let wordIndex = pos >> 2u;
        let shift     = (3u - (pos & 3u)) * 8u;

        block[wordIndex] = (block[wordIndex] & ~(0xFFu << shift)) | (byteVal << shift);
    }

    var initialState = array<u32, 8>(
        0x6A09E667u, 0xBB67AE85u, 0x3C6EF372u, 0xA54FF53Au,
        0x510E527Fu, 0x9B05688Cu, 0x1F83D9ABu, 0x5BE0CD19u
    );

    let finalState = sha256_transform_unrolled(initialState, block);

    var diff = 0u;
    for (var i = 0u; i < 8u; i = i + 1u) {
        diff |= (finalState[i] ^ sharedExpectedSHA256[i]);
    }

    if (diff == 0u) {
        atomicMinValue(&foundIndexAtomic.value, suffixId);
    }
}
