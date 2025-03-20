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

struct ExpectedMD4 {
    hash : array<u32, 4>,
}

@group(0) @binding(0) var<storage> globalCharSet  : array<u32>;        
@group(0) @binding(1) var<storage> prefixChars    : array<u32>;        
@group(0) @binding(2) var<storage> expectedBuffer : ExpectedMD4;       
@group(0) @binding(3) var<uniform> config         : Config;            
@group(0) @binding(4) var<storage, read_write> foundIndexAtomic : FoundIndexAtomic;

var<workgroup> sharedCharset     : array<u32, 256>;
var<workgroup> sharedBaseBlock   : array<u32, 16>;
var<workgroup> sharedExpectedMD4 : vec4<u32>;

fn atomicMinValue(addr : ptr<storage, atomic<u32>, read_write>, val : u32) {
    atomicMin(addr, val);
}

fn F(x : u32, y : u32, z : u32) -> u32 {
    return (x & y) | (~x & z);
}

fn G(x : u32, y : u32, z : u32) -> u32 {
    return (x & y) | (x & z) | (y & z);
}

fn H(x : u32, y : u32, z : u32) -> u32 {
    return x ^ y ^ z;
}

fn rotateLeft(x : u32, n : u32) -> u32 {
    return (x << n) | (x >> (32u - n));
}

fn FF(a : u32, b : u32, c : u32, d : u32, x : u32, s : u32) -> u32 {
    return rotateLeft(a + F(b,c,d) + x, s);
}

fn GG(a : u32, b : u32, c : u32, d : u32, x : u32, s : u32) -> u32 {
    return rotateLeft(a + G(b,c,d) + x + 0x5a827999u, s);
}

fn HH(a : u32, b : u32, c : u32, d : u32, x : u32, s : u32) -> u32 {
    return rotateLeft(a + H(b,c,d) + x + 0x6ed9eba1u, s);
}

fn initBaseBlock() {
    
    for (var i = 0u; i < 16u; i = i + 1u) {
        sharedBaseBlock[i] = 0u;
    }

    let pLen = config.prefixLength;
    let tLen = config.totalLength;

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

fn buildBlockWithSuffix(suffixId : u32) -> array<u32, 16> {
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

fn md4_transform(abcd : vec4<u32>, block : array<u32,16>) -> vec4<u32> {
    var a = abcd.x;
    var b = abcd.y;
    var c = abcd.z;
    var d = abcd.w;

    a = FF(a, b, c, d, block[0],  3u);
    d = FF(d, a, b, c, block[1],  7u);
    c = FF(c, d, a, b, block[2],  11u);
    b = FF(b, c, d, a, block[3],  19u);

    a = FF(a, b, c, d, block[4],  3u);
    d = FF(d, a, b, c, block[5],  7u);
    c = FF(c, d, a, b, block[6],  11u);
    b = FF(b, c, d, a, block[7],  19u);

    a = FF(a, b, c, d, block[8],  3u);
    d = FF(d, a, b, c, block[9],  7u);
    c = FF(c, d, a, b, block[10], 11u);
    b = FF(b, c, d, a, block[11], 19u);

    a = FF(a, b, c, d, block[12], 3u);
    d = FF(d, a, b, c, block[13], 7u);
    c = FF(c, d, a, b, block[14], 11u);
    b = FF(b, c, d, a, block[15], 19u);

    a = GG(a, b, c, d, block[0],  3u);
    d = GG(d, a, b, c, block[4],  5u);
    c = GG(c, d, a, b, block[8],  9u);
    b = GG(b, c, d, a, block[12], 13u);

    a = GG(a, b, c, d, block[1],  3u);
    d = GG(d, a, b, c, block[5],  5u);
    c = GG(c, d, a, b, block[9],  9u);
    b = GG(b, c, d, a, block[13], 13u);

    a = GG(a, b, c, d, block[2],  3u);
    d = GG(d, a, b, c, block[6],  5u);
    c = GG(c, d, a, b, block[10], 9u);
    b = GG(b, c, d, a, block[14], 13u);

    a = GG(a, b, c, d, block[3],  3u);
    d = GG(d, a, b, c, block[7],  5u);
    c = GG(c, d, a, b, block[11], 9u);
    b = GG(b, c, d, a, block[15], 13u);

    a = HH(a, b, c, d, block[0],  3u);
    d = HH(d, a, b, c, block[8],  9u);
    c = HH(c, d, a, b, block[4],  11u);
    b = HH(b, c, d, a, block[12], 15u);

    a = HH(a, b, c, d, block[2],  3u);
    d = HH(d, a, b, c, block[10], 9u);
    c = HH(c, d, a, b, block[6],  11u);
    b = HH(b, c, d, a, block[14], 15u);

    a = HH(a, b, c, d, block[1],  3u);
    d = HH(d, a, b, c, block[9],  9u);
    c = HH(c, d, a, b, block[5],  11u);
    b = HH(b, c, d, a, block[13], 15u);

    a = HH(a, b, c, d, block[3],  3u);
    d = HH(d, a, b, c, block[11], 9u);
    c = HH(c, d, a, b, block[7],  11u);
    b = HH(b, c, d, a, block[15], 15u);

    a = a + abcd.x;
    b = b + abcd.y;
    c = c + abcd.z;
    d = d + abcd.w;

    return vec4<u32>(a,b,c,d);
}

fn md4_forSuffix(suffixId : u32) -> vec4<u32> {
    
    var state = vec4<u32>(
        0x67452301u,
        0xEFCDAB89u,
        0x98BADCFEu,
        0x10325476u
    );

    let block = buildBlockWithSuffix(suffixId);
    return md4_transform(state, block);
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
        sharedExpectedMD4 = vec4<u32>(
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

    let md4Val   = md4_forSuffix(suffixId);
    let expected = sharedExpectedMD4;

    if ((md4Val.x == expected.x) &&
        (md4Val.y == expected.y) &&
        (md4Val.z == expected.z) &&
        (md4Val.w == expected.w)) 
    {
        
        atomicMinValue(&foundIndexAtomic.value, suffixId);
    }
}
