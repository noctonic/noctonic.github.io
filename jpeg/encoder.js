/*
  Copyright (c) 2008, Adobe Systems Incorporated
  All rights reserved.

  Redistribution and use in source and binary forms, with or without 
  modification, are permitted provided that the following conditions are
  met:

  * Redistributions of source code must retain the above copyright notice, 
    this list of conditions and the following disclaimer.
  
  * Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in the 
    documentation and/or other materials provided with the distribution.
  
  * Neither the name of Adobe Systems Incorporated nor the names of its 
    contributors may be used to endorse or promote products derived from 
    this software without specific prior written permission.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
  IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
  THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
  PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR 
  CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
  PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
  LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
  SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
/*
JPEG encoder ported to JavaScript and optimized by Andreas Ritter, www.bytestrom.eu, 11/2009

Basic GUI blocking jpeg encoder
*/
// this file is now cursed
var btoa = btoa || function(buf) {
  return Buffer.from(buf).toString('base64');
};

function JPEGEncoder() {
  var self = this;
  var YTable   = new Int16Array(64);
  var UVTable  = new Int16Array(64);
  var fdtbl_Y  = new Float32Array(64);
  var fdtbl_UV = new Float32Array(64);

  var YDC_HT, UVDC_HT, YAC_HT, UVAC_HT;

  var bitcode  = [];
  var category = [];

  var DU             = new Int16Array(64);
  var outputfDCTQuant= new Float32Array(64);

  var byteout = [];
  var bytenew = 0;
  var bytepos = 7;

  var YDU = new Int16Array(64);
  var UDU = new Int16Array(64);
  var VDU = new Int16Array(64);

  var RGB_YUV_TABLE = new Int32Array(2048);

  var clt = [];

  this.hSampleY = 1; 
  this.vSampleY = 1;
  this.hSampleU = 1; 
  this.vSampleU = 1;
  this.hSampleV = 1; 
  this.vSampleV = 1;
  this.subsamplingMode = "4:4:4";

  this.width       = 0;
  this.height      = 0;
  this.exifBuffer  = null;
  this.comments    = [];
  this.Y = null;  
  this.U = null;  
  this.V = null;

  var ZigZag = [
     0, 1, 5, 6,14,15,27,28,
     2, 4, 7,13,16,26,29,42,
     3, 8,12,17,25,30,41,43,
     9,11,18,24,31,40,44,53,
    10,19,23,32,39,45,52,54,
    20,22,33,38,46,51,55,60,
    21,34,37,47,50,56,59,61,
    35,36,48,49,57,58,62,63
  ];

  var std_dc_luminance_nrcodes = [0,0,1,5,1,1,1,1,1,1,0,0,0,0,0,0,0];
  var std_dc_luminance_values  = [0,1,2,3,4,5,6,7,8,9,10,11];
  var std_ac_luminance_nrcodes = [0,0,2,1,3,3,2,4,3,5,5,4,4,0,0,1,0x7d];
  var std_ac_luminance_values  = [
    0x01,0x02,0x03,0x00,0x04,0x11,0x05,0x12,
    0x21,0x31,0x41,0x06,0x13,0x51,0x61,0x07,
    0x22,0x71,0x14,0x32,0x81,0x91,0xa1,0x08,
    0x23,0x42,0xb1,0xc1,0x15,0x52,0xd1,0xf0,
    0x24,0x33,0x62,0x72,0x82,0x09,0x0a,0x16,
    0x17,0x18,0x19,0x1a,0x25,0x26,0x27,0x28,
    0x29,0x2a,0x34,0x35,0x36,0x37,0x38,0x39,
    0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,
    0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,
    0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,
    0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,
    0x7a,0x83,0x84,0x85,0x86,0x87,0x88,0x89,
    0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,
    0x99,0x9a,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,
    0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,
    0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,
    0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,0xd4,
    0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe1,0xe2,
    0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,
    0xf1,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,
    0xf9,0xfa
  ];

  var std_dc_chrominance_nrcodes = [0,0,3,1,1,1,1,1,1,1,1,1,0,0,0,0,0];
  var std_dc_chrominance_values  = [0,1,2,3,4,5,6,7,8,9,10,11];
  var std_ac_chrominance_nrcodes = [0,0,2,1,2,4,4,3,4,7,5,4,4,0,1,2,0x77];
  var std_ac_chrominance_values  = [
    0x00,0x01,0x02,0x03,0x11,0x04,0x05,0x21,
    0x31,0x06,0x12,0x41,0x51,0x07,0x61,0x71,
    0x13,0x22,0x32,0x81,0x08,0x14,0x42,0x91,
    0xa1,0xb1,0xc1,0x09,0x23,0x33,0x52,0xf0,
    0x15,0x62,0x72,0xd1,0x0a,0x16,0x24,0x34,
    0xe1,0x25,0xf1,0x17,0x18,0x19,0x1a,0x26,
    0x27,0x28,0x29,0x2a,0x35,0x36,0x37,0x38,
    0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,
    0x49,0x4a,0x53,0x54,0x55,0x56,0x57,0x58,
    0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,
    0x69,0x6a,0x73,0x74,0x75,0x76,0x77,0x78,
    0x79,0x7a,0x82,0x83,0x84,0x85,0x86,0x87,
    0x88,0x89,0x8a,0x92,0x93,0x94,0x95,0x96,
    0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,
    0xa6,0xa7,0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,
    0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,
    0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,0xca,0xd2,
    0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,
    0xe2,0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,
    0xea,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,
    0xf9,0xfa
  ];

  this.setQuantTables = function(inYTable, inUVTable) {
    if (!inYTable || !inUVTable || inYTable.length !== 64 || inUVTable.length !== 64) {
      throw new Error("setQuantTables expects two arrays of length 64");
    }

    for (var i = 0; i < 64; i++) {
      YTable[ZigZag[i]]  = inYTable[i];
      UVTable[ZigZag[i]] = inUVTable[i];
    }

    var aasf = [
      1.0,1.387039845,1.306562965,1.175875602,
      1.0,0.785694958,0.541196100,0.275899379
    ];
    var k=0;
    for(var row=0; row<8; row++){
      for(var col=0; col<8; col++){
        var indexZ = ZigZag[k];
        fdtbl_Y[indexZ]  = 1.0/(YTable[indexZ]  * aasf[row]*aasf[col]*8.0);
        fdtbl_UV[indexZ] = 1.0/(UVTable[indexZ] * aasf[row]*aasf[col]*8.0);
        k++;
      }
    }
  };

  this.setSubsamplingMode = function(mode) {
    switch (mode) {
      case '4:4:4':
        this.hSampleY=1; this.vSampleY=1;
        this.hSampleU=1; this.vSampleU=1;
        this.hSampleV=1; this.vSampleV=1;
        break;
      case '4:2:2':
        this.hSampleY=2; this.vSampleY=1;
        this.hSampleU=1; this.vSampleU=1;
        this.hSampleV=1; this.vSampleV=1;
        break;
      case '4:2:0':
        this.hSampleY=2; this.vSampleY=2;
        this.hSampleU=1; this.vSampleU=1;
        this.hSampleV=1; this.vSampleV=1;
        break;
      default:
        throw new Error("Unsupported subsampling mode: " + mode);
    }
    this.subsamplingMode = mode;
  };

  function computeHuffmanTbl(nrcodes, std_table){
    var codevalue = 0;
    var pos_in_table = 0;
    var HT = [];
    for(var k=1; k<=16; k++){
      for(var j=1; j<=nrcodes[k]; j++){
        HT[std_table[pos_in_table]] = [ codevalue, k ];
        pos_in_table++;
        codevalue++;
      }
      codevalue <<= 1;
    }
    return HT;
  }
  function initHuffmanTbl(){
    YDC_HT  = computeHuffmanTbl(std_dc_luminance_nrcodes,   std_dc_luminance_values);
    YAC_HT  = computeHuffmanTbl(std_ac_luminance_nrcodes,   std_ac_luminance_values);
    UVDC_HT = computeHuffmanTbl(std_dc_chrominance_nrcodes, std_dc_chrominance_values);
    UVAC_HT = computeHuffmanTbl(std_ac_chrominance_nrcodes, std_ac_chrominance_values);
  }

  function initCategoryNumber(){
    var nrlower=1;
    var nrupper=2;
    for(var cat=1; cat<=15; cat++){
      for(var nr=nrlower; nr<nrupper; nr++){
        category[32767+nr] = cat;
        bitcode[32767+nr]  = [ nr, cat ];
      }
      for(var nrneg=-(nrupper-1); nrneg<=-nrlower; nrneg++){
        category[32767+nrneg] = cat;
        bitcode[32767+nrneg]  = [ nrupper-1 + nrneg, cat ];
      }
      nrlower<<=1;
      nrupper<<=1;
    }
  }

  function initRGBYUVTable(){
    for(var i=0; i<256; i++){
      RGB_YUV_TABLE[i]        =  19595 * i;
      RGB_YUV_TABLE[i+ 256]   =  38470 * i;
      RGB_YUV_TABLE[i+ 512]   =   7471 * i + 0x8000; 
      RGB_YUV_TABLE[i+ 768]   = -11059 * i;
      RGB_YUV_TABLE[i+1024]   = -21709 * i;
      RGB_YUV_TABLE[i+1280]   =  32768 * i + 0x807FFF;
      RGB_YUV_TABLE[i+1536]   = -27439 * i;
      RGB_YUV_TABLE[i+1792]   = - 5329 * i;
    }
  }

  function initCharLookupTable(){
    for(var i=0;i<256;i++){
      clt[i] = String.fromCharCode(i);
    }
  }

  function init(){
    initHuffmanTbl();
    initCategoryNumber();
    initRGBYUVTable();
    initCharLookupTable();
  }
  init();

  this.initialEncode = function(imgData) {
    this.width      = imgData.width;
    this.height     = imgData.height;
    this.exifBuffer = imgData.exifBuffer || null;
    this.comments   = Array.isArray(imgData.comments) ? imgData.comments.slice() : [];

    var w = this.width;
    var h = this.height;
    var n = w*h;
    var rgba = imgData.data;

    this.Y = new Int16Array(n);
    this.U = new Int16Array(n);
    this.V = new Int16Array(n);

    var idx = 0;
    for(var i=0; i<n; i++){
      var r = rgba[idx++];
      var g = rgba[idx++];
      var b = rgba[idx++];
      idx++;

      var yy = ( RGB_YUV_TABLE[r] + 
                 RGB_YUV_TABLE[g+256] + 
                 RGB_YUV_TABLE[b+512] ) >> 16;
      var uu = ( RGB_YUV_TABLE[r+768] + 
                 RGB_YUV_TABLE[g+1024] + 
                 RGB_YUV_TABLE[b+1280] ) >> 16;
      var vv = ( RGB_YUV_TABLE[r+1280] + 
                 RGB_YUV_TABLE[g+1536] + 
                 RGB_YUV_TABLE[b+1792] ) >> 16;

      this.Y[i] = yy - 128;
      this.U[i] = uu - 128;
      this.V[i] = vv - 128;
    }
  };

  function writeBits(bs){
    var value = bs[0];
    var posval= bs[1]-1;
    while(posval >= 0){
      if(value & (1<<posval)){
        bytenew |= (1 << bytepos);
      }
      posval--;
      bytepos--;
      if(bytepos<0){
        if(bytenew == 0xFF){
          writeByte(0xFF);
          writeByte(0);
        } else {
          writeByte(bytenew);
        }
        bytepos=7; 
        bytenew=0;
      }
    }
  }
  function writeByte(value) {
    byteout.push(value);
  }
  function writeWord(value) {
    writeByte((value>>8)&0xFF);
    writeByte((value   )&0xFF);
  }

  function fDCTQuant(data, fdtbl){
    for(var i=0;i<8;i++){
      var row = 8*i;
      var d0 = data[row+0];
      var d1 = data[row+1];
      var d2 = data[row+2];
      var d3 = data[row+3];
      var d4 = data[row+4];
      var d5 = data[row+5];
      var d6 = data[row+6];
      var d7 = data[row+7];

      var tmp0 = d0 + d7;
      var tmp7 = d0 - d7;
      var tmp1 = d1 + d6;
      var tmp6 = d1 - d6;
      var tmp2 = d2 + d5;
      var tmp5 = d2 - d5;
      var tmp3 = d3 + d4;
      var tmp4 = d3 - d4;

      var tmp10 = tmp0 + tmp3;
      var tmp13 = tmp0 - tmp3;
      var tmp11 = tmp1 + tmp2;
      var tmp12 = tmp1 - tmp2;

      data[row+0] = tmp10 + tmp11;
      data[row+4] = tmp10 - tmp11;
      var z1 = (tmp12 + tmp13)*0.707106781;
      data[row+2] = tmp13 + z1;
      data[row+6] = tmp13 - z1;

      tmp10 = tmp4 + tmp5;
      tmp11 = tmp5 + tmp6;
      tmp12 = tmp6 + tmp7;

      var z5 = (tmp10 - tmp12)*0.382683433;
      var z2 = 0.541196100*tmp10 + z5;
      var z4 = 1.306562965*tmp12 + z5;
      var z3 = tmp11*0.707106781;

      var z11 = tmp7 + z3;
      var z13 = tmp7 - z3;

      data[row+5] = z13 + z2;
      data[row+3] = z13 - z2;
      data[row+1] = z11 + z4;
      data[row+7] = z11 - z4;
    }
    for(var col=0; col<8; col++){
      var c0 = data[col +  0];
      var c1 = data[col +  8];
      var c2 = data[col + 16];
      var c3 = data[col + 24];
      var c4 = data[col + 32];
      var c5 = data[col + 40];
      var c6 = data[col + 48];
      var c7 = data[col + 56];

      var tmp0p2 = c0 + c7;
      var tmp7p2 = c0 - c7;
      var tmp1p2 = c1 + c6;
      var tmp6p2 = c1 - c6;
      var tmp2p2 = c2 + c5;
      var tmp5p2 = c2 - c5;
      var tmp3p2 = c3 + c4;
      var tmp4p2 = c3 - c4;

      var tmp10p2 = tmp0p2 + tmp3p2;
      var tmp13p2 = tmp0p2 - tmp3p2;
      var tmp11p2 = tmp1p2 + tmp2p2;
      var tmp12p2 = tmp1p2 - tmp2p2;

      data[col+ 0] = tmp10p2 + tmp11p2;
      data[col+32] = tmp10p2 - tmp11p2;
      var z1p2 = (tmp12p2 + tmp13p2)*0.707106781;
      data[col+16] = tmp13p2 + z1p2;
      data[col+48] = tmp13p2 - z1p2;

      tmp10p2 = tmp4p2 + tmp5p2;
      tmp11p2 = tmp5p2 + tmp6p2;
      tmp12p2 = tmp6p2 + tmp7p2;

      var z5p2 = (tmp10p2 - tmp12p2)*0.382683433;
      var z2p2 = 0.541196100*tmp10p2 + z5p2;
      var z4p2 = 1.306562965*tmp12p2 + z5p2;
      var z3p2 = tmp11p2*0.707106781;

      var z11p2 = tmp7p2 + z3p2;
      var z13p2 = tmp7p2 - z3p2;

      data[col+40] = z13p2 + z2p2;
      data[col+24] = z13p2 - z2p2;
      data[col+ 8] = z11p2 + z4p2;
      data[col+56] = z11p2 - z4p2;
    }
    for(var i2=0; i2<64; i2++){
      var fq = data[i2]*fdtbl[i2];
      outputfDCTQuant[i2] = fq>0 ? (fq+0.5)|0 : (fq-0.5)|0;
    }
    return outputfDCTQuant;
  }

  function writeAPP0(){
    writeWord(0xFFD8);
    writeWord(0xFFE0);
    writeWord(16); 
    writeByte(0x4A); 
    writeByte(0x46); 
    writeByte(0x49); 
    writeByte(0x46); 
    writeByte(0);    
    writeByte(1);    
    writeByte(1);    
    writeByte(0);    
    writeWord(1);    
    writeWord(1);    
    writeByte(0);    
    writeByte(0);    
  }

  function writeAPP1(exifBuffer) {
    if(!exifBuffer) return;
    writeWord(0xFFE1); 
    
    if(exifBuffer[0]===0x45 && exifBuffer[1]===0x78 && 
       exifBuffer[2]===0x69 && exifBuffer[3]===0x66) {
      
      writeWord(exifBuffer.length + 2);
    } else {
      
      writeWord(exifBuffer.length + 5 + 2);
      writeByte(0x45); 
      writeByte(0x78); 
      writeByte(0x69); 
      writeByte(0x66); 
      writeByte(0);
    }
    for(var i=0;i<exifBuffer.length;i++){
      writeByte(exifBuffer[i]);
    }
  }

  function writeCOM(comments) {
    if(!comments || !comments.length) return;
    comments.forEach(function(c){
      if(typeof c !== 'string') return;
      writeWord(0xFFFE); 
      writeWord(c.length + 2);
      for(var i=0; i<c.length; i++){
        writeByte(c.charCodeAt(i));
      }
    });
  }

  function writeSOF0(width, height){
    writeWord(0xFFC0); 
    writeWord(17);     
    writeByte(8);      
    writeWord(height);
    writeWord(width);
    writeByte(3);      

    
    writeByte(1);
    writeByte((self.hSampleY<<4) + self.vSampleY);
    writeByte(0); 

    
    writeByte(2);
    writeByte((self.hSampleU<<4) + self.vSampleU);
    writeByte(1); 

    
    writeByte(3);
    writeByte((self.hSampleV<<4) + self.vSampleV);
    writeByte(1); 
  }

  function writeDQT(){
    
    writeWord(0xFFDB);
    writeWord(132);
    
    writeByte(0);  
    for(var i=0;i<64;i++){
      writeByte(YTable[i]);
    }
    
    writeByte(1); 
    for(var j=0;j<64;j++){
      writeByte(UVTable[j]);
    }
  }

  function writeDHT(){
    writeWord(0xFFC4);
    
    writeWord(0x01A2);

    
    writeByte(0);
    for(var i=0;i<16;i++){
      writeByte(std_dc_luminance_nrcodes[i+1]);
    }
    for(var j=0;j<=11;j++){
      writeByte(std_dc_luminance_values[j]);
    }
    
    writeByte(0x10);
    for(var k=0;k<16;k++){
      writeByte(std_ac_luminance_nrcodes[k+1]);
    }
    for(var l=0;l<=161;l++){
      writeByte(std_ac_luminance_values[l]);
    }

    
    writeByte(1);
    for(var m=0;m<16;m++){
      writeByte(std_dc_chrominance_nrcodes[m+1]);
    }
    for(var n=0;n<=11;n++){
      writeByte(std_dc_chrominance_values[n]);
    }

    
    writeByte(0x11);
    for(var o=0;o<16;o++){
      writeByte(std_ac_chrominance_nrcodes[o+1]);
    }
    for(var p=0;p<=161;p++){
      writeByte(std_ac_chrominance_values[p]);
    }
  }

  function writeSOS(){
    writeWord(0xFFDA);
    writeWord(12);
    writeByte(3); 
    
    writeByte(1);
    writeByte(0);
    
    writeByte(2);
    writeByte(0x11);
    
    writeByte(3);
    writeByte(0x11);
    writeByte(0);
    writeByte(0x3f);
    writeByte(0);
  }

  function processDU(CDU, fdtbl, DC, HTDC, HTAC){
    
    var DU_DCT = fDCTQuant(CDU, fdtbl);

    
    for(var j=0;j<64;j++){
      DU[ZigZag[j]] = DU_DCT[j];
    }
    
    var diff = DU[0] - DC; 
    DC = DU[0];
    if(diff === 0){
      
      var ht = HTDC[0];
      writeBits([ht[0], ht[1]]);
    } else {
      var pos = 32767 + diff;
      var ht = HTDC[ category[pos] ];
      writeBits([ht[0], ht[1]]);
      var bc = bitcode[pos];
      writeBits([bc[0], bc[1]]);
    }

    
    var end0pos = 63;
    while((end0pos>0) && (DU[end0pos]===0)) {
      end0pos--;
    }
    if(end0pos===0){
      
      var eob = HTAC[0x00];
      writeBits([eob[0], eob[1]]);
      return DC;
    }
    var i=1;
    while(i<=end0pos){
      var startpos=i;
      while((DU[i]===0) && (i<=end0pos)) {
        i++;
      }
      var nrzeroes = i - startpos;
      if(nrzeroes>=16){
        
        var lng = nrzeroes>>4;
        for(var nrmarker=1; nrmarker<=lng; nrmarker++){
          var m16zeroes = HTAC[0xF0];
          writeBits([m16zeroes[0], m16zeroes[1]]);
        }
        nrzeroes = nrzeroes & 0xF;
      }
      var pos = 32767 + DU[i];
      var ac = HTAC[(nrzeroes<<4) + category[pos]];
      writeBits([ac[0], ac[1]]);
      var bc2 = bitcode[pos];
      writeBits([bc2[0], bc2[1]]);
      i++;
    }
    if(end0pos!=63){
      
      var eob2 = HTAC[0x00];
      writeBits([eob2[0], eob2[1]]);
    }
    return DC;
  }

  function sampleBlock_444(plane, startX, startY, w, h, block){
    
    for(var pos=0; pos<64; pos++){
      var row = (pos >> 3);
      var col = (pos & 7);
      var x   = Math.min(startX + col, w-1);
      var y   = Math.min(startY + row, h-1);
      block[pos] = plane[y*w + x];
    }
  }

  function sampleBlock_422(plane, startX, startY, w, h, block){
    
    
    for(var pos=0; pos<64; pos++){
      var row = pos >> 3;
      var col = pos & 7;
      var sx  = (startX + (col<<1));
      var x   = Math.min(sx, w-1);
      var y   = Math.min(startY + row, h-1);
      block[pos] = plane[y*w + x];
    }
  }

  function sampleBlock_420(plane, startX, startY, w, h, block){
    
    
    for(var pos=0; pos<64; pos++){
      var row = pos >> 3;   
      var col = pos & 7;    
      var sx  = (col<<1);   
      var sy  = (row<<1);   
      var sum = 0;
      for(var rr=0; rr<2; rr++){
        for(var cc=0; cc<2; cc++){
          var x = Math.min(startX + sx + cc, w-1);
          var y = Math.min(startY + sy + rr, h-1);
          sum += plane[y*w + x];
        }
      }
      
      block[pos] = (sum>>2);
    }
  }

  this.reEncode = function(yTable, uvTable, subsamplingMode) {
    if(!this.Y || !this.U || !this.V) {
      throw new Error("Please call initialEncode(imgData) first!");
    }
    if(!yTable || !uvTable) {
      throw new Error("Must provide Y & UV quant tables (64 elements each).");
    }
    
    this.setQuantTables(yTable, uvTable);
    
    if(subsamplingMode) {
      this.setSubsamplingMode(subsamplingMode);
    }

    
    byteout = [];
    bytenew = 0;
    bytepos = 7;

    
    writeAPP0();
    writeCOM(this.comments);
    writeAPP1(this.exifBuffer);
    writeDQT();
    writeSOF0(this.width, this.height);
    writeDHT();
    writeSOS();

    
    var DCY=0, DCU=0, DCV=0;
    var w = this.width;
    var h = this.height;

    
    
    var MCUwidth  = 8 * self.hSampleY;
    var MCUheight = 8 * self.vSampleY;

    
    function sampleYBlock(x, y, blockIndex){
      
      
      
      if(self.subsamplingMode === '4:4:4'){
        
        sampleBlock_444(self.Y, x, y, w, h, YDU);
      } 
      else if(self.subsamplingMode === '4:2:2'){
        
        
        
        
        var offsetX = blockIndex<<3; 
        sampleBlock_444(self.Y, x+offsetX, y, w, h, YDU);
      }
      else if(self.subsamplingMode === '4:2:0'){
        var bx = (blockIndex & 1)<<3; 
        var by = (blockIndex > 1)? 8: 0;
        sampleBlock_444(self.Y, x+bx, y+by, w, h, YDU);
      }
    }

    
    function sampleUBlock(x, y){
      if(self.subsamplingMode === '4:4:4'){
        sampleBlock_444(self.U, x, y, w, h, UDU);
      } else if(self.subsamplingMode === '4:2:2'){
        sampleBlock_422(self.U, x, y, w, h, UDU);
      } else {
        
        sampleBlock_420(self.U, x, y, w, h, UDU);
      }
    }
    function sampleVBlock(x, y){
      if(self.subsamplingMode === '4:4:4'){
        sampleBlock_444(self.V, x, y, w, h, VDU);
      } else if(self.subsamplingMode === '4:2:2'){
        sampleBlock_422(self.V, x, y, w, h, VDU);
      } else {
        
        sampleBlock_420(self.V, x, y, w, h, VDU);
      }
    }

    
    for(var sy=0; sy<h; sy+=MCUheight){
      for(var sx=0; sx<w; sx+=MCUwidth){

        
        if(self.subsamplingMode === '4:4:4'){
          sampleYBlock(sx, sy, 0);
          DCY = processDU(YDU, fdtbl_Y, DCY, YDC_HT, YAC_HT);

          
          sampleUBlock(sx, sy);
          DCU = processDU(UDU, fdtbl_UV, DCU, UVDC_HT, UVAC_HT);
          
          sampleVBlock(sx, sy);
          DCV = processDU(VDU, fdtbl_UV, DCV, UVDC_HT, UVAC_HT);

        } else if(self.subsamplingMode === '4:2:2'){
          
          sampleYBlock(sx,   sy, 0);
          DCY = processDU(YDU, fdtbl_Y, DCY, YDC_HT, YAC_HT);

          sampleYBlock(sx,   sy, 1);
          DCY = processDU(YDU, fdtbl_Y, DCY, YDC_HT, YAC_HT);

          
          sampleUBlock(sx, sy);
          DCU = processDU(UDU, fdtbl_UV, DCU, UVDC_HT, UVAC_HT);
          
          sampleVBlock(sx, sy);
          DCV = processDU(VDU, fdtbl_UV, DCV, UVDC_HT, UVAC_HT);

        } else {
          
          
          for(var b=0;b<4;b++){
            sampleYBlock(sx, sy, b);
            DCY = processDU(YDU, fdtbl_Y, DCY, YDC_HT, YAC_HT);
          }
          sampleUBlock(sx, sy);
          DCU = processDU(UDU, fdtbl_UV, DCU, UVDC_HT, UVAC_HT);
          sampleVBlock(sx, sy);
          DCV = processDU(VDU, fdtbl_UV, DCV, UVDC_HT, UVAC_HT);
        }
      }
    }

    
    if(bytepos>=0){
      var fillbits = [(1<<(bytepos+1))-1, bytepos+1];
      writeBits(fillbits);
    }

    
    writeWord(0xFFD9);

    
    if(typeof module !== 'undefined' && module.exports){
      return Buffer.from(byteout);
    }
    return new Uint8Array(byteout);
  };

}


function initialEncode(imgData) {
  const encoder = new JPEGEncoder();
  encoder.initialEncode(imgData);
  return encoder;
}

function reEncode(encoder, yTable, uvTable, subsamplingMode) {
  const data = encoder.reEncode(yTable, uvTable, subsamplingMode);
  return {
    data,
    width:  encoder.width,
    height: encoder.height
  };
}

function encode(imgData, yTable, uvTable, subsamplingMode) {
  const encoder = new JPEGEncoder();
  encoder.initialEncode(imgData);
  const data = encoder.reEncode(yTable, uvTable, subsamplingMode);
  return { data, width: imgData.width, height: imgData.height };
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    JPEGEncoder, 
    initialEncode,
    reEncode,
    encode
  };
} else {
  window["jpeg-js"] = {
    JPEGEncoder,
    initialEncode,
    reEncode,
    encode
  };
}
