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

struct ExpectedMD5 {
    hash : array<u32, 4>,
}

@group(0) @binding(0) var<storage> globalCharSet  : array<u32>;        
@group(0) @binding(1) var<storage> prefixChars    : array<u32>;        
@group(0) @binding(2) var<storage> expectedBuffer : ExpectedMD5;       
@group(0) @binding(3) var<uniform> config         : Config;            
@group(0) @binding(4) var<storage, read_write> foundIndexAtomic : FoundIndexAtomic;

var<workgroup> sharedCharset     : array<u32, 256>;
var<workgroup> sharedBaseBlock   : array<u32, 16>;
var<workgroup> sharedExpectedMD5 : vec4<u32>;

fn atomicMinValue(addr : ptr<storage, atomic<u32>, read_write>, val : u32) {
    atomicMin(addr, val);
}

fn F(x : u32, y : u32, z : u32) -> u32 {
    return (x & y) | ((~x) & z);
}
fn G(x : u32, y : u32, z : u32) -> u32 {
    return (x & z) | (y & (~z));
}
fn H(x : u32, y : u32, z : u32) -> u32 {
    return x ^ y ^ z;
}
fn I(x : u32, y : u32, z : u32) -> u32 {
    return y ^ (x | (~z));
}
fn rotateLeft(x : u32, n : u32) -> u32 {
    return (x << n) | (x >> (32u - n));
}
fn FF(a : u32, b : u32, c : u32, d : u32, x : u32, s : u32, ac : u32) -> u32 {
    var res = a + F(b, c, d) + x + ac;
    res = rotateLeft(res, s);
    return res + b;
}
fn GG(a : u32, b : u32, c : u32, d : u32, x : u32, s : u32, ac : u32) -> u32 {
    var res = a + G(b, c, d) + x + ac;
    res = rotateLeft(res, s);
    return res + b;
}
fn HH(a : u32, b : u32, c : u32, d : u32, x : u32, s : u32, ac : u32) -> u32 {
    var res = a + H(b, c, d) + x + ac;
    res = rotateLeft(res, s);
    return res + b;
}
fn II(a : u32, b : u32, c : u32, d : u32, x : u32, s : u32, ac : u32) -> u32 {
    var res = a + I(b, c, d) + x + ac;
    res = rotateLeft(res, s);
    return res + b;
}

fn initBaseBlock() {
    for (var i = 0u; i < 16u; i = i + 1u) {
        sharedBaseBlock[i] = 0u;
    }

    let pLen     = config.prefixLength;
    let tLen     = config.totalLength;

    for (var i = 0u; i < pLen; i = i + 1u) {
        let bVal   = prefixChars[i] & 0xFFu;
        let wIndex = i >> 2u;
        let shift  = (i & 3u) * 8u;
        sharedBaseBlock[wIndex] |= (bVal << shift);
    }

    let padWordIndex = tLen >> 2u;
    let padShift     = (tLen & 3u) * 8u;
    sharedBaseBlock[padWordIndex] |= (0x80u << padShift);

    sharedBaseBlock[14] = tLen * 8u;
}


fn buildBlockWithSuffix(suffixId : u32) -> array<u32,16> {
    var block : array<u32, 16>;

    
    for (var i = 0u; i < 16u; i = i + 1u) {
        block[i] = sharedBaseBlock[i];
    }

    let pLen     = config.prefixLength;
    let totalLen = config.totalLength;
    let sLen     = totalLen - pLen;

    var idx = suffixId;
    for (var i = 0u; i < sLen; i = i + 1u) {
        let digit = idx % config.charSetLength;
        idx       = idx / config.charSetLength;

        let bVal   = sharedCharset[digit] & 0xFFu;
        let pos    = pLen + i;
        let wIndex = pos >> 2u;
        let shift  = (pos & 3u) * 8u;
        block[wIndex] |= (bVal << shift);
    }

    return block;
}

fn md5_transform(abcd : vec4<u32>, block : array<u32,16>) -> vec4<u32> {
    var a = abcd.x;
    var b = abcd.y;
    var c = abcd.z;
    var d = abcd.w;


    a = FF(a,b,c,d,block[0],  7u, 0xd76aa478u);
    d = FF(d,a,b,c,block[1], 12u, 0xe8c7b756u);
    c = FF(c,d,a,b,block[2], 17u, 0x242070dbu);
    b = FF(b,c,d,a,block[3], 22u, 0xc1bdceeeu);
    a = FF(a,b,c,d,block[4],  7u, 0xf57c0fafu);
    d = FF(d,a,b,c,block[5], 12u, 0x4787c62au);
    c = FF(c,d,a,b,block[6], 17u, 0xa8304613u);
    b = FF(b,c,d,a,block[7], 22u, 0xfd469501u);
    a = FF(a,b,c,d,block[8],  7u, 0x698098d8u);
    d = FF(d,a,b,c,block[9], 12u, 0x8b44f7afu);
    c = FF(c,d,a,b,block[10],17u, 0xffff5bb1u);
    b = FF(b,c,d,a,block[11],22u, 0x895cd7beu);
    a = FF(a,b,c,d,block[12], 7u, 0x6b901122u);
    d = FF(d,a,b,c,block[13],12u, 0xfd987193u);
    c = FF(c,d,a,b,block[14],17u, 0xa679438eu);
    b = FF(b,c,d,a,block[15],22u, 0x49b40821u);

    a = GG(a,b,c,d,block[1],  5u, 0xf61e2562u);
    d = GG(d,a,b,c,block[6],  9u, 0xc040b340u);
    c = GG(c,d,a,b,block[11],14u, 0x265e5a51u);
    b = GG(b,c,d,a,block[0],  20u,0xe9b6c7aau);
    a = GG(a,b,c,d,block[5],  5u, 0xd62f105du);
    d = GG(d,a,b,c,block[10], 9u, 0x02441453u);
    c = GG(c,d,a,b,block[15],14u, 0xd8a1e681u);
    b = GG(b,c,d,a,block[4],  20u,0xe7d3fbc8u);
    a = GG(a,b,c,d,block[9],  5u, 0x21e1cde6u);
    d = GG(d,a,b,c,block[14], 9u, 0xc33707d6u);
    c = GG(c,d,a,b,block[3],  14u,0xf4d50d87u);
    b = GG(b,c,d,a,block[8],  20u,0x455a14edu);
    a = GG(a,b,c,d,block[13], 5u, 0xa9e3e905u);
    d = GG(d,a,b,c,block[2],  9u, 0xfcefa3f8u);
    c = GG(c,d,a,b,block[7],  14u,0x676f02d9u);
    b = GG(b,c,d,a,block[12], 20u,0x8d2a4c8au);

    a = HH(a,b,c,d,block[5],  4u, 0xfffa3942u);
    d = HH(d,a,b,c,block[8],  11u,0x8771f681u);
    c = HH(c,d,a,b,block[11],16u,0x6d9d6122u);
    b = HH(b,c,d,a,block[14],23u,0xfde5380cu);
    a = HH(a,b,c,d,block[1],  4u, 0xa4beea44u);
    d = HH(d,a,b,c,block[4],  11u,0x4bdecfa9u);
    c = HH(c,d,a,b,block[7],  16u,0xf6bb4b60u);
    b = HH(b,c,d,a,block[10],23u,0xbebfbc70u);
    a = HH(a,b,c,d,block[13], 4u, 0x289b7ec6u);
    d = HH(d,a,b,c,block[0],  11u,0xeaa127fau);
    c = HH(c,d,a,b,block[3],  16u,0xd4ef3085u);
    b = HH(b,c,d,a,block[6],  23u,0x04881d05u);
    a = HH(a,b,c,d,block[9],  4u, 0xd9d4d039u);
    d = HH(d,a,b,c,block[12], 11u,0xe6db99e5u);
    c = HH(c,d,a,b,block[15], 16u,0x1fa27cf8u);
    b = HH(b,c,d,a,block[2],  23u,0xc4ac5665u);

    a = II(a,b,c,d,block[0],  6u, 0xf4292244u);
    d = II(d,a,b,c,block[7],  10u,0x432aff97u);
    c = II(c,d,a,b,block[14], 15u,0xab9423a7u);
    b = II(b,c,d,a,block[5],  21u,0xfc93a039u);
    a = II(a,b,c,d,block[12], 6u, 0x655b59c3u);
    d = II(d,a,b,c,block[3],  10u,0x8f0ccc92u);
    c = II(c,d,a,b,block[10], 15u,0xffeff47du);
    b = II(b,c,d,a,block[1],  21u,0x85845dd1u);
    a = II(a,b,c,d,block[8],  6u, 0x6fa87e4fu);
    d = II(d,a,b,c,block[15], 10u,0xfe2ce6e0u);
    c = II(c,d,a,b,block[6],  15u,0xa3014314u);
    b = II(b,c,d,a,block[13], 21u,0x4e0811a1u);
    a = II(a,b,c,d,block[4],  6u, 0xf7537e82u);
    d = II(d,a,b,c,block[11],10u,0xbd3af235u);
    c = II(c,d,a,b,block[2],  15u,0x2ad7d2bbu);
    b = II(b,c,d,a,block[9],  21u,0xeb86d391u);

    a = a + abcd.x;
    b = b + abcd.y;
    c = c + abcd.z;
    d = d + abcd.w;

    return vec4<u32>(a,b,c,d);
}

fn md5_forSuffix(suffixId : u32) -> vec4<u32> {
    
    var state = vec4<u32>(
        0x67452301u,
        0xEFCDAB89u,
        0x98BADCFEu,
        0x10325476u
    );

    let block = buildBlockWithSuffix(suffixId);
    return md5_transform(state, block);
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
        sharedExpectedMD5 = vec4<u32>(
            expectedBuffer.hash[0],
            expectedBuffer.hash[1],
            expectedBuffer.hash[2],
            expectedBuffer.hash[3]
        );
    }

    workgroupBarrier();

    let rowWidth  = config.dispatchWidth * 256u; 
    let globalRow = config.rowStart + gid.y;
    let suffixId  = globalRow * rowWidth + gid.x;

    
    if (suffixId >= config.suffixRange) {
        return;
    }

    let md5Val     = md5_forSuffix(suffixId);
    let expected   = sharedExpectedMD5;

    if ((md5Val.x == expected.x) &&
        (md5Val.y == expected.y) &&
        (md5Val.z == expected.z) &&
        (md5Val.w == expected.w)) {

        atomicMinValue(&foundIndexAtomic.value, suffixId);
    }

}
